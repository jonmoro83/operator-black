/* ---------- end-of-cycle review ---------- */
// Operator has no autoregulation. At the end of each cycle this reads what you logged
// (grinders, missed sets, effort on heavy weeks, readiness) and suggests next cycle's
// max per lift. Nothing changes until you apply it.
let reviewSel={};
/* ---------- how each working set moved ----------
Per set, so the review can see what a heavy week actually did rather than inferring it
from one number for the whole session. None of the books uses RPE or reps-in-reserve,
so this does not either; it uses their words. TB1's Golden Rule is to complete every
rep and avoid failure, and to finish feeling fresh -- "If you feel relatively fresh
after your strength session, you are doing it RIGHT." Ageless Athlete: "If you have to
grind your way through your sets on day one, there is a good chance that things will be
worse on Day 2." The three-point scale is ours. Ground is the books' word.

  fast    moved quickly, plenty left -- the fresh session TB1 describes
  solid   an honest working set, nothing to report
  ground  it slowed and had to be fought up: a grinder, AA's warning sign

`eff` sits beside `sets` on the lift, one entry per set index. */
const EFFORT=[['fast','Fast'],['solid','Solid'],['ground','Ground']];
function setEff(x,i){ const e=x&&Array.isArray(x.eff)?x.eff[i]:null; return EFFORT.some(([k])=>k===e)?e:null }
// Did this lift grind? The old whole-lift checkbox, or any set rated ground. One answer,
// read everywhere the checkbox used to be read, so old logs keep counting.
function ground(x){ return !!(x&&(x.grinder||(Array.isArray(x.eff)&&x.eff.includes('ground')))) }
// Tapping the rating a set already has clears it, so a slip of the thumb is undone in place.
function setEffort(date,k,i,v){
  if(!EFFORT.some(([e])=>e===v)) return false;
  const x=(lg(date).lifts||{})[k]||{}, arr=Array.isArray(x.eff)?[...x.eff]:[];
  arr[i]=arr[i]===v?null:v;
  for(let j=0;j<arr.length;j++) if(arr[j]===undefined) arr[j]=null;
  setLog(date,'lifts.'+k+'.eff',arr);
  return true;
}
// "fast, solid, ground" for whatever was rated, in set order.
function groundSets(x){ const n=Array.isArray(x&&x.eff)?x.eff.filter(e=>e==='ground').length:0; return Math.max(n,x&&x.grinder?1:0) }
function effSummary(x){ return (Array.isArray(x&&x.eff)?x.eff:[]).filter(Boolean).join(', ') }
function reviewCycleFor(date){
  const wk=weekOf(date); if(!wk) return null;
  let c=null;
  if(wk.kind==='cycle'&&wk.w===6&&dow(date)>=4) c=wk.cycle;
  else if(wk.kind==='cycle'&&wk.w<=2&&wk.cycle>1) c=wk.cycle-1;
  else if(wk.kind!=='cycle'&&wk.kind!=='bridge'&&wk.refCycle) c=wk.refCycle;
  if(!c||(plan.reviews||{})[c]) return null;
  return c;
}
function cycleStats(c){
  const list=weeks(), stats={}, rd=[];
  for(const wk of list){
    if(wk.kind!=='cycle'||wk.cycle!==c) continue;
    const heavy=tier(+wkRx(wk).p)==='heavy', p=+wkRx(wk).p;
    for(let i=0;i<7;i++){
      const d=addDays(wk.monday,i), L=logs[d]; if(!L) continue;
      const r=readiness(L.checkin||{}); if(r!=null) rd.push(r);
      const dp=dayPlan(d); if(dp.t!=='lift') continue;
      for(const k of dp.lifts){
        const x=(L.lifts||{})[k]; if(!x) continue;
        const sets=Array.isArray(x.sets)?x.sets:[], ticked=sets.filter(Boolean).length;
        if(!ticked&&!ground(x)) continue;
        const need=k==='dead'?1:+wkRx(wk).s;
        const S=stats[k]||(stats[k]={n:0,grind:0,heavyGrind:0,lightGrind:0,missed:0,rpe:[],sharp:0,niggle:0,where:{},heavyRated:0,heavyFast:0,groundSets:0});
        S.n++; if(ground(x)){S.grind++; if(heavy)S.heavyGrind++; if(p<=85)S.lightGrind++}
        // What each working set did, where it was rated.
        for(let j=0;j<sets.length;j++){ const e=setEff(x,j); if(!e) continue;
          if(e==='ground') S.groundSets++;
          if(heavy){ S.heavyRated++; if(e==='fast') S.heavyFast++ } }
        // a complaint counts against the lifts its location plausibly belongs to
        if(L.pain==='sharp'||L.pain==='niggle'){
          const where=painAt(L), mine=where.length?where.filter(w=>((PAIN_AT[w]||{}).lifts||[]).includes(k)):[];
          if(!where.length||mine.length){ S[L.pain==='sharp'?'sharp':'niggle']++; for(const w of mine) S.where[w]=(S.where[w]||0)+1 }
        }
        if(L.done&&ticked<need) S.missed++;
        if(heavy&&L.rpe) S.rpe.push(+L.rpe);
      }
    }
  }
  return {stats, readiness:rd.length?rd.reduce((a,b)=>a+b,0)/rd.length:null};
}
function reviewOptions(k,cur){
  const inc=+plan.inc[k]||0, rd=+plan.round[k]||5;
  return {reduce:floorTo(cur*.95,rd), hold:cur, standard:cur+inc, bigger:cur+inc+rd};
}
function painWords(S){
  const w=Object.entries(S.where||{}).sort((a,b)=>b[1]-a[1]).map(([k])=>(PAIN_AT[k]||{}).name||k);
  return w.length?' ('+w.join(', ').toLowerCase()+')':'';
}
function recommend(S,rdAvg){
  if(!S) return ['standard','Not enough logged sessions to judge, so the standard increase.'];
  const rpe=S.rpe.length?S.rpe.reduce((a,b)=>a+b,0)/S.rpe.length:null;
  const pain=[]; if(S.sharp) pain.push(`${S.sharp} with sharp pain${painWords(S)}`); if(S.niggle) pain.push(`${S.niggle} with a niggle`);
  const rated=S.heavyRated||0, fast=S.heavyFast||0;
  const bits=[`${S.n} sessions`,`${S.grind} grinder${S.grind===1?'':'s'}`,`${S.missed} missed`]
    .concat(rated?[`${fast} of ${rated} heavy sets fast`]:rpe!=null?[`heavy-week RPE ${rpe.toFixed(1)}`]:[]).concat(pain).join(' · ');
  // pain outranks everything else, including too few sessions to judge on
  if(S.sharp>=2) return ['reduce',bits+'. Sharp pain more than once on this lift: take the weight down and find out why before adding any.'];
  if(S.sharp>=1) return ['hold',bits+'. Sharp pain on this lift: hold the max rather than adding to it.'];
  if(S.n<3) return ['standard',(S.niggle?bits+'. ':'')+'Not enough logged sessions to judge, so the standard increase.'];
  if(S.missed>=3||S.lightGrind>=2) return ['reduce',bits+'. Grinding at moderate weights means the max is too high.'];
  if(S.missed>=1||S.heavyGrind>=1||S.grind>=2) return ['hold',bits+'. Repeat this max and own it.'];
  // The bigger increase. Per-set ratings are the better evidence, so they decide when
  // there are enough of them; the session's RPE is the fallback when there are not.
  // Ours, not the book's: four rated heavy sets is the least worth judging on, and
  // three in four fast is a heavy week that did not look heavy.
  if(rated>=4){
    if(fast/rated>=.75&&(rdAvg==null||rdAvg>=55)) return ['bigger',bits+'. The heavy sets moved fast \u2014 the max has room in it.'];
    return ['standard',bits+'. On track.'];
  }
  if(rpe!=null&&rpe<=7&&(rdAvg==null||rdAvg>=55)) return ['bigger',bits+'. Heavy weeks moved easily.'];
  return ['standard',bits+'. On track.'];
}
function reviewCard(c){
  const {stats,readiness:rdAvg}=cycleStats(c), mx=maxFor(c), nxt=(plan.cycleMaxes||{})[c+1]||{};
  const lifts=activeLifts().filter(k=>mx[k]);
  if(!Object.keys(stats).length) return '';
  const lbl={reduce:'Lower 5%',hold:'Hold',standard:'Standard',bigger:'Bigger jump'};
  let h=`<div class="card"><div class="lift-h"><h3>Cycle ${c} review</h3><span class="chip blue">Next: Cycle ${c+1}</span></div><p class="note" style="margin:0">Suggested from your grinders, missed sets and effort on heavy weeks${rdAvg!=null?` (average readiness ${Math.round(rdAvg)})`:''}. Pick next cycle’s max for each lift, then apply.</p>`;
  for(const k of lifts){
    const cur=mx[k].v, opts=reviewOptions(k,cur), [rec,why]=recommend(stats[k],rdAvg), preset=nxt[k]!=null&&nxt[k]!=='';
    const choice=reviewSel[k]||(preset?'keep':rec);
    const fmt=v=>isBW(k)?'+'+n(v):n(v);
    h+=`<div class="stack" style="gap:6px;border-top:1px solid var(--line);padding-top:10px"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="small muted mono">now ${fmt(cur)}</span></div><div class="small muted">${esc(why)}</div><div class="seg">${preset?`<button class="segb${choice==='keep'?' on':''}" data-act="rvsel" data-lift="${k}" data-v="keep">Keep ${fmt(+nxt[k])} (set)</button>`:''}${Object.entries(opts).map(([o,v])=>`<button class="segb${choice===o?' on':''}" data-act="rvsel" data-lift="${k}" data-v="${o}">${lbl[o]} ${fmt(v)}${o===rec?' ★':''}</button>`).join('')}</div></div>`;
  }
  h+=`<div class="row"><button class="btn primary" data-act="rvapply" data-c="${c}">Apply to Cycle ${c+1}</button><button class="btn ghost" data-act="rvdismiss" data-c="${c}">Dismiss</button><span class="small muted">★ = suggested</span></div></div>`;
  return h;
}

