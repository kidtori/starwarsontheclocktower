const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const laya=require('./laya'),casting=require('./character-casting');
const protocol='character-role-fit-v1';
const directory=(root,id)=>require('./themes').directory(root,id);
const file=(root,id)=>path.join(directory(root,id),'laya-fits.json');
function fingerprint(c,r){return crypto.createHash('sha256').update(JSON.stringify({protocol,character:{id:c.id,summary:c.summary,profile:casting.profile(c),personality:c.personality,themes:c.themes,bridge:casting.bridge({botcRole:r},c)},role:{id:r.id,ability:r.ability,designRole:r.designRole}})).digest('hex');}
function read(root,id){const f=file(root,id);if(!fs.existsSync(f))return {themeId:id,protocol,characters:{}};const data=JSON.parse(fs.readFileSync(f,'utf8'));if(data.themeId!==id||data.protocol!==protocol||!data.characters)throw Error('Unrecognised saved theme assessments.');return data;}
function attach(kb,root){if(!kb.theme)return;const data=read(root,kb.theme.id);kb.theme.savedFits=0;for(const c of kb.characters){c.roleFits={};for(const r of kb.botc){const fit=data.characters[c.id]?.[r.id];if(fit&&fit.fingerprint===fingerprint(c,r)){c.roleFits[r.id]=fit;kb.theme.savedFits++;}}}}
function save(root,data){const dir=directory(root,data.themeId);fs.mkdirSync(dir,{recursive:true});const f=file(root,data.themeId);fs.writeFileSync(f+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(f+'.tmp',f);}
async function assess(kb,root,{characterIds,force=false,onProgress=()=>{},shouldStop=()=>false}={}){
 if(!laya.available(root))throw Error('Bulk theme assessment requires embedded Laya in the desktop app.');
 if(!kb.botc.length)throw Error('Enable owned BOTC sets before assessing character-role fits.');
 if(!kb.theme)throw Error('Create or select a theme first.');
 const ids=characterIds||casting.pool(kb.characters).map(c=>c.id);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!kb.characters.some(c=>c.id===id)))throw Error('Choose recognised characters from this theme.');
 const data=read(root,kb.theme.id),total=ids.length*kb.botc.length;let completed=0,computed=0;
 for(const id of ids){const c=kb.characters.find(c=>c.id===id),profile=casting.profile(c);data.characters[id]||={};
  for(const r of [...kb.botc].sort((a,b)=>['demon','minion','townsfolk','outsider'].indexOf(a.team)-['demon','minion','townsfolk','outsider'].indexOf(b.team))){
   if(shouldStop())return {completed,total,computed,stopped:true};
   const key=fingerprint(c,r);if(!force&&data.characters[id][r.id]?.fingerprint===key){completed++;continue;}
   const publish=value=>{onProgress(value);laya.progress(root,{kind:'theme-library',...value});};
   publish({message:`Assessing ${c.name} → ${r.name}`,completed,total,computed,characterName:c.name,roleName:r.name});
   const proposal=casting.bridge({botcRole:r},c)?.proposal||profile.metaphor;
   const options=[{id:'specific',description:'Coherent adaptation: the supplied story can represent the ability choices, information and costs.'},{id:'plausible',description:'Plausible creative analogy, but needs extra interpretation to represent the exact rule.'},{id:'weak',description:'Weak or unsupported: shared traits alone do not connect this story to the exact mechanic.'}];
   const tags=[...new Set([...(c.personality||[]),...(c.themes||[]),...(c.narrativeFunctions||[])])].slice(0,18).join(', ');
   const state=`Character: ${c.name}\nPortrait: ${profile.portrait.split(/\s+/).slice(0,65).join(' ')}\nTraits and narrative tags: ${tags}\nProposed analogy: ${proposal}\nFit limits: ${profile.caution}\nBOTC role: ${r.name}\nExact ability: ${r.ability}`;
   const ballots=[];for(const order of [options,[...options].reverse()]){const result=await laya.choose(root,state,order,'Assess this creative game adaptation using the supplied evidence. Do not require literal canonical powers. Select the best supported fit category.');if(!result||!options.some(o=>o.id===result.choice))throw Error('Laya could not assess this pairing. Completed pairings have been saved; run again to resume.');ballots.push(result);}
   const weights=Object.fromEntries(options.map(o=>[o.id,ballots.reduce((s,b)=>s+Number(b.probabilities?.[o.id]??(b.choice===o.id?1:0)),0)/2]));
   const truncated=ballots.some(b=>b.context?.truncated),disagreed=ballots[0].choice!==ballots[1].choice;
   const fit=truncated?'weak':Object.keys(weights).sort((a,b)=>weights[b]-weights[a]||options.findIndex(o=>o.id===b)-options.findIndex(o=>o.id===a))[0];
   data.characters[id][r.id]={fingerprint:key,roleId:r.id,characterId:id,fit,score:truncated?0:weights.specific+weights.plausible*0.5,uncertain:truncated||disagreed,explanation:proposal,limits:profile.caution,assessedAt:new Date().toISOString(),weights};
   save(root,data);completed++;computed++;
   publish({message:`Saved ${c.name} → ${r.name} · ${fit}${disagreed?' · order-sensitive':''}`,completed,total,computed,characterName:c.name,roleName:r.name,fit,explanation:proposal});
  }
 }
 return {completed,total,computed};
}
module.exports={attach,assess,read,fingerprint};
