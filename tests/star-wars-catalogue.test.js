const{test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const{load,norm}=require('../lib/knowledge');
const{createLegacy:create,regenerate,mutate}=require('../lib/engine');
const{seeds,buildCatalogue,parsePage}=require('../scripts/import-star-wars');
const root=path.join(__dirname,'..'),kb=load(root);
const seed=seeds(),sources=Object.fromEntries(seed.map(s=>[s.id,JSON.parse(fs.readFileSync(path.join(root,'sources','star-wars','2026-10-02',s.id+'.json'),'utf8'))]));
const request={mode:'create',title:'Catalogue verification',theme:'Sith manipulation, unreliable information and rebel sacrifice',tone:'paranoia',complexity:'medium',galacticRacerEmphasis:'none',demonsSith:true,size:{townsfolk:13,outsider:4,minion:4,demon:4}};
test('162 source-backed identities load with intact core provenance and distinct racing supplements',()=>{
 assert.deepEqual(kb.errors,[]);assert.deepEqual(kb.warnings,[]);assert.equal(kb.characters.length,162);assert.equal(kb.starWarsCatalogue.total,162);assert.equal(kb.racer.length,5);
 const seen=new Map();for(const c of kb.characters){assert(!c.fixture);assert(c.summary&&c.themes.length&&c.annotationStatus);assert.equal(!!c.galacticRacer,Object.hasOwn(require('../scripts/import-racing').gameRoles,c.id));for(const a of[c.id,c.name,...c.aliases]){const n=norm(a);assert(!seen.has(n)||seen.get(n)===c.id,a);seen.set(n,c.id);}for(const r of c.relationships){assert(kb.characters.some(x=>x.id===r.characterId));assert.equal(r.sources.length,2);}const canonical=c.sources.find(s=>s.type==='canonical');if(sources[c.id])assert.equal(canonical.url,sources[c.id].url);assert.match(canonical.sha256,/^[a-f0-9]{64}$/);assert.equal(canonical.accessedAt,'2026-10-02');}
 assert.equal(kb.characters.reduce((n,c)=>n+c.relationships.length,0),84);
});
test('offline rebuild preserves verified metadata and separates source facts from editorial ratings',()=>{
 const{records,report}=buildCatalogue(seed,sources);assert.equal(report.total,148);assert.equal(report.verifiedSources,149);assert(report.coverage.includes('Not an exhaustive'));
 for(const c of records){assert.deepEqual(c.source,[...new Set([sources[c.id],...(sources[c.id].variants||[])].flatMap(b=>b.appearances))]);assert.deepEqual(c.canonicalMetadata.affiliations,[...new Set([sources[c.id],...(sources[c.id].variants||[])].flatMap(b=>b.affiliations))]);assert(c.sources.some(s=>s.type==='design'));assert(c.sources.some(s=>s.type==='interpretation'));}
 assert.throws(()=>buildCatalogue(seed,{...sources,'leia-organa':null}),/Missing verified source/);
});
test('source parser refuses error pages and extracts only Databank metadata',()=>{
 assert.throws(()=>parsePage('<title>404</title>','https://www.starwars.com/databank/example'),/No Databank biography/);
 const p=parsePage('<title>Example | StarWars.com</title><p class="desc">Biography.</p><div class="heading">Affiliations</div><ul><li><div class="property-name">Rebel Alliance</div></li></ul>','https://www.starwars.com/databank/example');assert.deepEqual(p.affiliations,['Rebel Alliance']);assert.equal(p.title,'Example');assert.equal(p.description,undefined);
});
test('full 25-role cast works with four Sith Demons, required aliases and preserved identity locks',async()=>{
 const p=await create(kb,{...request,requiredCharacters:'Anakin Skywalker, Darth Vader, Leia, Ben Solo'},root);assert.equal(p.entries.length,25);assert.equal(new Set(p.entries.map(e=>e.starWarsIdentity.id)).size,25);assert(p.entries.some(e=>e.starWarsIdentity.id==='darth-vader'));assert(p.entries.some(e=>e.starWarsIdentity.id==='kylo-ren'));
 for(const e of p.entries.filter(e=>e.team==='demon'))assert(kb.characters.find(c=>c.id===e.starWarsIdentity.id).factions.includes('Sith'));
 const entry=p.entries.find(e=>e.starWarsIdentity.id==='leia-organa');const locked=mutate(kb,p,{type:'locks',roleId:entry.botcRole.id,botcRole:true,starWarsCharacter:true},root);const next=await regenerate(kb,locked,root);assert.equal(next.entries.find(e=>e.botcRole.id===entry.botcRole.id).starWarsIdentity.id,'leia-organa');assert.equal(new Set(next.entries.map(e=>e.starWarsIdentity.id)).size,25);
});
test('alternate identity exclusions block the merged person and conflicting requirements',async()=>{
 const p=await create(kb,{...request,avoid:'Anakin Skywalker, Ben Solo'},root);assert(!p.entries.some(e=>['darth-vader','kylo-ren'].includes(e.starWarsIdentity.id)));await assert.rejects(()=>create(kb,{...request,requiredCharacters:'Darth Vader',avoid:'Anakin Skywalker'},root),/also excluded/);
});
test('all 22 Trouble Brewing roles can be rethemed without changing the imported composition',async()=>{
 const ids=kb.botc.filter(r=>r.officialEdition==='tb').map(r=>r.id);const p=await create(kb,{...request,mode:'retheme',demonsSith:false,requiredCharacters:'Luke, Leia, Han Solo'},root,ids);assert.deepEqual(p.entries.map(e=>e.botcRole.id),ids);assert.equal(new Set(p.entries.map(e=>e.starWarsIdentity.id)).size,22);
});
