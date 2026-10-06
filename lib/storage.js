const fs=require('node:fs');
const path=require('node:path');
const {clone}=require('./engine');
function atomic(file,data) {const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n');fs.renameSync(tmp,file);}
class Store {
  constructor(root){this.root=path.join(root,'projects');fs.mkdirSync(this.root,{recursive:true});}
  dir(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid project ID.');return path.join(this.root,id);}
  read(id){return JSON.parse(fs.readFileSync(path.join(this.dir(id),'project.json'),'utf8'));}
  list(){return fs.readdirSync(this.root,{withFileTypes:true}).filter(e=>e.isDirectory()).flatMap(e=>{try{const s=this.read(e.name),p=s.history[s.cursor].snapshot;return [{id:p.id,title:p.title,state:p.state,version:s.cursor+1,updatedAt:s.history[s.cursor].at}];}catch{return [];}}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  current(id){const s=this.read(id);return {...clone(s.history[s.cursor].snapshot),version:s.cursor+1,canUndo:s.cursor>0,canRedo:s.cursor<s.history.length-1,history:s.history.map((h,i)=>({version:i+1,at:h.at,note:h.note,state:h.snapshot.state})),archive:s.archive?.map(x=>({at:x.at,note:x.note}))||[]};}
  save(p,note,expectedVersion){
    const dir=this.dir(p.id);fs.mkdirSync(dir,{recursive:true});let s={cursor:-1,history:[],archive:[]};
    if(fs.existsSync(path.join(dir,'project.json')))s=this.read(p.id);
    if(expectedVersion!==undefined&&expectedVersion!==s.cursor+1)throw Error('This project changed in another tab. Reopen it before applying your change.');
    const clean=clone(p);for(const k of ['history','version','canUndo','canRedo','archive'])delete clean[k];
    if(s.cursor<s.history.length-1)s.archive.push(...s.history.slice(s.cursor+1));
    s.history=s.history.slice(0,s.cursor+1);s.history.push({at:new Date().toISOString(),note,snapshot:clean});s.cursor=s.history.length-1;
    if(clean.state==='APPROVED')atomic(path.join(dir,'approved.json'),{version:s.cursor+1,...clean});
    this.writeViews(dir,s);atomic(path.join(dir,'project.json'),s);return this.current(p.id);
  }
  writeViews(dir,s){const p=s.history[s.cursor].snapshot;atomic(path.join(dir,'request.json'),p.request);atomic(path.join(dir,'script.json'),{state:p.state,stage:p.stage,supplementalRoles:p.supplementalRoles,entries:p.entries.map(e=>({botcRole:e.botcRole,team:e.team,ability:e.ability,locks:e.locks}))});atomic(path.join(dir,'mappings.json'),p.entries.map(e=>({botcRole:e.botcRole.id,identity:e.identity,rationale:e.thematicRationale})));atomic(path.join(dir,'analysis.json'),{mechanical:p.analysis,thematic:p.themeAnalysis,modelCritique:p.modelCritique});atomic(path.join(dir,'history.json'),s.history.map((h,i)=>({version:i+1,at:h.at,note:h.note,state:h.snapshot.state})));}
  move(id,direction,version){const s=this.read(id);if(version!==s.cursor+1)throw Error('Project version changed. Reopen it first.');const cursor=s.cursor+direction;if(cursor<0||cursor>=s.history.length)throw Error('No revision in that direction.');s.cursor=cursor;this.writeViews(this.dir(id),s);atomic(path.join(this.dir(id),'project.json'),s);return this.current(id);}
}
module.exports={Store,atomic};
