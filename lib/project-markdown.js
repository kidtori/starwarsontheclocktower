function projectMarkdown(p){
 const snapshot={format:'clocktower-studio',version:1,title:p.title,request:p.request,stage:p.stage,roles:p.entries.map(e=>({id:e.botcRole.id,ability:e.ability,identityId:e.identity?.id||null,notes:e.notes||'',reviewResolved:e.reviewResolved,locks:e.locks})),supplementalIds:(p.supplementalRoles||[]).map(r=>r.id)};
 const brief=[...new Set([p.request.mechanicalBrief||'',p.request.mechanicalPreferences||''].map(x=>x.trim()).filter(Boolean))].join('\n\n');
 const lines=['# '+String(p.title||'Untitled script').replace(/[\r\n]/g,' '),'','Mechanics-first BOTC script. Import this Markdown file to reopen the role list, requirements and identity choices.','',`Stage: ${p.stage==='RETHEME'?'Retheming':'Mechanical review'}`,'', '## Mechanical brief','',brief, '', '## Tone','',p.request.tone||'', ''];
 for(const team of ['townsfolk','outsider','minion','demon']){lines.push('## '+team[0].toUpperCase()+team.slice(1),'');for(const e of p.entries.filter(e=>e.team===team))lines.push(`### ${e.botcRole.name}`,`${e.botcRole.edition||'Custom'}${e.identity?' · '+e.identity.name:''}`,'',e.ability,'');}
 if(p.supplementalRoles?.length)lines.push('## Supplemental roles','',...p.supplementalRoles.flatMap(r=>['### '+r.name,r.ability,'']));
 lines.push('## Import data','','Keep this block intact for an exact round trip.','','```clocktower-studio',JSON.stringify(snapshot,null,2),'```','');return lines.join('\n');
}
function parseProjectMarkdown(text,kb){
 const match=String(text).match(/```clocktower-studio\s*\n([\s\S]*?)\n```/);if(!match)return null;
 let data;try{data=JSON.parse(match[1]);}catch{throw Error('The Markdown import data is invalid JSON.');}
 if(data.format!=='clocktower-studio'||data.version!==1||!Array.isArray(data.roles)||!data.roles.length)throw Error('Unsupported or empty Clocktower Markdown file.');
 const unavailableTheme=(data.request?.themeId||null)!==(kb.theme?.id||null)||data.roles.some(e=>e.identityId&&!kb.characters.some(c=>c.id===e.identityId));
 const seen=new Set();for(const entry of data.roles){const role=kb.botc.find(r=>r.id===entry.id);if(!role)throw Error('Markdown role '+entry.id+' is unavailable in your owned sets.');if(seen.has(entry.id))throw Error('Markdown contains duplicate roles.');seen.add(entry.id);if(entry.ability!==role.ability)throw Error('The imported ability for '+role.name+' differs from the catalogue. Review it before importing.');}
 if(unavailableTheme){data.request={...data.request,themeId:kb.theme?.id||null,theme:'',tone:'',essentialCharacters:[],requiredCharacters:'',avoid:'',factions:'',eras:''};data.stage='MECHANICS';for(const entry of data.roles){entry.identityId=null;entry.locks={...entry.locks,character:false};}}
 for(const id of data.supplementalIds||[])if(!kb.botcReference.some(r=>r.id===id))throw Error('Supplemental role '+id+' is unavailable in your owned sets.');
 return data;
}
async function importProjectMarkdown(kb,data,root,engine){
 let p=await engine.create(kb,{...(data.request||{}),title:String(data.title||'Imported script'),mode:'retheme',importMappings:data.roles.filter(e=>e.identityId).map(e=>({roleId:e.id,characterId:e.identityId}))},root,data.roles.map(e=>e.id),data.supplementalIds||[]);
 if(data.stage==='RETHEME')p=engine.mutate(kb,p,{type:'begin-retheme'},root);
 for(const saved of data.roles){p=engine.mutate(kb,p,{type:'notes',roleId:saved.id,notes:String(saved.notes||''),resolved:saved.reviewResolved!==false},root);if(saved.locks)p=engine.mutate(kb,p,{type:'locks',roleId:saved.id,botcRole:!!saved.locks.botcRole,character:!!saved.locks.character},root);}
 return p;
}
module.exports={projectMarkdown,parseProjectMarkdown,importProjectMarkdown};
