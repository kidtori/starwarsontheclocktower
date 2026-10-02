const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load,validate,parseScript}=require('../lib/knowledge');
const {analyse}=require('../lib/engine');
const {buildCatalogue}=require('../scripts/import-botc');
const root=path.join(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const snapshot=path.join(root,'sources','botc','2026-10-02');
const official=read(path.join(snapshot,'official-roles.json'));
const tracker=read(path.join(snapshot,'tracker-payload.json'));
const jinxSource=read(path.join(snapshot,'official-jinxes.json'));
const annotations=read(path.join(root,'data','design','botc-annotations.json'));
const kb=load(root,{includeUnowned:true});
test('all 181 released records are valid with exact official abilities and no fixture markers',()=>{
  assert.deepEqual(kb.errors,[]);assert.deepEqual(kb.warnings,[]);
  const all=[...kb.botc,...kb.botcReference];assert.equal(all.length,181);assert.equal(new Set(all.map(r=>r.id)).size,181);assert.equal(kb.botc.length,138);assert.equal(kb.botcReference.length,43);
  for(const r of all){const source=official.find(o=>o.id===r.officialId);assert(source,r.name);assert.equal(r.name,source.name);assert.equal(r.team,source.team);assert.equal(r.ability,source.ability);assert(!r.fixture);assert.deepEqual(validate('botc',r),[]);assert(r.sources.some(s=>s.type==='canonical'));assert(r.sources.some(s=>s.type==='design'));}
});
test('Tracker coverage is complete; supplemental types and wording differences are reported',()=>{
  const {report}=buildCatalogue(official,tracker,jinxSource,annotations,'2026-10-02');
  assert.equal(report.trackerCount,156);assert.equal(report.officialOnly.length,25);assert.equal(report.wordingDifferences.length,9);assert.equal(report.jinxCount,131);assert.deepEqual(report.trackerMissingFromOfficial,[]);
  assert.deepEqual(report.counts,{townsfolk:69,outsider:23,minion:27,demon:19,traveller:18,fabled:14,loric:11});
});
test('all jinxes resolve, remain verbatim and are attached to both records',()=>{
  const all=[...kb.botc,...kb.botcReference];
  for(const owner of jinxSource)for(const j of owner.jinx){const a=all.find(r=>r.officialId===owner.id),b=all.find(r=>r.officialId===j.id);assert(a.jinxes.some(x=>x.characterId===b.id&&x.reason===j.reason));assert(b.jinxes.some(x=>x.characterId===a.id&&x.reason===j.reason));}
});
test('jinx warnings and the actual source rule appear in script analysis',()=>{
  const a=analyse(kb,[{botcRole:{id:'alchemist'}},{botcRole:{id:'widow'}},{botcRole:{id:'imp'}}],root);
  assert(a.warnings.some(w=>w.includes('Alchemist / Widow')&&w.includes('official jinx')));
  const rule=jinxSource.find(r=>r.id==='alchemist').jinx.find(j=>j.id==='widow').reason;
  assert(a.interactions.some(i=>i.endsWith(rule)));assert.equal(a.interactions.filter(i=>i.includes('[Jinx alchemist|widow]')).length,1);
});
test('Trouble Brewing TXT import resolves all 22 standard characters without changing composition',()=>{
  const roles=kb.botc.filter(r=>r.officialEdition==='tb');assert.equal(roles.length,22);
  const parsed=parseScript(roles.map(r=>r.name).join('\n'),kb);assert.deepEqual(parsed.unresolved,[]);assert.deepEqual(parsed.duplicates,[]);assert.equal(parsed.roles.length,22);assert.deepEqual(parsed.composition,{townsfolk:13,outsider:4,minion:4,demon:1});
});
test('Travellers, Fabled and Loric are recognised and preserved separately on import',()=>{
  const p=parseScript('Empath\nTRAVELLERS\nApprentice\nFABLED\nDjinn\nLORIC\nBootlegger',kb);
  assert.deepEqual(p.roles,['empath']);assert.equal(p.unresolved.length,0);assert.deepEqual(p.supplementalRoles,['apprentice','djinn','bootlegger']);
});
test('bespoke adjudication roles remain in the catalogue but are excluded from automatic generation',()=>{
  for(const id of ['amnesiac','atheist','wizard']){const r=kb.botc.find(r=>r.id===id);assert(r);assert.equal(r.generationEligible,false);assert(r.generationRestriction);}
  assert(kb.botc.every(r=>r.designRole.length&&Object.keys(r.mechanics).length));
  assert.equal(kb.botc.find(r=>r.id==='fortune-teller').abilityTextStatus,undefined);
  assert.equal(kb.botc.find(r=>r.id==='shugenja').mechanics.deathInteraction,undefined);
});
