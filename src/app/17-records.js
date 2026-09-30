/* ---------- personal records ---------- */
// Lifetime bests across every program, computed from the log. Each record keeps the
// date it was set and the value it beat, so a new one can be called out on the day.
function prList(){
  const out=[], add=(key,label,unit,entries,fmt)=>{
    const xs=entries.filter(e=>e.v!=null&&!Number.isNaN(e.v)&&e.v>0).sort((a,b)=>a.d<b.d?-1:1);
    if(!xs.length) return;
    let best=null, prev=null;
    for(const e of xs){ if(!best||e.v>best.v){prev=best;best=e} }
    out.push({key,label,unit,value:best.v,date:best.d,prev:prev?prev.v:null,n:xs.length,fmt:fmt||(v=>n(v))});
  };
  // tested maxes, per lift
  for(const k of activeLifts()){
    const xs=[];
    for(const [d,L] of Object.entries(logs)){
      const t=(L.test||{})[k]; if(!t||t.w==null||t.w==='') continue;
      const e=estMax(k,t.w,t.r||(dayPlan(d).t==='rm5'?5:1),d);
      if(e!=null) xs.push({d,v:floorTo(e,plan.round[k])});
    }
    add('lift:'+k,esc(liftName(k))+' 1RM',u(),xs,v=>(isBW(k)?'+':'')+n(v));
  }
  add('pullups','Max pull-ups','reps',Object.entries(logs).map(([d,L])=>({d,v:+L.pullups})));
  for(const [f,lbl] of [['broad','Broad jump'],['vertical','Vertical jump'],['triple','Standing triple jump']]){
    add('jump:'+f,lbl,'in',Object.entries(logs).map(([d,L])=>({d,v:+((L.jumps||{})[f]||(f==='broad'?((L.plyo||{}).best||(L.plyo||{}).mark):0))})));
  }
  // conditioning: best per activity and format, hard sessions only
  const g={};
  for(const x of hicSessions(true)){ if(x.f==='liss'||x.v==null) continue; (g[x.mod+'|'+x.f]=g[x.mod+'|'+x.f]||[]).push({d:x.d,v:x.v,u:x.u}) }
  for(const key of Object.keys(g)){
    const [m,f]=key.split('|');
    add('hic:'+key,MOD[m].name+' · '+HIC[f].name,g[key][0].u,g[key]);
  }
  return out;
}
// Records set on this date (the day something became a best, with a previous value to beat).
function prsOn(date){return prList().filter(r=>r.date===date&&r.prev!=null)}
function prCard(date){
  const hits=prsOn(date); if(!hits.length) return '';
  return `<div class="card pr"><div class="lift-h"><h3>New personal best${hits.length>1?'s':''}</h3><span class="chip light">PR</span></div>
  ${hits.map(r=>`<div class="pr-row"><span>${r.label}</span><span class="pr-v">${r.fmt(r.value)}<small> ${esc(r.unit)}</small></span><span class="small muted">was ${r.fmt(r.prev)}</span></div>`).join('')}</div>`;
}
function prBoard(){
  const rs=prList();
  if(!rs.length) return `<div class="card"><h3>Personal records</h3><div class="empty">Nothing tested yet. Bests from test days, jumps, pull-ups and conditioning land here.</div></div>`;
  return `<div class="card"><div class="lift-h"><h3>Personal records</h3><span class="small muted">All programs</span></div>
  <div class="tbl-wrap"><table><thead><tr><th>Record</th><th class="n">Best</th><th class="n">Set</th><th class="n">Gain</th></tr></thead><tbody>
  ${rs.map(r=>`<tr><td>${r.label}</td><td class="n"><b>${r.fmt(r.value)}</b> <span class="muted">${esc(r.unit)}</span></td><td class="n small">${fmtD(r.date,true)}</td><td class="n small">${r.prev!=null?`<span class="chip light">+${n(Math.round((r.value-r.prev)*10)/10)}</span>`:'<span class="muted">first</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}
