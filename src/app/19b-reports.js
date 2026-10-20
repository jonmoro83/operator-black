/* ---------- a stretch of training, summed up ----------
The end-of-cycle report and the six-month comparison both ask one question of a range
of days -- what happened, and which way did it move -- so one function answers it for
both. Everything here is read from the log; nothing is projected or estimated except
where the card says so. */
function periodSummary(from,to){
  const t=todayStr(), end=to<t?to:t;
  let sched=0,done=0;
  for(let d=from;d<=end;d=addDays(d,1)){
    if(d<plan.startMonday) continue;
    const st=sessState(d,t); if(st==='rest'||st==='upcoming'||st==='today') continue;
    sched++; if(st==='done') done++;
  }
  const days=Math.round((D(end)-D(from))/864e5)+1;
  const rd=[]; for(let d=from;d<=end;d=addDays(d,1)){ const r=readiness(ci(d)); if(r!=null) rd.push(r) }
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  // Bodyweight at each end is the 7-day average, not one weigh-in: a single morning
  // moves with water and salt, and a comparison should not hang on one.
  const bwA=bwAvg(addDays(from,6),7), bwB=bwAvg(end,7);
  const bf=bfSeries(end).filter(x=>x.d>=from);
  const kc=[], pr=[]; for(let d=from;d<=end;d=addDays(d,1)){ const k=kcalOn(d); if(k) kc.push(k); const p=macroOn(d,'proG'); if(p!=null) pr.push(p) }
  const hs=hicSessions().filter(x=>x.d>=from&&x.d<=end);
  const bm=benchmarkState(end), bms=bm?bm.xs.filter(x=>x.d>=from):[];
  // How the working sets moved, where they were rated, and on heavy weeks especially.
  const eff={rated:0,fast:0,solid:0,ground:0,heavyRated:0,heavyFast:0};
  for(const [d,L] of progLogs()){
    if(d<from||d>end||!L.lifts) continue;
    const wk=weekOf(d), heavy=wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
    for(const x of Object.values(L.lifts)) for(const e of (x&&Array.isArray(x.eff)?x.eff:[])){
      if(!e) continue; eff.rated++; eff[e]++; if(heavy){ eff.heavyRated++; if(e==='fast') eff.heavyFast++ } }
  }
  return {from,to:end,days,sched,done,
    readiness:mean(rd)==null?null:Math.round(mean(rd)),readinessN:rd.length,
    bwFrom:bwA&&bwA.n>=2?bwA.avg:null, bwTo:bwB&&bwB.n>=2?bwB.avg:null,
    bfFrom:bf.length?bf[0]:null, bfTo:bf.length>1?bf[bf.length-1]:null,
    kcal:mean(kc)==null?null:Math.round(mean(kc)),kcalN:kc.length,
    protein:mean(pr)==null?null:Math.round(mean(pr)),proteinN:pr.length,
    cond:{n:hs.length,min:hs.reduce((a,x)=>a+hicMinutes(x).m,0)},
    bench:bm&&bms.length?{name:`${MOD[bm.mod].name} ${HIC[bm.fmt].name}`,first:bms[0],last:bms[bms.length-1],u:bms[bms.length-1].u}:null,
    eff};
}
// A cycle's first Monday to its last Sunday, from the plan as it actually ran.
function cycleRange(c){
  const ws=weeks().filter(w=>w.kind==='cycle'&&w.cycle===c); if(!ws.length) return null;
  return {from:ws[0].monday,to:addDays(ws[ws.length-1].monday,6)};
}
function cycleDone(c){ const r=cycleRange(c); return !!r&&r.to<todayStr() }
// Sessions against what was scheduled, judged by the same standard as Keeping up: the
// book asks for none missed, and two is the grace.
function sessRow(S,label){
  const miss=S.sched-S.done;
  return bRow({label:label||'Sessions',value:S.done,of:S.sched,pct:S.sched?100*S.done/S.sched:0,
    tone:!S.sched?'muted':!miss?'ok':miss<=MISS_GRACE?'warn':'off',
    word:!S.sched?'Nothing scheduled':!miss?'None missed':`${miss} missed`,aria:`${S.done} of ${S.sched} sessions`});
}
function effWord(e){
  if(!e.rated) return '';
  const bits=[`${e.fast} fast`,`${e.solid} solid`,`${e.ground} ground`].filter(b=>!/^0 /.test(b));
  return bits.join(' · ')+(e.heavyRated?` · ${e.heavyFast} of ${e.heavyRated} heavy sets fast`:'');
}

