const fs = require('node:fs');
const path = require('node:path');
const settings=require('./settings');
const teams = ['townsfolk', 'outsider', 'minion', 'demon'];
const referenceTeams = ['traveller','fabled','loric'];
const norm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = s => new Set(norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2));
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : e.name.endsWith('.json') ? [path.join(dir,e.name)] : []);
}
function validate(kind, r) {
  const errors = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) return ['record must be an object'];
  const id = r.id;
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) errors.push('id/characterId must be a lowercase slug');
  if ((typeof r.name !== 'string' || !r.name.trim())) errors.push('name is required');
  if (kind === 'botc') {
    if (![...teams,...referenceTeams].includes(r.team)) errors.push('team must be a recognised BOTC character type');
    if (typeof r.ability !== 'string' || !r.ability.trim()) errors.push('original ability is required');
    if (r.complexity && !['low','medium','high'].includes(r.complexity)) errors.push('complexity must be low, medium or high');
    if (!r.mechanics || typeof r.mechanics !== 'object' || Array.isArray(r.mechanics)) errors.push('mechanics must be an object');
    else for (const [k,v] of Object.entries(r.mechanics)) if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 3) errors.push(`mechanics.${k} must be a number between 0 and 3`);
    for (const k of ['synergisesWith','conflictsWith','dangerousCombinations','storytellerNotes']) if (r.interactions?.[k] !== undefined && (!Array.isArray(r.interactions[k]) || r.interactions[k].some(x=>typeof x!=='string'))) errors.push(`interactions.${k} must be a string array`);
  }
  for (const k of ['aliases','tags','designRole','source','era','factions','alignment','archetypes','personality','themes','gameplayAssociations','gameplayIdentity','behaviours','narrativeFunctions','abilitiesOrTraits','strengths','weaknesses','motivations','racingStyle','roleInGame','rivalries','allies','playerPerception','reputation','socialImpact','storyImpact']) {
    if (r[k] !== undefined && (!Array.isArray(r[k]) || r[k].some(x=>typeof x!=='string'))) errors.push(`${k} must be an array of strings`);
  }
  if (r.importance !== undefined) {
    if (!r.importance || typeof r.importance !== 'object' || Array.isArray(r.importance)) errors.push('importance must be an object');
    else for (const [k,v] of Object.entries(r.importance)) if (typeof v !== 'number' || !Number.isFinite(v) || v<0 || v>3) errors.push(`importance.${k} must be 0–3`);
  }
  if (r.sources !== undefined && (!Array.isArray(r.sources) || r.sources.some(s=> !s || !['canonical','interpretation','design','internal','reference','user','fixture'].includes(s.type)))) errors.push('sources must have a supported type: canonical, interpretation, design, internal, reference, user or fixture');
  if (r.relationships !== undefined && (!Array.isArray(r.relationships) || r.relationships.some(x=>typeof x.characterId!=='string'||typeof x.type!=='string'))) errors.push('relationships require characterId and type');
  if (r.informationDistortion !== undefined && (!r.informationDistortion || !['self','others'].includes(r.informationDistortion.scope) || (r.informationDistortion.affectsRoleIds !== undefined && (!Array.isArray(r.informationDistortion.affectsRoleIds) || r.informationDistortion.affectsRoleIds.some(x=>typeof x!=='string'))))) errors.push('informationDistortion needs scope self/others and optional affectsRoleIds array');
  if(r.jinxes!==undefined&&(!Array.isArray(r.jinxes)||r.jinxes.some(j=>!j||typeof j.characterId!=='string'||typeof j.reason!=='string')))errors.push('jinxes must contain characterId and reason strings');
  return errors;
}
function load(root,{includeUnowned=false,themeId}={}) {
  const themes=require('./themes'),available=themes.list(root),active=themeId===undefined?themes.selected(root,available):available.find(t=>t.id===themeId)||null;
  const kb={botc:[],botcReference:[],characters:[],lore:[],errors:[],warnings:[],themes:available,theme:active?{...active,savedFits:0}:null};
  const areas=[['botc','botc',path.join(root,'data','botc')],...(active?[['character','characters',path.join(themes.directory(root,active.id),'characters')]]:[])];
  for(const [kind,key,dir] of areas)for(const file of files(dir))try{
    const parsed=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
    for(const r of Array.isArray(parsed)?parsed:[parsed]){
      const errors=validate(kind,r);if(errors.length){kb.errors.push({file:path.relative(root,file),errors});continue;}
      if([...kb[key],...(kind==='botc'?kb.botcReference:[])].some(x=>x.id===r.id)){kb.errors.push({file:path.relative(root,file),errors:['duplicate ID: '+r.id]});continue;}
      const destination=kind==='botc'&&referenceTeams.includes(r.team)?'botcReference':key;
      kb[destination].push({...r,...(kind==='character'?{themeId:active.id}:{}),_file:path.relative(root,file)});
    }
  }catch(e){kb.errors.push({file:path.relative(root,file),errors:[e.message]});}
  for(const c of kb.characters)for(const rel of c.relationships||[])if(!kb.characters.some(x=>x.id===rel.characterId))kb.warnings.push(c.name+': relationship references missing character '+rel.characterId);
  for (const r of kb.botc)for(const key of ['synergisesWith','conflictsWith','dangerousCombinations'])for(const id of r.interactions?.[key]||[])if(!kb.botc.some(x=>x.id===id))kb.warnings.push(`${r.name}: ${key} references missing BOTC record ${id}.`);
  const manifest=path.join(root,'data','botc-catalogue.json');
  if(fs.existsSync(manifest))try{kb.botcCatalogue=JSON.parse(fs.readFileSync(manifest,'utf8'));}catch(e){kb.errors.push({file:manifest,errors:[e.message]});}
  kb.botcEditions=settings.inventory([...kb.botc,...kb.botcReference]);
  try{kb.settings=settings.read(root,kb.botcEditions);}catch(e){kb.errors.push({file:'data/app-settings.json',errors:[e.message]});kb.settings={ownedEditions:[]};}
  const owned=r=>kb.settings.ownedEditions.includes(settings.editionId(r));
  if(!includeUnowned){kb.botc=kb.botc.filter(owned);kb.botcReference=kb.botcReference.filter(owned);}
  // Keep disabled roles out of ranking, retrieval, TXT suggestions and browser data.
  const allowedIds=new Set([...kb.botc,...kb.botcReference].map(r=>r.id));
  for(const r of [...kb.botc,...kb.botcReference]){
    r.jinxes=(r.jinxes||[]).filter(j=>allowedIds.has(j.characterId));
    if(r.interactions)for(const key of ['synergisesWith','conflictsWith','dangerousCombinations'])r.interactions[key]=(r.interactions[key]||[]).filter(id=>allowedIds.has(id));
  }
  if(kb.theme)try{require('./theme-fits').attach(kb,root);}catch(e){kb.errors.push({file:'theme assessments',errors:[e.message]});}
  return kb;
}
function retrieve(kb, query, {roleIds=[], characterIds=[], limit=16}={}) {
  const q = tokens(query);
  const pool = [...kb.botc.map(r=>({kind:'botc',record:r})),...(kb.botcReference||[]).map(r=>({kind:'botc-reference',record:r})),...kb.characters.map(r=>({kind:'character',record:r}))];
  return pool.map(x=>({...x,score:[...tokens(JSON.stringify(x.record))].filter(w=>q.has(w)).length + (roleIds.includes(x.record.id)||characterIds.includes(x.record.id)?1000:0)})).sort((a,b)=>b.score-a.score).slice(0,limit);
}
function editDistance(a,b) {
  let row = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) {const next=[i]; for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]!==b[j-1])); row=next;} return row[b.length];
}
function parseScript(text,kb) {
  const roles=[], supplementalRoles=[], unresolved=[],duplicates=[],mappings=[];
  for (const [i,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()) {
    let line=raw.replace(/\s+(?:#|\/\/).*$/,'').trim();
    const saved=line.match(/^# Mapping: ([a-z0-9-]+)=([a-z0-9-]+)$/);if(saved&&kb.botc.some(r=>r.id===saved[1])&&kb.characters.some(c=>c.id===saved[2]))mappings.push({roleId:saved[1],characterId:saved[2]});
    if (!line || /^(#|\/\/|;)/.test(line)) continue;
    line=line.replace(/^[-*•]\s*/,'').replace(/^\d+\s*[.)\-:]\s*/,'').replace(/\s*:\s*$/,'').trim();
    if (/^(townsfolk|outsiders?|minions?|demons?|travellers?|travelers?|fabled|loric|characters|roles|script)$/i.test(line)) continue;
    const reference=(kb.botcReference||[]).find(r=>norm(r.name)===norm(line)||norm(r.id)===norm(line)||(r.aliases||[]).some(a=>norm(a)===norm(line)));
    if(reference){if(supplementalRoles.includes(reference.id))duplicates.push({line:i+1,input:raw,roleId:reference.id});else supplementalRoles.push(reference.id);continue;}
    const matches = kb.botc.filter(r=>norm(r.name)===norm(line)||norm(r.id)===norm(line)||(r.aliases||[]).some(a=>norm(a)===norm(line)));
    if(matches.length>1){unresolved.push({line:i+1,input:line,suggestions:matches.map(r=>({id:r.id,name:r.name,distance:0})),ambiguous:true});continue;}
    const r = matches[0];
    if(r) {if(roles.includes(r.id))duplicates.push({line:i+1,input:raw,roleId:r.id}); else roles.push(r.id);}
    else unresolved.push({line:i+1,input:line,suggestions:kb.botc.map(r=>({id:r.id,name:r.name,distance:editDistance(norm(line),norm(r.name))})).sort((a,b)=>a.distance-b.distance).filter(r=>r.distance<=Math.max(3,line.length*.35)).slice(0,3)});
  }
  return {roles,supplementalRoles,mappings:mappings.filter(m=>roles.includes(m.roleId)),unresolved,duplicates,composition:Object.fromEntries(teams.map(t=>[t,roles.filter(id=>kb.botc.find(r=>r.id===id).team===t).length]))};
}
module.exports = {teams,referenceTeams,norm,tokens,validate,load,retrieve,parseScript};
