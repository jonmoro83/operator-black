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
