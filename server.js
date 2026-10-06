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
const themes=require('./lib/themes');
const themeFits=require('./lib/theme-fits');let themeJob=null,themeStop=false;
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
  if(req.method==='GET'&&url.pathname==='/api/theme-fits-status')return send(res,200,themeJob||{state:'idle'});
  if(req.method==='GET'&&url.pathname==='/api/bootstrap') {
    let status;try{const c=model.config(ROOT);status=laya.available(ROOT)?'Embedded Laya: local model weights, CPU inference, no external service.':c?`Language model: ${c.model}. Retrieved corpus is sent to ${new URL(c.endpoint).origin}.`:'Offline corpus rules. Configure config.local.json for language-model review.';}catch(e){status=e.message;}
    return send(res,200,{kb,projects:store.list(),modelStatus:status,layaAvailable:laya.available(ROOT)});
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/project/'))return send(res,200,engine.refresh(kb,engine.adopt(store.current(url.pathname.split('/').at(-1)),kb),ROOT));
  if(req.method==='POST'&&url.pathname.startsWith('/api/')) {
    const b=await body(req);const name=url.pathname.slice(5);
    if(name==='reload'){kb=knowledge.load(ROOT);return send(res,200,{kb});}
    if(name==='settings'){const value=settings.validateSettings(b,kb.botcEditions);atomic(path.join(ROOT,'data','app-settings.json'),value);kb=knowledge.load(ROOT);return send(res,200,{kb});}
    if(name==='theme-create'||name==='theme-select'){
      if(themeJob?.state==='running')throw Error('Stop the current assessment before switching themes.');
      if(name==='theme-create')themes.create(ROOT,b);else themes.select(ROOT,b.themeId||null);
      kb=knowledge.load(ROOT);return send(res,200,{kb});
    }
    if(name==='knowledge'){
      if(!['botc','character'].includes(b.kind))throw Error('Choose BOTC or theme characters.');
      if(b.kind==='character'&&!kb.theme)throw Error('Create or select a theme first.');
      const records=Array.isArray(b.records)?b.records:[b.records],seen=new Set();if(!records.length)throw Error('No records to import.');
      const errors=records.flatMap((r,i)=>{const errors=knowledge.validate(b.kind,r);if(seen.has(r?.id))errors.push('duplicate ID');seen.add(r?.id);return errors.map(e=>'Record '+(i+1)+': '+e);});if(errors.length)throw Error(errors.join('\n'));
      const complete=b.kind==='botc'?knowledge.load(ROOT,{includeUnowned:true}):kb,area=b.kind==='botc'?[...complete.botc,...complete.botcReference]:kb.characters;
      const dir=b.kind==='botc'?path.join(ROOT,'data','botc','characters'):path.join(themes.directory(ROOT,kb.theme.id),'characters');
      if(records.some(r=>area.some(c=>c.id===r.id)&&!b.overwrite))throw Error('Enable overwrite to replace an existing ID.');
      const writes=new Map();for(const record of records){const existing=area.find(c=>c.id===record.id),file=existing?path.join(ROOT,existing._file):path.join(dir,record.id+'.json');const old=writes.has(file)?writes.get(file):fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;if(Array.isArray(old)){const i=old.findIndex(c=>c.id===record.id);if(i>=0)old[i]=record;else old.push(record);writes.set(file,old);}else writes.set(file,record);}
      fs.mkdirSync(dir,{recursive:true});for(const [file,records]of writes)atomic(file,records);kb=knowledge.load(ROOT);return send(res,200,{kb});
    }
    assertCorpus();
    if(name==='theme-assess-stop'){themeStop=true;return send(res,200,{message:'Stopping after the current pairing; completed fits remain saved.'});}
    if(name==='theme-assess'){
      if(!laya.available(ROOT))throw Error('Embedded Laya is required to assess the theme library.');
      if(themeJob?.state==='running')throw Error('A theme assessment is already running.');
      if(!Array.isArray(b.characterIds)||!b.characterIds.length||new Set(b.characterIds).size!==b.characterIds.length||b.characterIds.some(id=>!kb.characters.some(c=>c.id===id)))throw Error('Choose recognised characters from the selected theme.');
      themeStop=false;themeJob={themeId:kb.theme?.id,state:'running',message:'Starting saved theme assessment…',completed:0,total:0};
      const snapshot=kb;
      themeFits.assess(snapshot,ROOT,{characterIds:b.characterIds,force:!!b.force,shouldStop:()=>themeStop,onProgress:value=>{themeJob={themeId:snapshot.theme?.id,state:'running',...value};}}).then(result=>{kb=knowledge.load(ROOT);themeJob={themeId:snapshot.theme?.id,state:result.stopped?'stopped':'complete',message:result.stopped?'Stopped. Completed fits are saved; run again to resume.':'Theme fits saved.',...result};}).catch(e=>{kb=knowledge.load(ROOT);themeJob={...themeJob,state:'error',message:e.message};});
      return send(res,200,themeJob);
    }
    if(name==='import-md'){const data=projectFile.parseProjectMarkdown(String(b.text||''),kb);if(!data)throw Error('This Markdown file has no Clocktower import block.');return send(res,200,store.save(await projectFile.importProjectMarkdown(kb,data,ROOT,engine),'Imported Markdown'));}
    if(name==='parse')return send(res,200,knowledge.parseScript(String(b.text||''),kb));
    if(name==='create'){const p=await engine.create(kb,b.request,ROOT,b.roleIds,b.supplementalRoleIds);return send(res,200,store.save(p,'Created '+b.request.mode+' project'));}
    const p=engine.refresh(kb,engine.adopt(store.current(b.id),kb),ROOT);
    if(name==='markdown'){if(b.version!==p.version)throw Error('Script changed.');return send(res,200,projectFile.projectMarkdown(p));}
    if(name==='text'){if(b.version!==p.version)throw Error('Reopen the current project first.');return send(res,200,scriptText(p));}
    if(name==='export') {
      if(b.version!==p.version)throw Error('Reopen the current project before export.');
      const text=markdown(p,b.options);res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="'+p.title.replace(/[^a-z0-9-]/gi,'-')+'.md"','Cache-Control':'no-store'});return res.end(text);
    }
    if(name==='undo'||name==='redo')return send(res,200,engine.refresh(kb,engine.adopt(store.move(p.id,name==='undo'?-1:1,b.version),kb),ROOT));
    if(name==='replacements')return send(res,200,engine.replacementOptions(kb,p,b.roleId,ROOT));
    if(b.version!==p.version)throw Error('Project changed in another tab. Reopen it first.');
    if(name==='action'){const next=engine.mutate(kb,p,b.action,ROOT);return send(res,200,store.save(next,b.note||describe(b.action),b.version));}
    if(name==='theme-best'){if(themeJob?.state==='running')throw Error('The library assessment is still using Laya. Saved fits remain available; use Find best fit after it finishes.');const next=await engine.bestThemeFit(kb,p,b.roleId,ROOT);return send(res,200,store.save(next,'Found best fit for the current cast',b.version));}
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
function describe(a){return a.type==='mapping'?`Changed ${a.roleId} identity to ${a.characterId}`:a.type==='role'?`Explicit mechanical replacement ${a.roleId} → ${a.newRoleId}`:a.type==='swap'?`Swapped identities on ${a.roleId} and ${a.otherRoleId}`:a.type==='locks'?`Updated ${a.roleId} locks: BOTC ${a.botcRole}, identity ${a.character}`:a.type==='approve'?'Explicitly approved current script':a.type;}
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
