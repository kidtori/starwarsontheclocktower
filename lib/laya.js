const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const workers=new Map();let sequence=0;
let latestProgress=null;
function progress(root,value){latestProgress={...value,at:Date.now()};}
function getProgress(){return latestProgress;}
function available(root){return process.env.STUDIO_LAYA_DISABLED!=='1'&&fs.existsSync(path.join(root,'runtime/python/python.exe'))&&fs.existsSync(path.join(root,'runtime/laya-model/model.safetensors'));}
function evaluate(root,state,questions){
 if(!available(root))return Promise.resolve(null);
 let worker=workers.get(root);
 if(!worker){
  const child=spawn(path.join(root,'runtime/python/python.exe'),['-u',path.join(root,'lib/laya-worker.py')],{cwd:root,windowsHide:true,env:{...process.env,PYTHONHOME:path.join(root,'runtime/python'),PYTHONPATH:path.join(root,'runtime/python/Lib/site-packages'),HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}});
  worker={child,pending:new Map(),error:''};workers.set(root,worker);
  child.stderr.on('data',chunk=>{worker.error=(worker.error+chunk.toString()).slice(-3000);});
  readline.createInterface({input:child.stdout}).on('line',line=>{let message;try{message=JSON.parse(line);}catch{return;}const pending=worker.pending.get(message.id);if(!pending)return;worker.pending.delete(message.id);clearTimeout(pending.timer);message.error?pending.reject(Error('Embedded Laya: '+message.error)):pending.resolve(message.result);});
  const failed=()=>{workers.delete(root);for(const pending of worker.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Embedded Laya could not run. '+worker.error));}worker.pending.clear();};
  child.on('error',failed);child.on('exit',failed);child.stdin.on('error',()=>{});
 }
 return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{worker.child.kill();reject(Error('Embedded Laya timed out. No changes applied.'));},180000);worker.pending.set(id,{resolve,reject,timer});worker.child.stdin.write(JSON.stringify({id,state,questions})+'\n');});
}
async function choose(root,state,options,instructions){
 if(options.length<2||!available(root))return null;
 const result=await evaluate(root,state,{selection:{type:'choice',instructions,criteria:Object.fromEntries(options.map(o=>[o.id,o.description]))}});
 const answer=result?.answers?.selection;
 if(!options.some(o=>o.id===answer?.choice))throw Error('Embedded Laya returned an invalid candidate. No changes applied.');
 return answer;
}
function close(){for(const worker of workers.values())worker.child.kill();workers.clear();}
process.once('exit',close);
module.exports={available,evaluate,choose,close,progress,getProgress};
