const fs=require('node:fs');
const path=require('node:path');
const {teams,norm,tokens,retrieve}=require('./knowledge');
const {ask}=require('./model');
const laya=require('./laya');
const casting=require('./character-casting');
const clone=x=>JSON.parse(JSON.stringify(x));
const criteria=root=>JSON.parse(fs.readFileSync(path.join(root,'data/design-criteria.json'),'utf8'));
const sum=(roles,k)=>roles.reduce((n,r)=>n+(r.mechanics?.[k]||0),0);
const roleFor=(kb,id)=>kb.botc.find(r=>r.id===id);
const charFor=(kb,id)=>kb.characters.find(c=>c.id===id);
function resolveCharacter(kb,name) {
  const n=norm(name);return kb.characters.find(c=>[c.id,c.name,...(c.aliases||[])].some(x=>norm(x)===n));
}
function preferences(kb,request) {
  const split=x=>Array.isArray(x)?x:String(x||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
  const required=split(request.requiredCharacters).map(name=>{const c=resolveCharacter(kb,name);if(!c)throw Error(`Required character "${name}" is not in the local Star Wars database. Add it or use an exact name/alias.`);return c.id;});
  const essential=split(request.essentialCharacters).map(name=>{const c=resolveCharacter(kb,name);if(!c)throw Error(`Priority character "${name}" is not in the local database.`);return c.id;});
  const avoid=split(request.avoid);
  const preferred=split(request.factions).concat(split(request.eras));
  const allowed=kb.characters.filter(c=>!avoid.some(a=>[c.id,c.name,...(c.aliases||[]),...(c.era||[]),...(c.factions||[])].some(x=>norm(x)===norm(a))));
  if(required.some(id=>!allowed.some(c=>c.id===id)))throw Error('A required character is also excluded. Resolve this constraint conflict.');
  return {required:[...new Set(required)],essential:[...new Set(essential)],avoid,preferred,allowed};
}
function analyse(kb,entries,root) {
  const roles=entries.map(e=>roleFor(kb,e.botcRole.id));
  const missing=entries.filter(e=>!roleFor(kb,e.botcRole.id));if(missing.length)throw Error(`This script contains BOTC roles outside your owned sets: ${missing.map(e=>e.botcRole.name||e.botcRole.id).join(', ')}. Enable their sets in My BOTC collection to edit or regenerate this saved script.`);
  const totals={};for(const r of roles)for(const[k,v]of Object.entries(r.mechanics||{}))totals[k]=(totals[k]||0)+v;
  const info=sum(roles,'startingInformation')+sum(roles,'recurringInformation');
  const corruption=sum(roles,'poisoning')+sum(roles,'drunkenness')+sum(roles,'misinformation');
  const warnings=[], interactions=[];
  const ids=roles.map(r=>r.id);
  for(const r of roles) {
    if(r.generationEligible===false)warnings.push(r.name+': explicitly included; '+(r.generationRestriction||'Storyteller adjudication is required.'));
    for(const j of r.jinxes||[])if(ids.includes(j.characterId)){
      const pair=[r.id,j.characterId].sort().join('|');
      const names=pair.split('|').map(id=>roleFor(kb,id).name).join(' / ');
      const text=`[Jinx ${pair}] ${names}: ${j.reason}`;
      if(!interactions.includes(text))interactions.push(text);
      warnings.push(`${names}: official jinx applies; review its rule under Important interactions.`);
    }
    for(const note of r.interactions?.storytellerNotes||[])if(r.annotationStatus!=='fixture')warnings.push(`${r.name}: ${note}`);
    for(const required of r.requiresRoles||[])if(!ids.includes(required))warnings.push(`${r.name}: required companion ${required} is absent.`);
    for(const id of r.interactions?.synergisesWith||[])if(ids.includes(id))interactions.push(`${r.name} ↔ ${roleFor(kb,id).name}: curated synergy. ${r.interactions?.storytellerNotes?.join(' ')||''}`);
    for(const id of r.interactions?.conflictsWith||[])if(ids.includes(id))warnings.push(`${r.name} / ${roleFor(kb,id).name}: curated tension; review their interaction.`);
    for(const id of r.interactions?.dangerousCombinations||[])if(ids.includes(id))warnings.push(`${r.name} / ${roleFor(kb,id).name}: dangerous combination flagged by your corpus; consult the source notes and required jinxes.`);
  }
  const th=criteria(root).warningThresholds;
  if(!roles.some(r=>r.team==='demon'))warnings.push('No Demon: this is not a standard playable script.');
  if(roles.some(r=>r.id==='imp')&&!roles.some(r=>r.team==='minion'))warnings.push('Imp has no available Minion on this script: its succession option lacks a normal target.');
  for(const r of roles)if(r.mechanics.registration&&!r.informationDistortion)warnings.push(`${r.name}: registration scope is unannotated; do not assume it affects every information role.`);
  if(!roles.some(r=>r.team==='outsider'))warnings.push('No Outsiders in this corpus slice: Outsider counts and relevance cannot be assessed.');
  if(!info)warnings.push('No annotated starting or recurring information. Good may lack investigative direction, or annotations are incomplete.');
  if(info>=th.information)warnings.push('High annotated information density; review the actual information combinations and evil counterplay.');
  if(corruption>=th.misinformation)warnings.push('Several corruption sources overlap; uncertainty may crowd out useful deduction.');
  if(sum(roles,'confirmation')>=th.hardConfirmation)warnings.push('Confirmation signals accumulate. Check how evil can explain or counterfeit them.');
  if(roles.filter(r=>r.complexity==='high').length*3>=th.complexity)warnings.push('Several high-complexity roles increase Storyteller burden.');
  if(roles.some(r=>r.fixture))warnings.push('Sample BOTC data: this is a pipeline demonstration, not a playtested or exhaustive design.');
  for(const r of roles)if(r.abilityTextStatus)warnings.push(`${r.name}: ${r.abilityTextStatus}`);
  const dimensions={
    information:`${info} annotated information signal points across ${roles.filter(r=>r.mechanics.recurringInformation||r.mechanics.startingInformation).length} roles. Inspect their actual information, rather than interpreting this as a balance score.`,
    reliability:corruption?`Information can be corrupted by ${roles.filter(r=>r.mechanics.poisoning||r.mechanics.drunkenness||r.mechanics.misinformation).map(r=>r.name).join(', ')}.`:'No annotated corruption source. This does not prove that all information is reliable.',
    evilStrategy:roles.filter(r=>['minion','demon'].includes(r.team)).map(r=>`${r.name}: ${(r.designRole||r.tags||[]).join(', ')}`).join('; ')||'No evil roles.',
    bluffability:`${sum(roles,'bluffability')} annotated bluffability signals. Evil must sustain claims consistent with the selected information and confirmation mechanics.`,
    outsiderRelevance:roles.filter(r=>r.team==='outsider').map(r=>`${r.name}: ${(r.designRole||[]).join(', ')}`).join('; ')||'No Outsiders present.',
    socialPressure:roles.filter(r=>r.mechanics.nominationInteraction||r.mechanics.votingInteraction||r.mechanics.executionInteraction||r.mechanics.deathInteraction).map(r=>r.name).join(', ')||'No annotated nomination, execution, voting or death interactions.',
    complexity:`${roles.filter(r=>r.complexity==='high').length} high-complexity roles. Missing complexity metadata is not evidence of simplicity.`
  };
  const identity=info && corruption?'Information under pressure: good builds competing worlds while evil disrupts their reliability.':info?'An information-driven investigation; review whether evil has enough ways to create competing worlds.':'Social deduction with limited annotated information; inspect the corpus for missing metadata.';
  return {identity,totals,dimensions,interactions:[...new Set(interactions)],warnings:[...new Set(warnings)],method:'Transparent corpus heuristics, not a balance proof or rules simulator.'};
}
function roleReview(kb,role,entries,analysis) {
  const others=entries.map(e=>roleFor(kb,e.botcRole.id)).filter(r=>r.id!==role.id);
  const synergies=others.filter(r=>(role.interactions?.synergisesWith||[]).includes(r.id)||(r.interactions?.synergisesWith||[]).includes(role.id)).map(r=>`${r.name}: ${(role.interactions?.storytellerNotes||[]).join(' ')||'Curated synergy in the supplied interaction metadata.'}`).concat((role.jinxes||[]).filter(j=>others.some(r=>r.id===j.characterId)).map(j=>`Official jinx with ${roleFor(kb,j.characterId).name}: ${j.reason}`));
  const tensions=others.filter(r=>(role.interactions?.conflictsWith||[]).includes(r.id)||(r.interactions?.conflictsWith||[]).includes(role.id)).map(r=>r.name);
  const corrupters=others.filter(r=>r.mechanics.poisoning||r.mechanics.drunkenness||(r.mechanics.registration&&(r.informationDistortion?.scope==='others'||r.informationDistortion?.affectsRoleIds?.includes(role.id))));
  const info=role.mechanics.recurringInformation||role.mechanics.startingInformation;
  const purpose=(role.designRole||role.tags||[]).join(', ') || 'Mechanical purpose metadata has not been supplied.';
  const context=info?`Within this script, ${role.name} contributes ${purpose}. ${corrupters.length?`${corrupters.map(r=>r.name).join(', ')} can compromise its information; track those worlds before trusting claims.`:'No other annotated poisoning, drunkenness or applicable registration source is present; inspect how evil can contest its claims.'}${role.informationDistortion?.scope==='self'?' Its own registration exception affects its own information, not unrelated roles.':''}`:`Within this script, ${role.name} contributes ${purpose}. ${others.filter(r=>r.mechanics.recurringInformation).length} recurring-information roles provide surrounding investigative pressure.`;
  const importance=Object.values(role.mechanics).reduce((n,v)=>n+v,0)+(synergies.length*2);
  return {purpose,context,synergies,tensions,importance,concerns:analysis.warnings.filter(w=>w.includes(role.name)),bluffing:`${role.mechanics.bluffability||0}/3 curated bluffability. ${role.explanation||'Inspect how this claim can be supported or undermined by the rest of the script.'}`,alternativesReason:'Alternatives are compared on the mechanical niche, script interactions, complexity and whole-script signal changes.'};
}
function candidate(kb,r,c,request,review,entries,context) {
  const cr=context.cr, themes=[];
  for(const[k,v]of Object.entries(r.mechanics))if(v>0)themes.push(...(cr.mechanicThemes[k]||[]));
  const profileFields=['themes','personality','narrativeFunctions','archetypes','tags'];
  const stop=new Set('the and or but for from with without this that these those their them they who whom whose one ones can could would should may might will shall has have had are was were been being into onto over under about also each any all not its our your you his her she him some than then when which what where how only very more most role roles ability abilities character characters chosen alignment'.split(' '));
  const useful=value=>new Set([...tokens(value)].filter(w=>!stop.has(w)));
  if(!context.words.has(c.id))context.words.set(c.id,{fields:profileFields.map(field=>({field,text:(c[field]||[]).join(' '),words:useful((c[field]||[]).join(' '))})),summary:useful(c.summary||'')});
  const profile=context.words.get(c.id);
  const signals=[...new Set([...themes,...(r.tags||[])].map(norm))].filter(term=>useful(term).size);
  const evidence=signals.map(term=>{const words=[...useful(term)];const fields=profile.fields.filter(f=>words.every(w=>f.words.has(w))).map(f=>f.field);const description=words.every(w=>profile.summary.has(w));return {term,fields:fields.concat(description?['summary']:[]),strength:fields.length?'tag':description?'description':null};}).filter(e=>e.strength);
  const matches=evidence.map(e=>e.term);
  const themeWords=useful(`${request.theme||''} ${request.tone||''}`);
  const themeMatches=[...themeWords].filter(t=>profile.fields.some(f=>f.words.has(t))||profile.summary.has(t));
  const evil=['minion','demon'].includes(r.team);
  const align=(c.alignment||[]).map(norm);
  const mismatch=(evil&&align.includes('good'))||(!evil&&align.includes('evil'));
  let score=evidence.reduce((sum,e)=>sum+(e.strength==='tag'?4:1),0)+Math.min(2,themeMatches.length)+(mismatch?-7:4);
  const pref=context.pref;
  score+=pref.preferred.filter(p=>[...(c.era||[]),...(c.factions||[])].some(x=>norm(x)===norm(p))).length*3;
  score+=(c.importance?.overall||0)*(review.importance/10)+(c.importance?.thematicImportance||0);
  if(c.galacticRacer)score+=({none:0,low:2,medium:5,high:9}[request.galacticRacerEmphasis]||0)+(c.importance?.galacticRacerImportance||0);
  if(request.demonsSith&&r.team==='demon'&&!(c.factions||[]).some(x=>norm(x)==='sith'))score-=10000;
  if(request.outsidersScoundrels&&r.team==='outsider'&&(c.archetypes||[]).some(x=>/smuggler|scoundrel/i.test(x)))score+=8;
  const related=(c.relationships||[]).filter(rel=>entries.some(e=>e.starWarsIdentity?.id===rel.characterId));
  score+=related.length;
  const low=matches.length<2||mismatch;
  const rationale=`${c.name}'s supplied traits connect to ${r.name} through ${matches.length?evidence.map(e=>e.term+' ('+e.fields.join(', ')+')').join('; '):'limited annotated overlap; this mapping needs human review'}. ${themeMatches.length?`The brief also overlaps on ${themeMatches.join(', ')}. `:''}${mismatch?'Alignment crosses the normal good/evil presentation; supply a specific narrative justification before approval. ':''}Recognisability/importance: ${c.importance?.recognisability??'unannotated'}/3; script impact signal ${review.importance}. ${related.length?`Cast relationships: ${related.map(x=>`${x.type} with ${charFor(kb,x.characterId)?.name||x.characterId}`).join('; ')}.`:'No relationship to the current cast is annotated.'}${c.galacticRacer?' Galactic Racer context is attached to this same identity.':''}`;
  return {id:c.id,name:c.name,score,confidence:low?'low':'supported',rationale,profile:casting.profile(c),fit:{personality:(c.personality||[]).join(', '),narrative:(c.narrativeFunctions||[]).join(', '),metaphor:matches.join(', '),evidence,briefMatches:themeMatches,importance:c.importance||{},relationships:related},mismatch};
}
// Hungarian assignment maximises fit across the whole cast, not row-by-row greedy choices.
function assign(weights) {
  const n=weights.length;if(!n)return [];
  const m=weights[0].length;if(m<n)throw Error('Assignment requires at least one unique identity per role.');
  const u=Array(n+1).fill(0),v=Array(m+1).fill(0),p=Array(m+1).fill(0),way=Array(m+1).fill(0);
  for(let i=1;i<=n;i++) {p[0]=i;let j0=0;const min=Array(m+1).fill(Infinity),used=Array(m+1).fill(false);
    do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=m;j++)if(!used[j]){const cur=-weights[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}for(let j=0;j<=m;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;j0=j1;}while(p[j0]!==0);
    do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
  }
  const out=Array(n);for(let j=1;j<=m;j++)if(p[j])out[p[j]-1]=j-1;return out;
}
// Quota-constrained assignment keeps priorities soft and Racer minimums hard.
function assignWithRacerQuota(weights,racerFlags,minimum){
  if(!minimum)return assign(weights);
  const n=weights.length,m=racerFlags.length,source=0,roles=1,characters=roles+n,racers=characters+m,others=racers+1,sink=others+1;
  const graph=Array.from({length:sink+1},()=>[]);
  const edge=(a,b,capacity,cost)=>{const f={to:b,capacity,cost,reverse:graph[b].length},r={to:a,capacity:0,cost:-cost,reverse:graph[a].length};graph[a].push(f);graph[b].push(r);return f;};
  const choices=weights.map((row,i)=>{edge(source,roles+i,1,0);return row.map((score,j)=>edge(roles+i,characters+j,1,-score));});
  racerFlags.forEach((flag,j)=>edge(characters+j,flag?racers:others,1,0));edge(racers,sink,n,0);edge(others,sink,n-minimum,0);
  for(let flow=0;flow<n;flow++){
    const distance=Array(graph.length).fill(Infinity),previous=Array(graph.length),queued=Array(graph.length).fill(false),queue=[source];distance[source]=0;queued[source]=true;
    for(let q=0;q<queue.length;q++){const a=queue[q];queued[a]=false;graph[a].forEach((e,k)=>{if(e.capacity&&distance[e.to]>distance[a]+e.cost+1e-8){distance[e.to]=distance[a]+e.cost;previous[e.to]=[a,k];if(!queued[e.to]){queued[e.to]=true;queue.push(e.to);}}});}
    if(!previous[sink])throw Error('Cannot satisfy the Racer minimum with the allowed identities and locks.');
    for(let b=sink;b!==source;){const[a,k]=previous[b],e=graph[a][k];e.capacity--;graph[b][e.reverse].capacity++;b=a;}
  }
  return choices.map(row=>row.findIndex(e=>e.capacity===0));
}
function mapCast(kb,project,root) {
  const pref=preferences(kb,project.request);
  const entries=project.entries;
  const fixed=entries.filter(e=>e.locks.starWarsCharacter);
  if(project.request.demonsSith&&fixed.some(e=>roleFor(kb,e.botcRole.id)?.team==='demon'&&!(charFor(kb,e.starWarsIdentity?.id)?.factions||[]).some(f=>norm(f)==='sith')))throw Error('A locked Demon identity is not Sith. Unlock it or change the Sith constraint before regenerating.');
  const used=fixed.map(e=>e.starWarsIdentity?.id).filter(Boolean);
  const available=pref.allowed.filter(c=>!used.includes(c.id));
  const open=entries.filter(e=>!e.locks.starWarsCharacter);
  const minRacer=Number(project.request.minRacer||0);
  if(!Number.isInteger(minRacer)||minRacer<0||minRacer>entries.length)throw Error('Minimum Racer count must be a nonnegative integer no larger than the script.');
  const fixedRacer=fixed.filter(e=>charFor(kb,e.starWarsIdentity?.id)?.galacticRacer).length;
  if(fixedRacer+Math.min(open.length,available.filter(c=>c.galacticRacer).length)<minRacer)throw Error('Insufficient available Galactic Racer identities to meet your minimum around the current locks. Add supplied Racer context or reduce the minimum.');
  if(available.length<open.length)throw Error(`Need ${open.length} unlocked unique Star Wars identities, but only ${available.length} allowed records are available. Add corpus records or reduce the script size.`);
  if(pref.required.length>entries.length)throw Error('More required characters than script slots.');
  if(used.some(id=>!pref.allowed.some(c=>c.id===id)))throw Error('A locked identity is excluded by current constraints.');
  const a=analyse(kb,entries,root);
  const context={cr:criteria(root),pref,words:new Map()};
  const scores=open.map(e=>{const role=roleFor(kb,e.botcRole.id),review=roleReview(kb,role,entries,a);return available.map(c=>candidate(kb,role,c,project.request,review,entries,context));});
  const legalScores=scores.flat().filter(s=>s.score>=-5000).map(s=>s.score);
  const fitRange=legalScores.length?Math.max(...legalScores)-Math.min(...legalScores)+1:1;
  const priorityBonus=fitRange*(open.length+1),requiredBonus=priorityBonus*(open.length+1);
  const weights=scores.map(row=>row.map(s=>s.score < -5000?-1e12:s.score+(pref.required.includes(s.id)?requiredBonus:0)+(pref.essential.includes(s.id)?priorityBonus:0)));
  const allocation=assignWithRacerQuota(weights,available.map(c=>!!c.galacticRacer),Math.max(0,minRacer-fixedRacer));
  open.forEach((e,i)=>{const picked=scores[i][allocation[i]];if(picked.score < -5000)throw Error('Cannot fulfil the Sith Demon constraint with the available unique identities.');e.starWarsIdentity={id:picked.id,name:picked.name};e.thematicRationale=picked.rationale;e.confidence=picked.confidence;});
  if(pref.required.some(id=>!entries.some(e=>e.starWarsIdentity?.id===id)))throw Error('Required cast constraint could not be satisfied.');
  if(entries.filter(e=>charFor(kb,e.starWarsIdentity?.id)?.galacticRacer).length<minRacer)throw Error('Required characters and Racer count conflict with the available script slots.');
  return project;
}
async function modelMap(kb,p,root) {
  const pref=preferences(kb,p.request);
  const candidates=p.entries.map(e=>({roleId:e.botcRole.id,locked:e.locks.starWarsCharacter,current:e.starWarsIdentity,mechanical:e.mechanical,candidates:e.candidates}));
  const result=await ask(root,'Select a coherent Star Wars cast from the explicitly listed per-role candidates. Return {mappings:[{roleId:string,characterId:string,rationale:string}]}. Include every role exactly once. Honour locked identities, required characters, minimum Racer count and Sith Demon constraints. Use unique identities. Mechanics are immutable.',{request:p.request,candidates,records:retrievalContext(kb,p,p.request.theme||'',null).records},true);
  if(!result)return;
  if(!Array.isArray(result.mappings)||result.mappings.length!==p.entries.length)throw Error('Model mapping proposal must include every role exactly once.');
  const seenRoles=new Set(),seenChars=new Set();
  for(const m of result.mappings){const e=p.entries.find(e=>e.botcRole.id===m.roleId),c=charFor(kb,m.characterId);
    if(!e||!c||seenRoles.has(m.roleId)||seenChars.has(m.characterId)||!pref.allowed.some(c=>c.id===m.characterId)||(!e.candidates.some(c=>c.id===m.characterId)&&e.starWarsIdentity.id!==m.characterId)||(e.locks.starWarsCharacter&&e.starWarsIdentity.id!==m.characterId))throw Error('Model mapping violated candidates, uniqueness or locks. No changes applied.');
    if(p.request.demonsSith&&e.team==='demon'&&!(c.factions||[]).some(f=>norm(f)==='sith'))throw Error('Model mapping violated the Sith constraint.');
    seenRoles.add(m.roleId);seenChars.add(m.characterId);
  }
  if(pref.required.some(id=>!seenChars.has(id))||result.mappings.filter(m=>charFor(kb,m.characterId)?.galacticRacer).length<Number(p.request.minRacer||0))throw Error('Model mapping violated required-character or Racer constraints.');
  if(result.mappings.filter(m=>pref.essential.includes(m.characterId)).length<p.entries.filter(e=>pref.essential.includes(e.starWarsIdentity.id)).length)return;
  for(const m of result.mappings){const e=p.entries.find(e=>e.botcRole.id===m.roleId);e.starWarsIdentity={id:m.characterId,name:charFor(kb,m.characterId).name};e.thematicRationale=String(m.rationale||'No model rationale supplied.');e.customRationale=true;}
  refresh(kb,p,root);
}
function refresh(kb,project,root) {
  if(project.stage==='MECHANICS')return refreshMechanics(kb,project,root);
  if(project.workflow==='mechanics-first'&&project.mechanicalFoundation&&foundation(project)!==project.mechanicalFoundation)throw Error('The confirmed mechanical foundation cannot change.');
  project.analysis=analyse(kb,project.entries,root);
  const pref=preferences(kb,project.request);
  const context={cr:criteria(root),pref,words:new Map()};
  for(const e of project.entries) {
    if(e.layaComparison&&e.layaComparison.contextKey!==casting.contextKey(project)){delete e.layaComparison;delete e.layaRecommendation;delete e.layaSuggestions;delete e.layaCompared;}
    const r=roleFor(kb,e.botcRole.id);if(!r)throw Error(`Missing BOTC corpus record: ${e.botcRole.id}`);
    e.botcRole={id:r.id,name:r.name,edition:r.edition,officialEdition:r.officialEdition};e.team=r.team;e.ability=project.workflow==='mechanics-first'&&e.ability!==undefined?e.ability:r.ability;e.jinxes=clone(r.jinxes||[]);e.sources=r.sources||[];
    e.abilityTextStatus=r.abilityTextStatus||null;
    e.mechanical=roleReview(kb,r,project.entries,project.analysis);
    e.candidates=casting.pool(pref.allowed,project.request,project.entries).filter(c=>!(project.request.demonsSith&&r.team==='demon')||(c.factions||[]).some(f=>norm(f)==='sith')).map(c=>({...candidate(kb,r,c,project.request,e.mechanical,project.entries,context),priority:pref.essential.includes(c.id),classification:(c.archetypes||[]).join(', ')})).sort((a,b)=>Number(b.priority)-Number(a.priority)||b.score-a.score).slice(0,12);
    if(e.layaSuggestions?.length){const ranks=new Map(e.layaSuggestions.map(s=>[s.id,s.rank]));e.candidates.sort((a,b)=>(ranks.get(a.id)||99)-(ranks.get(b.id)||99)||Number(b.priority)-Number(a.priority)||b.score-a.score);}
    else if(e.layaRecommendation&&e.layaComparison?.status==='clear')e.candidates.sort((a,b)=>Number(b.priority)-Number(a.priority)||Number(b.id===e.layaRecommendation.choice)-Number(a.id===e.layaRecommendation.choice)||b.score-a.score);
    const c=charFor(kb,e.starWarsIdentity?.id);
    if(c){const fit=candidate(kb,r,c,project.request,e.mechanical,project.entries,context);e.confidence=fit.confidence;if(!e.customRationale)e.thematicRationale=fit.rationale;e.fit=fit.fit;e.sources=[...(r.sources||[]),...(c.sources||[]),...(c.galacticRacer?.sources||[])];}
    else {e.confidence=e.starWarsIdentity?'low':'unassigned';e.thematicRationale=e.starWarsIdentity?'Identity missing from corpus. Resolve before approval.':'Review the candidates below and choose an identity for this role.';}
  }
  const chars=project.entries.map(e=>charFor(kb,e.starWarsIdentity?.id)).filter(Boolean);
  const warnings=project.entries.filter(e=>e.confidence==='low').map(e=>`${e.botcRole.name}: weak or cross-alignment thematic mapping; review ${e.starWarsIdentity?.name||'missing identity'}.`);
  const requiredMissing=pref.required.filter(id=>!chars.some(c=>c.id===id));
  if(requiredMissing.length)warnings.push(`Required identities missing: ${requiredMissing.join(', ')}`);
  const factions={};for(const c of chars)for(const f of c.factions||[])factions[f]=(factions[f]||0)+1;
  const eras={};for(const c of chars)for(const era of c.era||[])eras[era]=(eras[era]||0)+1;
  const archetypes={};for(const c of chars)for(const a of c.archetypes||[])archetypes[a]=(archetypes[a]||0)+1;
  for(const[f,n]of Object.entries(factions))if(n>chars.length*.65&&chars.length>3)warnings.push(`Faction concentration: ${f} appears in ${n}/${chars.length} identities. Check whether this supports the brief.`);
  for(const[e,n]of Object.entries(eras))if(n>chars.length*.8&&chars.length>4)warnings.push(`Era concentration: ${e} appears in ${n}/${chars.length} identities.`);
  for(const[a,n]of Object.entries(archetypes))if(n>2)warnings.push(`Repeated archetype ${a}: ${n} identities; consider whether their functions are distinct.`);
  const racerCount=chars.filter(c=>c.galacticRacer).length;
  if((Number(project.request.minRacer)||0)>racerCount)warnings.push(`Requested ${project.request.minRacer} Galactic Racer identities; current cast has ${racerCount}.`);
  if(project.request.galacticRacerEmphasis!=='none'&&project.request.galacticRacerEmphasis&&racerCount===0)warnings.push('Galactic Racer emphasis requested, but no attached Racer identities are in the cast. No Racer lore has been invented.');
  const underused=kb.characters.filter(c=>!chars.some(x=>x.id===c.id)&&(c.importance?.overall||0)>=2).map(c=>c.name);
  const priority={selected:pref.essential.filter(id=>chars.some(c=>c.id===id)).map(id=>charFor(kb,id).name),omitted:pref.essential.filter(id=>!chars.some(c=>c.id===id)).map(id=>({id,name:charFor(kb,id).name,reason:!pref.allowed.some(c=>c.id===id)?'Excluded by your avoid list.':'Not assigned yet. Compatible priority candidates appear first; you choose their roles.'}))};
  project.themeAnalysis={warnings,factions,eras,archetypes,racerCount,priority,underused,weakest:project.entries.filter(e=>e.confidence==='low').map(e=>e.botcRole.name).slice(0,3),method:'Candidate suggestions prioritise your essential pool, then narrative fit. Assignments require your choice; fit labels are editorial judgments.'};
  return project;
}
function goals(request,root) {
  const cr=criteria(root);const text=norm(`${request.theme||''} ${request.tone||''} ${request.mechanicalPreferences||''}`);
  const focus=Object.keys(cr.themeMechanics).filter(k=>text.includes(k));
  return {focus,mechanics:[...new Set(focus.flatMap(k=>cr.themeMechanics[k]))],tone:request.tone,complexity:request.complexity,requiredCharacters:request.requiredCharacters,galacticRacerEmphasis:request.galacticRacerEmphasis};
}
function requestedRoles(kb,request){
 const split=value=>Array.isArray(value)?value:String(value||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
 const resolve=name=>{const r=kb.botc.find(r=>[r.id,r.name,...(r.aliases||[])].some(x=>norm(x)===norm(name)));if(!r)throw Error('Requested BOTC role "'+name+'" is not available in your owned sets. Enable its set or correct its name.');return r.id;};
 const required=split(request.requiredBotcRoles).map(resolve),excluded=split(request.excludedBotcRoles).map(resolve);
 const must=[...new Set(required)],avoid=[...new Set(excluded)];if(must.some(id=>avoid.includes(id)))throw Error('A BOTC role is both requested and excluded. Resolve the conflicting preferences.');return {required:must,excluded:avoid};
}
async function chooseRoles(kb,request,root,fixed=[]) {
  const target=request.size||{townsfolk:13,outsider:4,minion:4,demon:4};
  const requested=requestedRoles(kb,request);
  fixed=[...new Set([...fixed,...requested.required])];
  if(fixed.some(id=>requested.excluded.includes(id)))throw Error('A locked or requested BOTC role is excluded. Unlock it or adjust your preferences.');
  const g={...goals(request,root),requiredRoles:requested.required,excludedRoles:requested.excluded}, selected=[...fixed];
  const trace=[];
  for(const team of teams) {
    const count=Number(target[team]);if(!Number.isInteger(count)||count<0||count>60)throw Error('Each team size must be an integer from 0 to 60.');
    const pool=kb.botc.filter(r=>r.team===team&&r.generationEligible!==false&&!selected.includes(r.id)&&!requested.excluded.includes(r.id));
    const needed=count-selected.filter(id=>roleFor(kb,id)?.team===team).length;
    if(needed<0)throw Error(`Requested / locked ${team} roles (${selected.filter(id=>roleFor(kb,id)?.team===team).map(id=>roleFor(kb,id).name).join(', ')}) exceed the requested size of ${count}. Increase that team size or remove a requirement.`);
    if(pool.length<needed)throw Error(`Insufficient ${team} data: need ${needed} additional roles, have ${pool.length}. Enable the appropriate sets in My BOTC collection, or reduce the requested team sizes.`);
    for(let i=0;i<needed;i++) {
      const ranked=pool.filter(r=>!selected.includes(r.id)).map(r=>{
        const current=selected.map(id=>roleFor(kb,id));
        const focus=g.mechanics.reduce((n,k)=>n+(r.mechanics[k]||0),0);
        const synergy=(r.interactions?.synergisesWith||[]).filter(id=>selected.includes(id)).length*3;
        const danger=(r.interactions?.dangerousCombinations||[]).filter(id=>selected.includes(id)).length*12;
        const niche=Object.entries(r.mechanics).filter(([k,v])=>v>0&&!current.some(x=>x.mechanics[k]>0)).length*2;
        const overlap=current.filter(x=>JSON.stringify(x.designRole)===JSON.stringify(r.designRole)).length*3;
        const complexity=request.complexity==='low'&&r.complexity==='high'?8:0;
        return {id:r.id,score:focus+synergy+niche-danger-overlap-complexity,reason:`theme signals ${focus}; complementary niches ${niche}; curated synergy ${synergy}; dangerous-pair penalty ${danger}; overlap penalty ${overlap}; complexity penalty ${complexity}`};
      }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
      const shortlist=ranked.slice(0,4);
      laya.progress(root,{message:`${laya.available(root)?'Laya':'Corpus rules'}: choosing ${team} slot ${i+1} of ${needed}`,roles:selected.map(id=>{const r=roleFor(kb,id);return {name:r.name,team:r.team,ability:r.ability};})});
      const decision=await laya.choose(root,{brief:request.mechanicalBrief||request.theme||'',preferences:request.mechanicalPreferences||'',tone:request.tone||'',complexity:request.complexity,selected:selected.map(id=>roleFor(kb,id).name).join(', ')},shortlist.map(x=>{const r=roleFor(kb,x.id);return {id:x.id,description:r.name+': '+r.ability.slice(0,160)};}),'Choose the next BOTC role that best supports the requested mechanics and complements the current script. Use ability meaning, not merely matching words.');
      const chosen=decision?shortlist.find(x=>x.id===decision.choice):ranked[0];
      selected.push(chosen.id);trace.push({chosen,alternatives:shortlist.filter(x=>x!==chosen),...(decision?{laya:decision}:{})});
    }
  }
  // A bounded mechanical pass; no Star Wars characters enter role selection.
  const candidates=retrieve(kb,`${request.theme} ${g.mechanics.join(' ')}`,{roleIds:selected,limit:Math.max(selected.length,Math.min(80,kb.botc.length))}).filter(x=>x.kind==='botc'&&!requested.excluded.includes(x.record.id)&&(x.record.generationEligible!==false||fixed.includes(x.record.id)));
  const proposal=await ask(root,'Select a mechanically coherent script from these BOTC candidates only. Return {roleIds: string[], rationale: string}. Honour exact team sizes and fixed role IDs. No abilities or Star Wars identities. Evaluate complementarity, evil counterplay and dangerous interactions.',{request,goals:g,teamSizes:target,fixed,candidates,heuristicProposal:selected},true);
  if(proposal) {
    const ids=proposal.roleIds;
    if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!candidates.some(x=>x.record.id===id))||fixed.some(id=>!ids.includes(id))||teams.some(t=>ids.filter(id=>roleFor(kb,id)?.team===t).length!==Number(target[t])))throw Error('Model role proposal violated candidate, composition or lock constraints. No changes applied.');
    return {ids,goals:g,trace,modelRationale:proposal.rationale};
  }
  return {ids:selected,goals:g,trace,modelRationale:null};
}
async function createLegacy(kb,request,root,imported) {
  preferences(kb,request);
  const design=request.mode==='retheme'?{ids:imported,goals:goals(request,root),trace:[]}:await chooseRoles(kb,request,root);
  if(!Array.isArray(design.ids)||!design.ids.length||design.ids.some(id=>!roleFor(kb,id))||new Set(design.ids).size!==design.ids.length)throw Error('Confirm a nonempty, recognised, unique role list before creating the project.');
  const project={id:require('node:crypto').randomUUID(),title:request.title||'Untitled script',state:'DRAFT',request:clone(request),goals:design.goals,designTrace:design.trace,modelRationale:design.modelRationale,importedRoleIds:request.mode==='retheme'?[...design.ids]:null,entries:design.ids.map(id=>({botcRole:{id},starWarsIdentity:null,locks:{botcRole:false,starWarsCharacter:false},notes:'',reviewResolved:true})),conversation:[],createdAt:new Date().toISOString()};
  mapCast(kb,project,root);refresh(kb,project,root);await modelMap(kb,project,root);
  await enrich(kb,project,root);
  return project;
}
async function enrich(kb,p,root) {
  const context=retrievalContext(kb,p,'Critique script and whole cast',null);
  const result=await ask(root,'Critique the mechanical system and whole Star Wars cast independently. Return {mechanicalCritique:string, castCritique:string, mappings:[{roleId:string, rationale:string}]}. Never change composition or identities. Cite supplied IDs; state dataset gaps.',context,true);
  if(result){p.modelCritique={mechanical:String(result.mechanicalCritique||''),cast:String(result.castCritique||'')};for(const m of result.mappings||[]){const e=p.entries.find(e=>e.botcRole.id===m.roleId);if(e&&typeof m.rationale==='string'){e.thematicRationale=m.rationale;e.customRationale=true;}}}
}
function retrievalContext(kb,p,query,selectedId) {
  const e=p.entries.find(e=>e.botcRole.id===selectedId);
  const r=e?roleFor(kb,e.botcRole.id):null;
  const namedRoles=kb.botc.filter(r=>norm(query).includes(norm(r.name))).map(r=>r.id);
  const namedCharacters=kb.characters.filter(c=>[c.name,...(c.aliases||[])].some(n=>norm(query).includes(norm(n)))).map(c=>c.id);
  const roleIds=[...new Set([...(r?[r.id,...(r.interactions?.synergisesWith||[]),...(r.interactions?.conflictsWith||[])]:[]),...namedRoles])];
  const characterIds=[...new Set([...(e?[e.starWarsIdentity?.id,...e.candidates.slice(0,3).map(c=>c.id)]:[]),...namedCharacters])];
  const records=retrieve(kb,query,{roleIds,characterIds,limit:Math.max(16,roleIds.length+characterIds.length)});
  return {request:p.request,selected:e,composition:p.entries.map(x=>({botcRole:x.botcRole,starWarsIdentity:x.starWarsIdentity,locks:x.locks})),analysis:p.analysis,themeAnalysis:p.themeAnalysis,records,retrieval:{query,roleIds,characterIds,files:records.map(x=>x.record._file)}};
}
function replacementOptions(kb,p,roleId,root) {
  if(p.workflow==='mechanics-first'&&(p.request.mode==='retheme'||p.stage==='RETHEME'))throw Error('The mechanical foundation is fixed. Imported scripts are preserved exactly.');
  analyse(kb,p.entries,root);
  const e=p.entries.find(e=>e.botcRole.id===roleId);if(!e)throw Error('Select a role first.');
  const r=roleFor(kb,roleId);
  return kb.botc.filter(x=>x.team===r.team&&!p.entries.some(e=>e.botcRole.id===x.id)).map(x=>{
    const copy=clone(p.entries);copy.find(e=>e.botcRole.id===roleId).botcRole.id=x.id;
    const after=analyse(kb,copy,root);
    const delta=Object.keys({...p.analysis.totals,...after.totals}).filter(k=>(after.totals[k]||0)!==(p.analysis.totals[k]||0)).map(k=>`${k}: ${p.analysis.totals[k]||0} → ${after.totals[k]||0}`);
    const shared=Object.keys(r.mechanics).filter(k=>r.mechanics[k]>0&&x.mechanics[k]>0);
    return {id:x.id,name:x.name,shared,delta,warnings:after.warnings,score:shared.length*3-(x.interactions?.dangerousCombinations||[]).filter(id=>p.entries.some(e=>e.botcRole.id===id)).length*10,explanation:`Retains annotated niches: ${shared.join(', ')||'none'}. Complexity ${r.complexity||'unannotated'} → ${x.complexity||'unannotated'}. Reassess claims, information dependencies and Star Wars mapping after replacement.`};
  }).sort((a,b)=>b.score-a.score);
}
function mutate(kb,p,action,root) {
  analyse(kb,p.entries,root);
  if(p.workflow==='mechanics-first'){
    if(['mapping','swap','approve'].includes(action.type)&&p.stage!=='RETHEME')throw Error('Confirm the mechanics before retheming or approving.');
    if(action.type==='role'&&(p.request.mode==='retheme'||p.stage==='RETHEME'))throw Error('The mechanical foundation is fixed. Imported scripts are preserved exactly.');
    if(action.type==='begin-retheme'){const out=clone(p);if(out.entries.some(e=>!e.reviewResolved))throw Error('Resolve mechanical review notes first.');out.stage='RETHEME';out.mechanicsConfirmedAt=new Date().toISOString();out.mechanicalFoundation=foundation(out);out.state='DRAFT';let ready=refresh(kb,out,root);for(const m of out.request.importMappings||[])ready=mutate(kb,ready,{type:'mapping',...m},root);return ready;}
  }
  const out=clone(p),e=out.entries.find(e=>e.botcRole.id===action.roleId);
  if(action.type==='mapping') {
    if(!e)throw Error('Select a role.');if(e.locks.starWarsCharacter)throw Error('Star Wars mapping is locked. Unlock it first.');
    const c=charFor(kb,action.characterId);if(!c||!preferences(kb,out.request).allowed.some(x=>x.id===c.id))throw Error('Choose an allowed identity from the corpus.');
    if(out.entries.some(x=>x!==e&&x.starWarsIdentity?.id===c.id))throw Error('Identity is already in the cast. Use Swap identities to exchange pairings.');
    if(out.request.demonsSith&&e.team==='demon'&&!(c.factions||[]).some(f=>norm(f)==='sith'))throw Error('Choose a Sith identity for this Demon.');
    e.starWarsIdentity={id:c.id,name:c.name};e.customRationale=false;
  } else if(action.type==='swap') {
    const other=out.entries.find(x=>x.botcRole.id===action.otherRoleId);if(!e||!other||e===other)throw Error('Select two different roles.');
    if(e.locks.starWarsCharacter||other.locks.starWarsCharacter)throw Error('Both identity mappings must be unlocked for a swap.');
    [e.starWarsIdentity,other.starWarsIdentity]=[other.starWarsIdentity,e.starWarsIdentity];e.customRationale=other.customRationale=false;
  } else if(action.type==='role') {
    if(!e)throw Error('Select a role.');if(e.locks.botcRole)throw Error('BOTC role is locked. Unlock it first.');
    if(out.request.mode==='retheme'&&action.explicitMechanicalChange!==true)throw Error('Imported composition is preserved. Explicitly request a mechanical change.');
    const r=roleFor(kb,action.newRoleId);if(!r||r.team!==e.team||out.entries.some(x=>x.botcRole.id===r.id))throw Error('Choose an unused, same-team BOTC record.');
    e.botcRole={id:r.id,name:r.name};delete e.ability;e.customRationale=false;
  } else if(action.type==='locks') {if(!e)throw Error('Select a role.');e.locks={botcRole:!!action.botcRole,starWarsCharacter:!!action.starWarsCharacter};
  } else if(action.type==='notes') {if(!e)throw Error('Select a role.');e.notes=String(action.notes||'');e.reviewResolved=!!action.resolved;
  } else if(action.type==='request') {for(const entry of out.entries){delete entry.layaRecommendation;delete entry.layaComparison;delete entry.layaSuggestions;delete entry.layaCompared;}out.request={...out.request,...action.request,mode:out.request.mode};out.title=out.request.title||out.title;if(out.stage!=='MECHANICS')preferences(kb,out.request);
  } else if(action.type==='review')out.state='REVIEW';
  else if(action.type==='approve') {
    const pref=preferences(kb,out.request);
    if(out.entries.some(e=>!charFor(kb,e.starWarsIdentity?.id)||!e.reviewResolved))throw Error('Resolve missing identities and outstanding review notes before approval.');
    if(pref.required.some(id=>!out.entries.some(e=>e.starWarsIdentity.id===id)))throw Error('Required characters are missing.');
    if(out.entries.some(e=>!pref.allowed.some(c=>c.id===e.starWarsIdentity.id)))throw Error('An excluded identity remains in the cast.');
    if(out.request.demonsSith&&out.entries.filter(e=>e.team==='demon').some(e=>!(charFor(kb,e.starWarsIdentity.id).factions||[]).some(f=>norm(f)==='sith')))throw Error('The all-Demons-Sith constraint is not met.');
    if(Number(out.request.minRacer||0)>out.themeAnalysis.racerCount)throw Error('Minimum Galactic Racer representation has not been met.');
    out.state='APPROVED';out.approvedAt=new Date().toISOString();
  } else throw Error('Unknown action.');
  if(!['approve','review'].includes(action.type)){out.state='DRAFT';delete out.approvedAt;}
  return refresh(kb,out,root);
}
async function regenerate(kb,p,root) {
  if(p.workflow==='mechanics-first'){
    analyse(kb,p.entries,root);
    const out=clone(p);
    if(p.stage==='MECHANICS'&&p.request.mode==='create'){const d=await chooseRoles(kb,p.request,root,p.entries.filter(e=>e.locks.botcRole).map(e=>e.botcRole.id));out.entries=d.ids.map(id=>clone(p.entries.find(e=>e.botcRole.id===id)||blankEntry(id)));out.goals=d.goals;out.designTrace=d.trace;out.modelRationale=d.modelRationale;}
    out.state='DRAFT';delete out.approvedAt;return refresh(kb,out,root);
  }
  analyse(kb,p.entries,root);
  const out=clone(p);
  if(p.request.mode==='create') {
    const fixed=p.entries.filter(e=>e.locks.botcRole||e.locks.starWarsCharacter).map(e=>e.botcRole.id);
    const design=await chooseRoles(kb,p.request,root,fixed);
    out.entries=design.ids.map(id=>clone(p.entries.find(e=>e.botcRole.id===id)||{botcRole:{id},locks:{botcRole:false,starWarsCharacter:false},notes:'',reviewResolved:true}));
    out.designTrace=design.trace;out.goals=design.goals;out.modelRationale=design.modelRationale;
  }
  for(const e of out.entries)if(!e.locks.starWarsCharacter)e.customRationale=false;
  mapCast(kb,out,root);refresh(kb,out,root);await modelMap(kb,out,root);await enrich(kb,out,root);out.state='DRAFT';delete out.approvedAt;return out;
}
async function review(kb,p,query,selectedId,root) {
  if(p.stage==='MECHANICS'){analyse(kb,p.entries,root);const e=p.entries.find(e=>e.botcRole.id===selectedId);const decision=await laya.choose(root,{question:query,brief:p.request.mechanicalBrief||'',role:e?e.botcRole.name+': '+e.ability:'Whole script',warnings:p.analysis.warnings.slice(0,3)},[{id:'information',description:'Information reliability, poisoning and misinformation'},{id:'counterplay',description:'Evil pressure, good counterplay and win conditions'},{id:'storyteller',description:'Storyteller judgement, wishes and special adjudication'},{id:'composition',description:'Role composition, synergy and redundancy'}],'Which mechanical aspect should be reviewed for the supplied question?');return {answer:[decision?'Embedded Laya review focus: '+decision.choice+' (shortlist confidence '+Math.round(decision.confidence*100)+'%). Source-backed notes follow.':null,p.analysis.identity,e?.mechanical.context,...(e?.mechanical.synergies||[]),...p.analysis.interactions,...p.analysis.warnings].filter(Boolean).join('\n\n'),proposal:null,retrieval:{query,roleIds:p.entries.map(e=>e.botcRole.id),files:p.entries.flatMap(e=>e.sources||[]).map(s=>s.url).filter(Boolean)},engine:decision?'embedded Laya + corpus review':'offline mechanical review',laya:decision};}
  analyse(kb,p.entries,root);
  const context=retrievalContext(kb,p,query,selectedId);
  const e=p.entries.find(e=>e.botcRole.id===selectedId);
  const named=kb.botc.find(r=>norm(query).includes(norm(r.name)));
  const target=named?p.entries.find(e=>e.botcRole.id===named.id):e;
  const n=norm(query);
  let proposal=null, answer;
  if(/^lock (this|it|both)/.test(n)&&target)proposal={type:'locks',roleId:target.botcRole.id,botcRole:true,starWarsCharacter:true};
  if(/^replace|^change/.test(n)&&target) {
    const opts=replacementOptions(kb,p,target.botcRole.id,root);
    const explicit=/botc|mechanic|replace\s+(?:the\s+)?(?:empath|fortune teller|poisoner|imp)/i.test(query)||(named&&/replace/i.test(query));
    if(explicit&&opts.length){proposal={type:'role',roleId:target.botcRole.id,newRoleId:opts[0].id,explicitMechanicalChange:true};answer=opts.map(o=>`${o.name}: ${o.explanation}\n${o.delta.join('; ')}\n${o.warnings.join('\n')}`).join('\n\n');}
    else {const alt=target.candidates.find(c=>!p.entries.some(e=>e.starWarsIdentity?.id===c.id));if(alt)proposal={type:'mapping',roleId:target.botcRole.id,characterId:alt.id};answer=explicit?'No unused same-team BOTC alternatives are available in the corpus. Add records to compare mechanical replacements.':target.candidates.map(c=>`${c.name}: ${c.rationale}`).join('\n\n');}
  }
  const modelAnswer=await ask(root,'Answer the review question using retrieved records and script context. Return {answer:string, proposal:null|object}. This is advisory: never claim changes were applied. Proposal types: mapping {roleId,characterId}, swap {roleId,otherRoleId}, role {roleId,newRoleId}, locks {roleId,botcRole,starWarsCharacter}, request {request:{requiredCharacters,essentialCharacters,avoid,factions,eras,galacticRacerEmphasis,minRacer}}. Every proposal has a type field. Use existing corpus IDs. A role change requires an explicit user request to change BOTC mechanics. Respect locks; describe script-wide effects. Return null when explaining rather than proposing a change. User question: '+query,context,true);
  if(modelAnswer){
    if(typeof modelAnswer.answer!=='string')throw Error('Model review must contain a text answer.');
    answer=modelAnswer.answer;
    const suggested=modelAnswer.proposal;
    if(suggested){
      if(!['mapping','swap','role','locks','request'].includes(suggested.type))throw Error('Unsupported model proposal; no changes applied.');
      if(suggested.type==='role'){
        const explicit=/replace|change|different|swap|remove/i.test(query)&&(/botc|mechanic/i.test(query)||!!named);
        if(!explicit)throw Error('Model attempted a mechanical edit without an explicit request. No changes applied.');
        suggested.explicitMechanicalChange=true;
        const comparison=replacementOptions(kb,p,suggested.roleId,root).find(o=>o.id===suggested.newRoleId);
        if(!comparison)throw Error('Model replacement is not an unused same-team corpus role.');
        answer+='\n\nReplacement consequences:\n'+comparison.explanation+'\n'+comparison.delta.join('\n')+'\n'+comparison.warnings.join('\n');
      }
      engineProposalCheck(kb,p,suggested,root);
      proposal=suggested;
    }
  }
  if(!answer) {
    if(/weak|questionable/.test(n))answer=`Weak mappings: ${p.themeAnalysis.weakest.join(', ')||'none flagged by current annotations'}.\nMechanical concerns:\n${p.analysis.warnings.join('\n')}\n${p.themeAnalysis.warnings.join('\n')}`;
    else if(/misinformation|poison|minion|information|mechanical/.test(n))answer=`${p.analysis.identity}\n${Object.entries(p.analysis.dimensions).map(([k,v])=>`${k}: ${v}`).join('\n')}\n${p.analysis.warnings.join('\n')}`;
    else if(/underused|missing|why isn/.test(n))answer=`Important identities outside the cast: ${p.themeAnalysis.underused.join(', ')||'none annotated'}. Inclusion depends on the available mechanical niches, whole-cast fit, constraints and locks. Require a character in project constraints and regenerate to include it. No unprovided traits will be invented.`;
    else if(target)answer=`${target.starWarsIdentity?.name||target.botcRole.name} — ${target.botcRole.name}\n\nMechanical purpose: ${target.mechanical.context}\n\nThematic rationale: ${target.thematicRationale}\n\nSynergies: ${target.mechanical.synergies.join('; ')||'none annotated'}\nTensions: ${target.mechanical.tensions.join('; ')||'none annotated'}\n\nAlternatives: ${target.candidates.map(c=>c.name).join(', ')}`;
    else answer=`${p.analysis.identity}\n${p.analysis.warnings.join('\n')}\nSelect a role for contextual review. Configure a language model for broader natural-language interpretation; offline mode supports rationale, alternatives, warnings and explicit change proposals.`;
  }
  return {answer,proposal,retrieval:context.retrieval,engine:modelAnswer?'language model':'offline corpus rules'};
}
function engineProposalCheck(kb,p,proposal,root){mutate(kb,p,proposal,root);}
module.exports={create,createLegacy,refresh,analyse,mutate,regenerate,review,replacementOptions,retrievalContext,assign,clone};

function blankEntry(id){return {botcRole:{id},starWarsIdentity:null,locks:{botcRole:false,starWarsCharacter:false},notes:'',reviewResolved:true};}
function foundation(p){return JSON.stringify({roles:p.entries.map(e=>[e.botcRole.id,e.team,e.ability]),supplemental:p.supplementalRoles||[]});}
function refreshMechanics(kb,p,root){
 if(p.importedFoundation&&foundation(p)!==p.importedFoundation)throw Error('Imported scripts are preserved exactly.');
 p.analysis=analyse(kb,p.entries,root);
 for(const e of p.entries){const r=roleFor(kb,e.botcRole.id);e.botcRole={id:r.id,name:r.name,edition:r.edition,officialEdition:r.officialEdition};e.team=r.team;if(e.ability===undefined)e.ability=r.ability;e.abilityTextStatus=r.abilityTextStatus||null;e.mechanical=roleReview(kb,r,p.entries,p.analysis);e.jinxes=clone(r.jinxes||[]);e.sources=clone(r.sources||[]);e.candidates=[];e.confidence=null;e.thematicRationale='';}
 p.themeAnalysis={warnings:[],factions:{},eras:{},archetypes:{},racerCount:0,priority:{selected:[],omitted:[]},underused:[],weakest:[],method:'Retheming starts after mechanical confirmation.'};return p;
}
async function create(kb,request,root,imported,supplemental=[]){
 const mechanicalRequest={mode:request.mode,title:request.title,theme:request.mechanicalBrief||request.theme||'',mechanicalPreferences:request.mechanicalPreferences||'',complexity:request.complexity,size:request.size,requiredBotcRoles:request.requiredBotcRoles,excludedBotcRoles:request.excludedBotcRoles};
 const design=request.mode==='retheme'?{ids:imported,goals:goals(mechanicalRequest,root),trace:[]}:await chooseRoles(kb,mechanicalRequest,root);
 if(!Array.isArray(design.ids)||!design.ids.length||design.ids.some(id=>!roleFor(kb,id))||new Set(design.ids).size!==design.ids.length)throw Error('Confirm a nonempty, recognised, unique role list before creating the project.');
 if(supplemental.some(id=>!(kb.botcReference||[]).some(r=>r.id===id)))throw Error('A supplemental role is outside your owned sets.');
 const p={id:require('node:crypto').randomUUID(),title:request.title||'Untitled BOTC script',workflow:'mechanics-first',stage:'MECHANICS',state:'DRAFT',request:clone(request),goals:design.goals,designTrace:design.trace,modelRationale:design.modelRationale,importedRoleIds:request.mode==='retheme'?[...design.ids]:null,entries:design.ids.map(blankEntry),supplementalRoles:[...new Set(supplemental)].map(id=>{const r=kb.botcReference.find(r=>r.id===id);return clone({id:r.id,name:r.name,team:r.team,edition:r.edition,officialEdition:r.officialEdition,ability:r.ability,sources:r.sources,jinxes:r.jinxes});}),conversation:[],createdAt:new Date().toISOString()};
 refresh(kb,p,root);if(request.mode==='retheme')p.importedFoundation=foundation(p);return p;
}

function adopt(p,kb){if(p.workflow)return p;const out=clone(p);out.workflow='mechanics-first';out.stage='RETHEME';out.supplementalRoles=out.supplementalRoles||[];for(const e of out.entries){const r=roleFor(kb,e.botcRole.id);if(r){e.botcRole.edition=r.edition;e.botcRole.officialEdition=r.officialEdition;e.jinxes=clone(r.jinxes||[]);}}out.mechanicalFoundation=foundation(out);return out;}
module.exports.adopt=adopt;

async function redesign(kb,p,request,root){if(p.stage!=='MECHANICS'||p.request.mode!=='create')throw Error('Imported or confirmed mechanics are fixed.');return regenerate(kb,mutate(kb,p,{type:'request',request},root),root);}
module.exports.redesign=redesign;

async function layaFit(kb,p,roleId,root){
 if(p.stage!=='RETHEME')throw Error('Confirm mechanics before comparing identities.');
 if(!laya.available(root))throw Error('Embedded Laya is available in the desktop package with its bundled runtime.');
 const out=refresh(kb,clone(p),root),entry=out.entries.find(e=>e.botcRole.id===roleId);
 if(!entry)throw Error('Select a role first.');
 const pool=entry.candidates.filter(c=>!out.entries.some(e=>e!==entry&&e.starWarsIdentity?.id===c.id)).slice(0,8);
 const standings=new Map(pool.map((c,i)=>[c.id,{candidate:c,baseline:i,score:0,wins:[],close:[],comparisons:0}]));
 const rounds=[];
 for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
  const a=pool[i],b=pool[j];
  const ca=charFor(kb,a.id),cb=charFor(kb,b.id);
  laya.progress(root,{message:`Laya: ranking suggestions for ${entry.botcRole.name} (${rounds.length+1}/${pool.length*(pool.length-1)/2}) · ${ca.name} vs ${cb.name}`});
  const decision=await laya.choose(root,casting.comparisonState(entry,p.request,ca,cb),[ca,cb].map(c=>({id:c.id,description:c.name})),'Which character better represents the exact BOTC ability: its choices, information, consequences and limitations? Compare the supplied portraits; distinguish narrative metaphors from canonical facts.');
  if(!decision)throw Error('Laya could not rank the character suggestions. Try again.');
  if(![a.id,b.id].includes(decision.choice))throw Error('Laya fit comparison returned a character outside the pair.');
  const assessment=casting.assess(decision),sa=standings.get(a.id),sb=standings.get(b.id);
  const pa=Number(decision.probabilities?.[a.id]),pb=Number(decision.probabilities?.[b.id]);
  const margin=Number.isFinite(pa)&&Number.isFinite(pb)&&!decision.context?.truncated?pa-pb:0;
  sa.score+=margin;sb.score-=margin;sa.comparisons++;sb.comparisons++;
  if(assessment.status==='clear')standings.get(decision.choice).wins.push(decision.choice===a.id?cb.name:ca.name);
  else {sa.close.push(cb.name);sb.close.push(ca.name);}
  rounds.push({...decision,...assessment,ids:[a.id,b.id],names:[ca.name,cb.name]});
 }
 const ranked=[...standings.values()].sort((a,b)=>Number(b.candidate.priority)-Number(a.candidate.priority)||b.score-a.score||a.baseline-b.baseline);
 entry.layaSuggestions=[];
 for(const [index,row] of ranked.slice(0,5).entries()){
  const c=charFor(kb,row.candidate.id),profile=casting.profile(c),purpose=entry.mechanical.purpose,clip=(value,n)=>String(value||'').split(/\s+/).slice(0,n).join(' ');
  const angles=[{id:'function',description:'Narrative function: '+profile.metaphor},{id:'personality',description:'Personality: '+(c.personality||[]).join(', ')},{id:'story',description:'Story context: '+profile.portrait.split(/(?<=[.!?])\s/)[0]},{id:'weak',description:'No specific fit: shared themes alone do not explain this ability.'}];
  laya.progress(root,{message:`Laya: explaining suggestion ${index+1} of ${Math.min(5,ranked.length)} · ${c.name}`});
  const reasoning=await laya.choose(root,`BOTC role: ${entry.botcRole.name}\nExact ability: ${entry.ability}\nMechanical purpose: ${clip(purpose,30)}\nTheme: ${clip(p.request.theme,35)}\nTone: ${clip(p.request.tone,12)}\nCharacter: ${c.name}\nPortrait: ${profile.portrait}\nNarrative metaphor: ${profile.metaphor}\nPersonality: ${(c.personality||[]).join(', ')}\nFit limits: ${profile.caution}`,angles,'Choose the most specific supported basis for this casting interpretation. The basis must explain this exact ability. If only vague shared themes support it, choose weak. Do not invent canonical powers.');
  if(!reasoning||!angles.some(a=>a.id===reasoning.choice))throw Error('Laya could not explain a character suggestion. Try again.');
  const basis=reasoning.context?.truncated?'weak':reasoning.choice;
  const interpretation=basis==='function'?`${c.name} offers the narrative metaphor “${profile.metaphor}” as an interpretation of ${entry.botcRole.name}'s function: ${purpose}`:basis==='personality'?`${c.name}'s ${(c.personality||[]).join(', ')} provides a personality angle for ${entry.botcRole.name}. The ability still requires this specific function: ${purpose}`:basis==='story'?`${profile.portrait} For ${entry.botcRole.name}, this story context would need to represent: ${purpose}`:`Laya found no specific supported explanation for ${c.name} as ${entry.botcRole.name}. The role needs: ${purpose} Treat this as an exploratory alternative.`;
  entry.layaSuggestions.push({id:c.id,name:c.name,rank:index+1,priority:row.candidate.priority,explanation:interpretation,limits:profile.caution,basis,reasoning,preferredOver:row.wins,closeTo:row.close,provisional:basis==='weak'||casting.assess(reasoning).status!=='clear'||row.close.length>0||ranked.length<2,rankingScore:row.score/Math.max(1,row.comparisons)});
 }
 entry.layaCompared=true;entry.layaRecommendation=null;
 const winner=ranked[0]?.candidate,topRounds=rounds.filter(r=>r.ids.includes(winner?.id));
 if(!rounds.length)entry.layaComparison={status:'unavailable',method:'ranked-five',reason:pool.length?'Only one unassigned candidate is available.':'No unassigned candidates are available in this pool.',rounds:[],contextKey:casting.contextKey(out)};
 else {
  const clear=topRounds.every(r=>r.status==='clear'&&r.choice===winner.id)&&!entry.layaSuggestions[0]?.provisional,confidence=Math.min(...topRounds.map(r=>r.confidence));
  entry.layaComparison={status:clear?'clear':'uncertain',method:'ranked-five',shortlist:pool.length,confidence,rounds,contextKey:casting.contextKey(out),reason:clear?'Laya has a distinct first preference.':'Laya ranked the alternatives, but close comparisons make the order provisional.'};
  if(clear)entry.layaRecommendation={choice:winner.id,name:winner.name,confidence};
 }
 const positions=new Map(entry.layaSuggestions.map(s=>[s.id,s.rank]));entry.candidates.sort((a,b)=>(positions.get(a.id)||99)-(positions.get(b.id)||99));
 return out;
}
module.exports.layaFit=layaFit;
