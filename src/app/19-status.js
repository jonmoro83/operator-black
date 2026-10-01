/* ---------- status dashboard ---------- */
function lineChart(pts,o){
  o=o||{};
  const W=300,H=118,L=36,R=40,T=10,B=22, iw=W-L-R, ih=H-T-B;
  const ys=pts.map(p=>p.y);
  let lo=o.min!=null?o.min:Math.min(...ys), hi=o.max!=null?o.max:Math.max(...ys);
  if(hi===lo){hi+=Math.max(1,Math.abs(hi)*.05);lo-=Math.max(1,Math.abs(lo)*.05)}
  if(o.min==null||o.max==null){const pad=(hi-lo)*.15;if(o.min==null)lo-=pad;if(o.max==null)hi+=pad}
  const step=Math.max(nice((hi-lo)/3),o.minStep||0); lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step;
  const x=i=>L+(pts.length===1?iw/2:i*iw/(pts.length-1)), y=v=>T+ih-(v-lo)/(hi-lo)*ih;
  let g='';
  for(let v=lo;v<=hi+1e-9;v+=step){const yy=y(v).toFixed(1);g+=`<line class="ch-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="ch-ax" x="${L-6}" y="${(+yy+3.5).toFixed(1)}" text-anchor="end">${fmtTick(v)}</text>`}
  const solid=pts.filter(p=>!p.hollow);
  const lastSolid=pts.length-1-[...pts].reverse().findIndex(p=>!p.hollow);
  const seg=(a,b)=>pts.slice(a,b+1).map((p,j)=>(j?'L':'M')+x(a+j).toFixed(1)+' '+y(p.y).toFixed(1)).join(' ');
  const path=seg(0,lastSolid), proj=lastSolid<pts.length-1?`<path class="ch-line" stroke-dasharray="4 4" d="${seg(lastSolid,pts.length-1)}"/>`:'';
  const area=solid.length>1?`<path class="ch-area" d="M${x(0).toFixed(1)} ${(T+ih)} ${pts.slice(0,lastSolid+1).map((p,i)=>'L'+x(i).toFixed(1)+' '+y(p.y).toFixed(1)).join(' ')} L${x(lastSolid).toFixed(1)} ${T+ih} Z"/>`:'';
  const xl=`<text class="ch-ax" x="${x(0)}" y="${H-5}" text-anchor="${pts.length===1?'middle':'start'}">${esc(pts[0].xl)}</text>`+(pts.length>1?`<text class="ch-ax" x="${x(pts.length-1)}" y="${H-5}" text-anchor="end">${esc(pts[pts.length-1].xl)}</text>`:'');
  const dense=pts.length>16;
  const dots=pts.map((p,i)=>dense&&i!==pts.length-1?'':`<circle class="ch-pt${p.hollow?' hollow':''}" cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="4"/>`).join('');
  const hits=pts.map((p,i)=>`<circle class="ch-hit" tabindex="0" cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="12" data-tip="${esc(p.tip)}"><title>${esc(p.tip)}</title></circle>`).join('');
  const e=pts[pts.length-1], end=`<text class="ch-end" x="${(x(pts.length-1)+8).toFixed(1)}" y="${(y(e.y)+4).toFixed(1)}">${esc(o.endLabel?o.endLabel(e):fmtTick(e.y))}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">${g}${area}<path class="ch-line" d="${path}"/>${proj}${dots}${xl}${end}${hits}</svg>`;
}
function r1(v){return String(Math.round(v*10)/10)}
function nice(r){const e=Math.pow(10,Math.floor(Math.log10(r||1))),f=r/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function fmtTick(v){return Math.abs(v)>=1000?(Math.round(v/100)/10)+'k':String(Math.round(v*10)/10)}
function sessState(d,t){const p=dayPlan(d);if(['off','pre','convert'].includes(p.t))return 'rest';if(lg(d).done)return 'done';if(d<t)return 'missed';if(d===t)return 'today';return 'upcoming'}
// Minutes per conditioning session. Only LISS asks you for minutes, so for everything
// else this is the session the timer would run: warm-up, rounds, rest and cool-down.
function hicMinutes(x){
  if(x.min!=null&&x.min!=='') return {m:+x.min,logged:true};
  const o=ivOpts(x.d,x.f); return {m:Math.round(ivTotal(ivSegments(x.f,o))/60),logged:false};
}
// Conditioning minutes per week, oldest first, for the last n weeks up to this one.
function condWeeks(n0){
  const t=todayStr(), mon=mondayOf(t), start=mondayOf(plan.startMonday), by={};
  for(const x of hicSessions()){
    const m=mondayOf(x.d); if(!by[m]) by[m]={min:0,n:0,est:0};
    const r=hicMinutes(x); by[m].min+=r.m; by[m].n++; if(!r.logged) by[m].est++;
  }
  const out=[];
  for(let i=n0-1;i>=0;i--){ const m=addDays(mon,-7*i); if(m<start) continue; out.push(Object.assign({mon:m,min:0,n:0,est:0},by[m])) }
  return out;
}
// What a logged work set implies about the max. In Operator the weight is computed FROM
// the max, so a set done exactly as prescribed only restates it: this says something new
// when you logged a different weight, or when a heavy set ground.
function heavySet(k){
  let best=null;
  for(const [d,L] of progLogs()){
    const x=(L.lifts||{})[k]; if(!x||!Array.isArray(x.sets)||!x.sets.some(Boolean)) continue;
    const wk=weekOf(d); if(!wk||wk.kind!=='cycle') continue;
    const v=rx(wk,k); if(!v.m||v.p<85) continue;
    const used=x.used!=null&&x.used!==''?+x.used:loadFor(k,v.m.v,v.p,d);
    const e=estMax(k,used,v.r,d); if(e==null) continue;
    if(!best||e>best.e) best={e,w:used,r:v.r,p:v.p,d,max:v.m.v,grinder:!!x.grinder,off:x.used!=null&&x.used!==''};
  }
  return best;
}
// Twelve weeks of sessions as a grid: one row per week, one cell per day. The same
// states the week dots use, so a missed day looks the same in both places.
function heatmap(t,n0){
  const mon=mondayOf(t), start=mondayOf(plan.startMonday), rows=[];
  for(let i=n0-1;i>=0;i--){ const m=addDays(mon,-7*i); if(m>=start) rows.push(m) }
  if(!rows.length) return '';
  let h=`<div class="heat-h"><span class="small muted">Last ${rows.length} week${rows.length>1?'s':''}</span><span class="heat-key">${[['done','done'],['missed','missed'],['rest','rest day']].map(([c,l])=>`<span><i class="${c}"></i>${l}</span>`).join('')}</span></div><div class="heat" role="img" aria-label="Sessions over the last ${rows.length} weeks">`;
  h+=`<span></span>${DAYN.map(d=>`<span class="heat-d">${d[0]}</span>`).join('')}`;
  for(const m of rows){
    const wk=weekOf(m), lbl=wk?(wk.kind==='cycle'?'C'+wk.cycle+'W'+wk.w:wk.kind==='bridge'?'Br':wk.kind==='deload'?'DL':wk.kind==='test'?'RT':wk.kind==='travel'?'Tr':'Off'):'';
    h+=`<span class="heat-w">${esc(lbl)}</span>`;
    for(let i=0;i<7;i++){
      const d=addDays(m,i), st=d<start?'pre':sessState(d,t), p=dayPlan(d);
      h+=`<i class="${st}" title="${esc(fmtD(d,true)+' · '+(p.short||'')+' · '+(st==='pre'?'before the start':st))}"></i>`;
    }
  }
  return h+`</div>`;
}
function vStatus(){
  const t=todayStr(), wk=weekOf(t);
  if(!wk) return `<div class="card"><h2>Status</h2><p class="muted" style="margin:0">The program starts the week of ${fmtLong(plan.startMonday)}.</p></div>`;
  const list=weeks(), ci0=wk.idx;
  let h='';
  // --- where you are
  const wt=weekTitle(wk);
  h+=`<div class="card"><div class="lift-h"><h2>${wt.t}</h2><span class="chip ${wt.cls}">${wt.chip}</span></div>`;
  if(wk.kind==='cycle'){
    const first=ci0-(wk.w-1);
    h+=`<div class="cyc" aria-label="Cycle ${wk.cycle} progress">${plan.wave.map((v,i)=>{const cls=tier(+v.p);return `<div class="chip ${cls}${i<wk.w-1?' past':''}${i===wk.w-1?' now':''}" style="border-radius:6px">W${i+1}<small>${v.s}×${v.r} ${v.p}%</small></div>`}).join('')}</div>`;
    h+=`<div class="small muted">Day ${dow(t)+1} of week ${wk.w}. Cycle ${wk.cycle} ends ${fmtD(addDays(list[first+5].monday,4),true)}.</div>`;
  }
  const nextOf=kind=>{for(let i=ci0+1;i<list.length;i++){if(kind==='cycle'?(list[i].kind==='cycle'&&list[i].w===1):list[i].kind===kind)return list[i]}return null};
  const days=w=>w?Math.round((D(w.monday)-D(t))/864e5):null;
  const nd=nextOf('deload'), nt=nextOf('test'), nc=nextOf('cycle');
  const mile=(l,w,sub)=>`<div class="mile"><span class="l">${l}</span>${w?`<span class="big">${days(w)}<small style="font-size:14px;color:var(--muted);margin-left:4px">days</small></span><span class="small muted">${sub(w)}</span>`:'<span class="small muted">Not scheduled</span>'}</div>`;
  h+=`<div class="miles">${mile('Next cycle',nc,w=>'Cycle '+w.cycle+' · '+fmtD(w.monday,true))}${mile('Next deload',nd,w=>fmtD(w.monday,true))}${mile('Next retest',nt,w=>fmtD(w.monday,true))}</div>`;
  const trained=list.slice(0,ci0).filter(w=>w.kind==='cycle').length;
  h+=`<div class="small muted">${trained} training week${trained===1?'':'s'} completed since ${fmtD(plan.startMonday)}.</div></div>`;
  // --- this week + adherence
  const mon=mondayOf(t);
  let wd='';for(let i=0;i<7;i++){const d=addDays(mon,i),st=sessState(d,t),p=dayPlan(d);wd+=`<div><i class="${st}" aria-label="${DAYN[i]}: ${st}">${st==='done'?'✓':st==='missed'?'✕':st==='rest'?'–':'•'}</i>${DAYN[i]}<span style="font-size:10px">${esc(p.short||'')}</span></div>`}
  const adh=(from,to)=>{let d0=0,n0=0;for(let d=from;d<=to;d=addDays(d,1)){if(d<plan.startMonday)continue;const st=sessState(d,t);if(st==='rest'||st==='upcoming'||st==='today')continue;n0++;if(st==='done')d0++}return {d:d0,n:n0}};
  const yest=addDays(t,-1), wkA=adh(mon,yest), a4=adh(addDays(mon,-28),yest), all=adh(plan.startMonday,yest);
  let tw=0,td=0;for(let i=0;i<7;i++){const d=addDays(mon,i),st=sessState(d,t);if(st!=='rest'){tw++;if(st==='done')td++}}
  const pct=a=>a.n?Math.round(a.d/a.n*100)+'%':'—';
  h+=`<div class="card"><div class="lift-h"><h3>This week</h3><span class="small muted mono">${td}/${tw} sessions</span></div><div class="wkdots">${wd}</div>
  <div class="miles"><div class="mile"><span class="l">Last 4 weeks</span><span class="big">${pct(a4)}</span><span class="small muted">${a4.d} of ${a4.n} sessions done</span></div><div class="mile"><span class="l">All time</span><span class="big">${pct(all)}</span><span class="small muted">${all.d} of ${all.n} sessions done</span></div><div class="mile"><span class="l">Readiness · 7 days</span>${(()=>{const xs=[];for(let i=0;i<7;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)xs.push(r)}if(!xs.length)return '<span class="small muted">No check-ins yet</span>';const av=Math.round(xs.reduce((a,b)=>a+b,0)/xs.length),lv=rLevel(av);return `<span class="big">${av}</span><span><span class="chip ${lv.cls}">${lv.t}</span> <span class="small muted">${xs.length} check-in${xs.length>1?'s':''}</span></span>`})()}</div></div>${heatmap(t,12)}</div>`;
  // --- strength
  const curC=wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle);
  h+=`<div class="card"><div class="lift-h"><h3>Strength</h3><span class="small muted">Max by cycle · hollow = next cycle, projected</span></div><div class="sm-grid">`;
  for(const k of activeLifts()){
    const pts=[];for(let c=1;c<=curC+(viewing?0:1);c++){const m=maxFor(c)[k];if(m)pts.push({y:m.v,xl:'C'+c,hollow:c>curC,tip:`Cycle ${c}: ${n(m.v)} ${u()}${m.src==='set'?' (tested/set)':m.src==='proj'?' (projected)':''}`})}
    const cur=maxFor(curC)[k], base=maxFor(1)[k];
    h+=`<div class="sm"><div class="sm-h"><b>${esc(liftName(k))}</b>${cur?`<span class="v">${n(cur.v)}<small>${u()}${base&&cur.v!==base.v?` · ${cur.v>base.v?'+':''}${n(cur.v-base.v)} since C1`:''}</small></span>`:''}</div>${pts.length?lineChart(pts,{label:liftName(k)+' max by cycle',minStep:+plan.round[k]||5}):'<div class="none">No max entered yet.</div>'}${(()=>{
      const hv=heavySet(k); if(!hv) return '';
      let say='';
      if(hv.off){ const d=Math.round(hv.e-hv.max);
        say=` You logged your own weight, which implies <b class="mono">${n(Math.round(hv.e))}</b> \u2014 ${d===0?'the max it replaced':(d>0?n(d)+' '+u()+' above':n(-d)+' '+u()+' below')+' the max for that cycle'}.`; }
      else if(hv.grinder) say=' It ground, which is what the end-of-cycle review reads.';
      return `<div class="small muted">Heaviest set completed: <b class="mono">${fmtLoad(k,hv.w)} \u00d7 ${hv.r}</b> at ${hv.p}% on ${fmtD(hv.d,true)}.${say}</div>`;
    })()}</div>`;
  }
  h+=`</div></div>`;
  // --- conditioning
  {
    const all=hicSessions(), hs=all.filter(x=>x.f!=='liss'&&x.v!=null), groups={};
    for(const x of hs)(groups[x.mod+'|'+x.f]=groups[x.mod+'|'+x.f]||[]).push(x);
    const keys=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).slice(0,6);
    const since=addDays(t,-27), mix={}; for(const x of all) if(x.d>=since) mix[x.mod]=(mix[x.mod]||0)+1;
    h+=`<div class="card"><div class="lift-h"><h3>Conditioning</h3><span class="small muted">Volume per week, then results per activity</span></div>`;
    h+=Object.keys(mix).length?`<div class="row" style="gap:6px"><span class="small muted">Last 4 weeks:</span>${Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([m,c])=>`<span class="chip">${MOD[m].name} · ${c}</span>`).join('')}</div>`:'';
    {
      const cw=condWeeks(12), tot=cw.reduce((a,x)=>a+x.min,0), thisWk=mondayOf(t);
      // this week is still running, so it is drawn hollow and left out of the average
      const full=cw.filter(x=>x.mon!==thisWk), last4=full.slice(-4);
      const av=last4.length?Math.round(last4.reduce((a,x)=>a+x.min,0)/last4.length):0;
      const anyEst=cw.some(x=>x.est>0);
      h+=`<div class="sm"><div class="sm-h"><b>Minutes per week</b>${last4.length?`<span class="v">${av}<small>min / week, last ${last4.length}</small></span>`:''}</div>`;
      h+=cw.length>=2&&tot?lineChart(cw.map(x=>({y:x.min,xl:fmtD(x.mon),hollow:x.mon===thisWk,tip:`Week of ${fmtD(x.mon,true)}: ${x.min} min across ${x.n} session${x.n===1?'':'s'}${x.mon===thisWk?' so far':''}`})),{min:0,minStep:10,label:'Conditioning minutes per week'}):`<div class="none">${tot?'One week logged so far.':'Log a conditioning session and this fills in.'}</div>`;
      if(tot) h+=`<div class="small muted">This week is dashed: it is still running.${anyEst?' Sessions where you did not log minutes count the planned length of that format, warm-up and cool-down included.':''}</div>`;
      h+=`</div>`;
    }
    if(!keys.length) h+=`<div class="sm"><div class="none">No HIC results logged yet. Results you log on HIC days show up here.</div></div>`;
    else{
      h+=`<div class="sm-grid">`;
      for(const key of keys){const xs=groups[key].slice(-24),[m,f]=key.split('|'),best=xs.reduce((a,x)=>Math.max(a,x.v),0),un=xs[xs.length-1].u;
        h+=`<div class="sm"><div class="sm-h"><b>${MOD[m].name} · ${HIC[f].name}</b><span class="v">${n(best)}<small>${esc(un)} best</small></span></div>${xs.length>=2?lineChart(xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${n(x.v)} ${x.u}`})),{label:MOD[m].name+' '+HIC[f].name,minStep:1}):'<div class="none">One session logged. The trend appears after the second.</div>'}</div>`}
      h+=`</div>`;
    }
    h+=`</div>`;
  }
  // --- body + recovery
  const raw=progLogs().filter(([d,L])=>L.checkin&&L.checkin.bw).map(([d,L])=>({d,v:+L.checkin.bw})).sort((a,b)=>a.d<b.d?-1:1).slice(-90);
  const bw=raw.map(x=>{const a=bwAvg(x.d,7);return {d:x.d,v:a?a.avg:x.v,raw:x.v}});
  const rate=bwRate(t,14);
  const rd=[];for(let i=27;i>=0;i--){const d=addDays(t,-i),r=readiness(ci(d));if(r!=null)rd.push({d,r})}
  const jm=progLogs().map(([d,L])=>({d,v:+((L.jumps&&L.jumps.broad)||(L.plyo&&(L.plyo.best||L.plyo.mark))||0)})).filter(x=>x.v).sort((a,b)=>a.d<b.d?-1:1).slice(-24);
  h+=`<div class="card"><h3>Body and recovery</h3><div class="sm-grid">`;
  h+=`<div class="sm"><div class="sm-h"><b>Readiness · 28 days</b>${rd.length?`<span class="v">${rd[rd.length-1].r}<small>latest</small></span>`:''}</div>${rd.length>=2?lineChart(rd.map(x=>({y:x.r,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: readiness ${x.r}`})),{min:0,max:100,label:'Readiness'}):'<div class="none">Check in on the Today tab to build this trend.</div>'}</div>`;
  h+=`<div class="sm"><div class="sm-h"><b>Bodyweight · 7-day average</b>${bw.length?`<span class="v">${r1(bw[bw.length-1].v)}<small>${u()}${rate?` · ${rate.perWeek>0?'+':''}${r1(rate.perWeek)}/week`:''}</small></span>`:''}</div>${bw.length>=2?lineChart(bw.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} ${u()} average (weighed ${r1(x.raw)})`})),{label:'Bodyweight, 7-day average',minStep:1}):'<div class="none">Log bodyweight in the daily check-in. The average needs a few days of weigh-ins.</div>'}</div>`;
  h+=`<div class="sm"><div class="sm-h"><b>Broad jump</b>${jm.length?`<span class="v">${r1(Math.max(...jm.map(x=>x.v)))}<small>in best</small></span>`:''}</div>${jm.length>=2?lineChart(jm.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} in`})),{label:'Broad jump',minStep:1}):'<div class="none">Thursday’s first broad jump builds this trend.</div>'}</div>`;
  h+=`</div><div class="row"><button class="btn sm" data-act="view" data-view="history">See full tables in History</button></div></div>`;
  h+=prBoard();
  return h;
}
