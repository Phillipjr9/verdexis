const fs = require('fs');
const path = require('path');
const reportPath = path.join(__dirname, '..', 'prisma', 'schema-mismatch-report.txt');
if (!fs.existsSync(reportPath)) { console.error('report missing'); process.exit(1); }
const txt = fs.readFileSync(reportPath,'utf8');
const lines = txt.split(/\r?\n/);
const entries = [];
for (let i=0;i<lines.length;i++){
  if (lines[i].startsWith('File: ')){
    const file = lines[i].slice(6).trim();
    const fieldsLine = (lines[i+4]||'').replace('Fields:','').trim();
    const fields = fieldsLine.split(',').map(s=>s.trim()).filter(Boolean);
    if (fields.length) entries.push({file,fields});
  }
}
function backup(file){ const bak=file+'.bak'; if(!fs.existsSync(bak)) fs.copyFileSync(file,bak); }
let patched=new Set();
for(const e of entries){
  if (!fs.existsSync(e.file)) continue;
  backup(e.file);
  let content = fs.readFileSync(e.file,'utf8');
  const orig = content;
  const lines = content.split(/\r?\n/);
  const out = lines.filter(line => {
    for (const f of e.fields) {
      if (!f) continue;
      const re = new RegExp('\\b' + f + '\\s*:\\s*');
      if (re.test(line)) return false;
    }
    return true;
  });
  content = out.join('\n');
  if (content !== orig) {
    fs.writeFileSync(e.file, content,'utf8');
    patched.add(e.file);
  }
}
console.log('Strict patched count:', patched.size);
for(const p of patched) console.log('Patched:', p);
