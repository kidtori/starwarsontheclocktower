const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
function editor(project,kb={botc:[],botcReference:[],characters:[]}){
 const nodes={'#project-editor':{innerHTML:''}};
 const calls=[];let error;
 const ctx=vm.createContext({project,kb,selected:'old',editorKey:null,editorDirty:false,bootstrap:{layaAvailable:false},teamNames:{townsfolk:'Townsfolk',outsider:'Outsiders',minion:'Minions',demon:'Demons'},esc:x=>String(x),characterPool:x=>x,
  $:id=>nodes[id]||null,task:async fn=>{try{return await fn();}catch(e){error=e;}},render:()=>{},
  api:async(name,data)=>{calls.push({name,data});return {...project,id:'loaded',title:data.request?.title||data.action.request.title};}});
 Object.defineProperty(nodes['#project-editor'],'innerHTML',{set(html){this.html=html;for(const match of html.matchAll(/id="([^"]+)"/g))nodes['#'+match[1]]={value:'',textContent:''};},get(){return this.html;}});
 vm.runInContext(source.slice(source.indexOf('function loadPublishedScript('),source.indexOf('function markdownImportDialog(){'))+'\nworkspaceEditor();',ctx);
 return {ctx,nodes,calls,get error(){return error;}};
}
test('published selection loads exact owned composition without draft requirements',async()=>{
 const d=editor({id:'draft',version:0,title:'Unrelated draft',stage:'MECHANICS',request:{mode:'create',mechanicalBrief:'poison',tone:'dark',requiredBotcRoles:['poisoner']},entries:[]},{botc:[{id:'washerwoman',team:'townsfolk',officialEdition:'tb'},{id:'imp',team:'demon',officialEdition:'tb'},{id:'vigormortis',team:'demon',officialEdition:'snv'}],botcReference:[{id:'beggar',team:'traveller',officialEdition:'tb'}],characters:[]});
 await d.nodes['#workspace-base'].onchange({target:{value:'tb'}});
 assert.equal(d.calls.length,1);assert.equal(d.calls[0].name,'create');
 assert.deepEqual(JSON.parse(JSON.stringify(d.calls[0].data)),{request:{title:'Trouble Brewing',mode:'retheme'},roleIds:['washerwoman','imp'],supplementalRoleIds:['beggar']});
 assert.equal(d.ctx.project.title,'Trouble Brewing');assert.equal(d.ctx.selected,null);
});
test('unavailable published set preserves current draft',async()=>{
 const project={id:'draft',version:0,title:'Draft',stage:'MECHANICS',request:{mode:'create'},entries:[]};const d=editor(project);
 await d.nodes['#workspace-base'].onchange({target:{value:'bmr'}});
 assert.equal(d.calls.length,0);assert.equal(d.ctx.project,project);assert.match(d.error.message,/Enable this set/);
});
test('loaded script omits mechanical setup and rename preserves saved settings',async()=>{
 const project={id:'imported',version:2,title:'Saved',stage:'MECHANICS',request:{mode:'retheme',mechanicalBrief:'saved brief',tone:'saved tone',size:{townsfolk:15}},entries:[]};const d=editor(project);
 for(const id of ['workspace-brief','workspace-tone','workspace-required','workspace-excluded','workspace-complexity','workspace-townsfolk','workspace-rebuild'])assert.equal(d.nodes['#'+id],undefined,id);
 d.nodes['#project-name'].value='Renamed';await d.nodes['#workspace-form'].onsubmit({preventDefault(){}});
 assert.deepEqual(JSON.parse(JSON.stringify(d.calls[0].data.action)),{type:'request',request:{title:'Renamed'}});
 assert.equal(project.request.tone,'saved tone');assert.equal(project.request.mechanicalBrief,'saved brief');
});
