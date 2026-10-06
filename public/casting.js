(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CharacterCasting=factory();})(typeof window==='undefined'?this:window,function(){
 const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const split=value=>Array.isArray(value)?value:String(value||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
 function pool(characters,request={},entries=[]){
  return characters;

 }
 function profile(c){return c.castingProfile||{portrait:c.summary||'No factual summary supplied.',metaphor:(c.narrativeFunctions||[]).join(', '),caution:'Limited character annotation; inspect the source before choosing.'};}
 function bridge(role,c){return c.castingBridges?.[role.botcRole?.id||role.id]||null;}
 const words=(value,n)=>String(value||'').split(/\s+/).slice(0,n).join(' ');
 function comparisonState(role,request,a,b){
  const describe=c=>{const p=profile(c),proposal=bridge(role,c);return proposal?`${c.name}: ${words(p.portrait,35)}\nProposed retheme: ${proposal.proposal}\nLimits: ${words(p.caution,20)}`:`${c.name}: ${p.portrait}\nCasting interpretation: ${p.metaphor}\nLimits: ${p.caution}`;};
  return `Task: compare playable narrative adaptations, not literal canonical powers. A close ranking does not mean neither adaptation works.\nBOTC role: ${role.botcRole.name}\nExact ability: ${role.ability}\nTheme: ${words(request.theme,20)}\nTone: ${words(request.tone,12)}\nMechanical purpose: ${words(role.mechanical?.purpose,18)}\n\nCharacter A — ${describe(a)}\n\nCharacter B — ${describe(b)}`;
 }
 function assess(answer){
  const confidence=Number(answer?.confidence),probabilities=Object.values(answer?.probabilities||{}).sort((a,b)=>b-a);
  const margin=probabilities.length>1?probabilities[0]-probabilities[1]:0;
  const clear=Number.isFinite(confidence)&&confidence>=0.15&&confidence<=1&&margin>=0.1&&!answer?.context?.truncated;
  return {status:clear?'clear':'uncertain',confidence:Number.isFinite(confidence)?confidence:0,margin,reason:answer?.context?.truncated?'Some comparison context exceeded the model input limit.':clear?'Laya separates these two options.':'Laya has no clear preference between these options.'};
 }
 function contextKey(project){return JSON.stringify({castingProtocol:2,request:project.request,cast:project.entries.map(e=>[e.botcRole.id,e.identity?.id||null])});}
 return {pool,profile,bridge,comparisonState,assess,contextKey};
});
