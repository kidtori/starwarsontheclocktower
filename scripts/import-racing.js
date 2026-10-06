const fs=require('node:fs'),path=require('node:path');
const{validate}=require('../lib/knowledge');
const root=path.join(__dirname,'..'),date='2026-10-02';
const source=id=>JSON.parse(fs.readFileSync(path.join(root,'sources','racing',date,id+'.json'),'utf8'));
const attribution=id=>{const s=source(id);return{type:'canonical',title:s.title,url:s.url,accessedAt:date,sha256:s.sha256};};
const editorial={type:'design',description:'Initial editable narrative casting signals; not official BOTC mappings or popularity ratings.'};
const newCharacters=[
 ['shade','Shade','A mysterious Galactic League pilot recruited to challenge Kestar Bool; he holds a grudge against the Bool family.','revenge,initiative,survival,secrecy','mixed','league'],
 ['hibi','Hibi','Ardennian mechanic who upgrades Shade\'s vehicles and helps him prepare for the Galactic League.','knowledge,protection,loyalty,initiative','good','hibi'],
 ['kestar-bool','Kestar Bool','Galactic League champion who uses his position to intimidate competitors and expand his influence.','control,intimidation,power,corruption','evil','league'],
 ['darius-pax','Darius Pax','Founder of the Galactic League who recruits Shade to challenge Kestar Bool\'s dominance.','political influence,leadership,control,initiative','mixed','league'],
 ['gasgano','Gasgano','Competitive Xexto podracer who entered the Boonta Eve Classic in a green Ord Pedrovia pod.','precision,initiative,recklessness,competition','mixed','gasgano'],
 ['ben-quadinaros','Ben Quadinaros','Inexperienced Boonta Eve entrant whose engines failed to start and then broke free from their couplings.','danger,unintended consequences,recklessness,survival','mixed','ben-quadinaros'],
 ['teemto-pagalies','Teemto Pagalies','Veknoid podracer who survived his pod\'s destruction by Tusken fire during the Boonta Eve Classic.','survival,reputation,initiative,danger','mixed','teemto-pagalies'],
 ['ratts-tyerell','Ratts Tyerell','Small Boonta Eve competitor killed when his large-engined pod crashed in the Laguna Caves.','danger,loss,recklessness','mixed','ratts-tyerell'],
 ['mawhonic','Mawhonic','Gran podracer considered a capable challenger before Sebulba knocked him out of the Boonta Eve race.','competition,danger,rivalry','mixed','mawhonic'],
 ['ody-mandrell','Ody Mandrell','Tatooine thrill-seeker whose Boonta Eve attempt ended after a pit droid damaged his engine.','recklessness,unintended consequences,danger','mixed','ody-mandrell'],
 ['clegg-holdfast','Clegg Holdfast','Podracing journalist and competitor whose engines were damaged by Sebulba\'s illegal flame jets.','reputation,knowledge,danger,rivalry','mixed','clegg-holdfast'],
 ['ark-bumpy-roose','Ark “Bumpy” Roose','Nuknog pilot whose attempt to sabotage Anakin\'s pod instead damaged Ben Quadinaros\' vehicle.','sabotage,deception,unintended consequences','evil,mixed','podracing'],
 ['neva-kee','Neva Kee','Podracer who disappeared after leaving the Boonta Eve course to take a shortcut.','secrecy,initiative,danger','mixed','podracing'],
 ['dud-bolt','Dud Bolt','Podracer who competed against Anakin, Sebulba and Gasgano in the Boonta Eve Classic.','competition,danger,initiative','mixed','names']
];
const classicPods=['darth-vader','sebulba',...newCharacters.slice(4).map(c=>c[0])];
const gameRoles={shade:['Campaign protagonist and rival of Kestar Bool.'],hibi:['Mechanic and ally who upgrades vehicles in the paddock.'],'kestar-bool':['Reigning League champion and campaign antagonist.'],'darius-pax':['League founder who recruits Shade.'],sebulba:['Veteran podracer who can support Shade if his respect is earned.']};
const vehicles=[
 ['landspeeder','Landspeeder','landspeeder','Galactic Racer vehicle class, with handling developed around automobile analogues.','vehicles',true],
 ['speeder-bike','Speeder bike','speeder bike','Galactic Racer vehicle class using motorcycle-like handling references.','vehicles',true],
 ['skim-speeder','Skim speeder','skim speeder','Galactic Racer vehicle class inspired by aircraft, with knife-edge cornering.','vehicles',true],
 ['podracer','Podracer','podracer','Galactic Racer vehicle class designed to feel like the pinnacle of high-speed racing.','vehicles',true],
 ['kor-sarun-darc-x','Kor Sarun: Darc X','landspeeder','Additional landspeeder included in the Deluxe Edition.','deluxe',true],
 ['kor-sarun-ciza-t','Kor Sarun: Ciza T','speeder bike','Additional speeder bike included in the Deluxe Edition.','deluxe',true],
 ['kor-sarun-rac-s','Kor Sarun: Rac S','skim speeder','Additional skim speeder included in the Deluxe Edition.','deluxe',true],
 ['anakin-pod','Anakin Skywalker\'s podracer','podracer','Anakin\'s homemade twin-engine pod carried him to victory and freedom at Boonta Eve.','anakin-pod',false],
 ['sebulba-pod','Sebulba\'s podracer','podracer','Large split-X engine pod equipped with illicit devices, including a concealed flamethrower.','sebulbas-podracer',false],
 ['rey-speeder','Rey\'s speeder','landspeeder','Salvage-built cargo speeder used by Rey while scavenging on Jakku.','rey-s-speeder',false],
 ['han-speeder','Han Solo\'s landspeeder','landspeeder','Modified Mobquet M-68 landspeeder used by Han on Corellia.','han-speeder',false],
 ['enfys-swoop','Enfys Nest\'s swoop bike','speeder bike','High-speed swoop bike used by the leader of the Cloud-Riders.','enfys-swoop',false]
].map(([id,name,vehicleClass,summary,src,confirmedGame])=>({id,name,kind:'vehicle',vehicleClass,summary,confirmedGame,scope:confirmedGame?'Galactic Racer announced class/model':'Film vehicle; specific model not confirmed for Galactic Racer',sources:[attribution(src)]}));
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}
function run(){
 const records=newCharacters.map(([id,name,summary,themes,alignment,src],i)=>({id,name,aliases:id==='ark-bumpy-roose'?['Ark Bumpy Roose','Bumpy Roose']:[],summary,source:[i<4?'Star Wars: Galactic Racer':'Star Wars: The Phantom Menace (Episode I)'],era:[i<4?'New Republic':'Fall of the Republic'],factions:[i<4?'Galactic League':'Podracing competitors'],alignment:alignment.split(','),themes:themes.split(','),archetypes:[i===1?'mechanic':i===3?'organiser':'racer'],personality:themes.split(','),narrativeFunctions:themes.split(','),relationships:[],importance:{overall:i<4?2:1,recognisability:i<4?1:1,storyImportance:i<4?2:1,thematicImportance:2,...(i<4?{galacticRacerImportance:i===0||i===2?3:2}:{})},annotationStatus:'Editable editorial draft. Factual summary from cited primary sources; casting themes, alignment and importance are interpretation.',sources:[attribution(src),editorial]}));
 for(const r of records){const errors=validate('star-wars',r);if(errors.length)throw Error(r.id+': '+errors.join('; '));}
 const backup=path.join(root,'backups','racing-before-import-'+Date.now());fs.mkdirSync(backup,{recursive:true});for(const area of ['star-wars','galactic-racer'])if(fs.existsSync(path.join(root,'data',area)))fs.cpSync(path.join(root,'data',area),path.join(backup,area),{recursive:true});
 for(const r of records)write(path.join(root,'data','themes','star-wars','characters',r.id+'.json'),r);
 const gameIds=Object.keys(gameRoles);
 for(const id of [...new Set([...classicPods,...gameIds,'rey','han-solo','enfys-nest'])]){
   const file=path.join(root,'data','themes','star-wars','characters',id+'.json'),r=JSON.parse(fs.readFileSync(file,'utf8'));const isPod=classicPods.includes(id),isGame=gameIds.includes(id);
   r.racingProfile={disciplines:[...(isPod?['podracing']:[]),...(['rey','han-solo','enfys-nest'].includes(id)?['speeder piloting']:[]),...(isGame?['Galactic League cast']:[])],confirmedGalacticRacer:isGame,vehicleIds:({ 'darth-vader':['anakin-pod'],sebulba:['sebulba-pod'],rey:['rey-speeder'],'han-solo':['han-speeder'],'enfys-nest':['enfys-swoop']})[id]||[],notes:isGame?'Game narrative role announced in official material. Individual vehicle assignments and unannounced statistics are not inferred.':'Film racing/piloting history; Galactic Racer roster membership is not confirmed.'};
   if(isPod&&!r.themes.includes('competition'))r.themes.push('competition');
   write(file,r);
   if(isGame){const context={characterId:id,roleInGame:gameRoles[id],gameplayIdentity:gameRoles[id],rivalries:id==='shade'?['Kestar Bool']:id==='kestar-bool'?['Shade']:[],allies:id==='shade'?['Hibi','Darius Pax','Sebulba (conditional support)']:id==='hibi'?['Shade']:[],vehicle:'Specific assigned vehicle not confirmed by the cited announcements.',narrativeNotes:'Official pre-release announcements checked on 2026-10-02; not a complete roster or a claim of hands-on gameplay verification.',sources:[attribution(id==='darius-pax'?'league':id==='hibi'?'hibi':'story')]};const errors=validate('galactic-racer',context);if(errors.length)throw Error(errors.join('; '));write(path.join(root,'data','themes','star-wars','racing','characters',id+'.json'),context);}
 }
 for(const v of vehicles)write(path.join(root,'data','themes','star-wars','racing','vehicles',v.id+'.json'),v);
 const report={researchedAt:date,confirmedGalacticRacerCharacters:gameIds,classicPodracers:classicPods,speederPilots:['rey','han-solo','enfys-nest'],vehicleRecords:vehicles.length,coverage:'Five officially named Galactic Racer characters; twelve source-verified classic podracers; three film speeder pilots. Announced game classes/models are distinct from film-only vehicles. Additional unannounced pilots and statistics are unknown.',sources:Object.fromEntries(['home','story','league','vehicles','deluxe','hibi','podracing','names'].map(id=>[id,source(id).url])),backup:path.relative(root,backup)};write(path.join(root,'data','themes','star-wars','racing-catalogue.json'),report);
 const manifestFile=path.join(root,'data','themes','star-wars','catalogue.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));manifest.coreCatalogueTotal=148;manifest.total=fs.readdirSync(path.join(root,'data','themes','star-wars','characters')).filter(f=>f.endsWith('.json')).length;const all=fs.readdirSync(path.join(root,'data','themes','star-wars','characters')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(root,'data','themes','star-wars','characters',f),'utf8')));manifest.coreVerifiedSources=149;manifest.verifiedSources=new Set(all.flatMap(c=>c.sources.filter(s=>s.type==='canonical').map(s=>s.url))).size;manifest.countsByEra=Object.fromEntries([...new Set(all.flatMap(c=>c.era||[]))].map(e=>[e,all.filter(c=>c.era?.includes(e)).length]));manifest.galacticRacerContexts=5;manifest.racingSupplement='data/themes/star-wars/racing-catalogue.json';write(manifestFile,manifest);console.log(JSON.stringify({characters:manifest.total,gameCharacters:gameIds.length,classicPodracers:classicPods.length,vehicles:vehicles.length},null,2));
}
if(require.main===module)run();
module.exports={newCharacters,classicPods,gameRoles,vehicles};
