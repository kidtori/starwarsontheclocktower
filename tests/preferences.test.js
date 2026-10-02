const{test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{load,parseScript,retrieve}=require('../lib/knowledge');
const engine=require('../lib/engine');
const{validateSettings}=require('../lib/settings');
const root=path.join(__dirname,'..'),kb=load(root);
const request={mode:'create',title:'Preference verification',theme:'racing, sabotage and uncertain loyalties',complexity:'medium',galacticRacerEmphasis:'none',size:{townsfolk:2,outsider:0,minion:1,demon:1}};
function temp(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-preferences-'));fs.cpSync(path.join(root,'data'),path.join(dir,'data'),{recursive:true});return dir;}
function cleanup(dir){const actual=fs.realpathSync(dir);assert(actual.startsWith(fs.realpathSync(os.tmpdir())+path.sep+'studio-preferences-'));fs.rmSync(actual,{recursive:true,force:true});}
test('racing corpus distinguishes five confirmed game characters, twelve classic pods and film-only vehicle models',()=>{
 assert.deepEqual(kb.errors,[]);assert.deepEqual(kb.warnings,[]);assert.equal(kb.racer.length,5);assert.equal(kb.vehicles.length,12);assert.equal(kb.vehicles.filter(v=>v.confirmedGame).length,7);assert.equal(kb.characters.filter(c=>c.racingProfile?.disciplines.includes('podracing')).length,12);
 assert.deepEqual(kb.characters.filter(c=>c.galacticRacer).map(c=>c.id).sort(),['darius-pax','hibi','kestar-bool','sebulba','shade']);assert(!kb.characters.find(c=>c.id==='darth-vader').galacticRacer);assert(kb.characters.find(c=>c.id==='darth-vader').racingProfile.vehicleIds.includes('anakin-pod'));
 for(const c of kb.characters)for(const id of c.racingProfile?.vehicleIds||[])assert(kb.vehicles.some(v=>v.id===id));for(const v of kb.vehicles)assert(v.sources.every(s=>s.type==='canonical'&&s.url.startsWith('https://')&&s.sha256.length===64));
});
test('owned sets persist and filter browser data, exact imports, fuzzy suggestions, retrieval and generation',async()=>{
 const dir=temp();try{fs.writeFileSync(path.join(dir,'data','app-settings.json'),JSON.stringify({ownedEditions:['tb']}));const owned=load(dir);assert.equal(owned.botc.length,22);assert(owned.botc.every(r=>r.officialEdition==='tb'));assert.equal(owned.botcEditions.length,6);assert(owned.botcEditions.some(e=>e.id==='carousel'));assert(!owned.botc.some(r=>r.id==='widow'));assert.deepEqual(load(dir).settings.ownedEditions,['tb']);
 const parsed=parseScript('Empath\nWidow\nWido',owned);assert.deepEqual(parsed.roles,['empath']);assert.equal(parsed.unresolved.length,2);assert(!parsed.unresolved.flatMap(r=>r.suggestions).some(r=>r.id==='widow'));assert(!retrieve(owned,'Widow',{limit:1000}).some(r=>r.record.id==='widow'));
 const p=await engine.createLegacy(owned,request,dir);assert(p.entries.every(e=>owned.botc.some(r=>r.id===e.botcRole.id)));const candidates=engine.replacementOptions(owned,p,p.entries[0].botcRole.id,dir);assert(candidates.every(r=>owned.botc.some(c=>c.id===r.id)));
 await assert.rejects(()=>engine.createLegacy(owned,{...request,size:{townsfolk:13,outsider:4,minion:4,demon:4}},dir),/Insufficient demon/);
 fs.writeFileSync(path.join(dir,'data','app-settings.json'),JSON.stringify({ownedEditions:[]}));assert.equal(load(dir).botc.length,0);assert.equal(load(dir).botcReference.length,0);assert.equal(load(dir,{includeUnowned:true}).botc.length,138);
 }finally{cleanup(dir);}
});
test('invalid ownership settings never silently enable unowned sets',()=>{assert.throws(()=>validateSettings({ownedEditions:['unknown']},kb.botcEditions),/available collection/);assert.throws(()=>validateSettings({ownedEditions:'tb'},kb.botcEditions),/available collection/);assert.deepEqual(validateSettings({ownedEditions:[]},kb.botcEditions),{ownedEditions:[]});});
test('essential pool may exceed script capacity and uses only compatible priorities before fallback',async()=>{
 const essentials=['Shade','Hibi','Kestar Bool','Darius Pax','Sebulba','Anakin Skywalker','Gasgano'];const p=await engine.createLegacy(kb,{...request,essentialCharacters:essentials},root);assert.equal(p.entries.length,4);assert.equal(p.themeAnalysis.priority.selected.length,4);assert.equal(p.themeAnalysis.priority.omitted.length,3);assert.equal(new Set(p.entries.map(e=>e.starWarsIdentity.id)).size,4);
 const constrained=await engine.createLegacy(kb,{...request,essentialCharacters:['Shade','Hibi'],demonsSith:true},root);assert.equal(constrained.themeAnalysis.priority.selected.length,2);assert(constrained.entries.filter(e=>e.team==='demon').every(e=>kb.characters.find(c=>c.id===e.starWarsIdentity.id).factions.includes('Sith')));
});
test('hard minimum Racer count reserves only necessary slots ahead of an oversized non-game priority pool',async()=>{
 const essentials=kb.characters.filter(c=>!c.galacticRacer).slice(0,30).map(c=>c.id);const p=await engine.createLegacy(kb,{...request,essentialCharacters:essentials,minRacer:1,requiredCharacters:'Luke Skywalker'},root);assert.equal(p.themeAnalysis.racerCount,1);assert(p.entries.some(e=>e.starWarsIdentity.id==='luke-skywalker'));assert.equal(p.themeAnalysis.priority.selected.length,2);
 const all=await engine.createLegacy(kb,{...request,size:{townsfolk:3,outsider:1,minion:1,demon:1},minRacer:5,essentialCharacters:essentials},root);assert.equal(all.themeAnalysis.racerCount,5);assert.equal(all.entries.length,6);
});
test('excluded priorities are explained, aliases deduplicate, and hard requirements remain distinct',async()=>{
 const p=await engine.createLegacy(kb,{...request,essentialCharacters:['Anakin','Darth Vader','Shade','Hibi'],avoid:'Anakin Skywalker'},root);assert.equal(p.themeAnalysis.priority.omitted.length,1);assert.match(p.themeAnalysis.priority.omitted[0].reason,/Excluded/);assert.equal(p.themeAnalysis.priority.selected.length,2);
 await assert.rejects(()=>engine.createLegacy(kb,{...request,requiredCharacters:'Shade, Hibi, Kestar Bool, Darius Pax, Sebulba'},root),/More required characters/);
});
test('identity locks survive priority changes and priority metadata follows regeneration',async()=>{
 let p=await engine.createLegacy(kb,{...request,requiredCharacters:'Luke Skywalker'},root);const e=p.entries.find(e=>e.starWarsIdentity.id==='luke-skywalker');p=engine.mutate(kb,p,{type:'locks',roleId:e.botcRole.id,botcRole:true,starWarsCharacter:true},root);p=engine.mutate(kb,p,{type:'request',request:{requiredCharacters:'',essentialCharacters:['Shade','Hibi','Kestar Bool','Darius Pax','Sebulba']}},root);const next=await engine.regenerate(kb,p,root);assert.equal(next.entries.find(x=>x.botcRole.id===e.botcRole.id).starWarsIdentity.id,'luke-skywalker');assert.equal(next.themeAnalysis.priority.selected.length,3);
});
test('existing snapshots retain data but unavailable roles require restoring ownership before edits',async()=>{
 const p=await engine.createLegacy(kb,{...request,mode:'retheme'},root,['widow','empath','imp']);const dir=temp();try{fs.writeFileSync(path.join(dir,'data','app-settings.json'),JSON.stringify({ownedEditions:['tb']}));const filtered=load(dir);await assert.rejects(()=>engine.regenerate(filtered,p,dir),/outside your owned sets/);assert.throws(()=>engine.replacementOptions(filtered,p,'empath',dir),/My BOTC collection/);assert.equal(p.entries[0].botcRole.id,'widow');}finally{cleanup(dir);}
});
