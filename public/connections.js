// Direct rules and curated links are kept separate from shared mechanic signals.
function connections(kb,entries,selectedId){
 const role=kb.botc.find(r=>r.id===selectedId);if(!role)return [];
 return entries.filter(e=>e.botcRole.id!==selectedId).map(entry=>{
  const other=kb.botc.find(r=>r.id===entry.botcRole.id);if(!other)return null;
  const rules=(role.jinxes||[]).filter(j=>j.characterId===other.id).map(j=>j.reason);
  const has=key=>(role.interactions?.[key]||[]).includes(other.id)||(other.interactions?.[key]||[]).includes(role.id);
  const shared=Object.keys(role.mechanics||{}).filter(k=>!['playerAgency','evilUtility','bluffability','swinginess'].includes(k)&&role.mechanics[k]>0&&other.mechanics?.[k]>0);
  const type=rules.length?'jinx':has('dangerousCombinations')||has('conflictsWith')?'tension':has('synergisesWith')?'synergy':shared.length?'signal':null;
  return type?{id:other.id,name:other.name,type,rules,shared}:null;
 }).filter(Boolean);
}
if(typeof module!=='undefined')module.exports={connections};else window.ScriptConnections={connections};