/* ---------- the end-of-cycle report ----------
The review asks one question -- what should the next max be. This is the rest of the
story in one place: what each max did, how the heavy sets moved, the body, the fuel,
the conditioning. Read-only, and it says what it does not know rather than guessing. */
function cycleReport(c){
  const r=cycleRange(c); if(!r) return '';
  const S=periodSummary(r.from,r.to), cur=maxFor(c), nxt=maxFor(c+1), set=(plan.cycleMaxes||{})[c+1]||{};
  let h=`<div class="mbs">`;
  h+=sessRow(S);
  h+=`</div><h4 class="sub-h">Strength</h4><div class="mbs">`;
  for(const k of activeLifts()){
    const a=cur[k], b=nxt[k]; if(!a) continue;
    const d=b?b.v-a.v:null, chosen=set[k]!=null&&set[k]!=='';
    h+=bRow({label:liftName(k),value:b?n(b.v):'—',unit:b?u():'',
      tone:d==null?'muted':d>0?'ok':d<0?'off':'muted',
      word:d==null?'':`${d>0?'+':d<0?'−':''}${d?n(Math.abs(d)):'Held'}${d?' for next cycle':''}`,
      sub:`This cycle ${n(a.v)} · ${chosen?'next max chosen in the review':'next max projected — not yet reviewed'}`});
  }
  h+=`</div>`;
  if(S.eff.rated) h+=`<div class="small muted">How the working sets moved: ${esc(effWord(S.eff))}.</div>`;
  h+=`<h4 class="sub-h">Body and fuel</h4><div class="mbs">`;
  if(S.bwFrom!=null&&S.bwTo!=null){ const dw=S.bwTo-S.bwFrom, tt=trendTone(dw/(S.days/7),u()==='kg'?0.1:0.2);
    h+=bRow({label:'Bodyweight',value:r1(S.bwTo),unit:u(),tone:tt.tone,word:`${dw>0?'+':''}${r1(dw)} over the cycle · ${tt.word.toLowerCase()}`,sub:`Started at ${r1(S.bwFrom)}, 7-day averages`}) }
  else h+=bRow({label:'Bodyweight',value:'—',sub:'Not enough weigh-ins at both ends'});
  if(S.bfFrom&&S.bfTo){ const db=S.bfTo.bf-S.bfFrom.bf, bt=bfTone(db);
    h+=bRow({label:'Body fat',value:r1(S.bfTo.bf),unit:'%',tone:bt.tone,word:`${bt.word} \u00b7 ${db>0?'+':''}${r1(db)} since ${fmtD(S.bfFrom.d)}`}) }
  const tg=macroTarget(r.to);
  if(S.protein!=null&&tg){ const mt=macroTone(tg.p,S.protein);
    h+=bRow({label:'Protein a day',value:S.protein,of:tg.p,unit:'g',pct:100*S.protein/tg.p,tone:mt.tone,word:mt.word,sub:`${S.proteinN} of ${S.days} days logged`,aria:`Protein ${S.protein} of ${tg.p} grams`}) }
  if(S.kcal!=null) h+=bRow({label:'Calories a day',value:n(S.kcal),of:tg?n(tg.kcal):null,unit:tg?'target':'',pct:tg?100*S.kcal/tg.kcal:null,
    tone:tg?macroTone(tg.kcal,S.kcal).tone:'muted',word:tg?macroTone(tg.kcal,S.kcal).word:'',sub:`${S.kcalN} of ${S.days} days logged`});
  if(S.readiness!=null){ const rt=readyTone(S.readiness); h+=bRow({label:'Readiness',value:S.readiness,of:100,pct:S.readiness,tone:rt.tone,word:rt.word,sub:`Average of ${S.readinessN} check-ins`}) }
  h+=`</div><h4 class="sub-h">Conditioning</h4><div class="mbs">`;
  h+=bRow({label:'Sessions',value:S.cond.n,sub:S.cond.n?`${Math.round(S.cond.min/(S.days/7))} minutes a week on average`:'None logged'});
  if(S.bench){ const db=S.bench.last.v-S.bench.first.v;
    h+=bRow({label:S.bench.name,value:n(S.bench.last.v),unit:S.bench.u,tone:S.bench.first===S.bench.last?'muted':db>0?'ok':db<0?'off':'muted',
      word:S.bench.first===S.bench.last?'Run once this cycle':`${db>0?'+':''}${n(db)} since ${fmtD(S.bench.first.d)}`,sub:'Your benchmark session'}) }
  return h+`</div>`;
}
// History lists every finished cycle's report, newest open, the rest folded. Open state
// lives in openPx like every other disclosure, because a <details> left to the DOM
// closes on the next render. The newest is opened once, the first time it is shown;
// after that it stays however you leave it.
let repSeeded=new Set();
function reportsCard(){
  const list=weeks(), cs=[...new Set(list.filter(w=>w.kind==='cycle').map(w=>w.cycle))].filter(cycleDone).sort((a,b)=>b-a);
  let h=`<div class="card"><h2>Cycle reports</h2>`;
  if(!cs.length){ const c1=cycleRange(1);
    return h+`<p class="note" style="margin:0">Each cycle gets a report when it ends: what every max did, how the heavy sets moved, bodyweight, fuel and conditioning, in one place.${c1?` The first one appears after ${fmtD(c1.to,true)}.`:''}</p></div>` }
  if(!repSeeded.has(cs[0])){ repSeeded.add(cs[0]); openPx.add('rep-'+cs[0]) }
  cs.forEach(c=>{ const r=cycleRange(c);
    h+=`<details class="plain" data-px="rep-${c}"${openPx.has('rep-'+c)?' open':''}><summary>Cycle ${c} · ${fmtD(r.from)}–${fmtD(r.to)}</summary><div style="margin-top:10px">${cycleReport(c)}</div></details>`; });
  return h+`</div>`;
}
