const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '..', 'prisma', 'schema-mismatch-report.txt');
if (!fs.existsSync(reportPath)) {
  console.error('Report not found:', reportPath);
  process.exit(1);
}
const report = fs.readFileSync(reportPath, 'utf8');
const entries = [];
const lines = report.split(/\r?\n/);
let i = 0;
while (i < lines.length) {
  const l = lines[i];
  if (l.startsWith('File: ')) {
    const file = l.replace('File: ', '').trim();
    const modelLine = lines[i+1] || '';
    const opLine = lines[i+2] || '';
    const probLine = lines[i+3] || '';
    const fieldsLine = lines[i+4] || '';
    const fields = fieldsLine.replace('Fields:','').trim().split(',').map(s=>s.trim()).filter(Boolean);
    entries.push({file, model: modelLine.replace('Model:','').trim(), op: opLine.replace('Operation:','').trim(), problem: probLine.replace('Problem:','').trim(), fields});
    i += 5;
  } else i++;
}

function backup(file) {
  const bak = file + '.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
}

function removeFieldsFromObject(src, fieldNames) {
  // remove lines like "  fieldName: something," at top-level of object
  const lines = src.split(/\r?\n/);
  const out = [];
  for (let ln of lines) {
    let skip = false;
    for (const f of fieldNames) {
      const re = new RegExp('^\\s*' + f.replace(/[-\\/\\^$*+?.()|[\]{}]/g,'\\$&') + '\\s*:\\s*');
      if (re.test(ln)) { skip = true; break; }
    }
    if (!skip) out.push(ln);
  }
  return out.join('\n');
}

function patchFile(file, fields) {
  if (!fs.existsSync(file)) return false;
  backup(file);
  let txt = fs.readFileSync(file, 'utf8');
  // find occurrences of create: { ... }, update: { ... }, upsert({ ... })
  const patterns = ['create:', 'update:'];
  for (const pat of patterns) {
    let idx = 0;
    while ((idx = txt.indexOf(pat, idx)) !== -1) {
      // find opening brace after pat
      const braceIdx = txt.indexOf('{', idx + pat.length);
      if (braceIdx === -1) break;
      // find matching closing brace
      let i = braceIdx;
      let depth = 0;
      let end = -1;
      for (; i < txt.length; i++) {
        const ch = txt[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end === -1) break;
      const objSrc = txt.slice(braceIdx, end+1);
      const newObj = removeFieldsFromObject(objSrc, fields);
      txt = txt.slice(0, braceIdx) + newObj + txt.slice(end+1);
      idx = braceIdx + newObj.length;
    }
  }
  fs.writeFileSync(file, txt, 'utf8');
  return true;
}

const changed = new Set();
for (const e of entries) {
  if (!e.fields || e.fields.length === 0) continue;
  try {
    const ok = patchFile(e.file, e.fields);
    if (ok) changed.add(e.file);
  } catch (err) {
    console.error('Failed to patch', e.file, err.message);
  }
}

console.log('Patched files count:', changed.size);
for (const f of changed) console.log('Patched:', f);
