const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const engine=require('../lib/engine');const laya=require('../lib/laya');const casting=require('../lib/character-casting');const {load}=require('../lib/knowledge');
const root=path.join(__dirname,'..'),kb=load(root,{includeUnowned:true});
async function script(request={}){let p=await engine.create(kb,{mode:'retheme',...request},root,['village-idiot','imp']);return engine.mutate(kb,p,{type:'begin-retheme'},root);}
function mock(t,choose){const original={available:laya.available,choose:laya.choose};t.after(()=>Object.assign(laya,original));laya.available=()=>true;laya.choose=choose;}
test('popular pool has 49 detailed portraits, all five Racers, explicit exceptions and a full-catalogue option',()=>{
 const pool=casting.pool(kb.characters);assert.equal(pool.length,49);assert.equal(pool.filter(c=>c.galacticRacer).length,5);assert(pool.every(c=>c.castingProfile&&c.castingProfile.portrait.length>150&&c.castingProfile.caution&&c.castingProfile.sources.length));assert(!pool.some(c=>c.id==='brasso'));
 assert.equal(casting.pool(kb.characters,{characterPool:'all'}).length,162);
 const exceptions=casting.pool(kb.characters,{essentialCharacters:'Brasso'},[{starWarsIdentity:{id:'dedra-meero'}}]);assert(exceptions.some(c=>c.id==='brasso'));assert(exceptions.some(c=>c.id==='dedra-meero'));
 assert(kb.characters.find(c=>c.id==='poe-dameron').castingProfile.caution.includes('Village Idiot'));
});
test('uncertain fit does not promote a winner and supplies both full portraits with the exact ability',async t=>{
 let state;mock(t,async(_root,input,options)=>{state=input;assert.equal(options.length,2);return {choice:options[1].id,confidence:0.0001,probabilities:Object.fromEntries(options.map(o=>[o.id,0.5]))};});
 const p=await script({essentialCharacters:['Poe Dameron','Han Solo'],tone:'Playful intrigue'}),before=p.entries[0].candidates.map(c=>c.id);const result=await engine.layaFit(kb,p,'village-idiot',root),e=result.entries[0];
 assert(state.includes(p.entries[0].ability));assert(state.includes('Recklessness alone does not justify Village Idiot'));assert(state.includes('Improvisation'));assert(state.includes('Playful intrigue'));assert.equal(e.layaComparison.status,'uncertain');assert.equal(e.layaRecommendation,null);assert.deepEqual(e.candidates.map(c=>c.id),before);assert.equal(e.starWarsIdentity,null);
});
test('distinct preferences can promote a suggestion without assigning it; changes to the cast invalidate it',async t=>{
 mock(t,async(_root,_state,options)=>({choice:options[1].id,confidence:0.5,probabilities:{[options[0].id]:0.05,[options[1].id]:0.95}}));
 let p=await script({essentialCharacters:['Poe Dameron','Han Solo']});const original=p.entries.map(e=>[e.botcRole.id,e.ability]);p=await engine.layaFit(kb,p,'village-idiot',root);const e=p.entries[0];assert.equal(e.layaComparison.status,'clear');assert.equal(e.candidates[0].id,e.layaRecommendation.choice);assert.equal(e.starWarsIdentity,null);
 const refresh=engine.refresh(kb,structuredClone(p),root);assert.equal(refresh.entries[0].candidates[0].id,e.layaRecommendation.choice);
 const changed=engine.mutate(kb,p,{type:'mapping',roleId:'imp',characterId:e.layaRecommendation.choice},root);assert.equal(changed.entries[0].layaRecommendation,undefined);assert.deepEqual(changed.entries.map(e=>[e.botcRole.id,e.ability]),original);
});
test('a tied comparison anywhere in the four-character bracket prevents a global recommendation',async t=>{
 let calls=0;mock(t,async(_root,_state,options)=>{calls++;return {choice:options[0].id,confidence:calls===1?0:0.5,probabilities:{[options[0].id]:calls===1?0.5:0.95,[options[1].id]:calls===1?0.5:0.05}};});
 const p=await script(),result=await engine.layaFit(kb,p,'village-idiot',root);assert.equal(calls,3);assert.equal(result.entries[0].layaRecommendation,null);assert.equal(result.entries[0].layaComparison.rounds.length,3);
});
test('input truncation prevents a recommendation even when the reported preference is strong',async t=>{
 mock(t,async(_root,_state,options)=>({choice:options[0].id,confidence:0.8,probabilities:{[options[0].id]:0.99,[options[1].id]:0.01},context:{truncated:true}}));
 const result=await engine.layaFit(kb,await script(),'village-idiot',root);assert.equal(result.entries[0].layaRecommendation,null);assert(result.entries[0].layaComparison.rounds.every(r=>r.status==='uncertain'));
});
test('selected obscure identities survive the default pool, including Markdown round trips',async()=>{
 const {projectMarkdown,parseProjectMarkdown,importProjectMarkdown}=require('../lib/project-markdown');let p=await script();p=engine.mutate(kb,p,{type:'mapping',roleId:'village-idiot',characterId:'brasso'},root);const restored=await importProjectMarkdown(kb,parseProjectMarkdown(projectMarkdown(p),kb),root,engine);assert.equal(restored.entries[0].starWarsIdentity.id,'brasso');assert(casting.pool(kb.characters,restored.request,restored.entries).some(c=>c.id==='brasso'));assert.deepEqual(restored.entries.map(e=>e.ability),p.entries.map(e=>e.ability));
});
