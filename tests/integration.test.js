const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {load}=require('../lib/knowledge');
const engine=require('../lib/engine');
const source=path.join(__dirname,'..');
function temp(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clocktower-test-'));fs.cpSync(path.join(__dirname,'fixtures','data'),path.join(dir,'data'),{recursive:true});return dir;}
function cleanup(dir){const resolved=fs.realpathSync(dir);assert(resolved.startsWith(fs.realpathSync(os.tmpdir())+path.sep+'clocktower-test-'));fs.rmSync(resolved,{recursive:true,force:true});}
const req={mode:'create',title:'Integration sample',theme:'Sith manipulation',requiredCharacters:'Leia, Palpatine',galacticRacerEmphasis:'none',size:{townsfolk:2,outsider:0,minion:1,demon:1}};
test('configured provider uses bounded mechanics, unique cast proposals, critique and retrieved chat',async()=>{
  const dir=temp();let invalid=false,invalidCast=false,invalidReview=false;const calls=[];
  const model=http.createServer(async(request,response)=>{let raw='';for await(const c of request)raw+=c;const input=JSON.parse(raw),task=JSON.parse(input.messages[1].content);calls.push(task);let out;
    if(task.task.startsWith('Select a mechanically'))out={roleIds:invalid?['invented-homebrew']:task.context.heuristicProposal,rationale:'Bounded corpus selection.'};
    else if(task.task.startsWith('Select a coherent'))out={mappings:task.context.candidates.map(c=>({roleId:c.roleId,characterId:invalidCast?'invented-identity':c.current.id,rationale:'Supported mapping '+c.current.name}))};
    else if(task.task.startsWith('Critique'))out={mechanicalCritique:'Review information corruption.',castCritique:'Review narrative importance.',mappings:[]};
    else out={answer:'The retrieved Empath record supports recurring alignment information.',proposal:invalidReview?{type:'role',roleId:'empath',newRoleId:'fortune-teller'}:null};
    response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({choices:[{message:{content:JSON.stringify(out)}}]}));
  });
  await new Promise(resolve=>model.listen(0,'127.0.0.1',resolve));
  fs.writeFileSync(path.join(dir,'config.local.json'),JSON.stringify({endpoint:`http://127.0.0.1:${model.address().port}/v1/chat/completions`,model:'test-model'}));
  try{
    const kb=load(dir),p=await engine.createLegacy(kb,req,dir);assert.equal(calls.length,3);assert(calls[0].context.candidates.every(x=>x.kind==='botc'));assert(!JSON.stringify(calls[0].context.candidates).includes('leia-organa'));assert.equal(p.modelCritique.mechanical,'Review information corruption.');
    const reply=await engine.review(kb,p,'Why this one?','empath',dir);assert.equal(reply.engine,'language model');assert(calls.at(-1).context.records.some(x=>x.record.id==='empath'));assert.equal(reply.proposal,null);
    invalidReview=true;await assert.rejects(()=>engine.review(kb,p,'Why this one?','empath',dir),/without an explicit request/);invalidReview=false;
    invalidCast=true;await assert.rejects(()=>engine.createLegacy(kb,req,dir),/violated candidates/);invalidCast=false;
    invalid=true;await assert.rejects(()=>engine.createLegacy(kb,req,dir),/violated candidate/);
  }finally{await new Promise(resolve=>model.close(resolve));cleanup(dir);}
});
test('HTTP session workflow rejects bad imports and stale edits, preserves grouped data, exports only approved Markdown',async()=>{
  const dir=temp();const grouped=JSON.parse(fs.readFileSync(path.join(dir,'data/star-wars/characters/yoda.json'),'utf8'));const leia=JSON.parse(fs.readFileSync(path.join(dir,'data/star-wars/characters/leia-organa.json'),'utf8'));
  fs.unlinkSync(path.join(dir,'data/star-wars/characters/yoda.json'));fs.unlinkSync(path.join(dir,'data/star-wars/characters/leia-organa.json'));fs.writeFileSync(path.join(dir,'data/star-wars/characters/grouped.json'),JSON.stringify([grouped,leia]));
  const portServer=http.createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
  const child=spawn(process.execPath,[path.join(source,'server.js')],{env:{...process.env,PORT:String(port),STUDIO_ROOT:dir},stdio:['ignore','pipe','pipe'],windowsHide:true});
  try{
    await Promise.race([new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('Clocktower Studio:'))resolve();});child.once('exit',code=>reject(Error('Server exited '+code)));}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server startup timeout')),10000))]);
    const base=`http://127.0.0.1:${port}`;
    const castingScript=await fetch(base+'/casting.js');assert.equal(castingScript.status,200);assert.match(await castingScript.text(),/CharacterCasting/);
    const post=async(name,payload,headers={})=>{const response=await fetch(base+'/api/'+name,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload)});const content=await response.text();return {status:response.status,value:response.headers.get('content-type').startsWith('application/json')?JSON.parse(content):content};};
    let p=(await post('create',{request:req})).value;assert.equal(p.state,'DRAFT');assert.equal((await post('export',{id:p.id,version:p.version})).status,400);
    const parsed=(await post('parse',{text:'Empath\nFortuneteller\nImp'})).value;assert.equal(parsed.unresolved.length,1);
    const before=fs.readdirSync(path.join(dir,'data/star-wars/characters'));
    assert.equal((await post('knowledge',{kind:'star-wars',records:[{id:'valid',name:'Valid'},{id:'../invalid',name:'Invalid'}]})).status,400);assert.deepEqual(fs.readdirSync(path.join(dir,'data/star-wars/characters')),before);
    const update=await post('knowledge',{kind:'star-wars',records:{...grouped,notes:'Updated notes'},overwrite:true});assert.equal(update.status,200);assert.equal(update.value.kb.characters.length,4);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'data/star-wars/characters/grouped.json'))).length,2);
    assert.equal((await post('action',{id:p.id,version:99,action:{type:'approve'}})).status,400);
    assert.equal((await post('reload',{}, {Origin:'https://untrusted.example'})).status,403);
    assert.equal(p.stage,'MECHANICS');assert(p.entries.every(e=>e.starWarsIdentity===null));
    p=(await post('action',{id:p.id,version:p.version,action:{type:'begin-retheme'}})).value;
    const identities=['leia-organa','yoda','darth-vader','emperor-palpatine'];
    for(let i=0;i<p.entries.length;i++)p=(await post('action',{id:p.id,version:p.version,action:{type:'mapping',roleId:p.entries[i].botcRole.id,characterId:identities[i]}})).value;
    p=(await post('action',{id:p.id,version:p.version,action:{type:'approve'}})).value;assert.equal(p.state,'APPROVED');
    const exported=await post('export',{id:p.id,version:p.version,options:{history:true}});assert.equal(exported.status,200);assert(exported.value.includes('# Mapping Reference'));assert(exported.value.includes('# Revision Notes'));assert(exported.value.includes('sample paraphrase'));
    p=(await post('action',{id:p.id,version:p.version,action:{type:'notes',roleId:'empath',notes:'Change after approval',resolved:true}})).value;assert.equal(p.state,'DRAFT');assert.equal((await post('undo',{id:p.id,version:p.version})).value.state,'APPROVED');
    const reopened=await (await fetch(base+'/api/project/'+p.id)).json();assert.equal(reopened.state,'APPROVED');assert(!fs.existsSync(path.join(dir,'projects',p.id,'approved.json')));
    const available=(await (await fetch(base+'/api/bootstrap')).json()).kb.botcEditions.map(e=>e.id);
    assert.equal((await post('settings',{ownedEditions:['imaginary-expansion']})).status,400);
    const disabled=await post('settings',{ownedEditions:[]});assert.equal(disabled.status,200);assert.equal(disabled.value.kb.botc.length,0);assert.equal((await post('parse',{text:'Empath'})).value.roles.length,0);
    assert.equal((await post('knowledge',{kind:'botc',records:load(source).botc.find(r=>r.id==='empath')})).status,400);
    assert.equal((await post('create',{request:req})).status,400);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'data','app-settings.json'))).ownedEditions,[]);
    const restored=await post('settings',{ownedEditions:available});assert.equal(restored.value.kb.botc.length,4);
  }finally{child.kill();if(child.exitCode===null)await once(child,'exit');cleanup(dir);}
});
