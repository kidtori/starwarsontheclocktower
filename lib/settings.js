const fs=require('node:fs'),path=require('node:path');
const editionNames={tb:'Trouble Brewing',bmr:'Bad Moon Rising',snv:'Sects & Violets',carousel:'Experimental / Carousel',fabled:'Fabled',loric:'Loric',custom:'Custom / unclassified'};
function editionId(r){return r.officialEdition||Object.entries(editionNames).find(([,name])=>name===r.edition)?.[0]||(['Experimental','Carousel'].includes(r.edition)?'carousel':'custom');}
function inventory(records){return [...new Set(records.map(editionId))].map(id=>({id,name:editionNames[id]||id,total:records.filter(r=>editionId(r)===id).length}));}
function validateSettings(value,editions){if(!value||!Array.isArray(value.ownedEditions)||value.ownedEditions.some(id=>typeof id!=='string'||!editions.some(e=>e.id===id)))throw Error('Choose BOTC sets from the available collection list.');return{ownedEditions:[...new Set(value.ownedEditions)]};}
function read(root,editions){const file=path.join(root,'data','app-settings.json');return fs.existsSync(file)?validateSettings(JSON.parse(fs.readFileSync(file,'utf8')),editions):{ownedEditions:editions.map(e=>e.id)};}
module.exports={editionId,inventory,validateSettings,read};
