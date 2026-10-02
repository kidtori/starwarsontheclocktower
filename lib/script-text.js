function scriptText(p) {
  const out=['# Clocktower Studio script','# Title: '+String(p.title||'Untitled').replace(/[\r\n]/g,' '),'# Import this TXT to reuse the original BOTC role list.'];
  for(const e of p.entries)if(e.starWarsIdentity)out.push('# Mapping: '+e.botcRole.id+'='+e.starWarsIdentity.id);
  for(const team of ['townsfolk','outsider','minion','demon']){
    out.push('',team.toUpperCase());
    for(const e of p.entries.filter(e=>e.team===team))out.push(e.botcRole.name+(e.starWarsIdentity?' # '+e.starWarsIdentity.name:''));
  }
  for(const team of ['traveller','fabled','loric']){
    const roles=(p.supplementalRoles||[]).filter(r=>r.team===team);if(roles.length)out.push('',team.toUpperCase(),...roles.map(r=>r.name));
  }
  return out.join('\n')+'\n';
}
module.exports={scriptText};
