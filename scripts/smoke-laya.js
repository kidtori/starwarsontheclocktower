const assert=require('node:assert/strict');const path=require('node:path');
const laya=require('../lib/laya');const engine=require('../lib/engine');const {load}=require('../lib/knowledge');
const root=path.join(__dirname,'..');
(async()=>{
 assert(laya.available(root),'Prepare the embedded Laya runtime first.');
 const unicode=await laya.choose(root,{brief:'Wishes '+String.fromCharCode(0xD800)},[{id:'wish',description:'Wish granting'},{id:'poison',description:'Poisoning'}],'Choose the matching mechanic.');assert(unicode.choice);
 const kb=load(root,{includeUnowned:true});
 const p=await engine.create(kb,{mode:'create',title:'Embedded wish smoke',complexity:'high',mechanicalBrief:'Wizard wishes with alchemist wishes, plague doctor for storyteller wishes and other ways to make wishes.',size:{townsfolk:2,outsider:1,minion:2,demon:1}},root);
 for(const id of ['wizard','alchemist','plague-doctor'])assert(p.entries.some(e=>e.botcRole.id===id));
 assert(p.designTrace.length&&p.designTrace.every(x=>x.laya&&x.chosen.id===x.laya.choice));
 const review=await engine.review(kb,p,'How do these wishes work?', 'wizard',root);assert.equal(review.engine,'embedded Laya + corpus review');
 const themed=engine.mutate(kb,p,{type:'begin-retheme'},root);
 const compared=await engine.layaFit(kb,themed,'wizard',root);const entry=compared.entries.find(e=>e.botcRole.id==='wizard');assert(entry.layaRecommendation);assert.equal(entry.starWarsIdentity,null);assert.equal(entry.candidates[0].id,entry.layaRecommendation.choice);
 assert.deepEqual(compared.entries.map(e=>[e.botcRole.id,e.ability]),p.entries.map(e=>[e.botcRole.id,e.ability]));
 console.log(JSON.stringify({engine:review.engine,roles:p.entries.map(e=>e.botcRole.name),decisions:p.designTrace.length,wizardCharacter:entry.layaRecommendation.name,confidence:entry.layaRecommendation.confidence}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>laya.close());
