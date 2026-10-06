const {teams}=require('./knowledge');
const safe=s=>String(s||'').replace(/\|/g,'\\|').replace(/\r/g,'');
function markdown(p,opts={}) {
  if(p.state!=='APPROVED')throw Error('Explicitly approve this revision before exporting.');
  const o={abilities:true,mechanical:true,thematic:true,analysis:true,warnings:true,history:false,sources:true,...opts};
  const out=[`# ${safe(p.title)}`,'','## Concept','',safe(p.request.theme||'theme retheming of an existing BOTC script.'),'',`Workflow: ${p.request.mode==='retheme'?'Retheme existing script':'Create from theme'}. Approved revision: ${p.version}.`,''];
  for(const team of teams) {
    out.push(`## ${team==='townsfolk'?'Townsfolk':team[0].toUpperCase()+team.slice(1)+'s'}`,'');
    for(const e of p.entries.filter(e=>e.team===team)) {
      out.push(`### ${safe(e.identity.name)} — ${safe(e.botcRole.name)}`,'',`**BOTC role:** ${safe(e.botcRole.name)} · ${safe(e.botcRole.edition||'Custom')}`,'');
      if(o.abilities)out.push(e.abilityTextStatus?'**BOTC ability (sample paraphrase):**':'**Original BOTC ability:**',safe(e.ability),'',...(e.abilityTextStatus?['**Ability source note:** '+safe(e.abilityTextStatus),'']:[]));
      if(o.mechanical)out.push(`**${p.request.mode==='retheme'?'Why this role matters in this script':'Mechanical purpose'}:**`,safe(e.mechanical.context),'',`**Bluffing implications:** ${safe(e.mechanical.bluffing)}`,'','**Key interactions:**',...e.mechanical.synergies.map(s=>`- ${safe(s)}`),...(e.mechanical.synergies.length?[]:['- No curated synergies annotated.']),...e.mechanical.tensions.map(s=>`- Tension with ${safe(s)}`),'');
      if(o.thematic)out.push('**Thematic rationale:**',safe(e.thematicRationale),'');
      if(o.warnings&&e.confidence==='low')out.push('**Mapping review:** Low confidence; approved with the reviewer’s awareness.','');
      if(e.notes)out.push('**Review notes:**',safe(e.notes),'');
      if(o.sources)out.push('**Sources / provenance:**',...e.sources.map(s=>`- [${safe(s.type)}] ${safe(s.title||s.description||'Source')} ${s.url?`(${safe(s.url)})`:''}`),'');
      out.push('---','');
    }
  }
  if(p.supplementalRoles?.length)out.push('## Supplemental roles','',...p.supplementalRoles.flatMap(r=>[`### ${safe(r.name)} · ${safe(r.team)} · ${safe(r.edition)}`,'',safe(r.ability),'']));
  if(o.analysis)out.push('# Script Analysis','','## Mechanical Identity','',p.analysis.identity,'',...Object.entries(p.analysis.dimensions).flatMap(([k,v])=>[`## ${k[0].toUpperCase()+k.slice(1).replace(/([A-Z])/g,' $1')}`,'',v,'']),'## Important Interactions','',...p.analysis.interactions.map(s=>`- ${s}`),'',...(p.modelCritique?.mechanical?['## Model Critique','',p.modelCritique.mechanical,'']:[]),'# Theme Analysis','',`Faction distribution: ${Object.entries(p.themeAnalysis.factions).map(([k,v])=>`${k}: ${v}`).join('; ')}.`,'',`Important identities outside this cast: ${p.themeAnalysis.underused.join(', ')||'none annotated'}.`,'',...(p.modelCritique?.cast?[p.modelCritique.cast,'']:[]),p.analysis.method,'');
  if(o.warnings)out.push('## Known Concerns','',...[...p.analysis.warnings,...p.themeAnalysis.warnings].map(s=>`- ${s}`),'');
  out.push('# Mapping Reference','','| theme Character | BOTC Role | Team |','| --- | --- | --- |',...p.entries.map(e=>`| ${safe(e.identity.name)} | ${safe(e.botcRole.name)} | ${e.team} |`),'');
  if(o.history)out.push('# Revision Notes','',...p.history.filter(h=>h.version<=p.version).map(h=>`- v${h.version} — ${safe(h.note)} (${h.at})`),'');
  return out.join('\n');
}
module.exports={markdown};
