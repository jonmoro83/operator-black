/* ---------- status dashboard ---------- */
function lineChart(pts,o){
  o=o||{};
  const W=300,H=118,L=36,R=40,T=10,B=22, iw=W-L-R, ih=H-T-B;
  const ys=pts.map(p=>p.y).concat(pts.filter(p=>p.y2!=null).map(p=>p.y2));
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
  // the raw series, when there is one: faint dots behind the line they average into
  const has2=pts.some(p=>p.y2!=null);
  const raw2=has2?`<path class="ch-line2" d="${pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.y2!=null?p.y2:p.y).toFixed(1)).join(' ')}"/>`+pts.map((p,i)=>p.y2==null?'':`<circle class="ch-pt2" cx="${x(i).toFixed(1)}" cy="${y(p.y2).toFixed(1)}" r="${dense2(pts)}"/>`).join(''):'';
  const e=pts[pts.length-1], end=`<text class="ch-end" x="${(x(pts.length-1)+8).toFixed(1)}" y="${(y(e.y)+4).toFixed(1)}">${esc(o.endLabel?o.endLabel(e):fmtTick(e.y))}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">${g}${area}${raw2}<path class="ch-line" d="${path}"/>${proj}${dots}${xl}${end}${hits}</svg>`;
}
function dense2(pts){return pts.length>40?1.4:pts.length>20?1.8:2.4}
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
// Bodyweight: every weigh-in, and the 7-day average they feed. The average is the line
// you act on — a single reading moves with water, food and the time of day — so it is the
// solid one and the weigh-ins sit behind it.
const BWR={30:'30 days',90:'90 days',all:'All'};
function bwRange(){const v=LS.get('ob.bwRange');return BWR[v]?v:90}
function bwSeries(t){
  const r=bwRange(), from=r==='all'?plan.startMonday:addDays(t,-(+r-1));
  const xs=progLogs().filter(([d,L])=>d>=from&&d<=t&&L.checkin&&L.checkin.bw!=null&&L.checkin.bw!=='')
    .map(([d,L])=>({d,raw:+L.checkin.bw})).sort((a,b)=>a.d<b.d?-1:1);
  return xs.map(x=>{const a=bwAvg(x.d,7);return {d:x.d,v:a?a.avg:x.raw,raw:x.raw,n:a?a.n:1}});
}
function bwCard(t){
  const xs=bwSeries(t), r=bwRange(), rate=bwRate(t,14);
  const seg=`<div class="restsel"><span>Range</span><div class="seg">${Object.entries(BWR).map(([k,l])=>`<button class="segb${k===r?' on':''}" data-act="bwrange" data-v="${k}" aria-pressed="${k===r}">${l}</button>`).join('')}</div></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Bodyweight</h3><span class="small muted">Every weigh-in, and the 7-day average</span></div>${seg}`;
  if(xs.length<2) return h+`<div class="none">${xs.length?'One weigh-in in this range. The average needs a few days.':'Log your weight in the daily check-in and it charts here.'}</div></div>`;
  const first=xs[0], last=xs[xs.length-1];
  const k0=Math.min(7,Math.floor(xs.length/2)), mean=a0=>a0.reduce((x,y)=>x+y.raw,0)/a0.length;
  const ch=k0>=2?mean(xs.slice(-k0))-mean(xs.slice(0,k0)):last.raw-first.raw;
  const days=Math.round((D(last.d)-D(first.d))/864e5)+1, logged=xs.length;
  h+=`<div class="miles"><div class="mile"><span class="l">7-day average</span><span class="big">${r1(last.v)}<small style="font-size:14px;color:var(--muted);margin-left:4px">${u()}</small></span><span class="small muted">latest weigh-in ${r1(last.raw)}</span></div>
  <div class="mile"><span class="l">Over this range</span><span class="big">${ch>0?'+':''}${r1(ch)}</span><span class="small muted">${fmtD(first.d)} to ${fmtD(last.d)}${k0>=2?` · first ${k0} vs last ${k0}`:''}</span></div>
  <div class="mile"><span class="l">Per week</span>${rate?`<span class="big">${rate.perWeek>0?'+':''}${r1(rate.perWeek)}</span><span class="small muted">last ${rate.back} days</span>`:'<span class="small muted">Needs two weeks of weigh-ins</span>'}</div></div>`;
  h+=lineChart(xs.map(x=>({y:x.v,y2:x.raw,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: weighed ${r1(x.raw)}, ${r1(x.v)} average${x.n>1?' of '+x.n:''}`})),{label:'Bodyweight, daily and 7-day average',minStep:1});
  h+=`<div class="small muted">Weighed on ${logged} of the last ${days} day${days===1?'':'s'}. The faint line is each weigh-in; the solid one is the 7-day average, which is what the protein target, the weighted pull-up loads and the trend advice use.</div>`;
  return h+`</div>`;
}
// What you burn and what you are made of. The measured number comes from your own
// intake and scale trend; the formula is only there until that exists.
function energyCard(t){
  const m28=tdeeMeasured(t,28), m14=tdeeMeasured(t,14), pred=tdeePredicted(t), meas=m28||m14;
  const bf=bfSeries(t), last=bf[bf.length-1];
  const kc=[]; for(let i=27;i>=0;i--){const v=kcalOn(addDays(t,-i));if(v)kc.push(v)}
  if(!meas&&!pred&&!bf.length) return `<div class="card"><h3>Energy and composition</h3><p class="small muted" style="margin:0">Log calories in the daily check-in, add your height, sex and birth year in Setup, and take neck and waist measurements weekly. Then this card estimates what you burn and what you are made of.</p></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Energy and composition</h3><span class="small muted">Estimates, not measurements</span></div>`;
  h+=`<div class="miles">`;
  h+=`<div class="mile"><span class="l">Burn per day</span>${meas?`<span class="big">${n(meas.tdee)}</span><span class="small muted">from your own ${meas.days} days${pred?` · formula says ${n(pred)}`:''}</span>`:pred?`<span class="big">${n(pred)}</span><span class="small muted">Mifflin-St Jeor × ${actFactor()}</span>`:'<span class="small muted">Needs height, sex and birth year</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Eaten per day</span>${kc.length?`<span class="big">${n(Math.round(kc.reduce((a,b)=>a+b,0)/kc.length))}</span><span class="small muted">${kc.length} of the last 28 days logged</span>`:'<span class="small muted">Log calories in the check-in</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Body fat</span>${last?`<span class="big">${r1(last.bf)}<small style="font-size:14px;color:var(--muted);margin-left:2px">%</small></span><span class="small muted">${fmtD(last.d,true)}${bf.length>1?` · ${last.bf>bf[0].bf?'+':''}${r1(last.bf-bf[0].bf)} since ${fmtD(bf[0].d)}`:''}</span>`:'<span class="small muted">Needs neck and waist</span>'}</div></div>`;
  if(meas){
    const gap=meas.tdee-meas.mean;
    const rt=meas.dw/meas.gap*7;
    h+=`<div class="small">Over the last ${meas.days} days you ate <b class="mono">${n(meas.mean)}</b> a day and your weight trend ${Math.abs(rt)<.05?'held flat':`moved ${rt>0?'+':'−'}${r1(Math.abs(rt))} ${u()} a week`}, which puts your burn at about <b class="mono">${n(meas.tdee)}</b> — a ${gap>0?'deficit':'surplus'} of <b class="mono">${n(Math.abs(gap))}</b> a day.</div>`;
    const goal=plan.goal, tgt=goal==='lose'?meas.tdee-Math.round(meas.tdee*.18/10)*10:goal==='gain'?meas.tdee+250:meas.tdee;
    if(goal&&goal!=='maintain') h+=`<div class="small muted">Your goal is set to ${goal==='lose'?'lose fat':'build'}. About <b class="mono">${n(tgt)}</b> a day would ${goal==='lose'?'take off roughly 1% of bodyweight a month without wrecking the lifting':'add weight slowly enough to stay mostly lean'}. Protein target is on the Today card.</div>`;
  } else if(pred){
    h+=`<div class="small muted">That is the formula's guess from your height, weight, age and activity. Log calories for ${28} days alongside your weigh-ins and this switches to your own numbers, which are the only ones that count.</div>`;
  }
  if(bf.length>=2){
    const w=bf.map(x=>({d:x.d,v:+x.m.waist}));
    h+=`<div class="sm-grid" style="margin-top:12px">`;
    h+=`<div class="sm"><div class="sm-h"><b>Body fat</b><span class="v">${r1(last.bf)}<small>%</small></span></div>${lineChart(bf.map(x=>({y:x.bf,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.bf)}%`})),{label:'Body fat estimate',minStep:.5})}</div>`;
    h+=`<div class="sm"><div class="sm-h"><b>Waist</b><span class="v">${r1(w[w.length-1].v)}<small>${u()==='kg'?'cm':'in'}</small></span></div>${lineChart(w.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} ${u()==='kg'?'cm':'in'}`})),{label:'Waist',minStep:.5})}</div>`;
    h+=`</div>`;
  }
  h+=`<div class="small muted">The body-fat estimate is the US Navy tape method: typically within 3–4 points, and more useful as a direction than a number. Measure at the same time of day, relaxed.</div>`;
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
  const rd=[];for(let i=27;i>=0;i--){const d=addDays(t,-i),r=readiness(ci(d));if(r!=null)rd.push({d,r})}
  const jm=progLogs().map(([d,L])=>({d,v:+((L.jumps&&L.jumps.broad)||(L.plyo&&(L.plyo.best||L.plyo.mark))||0)})).filter(x=>x.v).sort((a,b)=>a.d<b.d?-1:1).slice(-24);
  h+=`<div class="card"><h3>Body and recovery</h3><div class="sm-grid">`;
  h+=`<div class="sm"><div class="sm-h"><b>Readiness · 28 days</b>${rd.length?`<span class="v">${rd[rd.length-1].r}<small>latest</small></span>`:''}</div>${rd.length>=2?lineChart(rd.map(x=>({y:x.r,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: readiness ${x.r}`})),{min:0,max:100,label:'Readiness'}):'<div class="none">Check in on the Today tab to build this trend.</div>'}</div>`;
  h+=`<div class="sm"><div class="sm-h"><b>Broad jump</b>${jm.length?`<span class="v">${r1(Math.max(...jm.map(x=>x.v)))}<small>in best</small></span>`:''}</div>${jm.length>=2?lineChart(jm.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} in`})),{label:'Broad jump',minStep:1}):'<div class="none">Thursday’s first broad jump builds this trend.</div>'}</div>`;
  h+=`</div><div class="row"><button class="btn sm" data-act="view" data-view="history">See full tables in History</button></div></div>`;
  h+=bwCard(t);
  h+=energyCard(t);
  h+=prBoard();
  return h;
}
