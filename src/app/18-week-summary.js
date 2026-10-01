/* ---------- week summary ---------- */
// At the start of a new week: how last week went, then what this one holds. Shown until
// dismissed (plan.weekSeen keeps the last Monday that was cleared).
function weekRecap(mon){
  let done=0, tot=0; const prs=[], rd=[];
  for(let i=0;i<7;i++){
    const d=addDays(mon,i), p=dayPlan(d);
    if(!['off','pre','convert'].includes(p.t)){tot++; if(lg(d).done) done++}
    const r=readiness(ci(d)); if(r!=null) rd.push(r);
    prs.push(...prsOn(d));
  }
  const end=addDays(mon,6);
  const hics=hicSessions(true).filter(x=>x.d>=mon&&x.d<=end&&x.v!=null);
  const avg=rd.length?Math.round(rd.reduce((a,b)=>a+b,0)/rd.length):null;
  return {done,tot,prs,avg,hics,mon,end};
}
// The weekly check-in: measurements, once a week, at the start of the training week.
// They are a weekly number, so asking for them in the daily check-in made them easy to
// skip and easy to over-log. This stays up all week until it has been filled in.
function weeklyCard(){
  if(viewing||sel!==todayStr()) return '';
  const t=todayStr(), mon=mondayOf(t);
  if(!weekOf(mon)) return '';
  const unit=u()==='kg'?'cm':'in';
  // anything logged this week counts as done, whichever day it went in on
  let today=(lg(t).meas)||{}, thisWeek=null;
  for(let i=0;i<7;i++){const d=addDays(mon,i),L=lg(d);if(L.meas&&L.meas.waist&&L.meas.neck){thisWeek={d,m:L.meas};break}}
  const prev=measBefore(mon), bfNow=thisWeek?navyBf(thisWeek.m,thisWeek.d):null, bfPrev=prev?navyBf(prev.m,prev.d):null;
  const f=(k,l)=>`<label class="f">${l} <small>(${unit})</small>${numIn('meas.'+k,today[k],prev&&prev.m[k]!=null?String(prev.m[k]):'')}</label>`;
  const since=prev?Math.round((D(mon)-D(prev.d))/864e5):null;
  if(thisWeek&&thisWeek.d!==t){
    const dw=bfNow!=null&&bfPrev!=null?bfNow-bfPrev:null;
    return `<details class="plain card"><summary><b>Weekly check-in</b> \u00b7 done ${fmtD(thisWeek.d,true)}${bfNow!=null?` \u00b7 ${r1(bfNow)}% body fat`:''}</summary>
    <div class="small muted" style="margin-top:8px">Waist ${r1(thisWeek.m.waist)} ${unit}, neck ${r1(thisWeek.m.neck)}${thisWeek.m.hip?`, hips ${r1(thisWeek.m.hip)}`:''}.${dw!=null?` ${dw<0?'Down':dw>0?'Up':'Level'} ${dw?r1(Math.abs(dw))+' points':''} since ${fmtD(prev.d)}.`:''} Charts are on Status.</div></details>`;
  }
  let h=`<div class="card"><div class="lift-h"><h3>Weekly check-in</h3><span class="small muted">${prev?`last ${fmtD(prev.d,true)}${since?` \u00b7 ${since} days ago`:''}`:'first one'}</span></div>
  <p class="small muted" style="margin:0">Measurements once a week, same time of day, relaxed: waist at the navel, neck below the larynx, hips at the widest point.</p>
  <div class="grid3">${f('neck','Neck')}${f('waist','Waist')}${f('hip','Hips')}</div>`;
  const bfT=navyBf(today,t);
  if(bfT!=null) h+=`<div class="small">That puts you at <b class="mono">${r1(bfT)}%</b> body fat${bfPrev!=null?`, ${bfT<bfPrev?'down':bfT>bfPrev?'up':'level'} ${bfT===bfPrev?'':r1(Math.abs(bfT-bfPrev))+' points '}since ${fmtD(prev.d)}`:''}.</div>`;
  else if(!plan.height||!plan.sex) h+=`<div class="small muted">Add your height and sex in Setup \u2192 About you and these turn into a body-fat estimate. They are worth tracking either way.</div>`;
  else if(today.waist||today.neck) h+=`<div class="small muted">Neck and waist both needed for the estimate${plan.sex==='f'?', plus hips':''}.</div>`;
  return h+`</div>`;
}
function weekSummaryCard(){
  if(viewing||sel!==todayStr()) return '';
  const mon=mondayOf(todayStr()), last=addDays(mon,-7);
  if((plan.weekSeen||'')===mon) return '';
  if(idxOf(last)<0) return '';                       // no previous week in this program
  const r=weekRecap(last);
  if(!r.tot&&!r.prs.length) return '';
  const wk=weekOf(mon), wt=wk?weekTitle(wk):null, lv=r.avg!=null?rLevel(r.avg):null;
  const ahead=[];
  if(wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy') ahead.push('A heavy week: singles or doubles near the top. Accessories are off.');
  if(wk&&wk.kind==='deload') ahead.push('A deload: easy lifting, steady conditioning, half the plyo contacts.');
  if(wk&&wk.kind==='test') ahead.push('Retest week: three easy days, then heavy singles.');
  if(wk&&wk.kind==='cycle') ahead.push('Plyos: '+plyoPhase(wk).name+'.');
  const nd=nextScheduled('deload'), nt=nextScheduled('test');
  let h=`<div class="card"><div class="lift-h"><h3>Your week</h3><button class="btn sm ghost" data-act="weekseen">Dismiss</button></div>
  <div class="small muted">Last week · ${fmtD(r.mon)}–${fmtD(r.end)}</div>
  <div class="miles"><div class="mile"><span class="l">Sessions</span><span class="big">${r.done}<small style="font-size:14px;color:var(--muted)">/${r.tot}</small></span><span class="small muted">${r.tot&&r.done===r.tot?'every one':r.tot?Math.round(100*r.done/r.tot)+'% done':'—'}</span></div>
  <div class="mile"><span class="l">Readiness</span>${r.avg!=null?`<span class="big">${r.avg}</span><span class="small"><span class="chip ${lv.cls}">${lv.t}</span></span>`:'<span class="small muted">No check-ins</span>'}</div>
  <div class="mile"><span class="l">Bests set</span><span class="big">${r.prs.length}</span><span class="small muted">${r.prs.length?r.prs.map(x=>x.label).join(', '):'none last week'}</span></div></div>`;
  if(r.hics.length) h+=`<div class="small muted">Conditioning: ${r.hics.map(x=>`${MOD[x.mod].name} ${HIC[x.f].name} ${n(x.v)} ${esc(x.u)}`).join(' · ')}</div>`;
  h+=`<div style="border-top:1px solid var(--line);padding-top:10px"><b>This week</b>${wt?` · ${esc(wt.t)} <span class="chip ${wt.cls}">${esc(wt.chip)}</span>`:''}</div>`;
  if(ahead.length) h+=`<ul class="tight small">${ahead.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  h+=`<div class="small muted">${esc(nd)} ${esc(nt)}</div></div>`;
  return h;
}
