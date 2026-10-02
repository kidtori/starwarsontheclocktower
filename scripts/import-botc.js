// Explicit offline import of downloaded public source snapshots. Never called by the app.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validate,teams,referenceTeams}=require('../lib/knowledge');
const {atomic}=require('../lib/storage');
const root=path.join(__dirname,'..');
const urls={tracker:'https://botc-tracker.com/characters/',roles:'https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main/resources/data/roles.json',jinxes:'https://release.botc.app/resources/data/jinxes.json'};
const slug=name=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function buildCatalogue(official,tracker,jinxSource,annotations,date){
  const validTypes=[...teams,...referenceTeams];
  const roles=official.filter(r=>validTypes.includes(r.team));
  if(roles.length!==official.length)throw Error('Official feed contains an unsupported character type. Review before importing.');
  const idMap=new Map(roles.map(r=>[r.id,slug(r.name)]));
  if(idMap.size!==roles.length||new Set(idMap.values()).size!==roles.length)throw Error('Duplicate official IDs or normalised slugs.');
  const names=new Set(roles.map(r=>r.name));
  const missingTracker=tracker.characters.filter(r=>!names.has(r.name)).map(r=>r.name);
  if(missingTracker.length)throw Error('Tracker characters missing from official feed: '+missingTracker.join(', '));
  const annotationIds=new Set();
  for(const buckets of Object.values(annotations.groups))for(const ids of Object.values(buckets))for(const id of ids)annotationIds.add(id);
  for(const id of Object.keys(annotations.purposes))annotationIds.add(id);
  for(const pair of annotations.synergies)pair.forEach(id=>annotationIds.add(id));
  for(const id of annotationIds)if(!idMap.has(id))throw Error(`Design annotations contain an unknown official ID: ${id}`);
  const jinxes=[];
  for(const owner of jinxSource)for(const j of owner.jinx||[]){if(!idMap.has(owner.id)||!idMap.has(j.id))throw Error(`Jinx references an unknown ID: ${owner.id}/${j.id}`);jinxes.push({from:idMap.get(owner.id),to:idMap.get(j.id),reason:j.reason});}
  const differences=[];
  const editions={tb:'Trouble Brewing',bmr:'Bad Moon Rising',snv:'Sects & Violets',carousel:'Experimental',fabled:'Fabled',loric:'Loric'};
  const records=roles.map(role=>{
    const id=idMap.get(role.id),entry=tracker.characters.find(c=>c.name===role.name);
    if(entry&&entry.ability!==role.ability)differences.push({id,name:role.name,trackerAbility:entry.ability,officialAbility:role.ability,resolution:'Official feed wording retained; original tracker wording preserved in this report.'});
    const mechanics={};
    for(const [metric,buckets]of Object.entries(annotations.groups))for(const [strength,ids]of Object.entries(buckets))if(ids.includes(role.id))mechanics[metric]=Number(strength);
    const complexity=annotations.complexity.low.includes(role.id)?'low':annotations.complexity.high.includes(role.id)?'high':teams.includes(role.team)?'medium':undefined;
    const pairs=annotations.synergies.filter(p=>p.includes(role.id)).map(p=>idMap.get(p.find(x=>x!==role.id)));
    const ownJinxes=jinxes.filter(j=>j.from===id||j.to===id).map(j=>({characterId:j.from===id?j.to:j.from,reason:j.reason,sourceOwner:j.from,source:urls.jinxes}));
    const purpose=annotations.purposes[role.id]||(role.team==='traveller'?'Publicly known Traveller identity with independently assigned good or evil alignment; supplemental to the core script.':role.team==='fabled'?'Storyteller rule supporting accessibility or resolving a game-running issue.':'Optional Storyteller rule that changes the structure of the game.');
    const sources=[{type:'canonical',title:'The Pandemonium Institute: released character data',url:urls.roles,accessedAt:date},...(entry?[{type:'reference',title:'BotC Tracker character catalogue',url:urls.tracker,accessedAt:date,sourceId:entry.id}]:[]),{type:'design',description:'Initial editable editorial annotations in data/design/botc-annotations.json. Numeric signals and synergy judgements are not official ratings.'}];
    if(ownJinxes.length)sources.push({type:'canonical',title:'The Pandemonium Institute: official jinx rules',url:urls.jinxes,accessedAt:date});
    const record={id,name:role.name,officialId:role.id,aliases:role.id===id?[]:[role.id],team:role.team,edition:editions[role.edition]||entry?.edition||role.edition,officialEdition:role.edition,ability:role.ability,mechanics,tags:Object.keys(mechanics),designRole:[purpose],explanation:purpose,annotationStatus:'initial editorial draft',generationEligible:teams.includes(role.team)&&!annotations.generationExcluded.includes(role.id),referenceOnly:referenceTeams.includes(role.team),...(complexity?{complexity}:{}),setup:!!role.setup,nightInstructions:{firstNight:role.firstNightReminder||null,otherNights:role.otherNightReminder||null},interactions:{synergisesWith:[...new Set(pairs)],conflictsWith:[],dangerousCombinations:[],storytellerNotes:annotations.notes[role.id]||[]},requiresRoles:(annotations.requiresRoles[role.id]||[]).map(x=>idMap.get(x)),jinxes:ownJinxes,sources};
    if(role.id==='fortuneteller')record.informationDistortion={scope:'self',affectsRoleIds:[id],description:'The fixed red herring registers as a Demon to the Fortune Teller only.'};
    if(['recluse','spy'].includes(role.id))record.informationDistortion={scope:'others',description:'Optional character/alignment registration can affect relevant information abilities; inspect each test.'};
    if(role.id==='zombuul')record.informationDistortion={scope:'self',affectsRoleIds:[id],description:'Registration as dead is not a general evil-alignment registration exception.'};
    if(['amnesiac','atheist','wizard'].includes(role.id))record.generationRestriction='Reference and imported scripts supported. Automated generation excludes this role because it needs bespoke Storyteller adjudication or a nonstandard no-evil script.';
    const errors=validate('botc',record);if(errors.length)throw Error(`${role.name}: ${errors.join('; ')}`);
    return record;
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const counts=Object.fromEntries(validTypes.map(t=>[t,records.filter(r=>r.team===t).length]));
  return {records,report:{importedAt:date,total:records.length,scriptRoles:records.filter(r=>teams.includes(r.team)).length,referenceCharacters:records.filter(r=>referenceTeams.includes(r.team)).length,counts,trackerCount:tracker.characters.length,trackerMissingFromOfficial:missingTracker,officialOnly:records.filter(r=>!tracker.characters.some(c=>c.name===r.name)).map(r=>({id:r.id,name:r.name,team:r.team})),jinxCount:jinxes.length,wordingDifferences:differences,sources:urls,annotationStatus:annotations.status}};
}
function run(){
  const snapshot=path.join(root,'sources','botc','2026-10-02');
  const official=JSON.parse(fs.readFileSync(path.join(snapshot,'official-roles.json'),'utf8').replace(/^\uFEFF/,''));
  const tracker=JSON.parse(fs.readFileSync(path.join(snapshot,'tracker-payload.json'),'utf8').replace(/^\uFEFF/,''));
  const jinxes=JSON.parse(fs.readFileSync(path.join(snapshot,'official-jinxes.json'),'utf8').replace(/^\uFEFF/,''));
  const annotations=JSON.parse(fs.readFileSync(path.join(root,'data','design','botc-annotations.json'),'utf8'));
  const {records,report}=buildCatalogue(official,tracker,jinxes,annotations,'2026-10-02');
  const dir=path.join(root,'data','botc','characters');
  // Preserve any current records before replacing source fields or annotations.
  const backup=path.join(root,'backups','botc-before-import-'+Date.now());fs.mkdirSync(backup,{recursive:true});fs.cpSync(dir,path.join(backup,'characters'),{recursive:true});
  const written=[];
  for(const record of records){atomic(path.join(dir,record.id+'.json'),record);written.push(record.id);}
  report.backup=path.relative(root,backup);report.checksums=Object.fromEntries(['official-roles.json','tracker-payload.json','official-jinxes.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(snapshot,file))).digest('hex')]));
  atomic(path.join(root,'data','botc-catalogue.json'),report);
  console.log(JSON.stringify({total:report.total,counts:report.counts,jinxes:report.jinxCount,wordingDifferences:report.wordingDifferences.length,backup:report.backup},null,2));
}
if(require.main===module)run();
module.exports={buildCatalogue,slug};
