const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const engine=require('../lib/engine');const {load}=require('../lib/knowledge');const laya=require('../lib/laya');
const root=path.join(__dirname,'..'),kb=load(root,{includeUnowned:true});
const request={mode:'create',complexity:'high',mechanicalBrief:'Wizard wishes with alchemist wishes, plague doctor for storyteller wishes and other ways to make wishes.',size:{townsfolk:2,outsider:1,minion:2,demon:1}};
test('the wish brief retains Wizard, Alchemist and Plague Doctor, including the bespoke caution',async()=>{
 const p=await engine.create(kb,request,root);for(const id of ['wizard','alchemist','plague-doctor'])assert(p.entries.some(e=>e.botcRole.id===id));
 assert(p.analysis.warnings.some(w=>w.includes('Wizard')));for(const e of p.entries)assert.equal(e.ability,kb.botc.find(r=>r.id===e.botcRole.id).ability);
});
test('requirements reject capacity conflicts, unavailable roles and exclusions',async()=>{
 await assert.rejects(engine.create(kb,{...request,size:{...request.size,minion:0}},root),/exceed/);
 await assert.rejects(engine.create(kb,{...request,excludedBotcRoles:'Wizard'},root),/both requested and excluded/);
 await assert.rejects(engine.create(kb,{...request,requiredBotcRoles:'Imaginary role'},root),/not available|not in|unknown/i);
 const p=await engine.create(kb,{...request,mechanicalBrief:'poisoning without Poisoner'},root);assert(!p.entries.some(e=>e.botcRole.id==='poisoner'));
});
test('Laya choices are bounded by the eligible shortlist and leave required roles intact',async(t)=>{
 const original=laya.choose;t.after(()=>{laya.choose=original;});let calls=0;
 laya.choose=async(_root,_state,options)=>{calls++;return {choice:options.at(-1).id,confidence:0.5,probabilities:Object.fromEntries(options.map(o=>[o.id,1/options.length]))};};
 const p=await engine.create(kb,request,root);assert(calls>0);assert(p.designTrace.every(x=>x.laya));for(const id of ['wizard','alchemist','plague-doctor'])assert(p.entries.some(e=>e.botcRole.id===id));
});
test('applying preferences rebuilds unlocked roles and preserves locked roles',async()=>{
 let p=await engine.create(kb,{...request,mechanicalBrief:'information'},root);const keep=p.entries.find(e=>e.team==='demon').botcRole.id;p=engine.mutate(kb,p,{type:'locks',roleId:keep,botcRole:true},root);
 const next=await engine.redesign(kb,p,request,root);for(const id of ['wizard','alchemist','plague-doctor',keep])assert(next.entries.some(e=>e.botcRole.id===id));
});
