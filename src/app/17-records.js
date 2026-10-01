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
// Where you are on the pull-up road, from the best set you have logged. Max-rep sets are
// logged on test days (`pullups`); weighted work shows up as the `wpu` max.
function pullupState(date){
  let best=null, xs=[];
  for(const [d,L] of Object.entries(logs)){
    if(d>date||!inProgram(d)||!L.pullups) continue;
    xs.push({d,v:+L.pullups});
    if(!best||+L.pullups>best.v||(+L.pullups===best.v&&d>best.d)) best={d,v:+L.pullups};
  }
  xs.sort((a0,b0)=>a0.d<b0.d?-1:1);
  const wpu=(plan.maxes||{}).wpu, bw=bwFor(date);
  const reps=best?best.v:0, i=pullupStage(reps), st=PULLUP[i], nextSt=PULLUP[i+1]||null;
  const togo=nextSt?Math.max(0,nextSt.at-reps):0;
  return {best,xs,stage:i,st,next:nextSt,togo,reps,wpu:wpu!=null&&wpu!==''?+wpu:null,bw,
    pct:bw&&wpu?Math.round(+wpu/bw*100):null};
}
function pullupCard(date){
  const p=pullupState(date);
  if(!p.best&&!p.wpu) return `<div class="card"><h3>Pull-ups</h3><p class="small muted" style="margin:0">Log one all-out set on a test day \u2014 full hang to chin over bar \u2014 and this maps out the road from there to a weighted pull-up.</p></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Pull-ups</h3><span class="chip ${p.stage>=3?'light':''}">${esc(p.st.name)}</span></div>`;
  h+=`<div class="miles"><div class="mile"><span class="l">Best set</span>${p.best?`<span class="big">${p.best.v}</span><span class="small muted">${fmtD(p.best.d,true)}</span>`:'<span class="small muted">Not tested yet</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Next rung</span>${p.next?`<span class="big">${p.next.at}</span><span class="small muted">${p.togo?`${p.togo} more rep${p.togo===1?'':'s'} \u00b7 ${esc(p.next.name.toLowerCase())}`:'reached \u2014 move up'}</span>`:'<span class="small muted">Top of the ladder</span>'}</div>`;
  if(p.wpu!=null) h+=`<div class="mile"><span class="l">Added weight</span><span class="big">+${n(p.wpu)}</span><span class="small muted">${u()}${p.pct?` \u00b7 ${p.pct}% of bodyweight`:''}</span></div>`;
  h+=`</div>`;
  h+=`<div class="small"><b>Now:</b> ${esc(p.st.work)}</div><div class="small muted">${esc(p.st.why)}</div>`;
  if(p.next) h+=`<div class="small muted"><b>Next:</b> ${esc(p.next.next===undefined?'':p.st.next)}</div>`;
  if(p.xs.length>=2) h+=lineChart(p.xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${x.v} reps`})),{label:'Max pull-ups',min:0,minStep:1,tick:fmtWhole});
  h+=`<details class="plain"><summary>The whole road</summary><div class="stack small" style="margin-top:8px">${PULLUP.map((s0,i)=>`<div class="${i===p.stage?'':'muted'}"><b>${i===p.stage?'\u2192 ':''}${esc(s0.name)}</b>${s0.at?` <span class="mono">${s0.at}+ reps</span>`:' <span class="mono">0 reps</span>'}<div>${esc(s0.work)}</div></div>`).join('')}</div></details>`;
  return h+`</div>`;
}
function prBoard(){
  const rs=prList();
  if(!rs.length) return `<div class="card"><h3>Personal records</h3><div class="empty">Nothing tested yet. Bests from test days, jumps, pull-ups and conditioning land here.</div></div>`;
  return `<div class="card"><div class="lift-h"><h3>Personal records</h3><span class="small muted">All programs</span></div>
  <div class="tbl-wrap"><table><thead><tr><th>Record</th><th class="n">Best</th><th class="n">Set</th><th class="n">Gain</th></tr></thead><tbody>
  ${rs.map(r=>`<tr><td>${r.label}</td><td class="n"><b>${r.fmt(r.value)}</b> <span class="muted">${esc(r.unit)}</span></td><td class="n small">${fmtD(r.date,true)}</td><td class="n small">${r.prev!=null?`<span class="chip light">+${n(Math.round((r.value-r.prev)*10)/10)}</span>`:'<span class="muted">first</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}
