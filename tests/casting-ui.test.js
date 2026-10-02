const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {load}=require('../lib/knowledge'),casting=require('../lib/character-casting');
test('missing browser casting helper preserves popular pool, full catalogue and explicit exceptions',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const code=source.slice(source.indexOf('function characterPool('),source.indexOf('function castingCharacters('));
 const context=vm.createContext({window:{}});vm.runInContext(code,context);
 const characters=load(path.join(__dirname,'..'),{includeUnowned:true}).characters;
 for(const [request,entries] of [[{},[]],[{characterPool:'all'},[]],[{essentialCharacters:'Brasso',requiredCharacters:['Yoda']},[{starWarsIdentity:{id:'dedra-meero'}}]]]){
  assert.deepEqual(Array.from(context.characterPool(characters,request,entries),c=>c.id),casting.pool(characters,request,entries).map(c=>c.id));
 }
 assert.equal(context.characterPool(characters).length,49);
});
