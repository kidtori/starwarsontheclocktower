const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function dialog(){
 const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const code=source.slice(source.indexOf('function markdownImportDialog(){'),source.indexOf("$('#import-md').onclick=markdownImportDialog;"));
 const nodes=Object.fromEntries(['markdown-file','markdown-text','markdown-file-state','import-markdown-submit','modal-error'].map(id=>['#'+id,{value:'',textContent:'',disabled:false,files:[]} ]));
 const calls=[];let error='',closed=false,rendered=false;
 const original={title:'Existing unsaved script'};
 const ctx=vm.createContext({$:id=>nodes[id],modal:()=>{},project:original,selected:'empath',editorKey:'old',editorDirty:true,api:async(name,data)=>{calls.push({name,data});if(data.text==='invalid')throw Error('Invalid import data');return {title:'Imported script'};},task:async fn=>{try{await fn();}catch(e){error=e.message;}},render:()=>{rendered=true;},close:()=>{closed=true;}});
 vm.runInContext(code+'\nmarkdownImportDialog();',ctx);
 return {ctx,nodes,calls,original,get error(){return error;},get closed(){return closed;},get rendered(){return rendered;}};
}
test('unreadable file leaves current script intact and allows pasted Markdown recovery',async()=>{
 const d=dialog(),n=d.nodes;
 n['#markdown-text'].value='stale previously loaded file';
 n['#markdown-file'].files=[{name:'Cloud script.md',text:async()=>{throw Object.assign(Error('File no longer exists'),{name:'NotFoundError'});}}];
 await n['#markdown-file'].onchange();
 assert.equal(n['#markdown-text'].value,'');assert.match(n['#modal-error'].textContent,/Windows could not read/);
 assert.equal(n['#import-markdown-submit'].disabled,false);assert.equal(d.ctx.project,d.original);
 await n['#import-markdown-submit'].onclick();assert.equal(d.calls.length,0);assert.match(d.error,/Choose a readable/);
 n['#markdown-text'].value='complete pasted Markdown';await n['#import-markdown-submit'].onclick();
 assert.equal(d.calls[0].data.text,'complete pasted Markdown');assert.equal(d.ctx.project.title,'Imported script');assert(d.closed&&d.rendered);
});
test('file reading waits for explicit import and rejected import preserves project and text',async()=>{
 const d=dialog(),n=d.nodes;n['#markdown-file'].files=[{name:'Script.md',text:async()=> 'invalid'}];
 await n['#markdown-file'].onchange();assert.equal(d.calls.length,0);assert.equal(n['#markdown-text'].value,'invalid');
 await n['#import-markdown-submit'].onclick();assert.equal(d.ctx.project,d.original);assert.equal(n['#markdown-text'].value,'invalid');assert.equal(d.closed,false);assert.equal(d.error,'Invalid import data');
});
