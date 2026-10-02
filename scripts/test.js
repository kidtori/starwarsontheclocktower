const {spawnSync}=require('node:child_process');
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
const files=fs.readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.js')).map(f=>'tests/'+f);
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',env:{...process.env,STUDIO_LAYA_DISABLED:'1'}});
process.exit(result.status??1);
