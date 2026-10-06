const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const fits=require('../lib/theme-fits'),laya=require('../lib/laya'),knowledge=require('../lib/knowledge'),engine=require('../lib/engine');
const app=path.join(__dirname,'..');
function model(t){const original={choose:laya.choose,available:laya.available};t.after(()=>Object.assign(laya,original));laya.available=()=>true;let count=0;laya.choose=async(_root,_state,options)=>{count++;return {choice:options.find(o=>o.id==='plausible')?.id||options[0].id,probabilities:Object.fromEntries(options.map(o=>[o.id,o.id==='plausible'?0.8:0.1]))};};return ()=>count;}
test('character assessments persist per pairing, resume and invalidate changed evidence',async t=>{
 const count=model(t),root=fs.mkdtempSync(path.join(os.tmpdir(),'theme-fits-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const full=knowledge.load(app,{includeUnowned:true}),kb={characters:[full.characters.find(c=>c.id==='yoda')],botc:full.botc.filter(r=>['empath','imp'].includes(r.id))};
 let stop=false;const first=await fits.assess(kb,root,{characterIds:['yoda'],onProgress:e=>{if(e.fit)stop=true;},shouldStop:()=>stop});
 assert(first.stopped);assert.equal(first.computed,1);assert.equal(count(),2);assert.equal(Object.keys(fits.read(root).characters.yoda).length,1);
 const resumed=await fits.assess(kb,root,{characterIds:['yoda']});assert.equal(resumed.computed,1);assert.equal(count(),4);
 await fits.assess(kb,root,{characterIds:['yoda']});assert.equal(count(),4);
 fits.attach(kb,root);assert.equal(Object.keys(kb.characters[0].roleFits).length,2);assert.equal(kb.characters[0].themeId,'star-wars');
 kb.botc[0]={...kb.botc[0],ability:'Changed evidence'};fits.attach(kb,root);assert.equal(Object.keys(kb.characters[0].roleFits).length,1);
 await fits.assess(kb,root,{characterIds:['yoda']});assert.equal(count(),6);
 const owned={characters:kb.characters,botc:[kb.botc[0]]};fits.attach(owned,root);assert.deepEqual(Object.keys(owned.characters[0].roleFits),[owned.botc[0].id]);
});
test('best fit uses saved candidates and existing cast, avoids assigned identities and preserves mechanics',async t=>{
 model(t);const kb=knowledge.load(app,{includeUnowned:true});for(const c of kb.characters)c.roleFits={'village-idiot':{fit:'plausible',score:0.6,explanation:'Adapt this character to unreliable alignment readings.',limits:'Editorial adaptation'}};
 let p=await engine.create(kb,{mode:'retheme'},app,['village-idiot','imp']);p=engine.mutate(kb,p,{type:'begin-retheme'},app);p=engine.mutate(kb,p,{type:'mapping',roleId:'imp',characterId:'yoda'},app);
 const states=[];laya.choose=async(_root,state,options)=>{states.push(state);assert(!options.some(o=>o.id==='yoda'));return {choice:options[0].id,probabilities:Object.fromEntries(options.map((o,i)=>[o.id,i===0?1:0]))};};
 const before=p.entries.map(e=>[e.botcRole.id,e.ability]);const result=await engine.bestThemeFit(kb,p,'village-idiot',app);
 assert(result.entries[0].layaRecommendation);assert.equal(result.entries[0].starWarsIdentity,null);assert.deepEqual(result.entries.map(e=>[e.botcRole.id,e.ability]),before);assert(states.every(s=>s.includes('Imp: Yoda')));
 const changed=engine.mutate(kb,result,{type:'mapping',roleId:'imp',characterId:'luke-skywalker'},app);assert.equal(changed.entries[0].layaRecommendation,undefined);
});
test('role clicks only render; they never call the model or API',()=>{
 const source=fs.readFileSync(path.join(app,'public/app.js'),'utf8'),start=source.indexOf('function selectRole(id){'),end=source.indexOf("$('#review').onclick",start);let renders=0;
 const ctx=vm.createContext({selected:null,render:()=>{renders++;},task:()=>{throw Error('Unexpected model request');},api:()=>{throw Error('Unexpected API request');}});vm.runInContext(source.slice(start,end)+"selectRole('imp');selectRole('empath');",ctx);assert.equal(ctx.selected,'empath');assert.equal(renders,2);
});
test('all Star Wars identities including racers live in one theme directory',()=>{
 const kb=knowledge.load(app,{includeUnowned:true});assert.equal(kb.characters.length,162);assert.equal(kb.characters.filter(c=>c.galacticRacer).length,5);assert(kb.characters.every(c=>c.themeId==='star-wars'&&c._file.replaceAll('\\','/').startsWith('data/themes/star-wars/characters/')));
});