/* ---------- deload check-in (every 2 cycles) ---------- */
// In weeks 5-6 of cycles 2, 4, 6… ask whether the scheduled-deload setting still fits,
// with a recap of the last two cycles. Answers are kept in plan.deloadChecks.
const DELOAD_OPTS=[[0,'As needed'],[1,'After every cycle'],[2,'After every 2 cycles']];
function deloadLabel(v){const o=DELOAD_OPTS.find(x=>x[0]===v);return o?o[1]:'Every '+v+' cycles'}
function deloadCheckCycle(date){
  if(plan.askDeload===false) return null;
  const wk=weekOf(date); if(!wk||wk.kind!=='cycle'||wk.cycle%2||wk.w<5) return null;
  if((plan.deloadChecks||{})[wk.cycle]) return null;
  return wk.cycle;
}
function deloadCheckCard(c){
  const a=cycleStats(c-1), b=cycleStats(c), cur=+plan.deloadEvery||0;
  let grind=0, missed=0, sessions=0;
  for(const st of [a.stats,b.stats]) for(const S of Object.values(st)){grind+=S.grind;missed+=S.missed;sessions+=S.n}
  const rd=[a.readiness,b.readiness].filter(x=>x!=null), rdAvg=rd.length?Math.round(rd.reduce((x,y)=>x+y,0)/rd.length):null;
  const recap=sessions?`${sessions} lift entries · ${grind} grinder${grind===1?'':'s'} · ${missed} missed session${missed===1?'':'s'}${rdAvg!=null?' · average readiness '+rdAvg:''}`:'Not much logged in these two cycles yet.';
  const hint=rdAvg!=null&&rdAvg<60||grind+missed>=4?'Recovery looks strained. A deload after every cycle may fit better.':rdAvg!=null&&rdAvg>=75&&grind+missed<=1?'Recovery looks solid. As needed or every 2 cycles both fit.':'';
  return `<div class="card"><div class="lift-h"><h3>Deload check-in</h3><span class="chip blue">Cycles ${c-1}–${c}</span></div>
  <p class="small" style="margin:0">You’re set to <b>${deloadLabel(cur)}</b>. ${esc(nextScheduled('deload'))} Keep it, or change it for the next two cycles.</p>
  <div class="small muted">${esc(recap)}${hint?'. '+esc(hint):''}</div>
  <div class="seg"><button class="segb on" data-act="dlcheck" data-v="keep">Keep: ${deloadLabel(cur)}</button>${DELOAD_OPTS.filter(([v])=>v!==cur).map(([v,l])=>`<button class="segb" data-act="dlcheck" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="small muted">Asks again after Cycle ${c+2}. Turn this off in Setup.</div></div>`;
}
