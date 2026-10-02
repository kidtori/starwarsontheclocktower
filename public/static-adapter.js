// This adapter is bundled only into the hosted, one-off builder.
const engine=require('./engine'),knowledge=require('./knowledge'),settings=require('./settings');
const {markdown}=require('./export'),{scriptText}=require('./script-text');
const initial=fetch('./corpus.json').then(r=>{if(!r.ok)throw Error('Character corpus could not be loaded.');return r.json();});
const projects=new Map();let base,kb;
function ownedCorpus(){kb=structuredClone(base);const owned=new Set(base.settings.ownedEditions);kb.botc=kb.botc.filter(r=>owned.has(settings.editionId(r)));kb.botcReference=kb.botcReference.filter(r=>owned.has(settings.editionId(r)));const ids=new Set([...kb.botc,...kb.botcReference].map(r=>r.id));for(const r of [...kb.botc,...kb.botcReference]){r.jinxes=(r.jinxes||[]).filter(j=>ids.has(j.characterId));if(r.interactions)for(const key of ['synergisesWith','conflictsWith','dangerousCombinations'])r.interactions[key]=(r.interactions[key]||[]).filter(id=>ids.has(id));}return kb;}
function current(id){const s=projects.get(id);if(!s)throw Error('Import your TXT or create a script to begin.');return {...structuredClone(s.history[s.cursor].snapshot),version:s.cursor+1,canUndo:s.cursor>0,canRedo:s.cursor<s.history.length-1,history:s.history.map((h,i)=>({version:i+1,note:h.note,state:h.snapshot.state,at:h.at})),archive:[]};}
function save(p,note){const old=projects.get(p.id)||{history:[],cursor:-1};const snapshot=structuredClone(p);for(const key of ['version','canUndo','canRedo','history','archive'])delete snapshot[key];old.history=old.history.slice(0,old.cursor+1);old.history.push({snapshot,note,at:new Date().toISOString()});old.cursor++;projects.set(p.id,old);return current(p.id);}
window.StaticApi=async(name,b={})=>{
 if(!base){base=await initial;ownedCorpus();}
 if(name==='bootstrap')return {kb,projects:[...projects.keys()].map(id=>{const p=current(id);return {id,title:p.title,state:p.state};}),modelStatus:'One-off web builder. Nothing is saved online. Export TXT before closing this page.'};
 if(name==='settings'){base.settings=settings.validateSettings(b,base.botcEditions);return {kb:ownedCorpus()};}
 if(name==='reload')return {kb:ownedCorpus()};
 if(name==='knowledge')throw Error('Edit the source repository to change the hosted corpus. Local JSON imports are available in the desktop app.');
 if(name==='parse')return knowledge.parseScript(String(b.text||''),kb);
 if(name==='create')return save(await engine.create(kb,b.request,'',b.roleIds,b.supplementalRoleIds),'Created mechanics');
 if(name.startsWith('project/'))return current(name.slice(8));
 const p=current(b.id);if(b.version!==undefined&&b.version!==p.version)throw Error('This script changed. Try again with the current revision.');
 if(name==='export')return markdown(p,b.options);
 if(name==='text')return scriptText(p);
 if(name==='replacements')return engine.replacementOptions(kb,p,b.roleId,'');
 if(name==='action')return save(engine.mutate(kb,p,b.action,''),b.action.type);
 if(name==='regenerate')return save(await engine.regenerate(kb,p,''),'Refreshed design / fits');
 if(name==='undo'||name==='redo'){const s=projects.get(p.id),cursor=s.cursor+(name==='undo'?-1:1);if(cursor<0||cursor>=s.history.length)throw Error('No revision in that direction.');s.cursor=cursor;return current(p.id);}
 if(name==='chat'){const reply=await engine.review(kb,p,b.query,b.selectedId,'');p.conversation.push({query:b.query,...reply,at:new Date().toISOString()});return {project:save(p,'Review question'),reply};}
 throw Error('Unsupported operation.');
};
