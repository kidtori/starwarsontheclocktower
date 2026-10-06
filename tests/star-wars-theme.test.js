const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {load}=require('../lib/knowledge'),engine=require('../lib/engine');
const root=path.join(__dirname,'..'),kb=load(root,{includeUnowned:true,themeId:'star-wars'});
test('celebration library has fifty sourced identities and six optional game references',()=>{
 assert.deepEqual(kb.errors,[]);assert.equal(kb.characters.length,50);
 assert.equal(new Set(kb.characters.map(c=>c.id)).size,50);
 assert.deepEqual(['good','evil','mixed'].map(a=>kb.characters.filter(c=>c.alignment.includes(a)).length),[26,16,8]);
 assert.deepEqual(kb.characters.filter(c=>c.celebrationReference).map(c=>c.id).sort(),[...kb.theme.priorityCharacterIds].sort());
 let bridges=0;
 for(const c of kb.characters){assert(c.summary.split(/\s+/).length>=25,c.name);for(const key of ['portrait','metaphor','caution'])assert(c.castingProfile[key],c.name+' '+key);assert(c.sources.some(s=>/^https:\/\//.test(s.url||'')),c.name);assert.equal(Object.keys(c.roleFits).length,0);for(const [id,b] of Object.entries(c.castingBridges)){assert(kb.botc.some(r=>r.id===id),id);assert.match(b.annotation,/Editorial/);bridges++;}for(const r of c.relationships)assert(kb.characters.some(other=>other.id===r.characterId));}
 assert.equal(bridges,56);assert(kb.characters.find(c=>c.id==='darth-vader').aliases.includes('Anakin Skywalker'));
});
test('game celebration priorities never add mechanics or force all six identities',async()=>{
 const roles=['empath','imp'];const p=await engine.create(kb,{mode:'retheme'},root,roles);
 assert.deepEqual(p.entries.map(e=>e.botcRole.id),roles);assert.deepEqual(p.request.essentialCharacters,kb.theme.priorityCharacterIds);assert(p.entries.every(e=>e.identity===null));
 const themed=engine.mutate(kb,p,{type:'begin-retheme'},root);assert.equal(themed.entries.length,2);assert(themed.entries.every(e=>e.identity===null));
 const cleared=await engine.create(kb,{mode:'retheme',essentialCharacters:[]},root,roles);assert.deepEqual(cleared.request.essentialCharacters,[]);
 const picked=engine.mutate(kb,themed,{type:'mapping',roleId:'imp',characterId:'kestar-bool'},root);assert.equal(picked.entries.find(e=>e.botcRole.id==='imp').identity.id,'kestar-bool');assert.deepEqual(picked.entries.map(e=>e.ability),p.entries.map(e=>e.ability));
});
