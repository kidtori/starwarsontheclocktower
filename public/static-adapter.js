// This adapter is bundled only into the hosted, one-off builder.
const engine=require('./engine'),knowledge=require('./knowledge'),settings=require('./settings');
const projectFile=require('./project-markdown');
const {markdown}=require('./export'),{scriptText}=require('./script-text');
const initial=fetch('./corpus.json').then(r=>{if(!r.ok)throw Error('Character corpus could not be loaded.');return r.json();});
const projects=new Map(),themeLibraries=new Map();let base,kb;
function ownedCorpus(){kb=structuredClone(base);const owned=new Set(base.settings.ownedEditions);kb.botc=kb.botc.filter(r=>owned.has(settings.editionId(r)));kb.botcReference=kb.botcReference.filter(r=>owned.has(settings.editionId(r)));const ids=new Set([...kb.botc,...kb.botcReference].map(r=>r.id));for(const r of [...kb.botc,...kb.botcReference]){r.jinxes=(r.jinxes||[]).filter(j=>ids.has(j.characterId));if(r.interactions)for(const key of ['synergisesWith','conflictsWith','dangerousCombinations'])r.interactions[key]=(r.interactions[key]||[]).filter(id=>ids.has(id));}return kb;}
function current(id){const s=projects.get(id);if(!s)throw Error('Import your TXT or create a script to begin.');return {...structuredClone(s.history[s.cursor].snapshot),version:s.cursor+1,canUndo:s.cursor>0,canRedo:s.cursor<s.history.length-1,history:s.history.map((h,i)=>({version:i+1,note:h.note,state:h.snapshot.state,at:h.at})),archive:[]};}
function save(p,note){const old=projects.get(p.id)||{history:[],cursor:-1};const snapshot=structuredClone(p);for(const key of ['version','canUndo','canRedo','history','archive'])delete snapshot[key];old.history=old.history.slice(0,old.cursor+1);old.history.push({snapshot,note,at:new Date().toISOString()});old.cursor++;projects.set(p.id,old);return current(p.id);}
window.StaticApi=async(name,b={})=>{
 if(!base){base=await initial;for(const [id,characters]of Object.entries(base.themeLibraries||{}))themeLibraries.set(id,structuredClone(characters));if(base.theme)themeLibraries.set(base.theme.id,structuredClone(base.characters));ownedCorpus();}
 if(name==='bootstrap')return {kb,projects:[...projects.keys()].map(id=>{const p=current(id);return {id,title:p.title,state:p.state};}),modelStatus:'One-off web builder. Nothing is saved online. Export TXT before closing this page.'};
 if(name==='settings'){base.settings=settings.validateSettings(b,base.botcEditions);return {kb:ownedCorpus()};}
 if(name==='reload')return {kb:ownedCorpus()};
 if(name==='theme-create'){const name=String(b.name||'').trim();if(!name||name.length>80)throw Error('Give the theme a name (1–80 characters).');const id=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)||base.themes.some(t=>t.id===id))throw Error('Use a unique theme name.');const theme={id,name,description:String(b.description||'').slice(0,1000)};base.themes.push(theme);themeLibraries.set(id,[]);base.theme=theme;base.characters=[];return {kb:ownedCorpus()};}
 if(name==='theme-select'){if(base.theme)themeLibraries.set(base.theme.id,structuredClone(base.characters));const theme=b.themeId===null?null:base.themes.find(t=>t.id===b.themeId);if(!theme&&b.themeId!==null)throw Error('Choose an existing theme.');base.theme=theme;base.characters=structuredClone(themeLibraries.get(theme?.id)||[]);return {kb:ownedCorpus()};}
 if(name==='knowledge'){if(b.kind!=='character'||!base.theme)throw Error('Choose a theme before adding characters.');const records=Array.isArray(b.records)?b.records:[b.records],ids=new Set();for(const r of records){const errors=knowledge.validate('character',r);if(errors.length)throw Error(errors.join('; '));if(ids.has(r.id)||(!b.overwrite&&base.characters.some(c=>c.id===r.id)))throw Error('Duplicate character ID.');ids.add(r.id);}for(const r of records){const i=base.characters.findIndex(c=>c.id===r.id),record={...structuredClone(r),themeId:base.theme.id,kind:'character'};if(i<0)base.characters.push(record);else base.characters[i]=record;}themeLibraries.set(base.theme.id,structuredClone(base.characters));return {kb:ownedCorpus()};}
 if(name==='theme-fits-status')return {status:'unavailable',message:'Bulk Laya assessment is available in the desktop app.'};
 if(name==='theme-assess'||name==='theme-best')throw Error('Embedded Laya is available in the desktop app.');
 if(name==='parse')return knowledge.parseScript(String(b.text||''),kb);
 if(name==='import-md'){const data=projectFile.parseProjectMarkdown(String(b.text||''),kb);if(!data)throw Error('Missing Clocktower Markdown import block.');projects.clear();return save(await projectFile.importProjectMarkdown(kb,data,'',engine),'Imported Markdown');}
 if(name==='create'){projects.clear();return save(await engine.create(kb,b.request,'',b.roleIds,b.supplementalRoleIds),'Created mechanics');}
 if(name.startsWith('project/'))return engine.refresh(kb,current(name.slice(8)),'');
 const p=engine.refresh(kb,current(b.id),'');if(b.version!==undefined&&b.version!==p.version)throw Error('This script changed. Try again with the current revision.');
 if(name==='export')return markdown(p,b.options);
 if(name==='markdown')return projectFile.projectMarkdown(p);
 if(name==='text')return scriptText(p);
 if(name==='replacements')return engine.replacementOptions(kb,p,b.roleId,'');
 if(name==='action')return save(engine.mutate(kb,p,b.action,''),b.action.type);
 if(name==='redesign')return save(await engine.redesign(kb,p,b.request,''),'Applied mechanical preferences');
 if(name==='regenerate')return save(await engine.regenerate(kb,p,''),'Refreshed design / fits');
 if(name==='undo'||name==='redo'){const s=projects.get(p.id),cursor=s.cursor+(name==='undo'?-1:1);if(cursor<0||cursor>=s.history.length)throw Error('No revision in that direction.');s.cursor=cursor;return engine.refresh(kb,current(p.id),'');}
 if(name==='chat'){const reply=await engine.review(kb,p,b.query,b.selectedId,'');p.conversation.push({query:b.query,...reply,at:new Date().toISOString()});return {project:save(p,'Review question'),reply};}
 throw Error('Unsupported operation.');
};
