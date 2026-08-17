const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const root = path.join(__dirname, '..');

function parseSchema(schema) {
  const models = {};
  const lines = schema.split('\n');
  let current = null;
  for (const line of lines) {
    const m = line.match(/^model\s+(\w+)\s+\{/);
    if (m) {
      current = m[1];
      // Prisma client exposes models in lowerCamel (first letter lowercased)
      const clientName = current[0].toLowerCase() + current.slice(1);
      models[clientName] = new Set();
      continue;
    }
    if (!current) continue;
    if (line.match(/^\}/)) { current = null; continue; }
    const f = line.trim().split(/\s+/)[0];
    if (f && !f.startsWith('//') && !f.startsWith('@@')) {
      // skip attributes like @@unique
      if (f.includes('(') || f.startsWith('@')) continue;
      models[current ? (current[0].toLowerCase() + current.slice(1)) : current].add(f);
    }
  }
  return models;
}

function walk(dir, filelist=[]) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      if (['node_modules','.git','prisma','dist'].includes(f)) return;
      walk(fp, filelist);
    } else {
      if (fp.endsWith('.js') || fp.endsWith('.ts') || fp.endsWith('.mjs')) filelist.push(fp);
    }
  });
  return filelist;
}

function extractObjectFields(text, startIndex) {
  // find the create:/update: object starting at startIndex
  const sub = text.slice(startIndex);
  const objStart = sub.indexOf('{');
  if (objStart === -1) return [];
  let i = objStart;
  let depth = 0;
  const fields = new Set();
  for (; i < sub.length; i++) {
    const ch = sub[i];
    if (ch === '{') { depth++; i++; break; }
  }
  let key = '';
  let inKey = true;
  let token = '';
  for (; i < sub.length; i++) {
    const ch = sub[i];
    if (depth === 0) break;
    if (ch === '{') { depth++; inKey = true; token = ''; continue; }
    if (ch === '}') { depth--; inKey = true; token = ''; continue; }
    if (depth === 1) {
      // top-level fields
      // capture property names like \n  fieldName: 
      const rest = sub.slice(i);
      const m = rest.match(/^[\s\r\n]*([A-Za-z0-9_]+)\s*:/);
      if (m) {
        fields.add(m[1]);
        i += m.index + m[0].length - 1;
        continue;
      }
    }
  }
  return Array.from(fields);
}

function findMatchingParen(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

(async () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const models = parseSchema(schema);
  const files = walk(root);
  const report = [];

  const usageRegex = /(prisma|tx)\.([a-zA-Z0-9_]+)\.(create|update|upsert)\s*\(/g;

  for (const file of files) {
    const txt = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = usageRegex.exec(txt)) !== null) {
      const model = m[2];
      const op = m[3];
      const idx = m.index + m[0].length;
      // find the full call body by matching parentheses so we only inspect this call
      const openPos = idx - 1; // position of the '('
      const closePos = findMatchingParen(txt, openPos);
      const callSlice = closePos === -1 ? txt.slice(idx) : txt.slice(openPos + 1, closePos);
      // prefer to look inside `data: { create: { ... } }` or direct `create: {}`
      const dataIdx = callSlice.indexOf('data:');
      const searchBase = dataIdx !== -1 ? callSlice.slice(dataIdx) : callSlice;
      const createIdx = searchBase.indexOf('create:');
      const updateIdx = searchBase.indexOf('update:');
      const fields = new Set();
      if (createIdx !== -1) {
        const f = extractObjectFields(searchBase, createIdx);
        f.forEach(x => fields.add(x));
      }
      if (updateIdx !== -1) {
        const f = extractObjectFields(searchBase, updateIdx);
        f.forEach(x => fields.add(x));
      }
      // Note: do not scan a huge window for create/update — use only the call's own arguments

      if (!models[model]) {
        report.push({file, model, op, problem: 'model-not-in-schema', fields: Array.from(fields)});
      } else {
        const missing = [];
        for (const fld of fields) {
          if (!models[model].has(fld)) missing.push(fld);
        }
        if (missing.length) report.push({file, model, op, problem: 'missing-fields', fields: missing});
      }
    }
  }

  if (report.length === 0) {
    console.log('No mismatches found for create/update/upsert usage against server/prisma/schema.prisma');
    process.exit(0);
  }
  console.log('Schema mismatches report:');
  report.forEach(r => {
    console.log('\nFile:', r.file);
    console.log('Model:', r.model);
    console.log('Operation:', r.op);
    console.log('Problem:', r.problem);
    console.log('Fields:', r.fields.join(', '));
  });
})();
