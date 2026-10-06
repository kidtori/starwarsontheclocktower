const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const knowledge=require('./lib/knowledge');
const engine=require('./lib/engine');
const model=require('./lib/model');
const laya=require('./lib/laya');
const {atomic}=require('./lib/storage');
const {SessionStore}=require('./lib/session-store');
const projectFile=require('./lib/project-markdown');
const {markdown}=require('./lib/export');
const {scriptText}=require('./lib/script-text');
const settings=require('./lib/settings');
const ROOT=process.env.STUDIO_ROOT||__dirname;
let kb=knowledge.load(ROOT);const store=new SessionStore();
let queue=Promise.resolve();
const port=Number(process.env.PORT||3210);
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(Buffer.byteLength(s)>5*1024*1024)throw Error('Request exceeds 5 MB.');}return JSON.parse(s||'{}');}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function assertCorpus(){if(kb.errors.length)throw Error('Fix knowledge-base validation errors before editing projects. Open Knowledge to inspect them.');}
async function route(req,res) {
  const url=new URL(req.url,'http://localhost');
  // Loopback binding plus Host/Origin checks prevent remote websites writing to the local app.
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send(res,403,{error:'Invalid local host.'});
  if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return send(res,403,{error:'Cross-origin access refused.'});
  if(req.method==='GET'&&url.pathname==='/api/progress')return send(res,200,laya.getProgress());
  if(req.method==='GET'&&url.pathname==='/api/bootstrap') {
    let status;try{const c=model.config(ROOT);status=laya.available(ROOT)?'Embedded Laya: local model weights, CPU inference, no external service.':c?`Language model: ${c.model}. Retrieved corpus is sent to ${new URL(c.endpoint).origin}.`:'Offline corpus rules. Configure config.local.json for language-model review.';}catch(e){status=e.message;}
    return send(res,200,{kb,projects:store.list(),modelStatus:status,layaAvailable:laya.available(ROOT)});
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/project/'))return send(res,200,engine.adopt(store.current(url.pathname.split('/').at(-1)),kb));
  if(req.method==='POST'&&url.pathname.startsWith('/api/')) {
    const b=await body(req);const name=url.pathname.slice(5);
    if(name==='reload'){kb=knowledge.load(ROOT);return send(res,200,{kb});}
    if(name==='settings'){const value=settings.validateSettings(b,kb.botcEditions);atomic(path.join(ROOT,'data','app-settings.json'),value);kb=knowledge.load(ROOT);return send(res,200,{kb});}
    if(name==='knowledge') {
      if(!['botc','star-wars','galactic-racer'].includes(b.kind))throw Error('Choose a supported knowledge area.');
      const records=Array.isArray(b.records)?b.records:[b.records];if(!records.length)throw Error('No records to import.');
      const seen=new Set();const errors=records.flatMap((r,i)=>{const errs=knowledge.validate(b.kind,r),id=r?.id||r?.characterId;if(seen.has(id))errs.push('duplicate ID in batch');seen.add(id);return errs.map(e=>`Record ${i+1}: ${e}`);});
      if(errors.length)throw Error(errors.join('\n'));
      const dir=path.join(ROOT,'data',b.kind,'characters');fs.mkdirSync(dir,{recursive:true});
      const complete=b.kind==='botc'?knowledge.load(ROOT,{includeUnowned:true}):kb;
      const areaRecords=b.kind==='botc'?[...complete.botc,...complete.botcReference]:b.kind==='star-wars'?kb.characters:kb.racer;
      for(const r of records){const id=r.id||r.characterId;const existing=areaRecords.find(x=>(x.id||x.characterId)===id);if(existing&&!b.overwrite)throw Error(`${id} already exists. Enable explicit overwrite to replace knowledge records.`);}
      const writes=new Map();
      for(const r of records){const id=r.id||r.characterId;const existing=areaRecords.find(x=>(x.id||x.characterId)===id);const file=existing?path.join(ROOT,existing._file):path.join(dir,id+'.json');
        const previous=writes.has(file)?writes.get(file):fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):null;
        if(Array.isArray(previous)){const idx=previous.findIndex(x=>(x.id||x.characterId)===id);if(idx>=0)previous[idx]=r;else previous.push(r);writes.set(file,previous);}else writes.set(file,r);
      }
      for(const[file,records]of writes)atomic(file,records);
      kb=knowledge.load(ROOT);return send(res,200,{kb});
    }
    assertCorpus();
    if(name==='import-md'){const data=projectFile.parseProjectMarkdown(String(b.text||''),kb);if(!data)throw Error('This Markdown file has no Clocktower import block.');return send(res,200,store.save(await projectFile.importProjectMarkdown(kb,data,ROOT,engine),'Imported Markdown'));}
    if(name==='parse')return send(res,200,knowledge.parseScript(String(b.text||''),kb));
    if(name==='create'){const p=await engine.create(kb,b.request,ROOT,b.roleIds,b.supplementalRoleIds);return send(res,200,store.save(p,'Created '+b.request.mode+' project'));}
    const p=engine.adopt(store.current(b.id),kb);
    if(name==='markdown'){if(b.version!==p.version)throw Error('Script changed.');return send(res,200,projectFile.projectMarkdown(p));}
    if(name==='text'){if(b.version!==p.version)throw Error('Reopen the current project first.');return send(res,200,scriptText(p));}
    if(name==='export') {
      if(b.version!==p.version)throw Error('Reopen the current project before export.');
      const text=markdown(p,b.options);res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="'+p.title.replace(/[^a-z0-9-]/gi,'-')+'.md"','Cache-Control':'no-store'});return res.end(text);
    }
    if(name==='undo'||name==='redo')return send(res,200,engine.adopt(store.move(p.id,name==='undo'?-1:1,b.version),kb));
    if(name==='replacements')return send(res,200,engine.replacementOptions(kb,p,b.roleId,ROOT));
    if(b.version!==p.version)throw Error('Project changed in another tab. Reopen it first.');
    if(name==='action'){let next=engine.mutate(kb,p,b.action,ROOT);if(b.action.type==='begin-retheme'&&laya.available(ROOT)&&next.entries.length)next=await engine.layaFit(kb,next,['demon','minion','townsfolk','outsider'].flatMap(t=>next.entries.filter(e=>e.team===t))[0].botcRole.id,ROOT);return send(res,200,store.save(next,b.note||describe(b.action),b.version));}
    if(name==='redesign'){const next=await engine.redesign(kb,p,b.request,ROOT);return send(res,200,store.save(next,'Applied mechanical preferences and rebuilt unlocked roles',b.version));}
    if(name==='laya-fit'){const next=await engine.layaFit(kb,p,b.roleId,ROOT);return send(res,200,store.save(next,'Laya compared character fits',b.version));}
    if(name==='regenerate'){const next=await engine.regenerate(kb,p,ROOT);return send(res,200,store.save(next,'Regenerated around locks; '+(p.request.mode==='retheme'?'preserved imported composition':'updated mechanical design or candidate fits'),b.version));}
    if(name==='chat'){const reply=await engine.review(kb,p,String(b.query||''),b.selectedId,ROOT);p.conversation.push({query:b.query,...reply,at:new Date().toISOString()});return send(res,200,{project:store.save(p,'Review question: '+String(b.query).slice(0,100),b.version),reply});}
    throw Error('Unknown API operation.');
  }
  if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
  const names={'/':'index.html','/app.js':'app.js','/connections.js':'connections.js','/casting.js':'casting.js','/styles.css':'styles.css'};const file=names[url.pathname];if(!file)return send(res,404,{error:'Not found.'});
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(__dirname,'public',file)));
}
function describe(a){return a.type==='mapping'?`Changed ${a.roleId} identity to ${a.characterId}`:a.type==='role'?`Explicit mechanical replacement ${a.roleId} → ${a.newRoleId}`:a.type==='swap'?`Swapped identities on ${a.roleId} and ${a.otherRoleId}`:a.type==='locks'?`Updated ${a.roleId} locks: BOTC ${a.botcRole}, identity ${a.starWarsCharacter}`:a.type==='approve'?'Explicitly approved current script':a.type;}
const server=http.createServer((req,res)=>{const run=()=>route(req,res).catch(e=>send(res,400,{error:e.message}));if(req.method==='POST'){queue=queue.then(run,run);}else run();});
function openBrowser(){
  const url=`http://127.0.0.1:${port}`;
  if(process.platform!=='win32'){console.log(`Open ${url} in your browser.`);return;}
  const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  require('node:child_process').execFile(powershell,['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference = 'Stop'; Start-Process -FilePath '${url}'`],{windowsHide:true},error=>{
    if(error)console.error(`Windows could not open your browser automatically. Open ${url} manually. ${error.message}`);
    else console.log(`Opened ${url} in your default browser.`);
  });
}
server.on('error',async e=>{
  if(e.code==='EADDRINUSE'&&process.argv.includes('--open')){
    try{const existing=await (await fetch(`http://127.0.0.1:${port}/api/bootstrap`,{signal:AbortSignal.timeout(2000)})).json();if(existing.kb?.botc&&existing.modelStatus){console.log('Clocktower Studio is already running. Opening it.');openBrowser();return;}}catch{}
  }
  console.error(`Could not start Clocktower Studio: ${e.message}`);process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>{console.log(`Clocktower Studio: http://127.0.0.1:${port}\nData: ${ROOT}\nOffline by default; no knowledge leaves this computer without model configuration.`);if(process.argv.includes('--open'))openBrowser();});
