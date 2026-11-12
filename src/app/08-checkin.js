/* ---------- daily check-in ---------- */
const CI_Q=[
  {grp:'Last night'},
  {f:'sleepH',q:'How many hours did you sleep?',num:true,opts:[[5,'5'],[6,'6'],[7,'7'],[8,'8'],[9,'9+']]},
  {f:'sleepQ',q:'How well did you sleep?',opts:[[1,'Awful'],[2,'Poor'],[3,'OK'],[4,'Good'],[5,'Great']]},
  {grp:'Right now'},
  {f:'energy',q:'Energy level?',opts:[[1,'Drained'],[2,'Low'],[3,'Normal'],[4,'Good'],[5,'Fired up']]},
  {f:'soreness',q:'How sore are you?',opts:[[1,'None'],[2,'A little'],[3,'Some'],[4,'Very'],[5,'Wrecked']]},
  {f:'stress',q:'Stress outside the gym?',opts:[[1,'Low'],[2,'Mild'],[3,'Moderate'],[4,'High'],[5,'Very high']]},
  {grp:'Yesterday’s eating'},
  {f:'protein',q:'Did you hit your protein target?',hint:'target',opts:[['yes','Yes'],['close','Close'],['no','No']]},
  {f:'fuel',q:'How much did you eat compared to your plan?',opts:[['under','Under'],['on','About right'],['over','Over']]},
  {f:'water',q:'Enough water?',opts:[['yes','Yes'],['no','Not really']]},
  {f:'alcohol',q:'Any alcohol?',opts:[['none','None'],['some','1–2 drinks'],['lots','3+']]},
  {f:'kcal',q:'Calories yesterday',kcal:true},
  // Grams, for the same day the calories are for. Optional, and the card above shows
  // what they should have been so the numbers are worth typing.
  {f:'macros',q:'Protein, carbs, fat',macros:true},
  {grp:'Optional'},
  {f:'bw',q:'Bodyweight this morning',bw:true}
];
const openCI=new Set();
const cvErr={};              // per-lift error from the add-a-variant form
function ci(date){return (lg(date).checkin)||{}}
// Calories are asked for the morning after, so what you ate on day d is logged on d+1.
function kcalOn(d){const v=ci(addDays(d,1)).kcal;return v==null||v===''?null:+v}
// Measured ("adaptive") TDEE: what you ate against what the scale trend did about it.
// 3500 kcal per lb, 7700 per kg. Needs a settled 7-day average at both ends of the
// window and calories on most of its days, or it says nothing.
function endAvg(from,to){
  let sw=0,sd=0,n=0;
  for(let d=from;d<=to;d=addDays(d,1)){const L=logs[d];if(!L||!inProgram(d))continue;const v=L.checkin&&L.checkin.bw;if(v==null||v==='')continue;sw+=+v;sd+=D(d);n++}
  return n?{avg:sw/n,at:sd/n,n}:null;
}
function tdeeMeasured(date,days){
  days=days||28;
  const from=addDays(date,-(days-1)), kc=[];
  for(let d=from;d<=date;d=addDays(d,1)){const v=kcalOn(d);if(v)kc.push(v)}
  // Both ends average their own 7 days, so the window needs no history before it. The
  // divisor is the real gap between the two groups' mean dates, not the window length.
  const a=endAvg(from,addDays(from,6)), b=endAvg(addDays(date,-6),date);
  if(!a||!b||a.n<2||b.n<2||kc.length<Math.ceil(days*.6)) return null;
  const gap=(b.at-a.at)/864e5; if(gap<7) return null;
  const mean=kc.reduce((x,y)=>x+y,0)/kc.length, dw=b.avg-a.avg, per=u()==='kg'?7700:3500;
  return {tdee:Math.round(mean-dw*per/gap),mean:Math.round(mean),dw,gap:Math.round(gap),days,n:kc.length,from,to:date};
}
// Mifflin-St Jeor, the usual predictive formula, for before there is enough data.
function bmr(date){
  const bw=bwFor(date), ht=+plan.height, sex=plan.sex, age=ageNow();
  if(!bw||!ht||!sex||!age) return null;
  const kg=u()==='kg'?bw:bw/2.2046, cm=u()==='kg'?ht:ht*2.54;
  return Math.round(10*kg+6.25*cm-5*age+(sex==='f'?-161:5));
}
function ageNow(){const b=+plan.birthYear;if(!b||b<1900)return null;return +todayStr().slice(0,4)-b}
const ACT=[[1.375,'Light · desk job, little else'],[1.55,'Moderate · this program, desk job'],[1.725,'High · this program plus an active job'],[1.9,'Very high · manual work or two-a-days']];
function actFactor(){const v=+plan.activity;return ACT.some(x=>x[0]===v)?v:1.55}
function tdeePredicted(date){const b=bmr(date);return b?Math.round(b*actFactor()):null}
// The running estimate. Your burn is not a constant: it drifts with bodyweight, with how
// much you move, and with a long deficit. So this is recomputed for every day from the
// window ending that day, longest window that has the data.
// Early on the window is short and the scale noise dominates, so the estimate is pulled
// toward the formula; the weight on your own data is the window's span over span + 10
// days, scaled by how many of its days have calories. By a full 28-day window it is ~70%
// yours, and `tdeeTrust` keeps climbing as history accumulates until the formula drops out.
function tdeeOn(date){
  const pred=tdeePredicted(date);
  const m=tdeeMeasured(date,28)||tdeeMeasured(date,21)||tdeeMeasured(date,14);
  if(!m) return pred?{tdee:pred,predicted:pred,measured:null,w:0}:null;
  if(!pred) return {tdee:m.tdee,predicted:null,measured:m,w:1};
  // Two things decide how much of your own number to use: how long you have been logging
  // both (six weeks of it and the formula drops out entirely) and how completely you
  // filled in the window. Today's intake is unknowable, so it is not counted against you.
  const w=Math.min(1,tdeeHistory(date)/42);
  return {tdee:Math.round(m.tdee*w+pred*(1-w)),predicted:pred,measured:m,w};
}
function tdeeHistory(date){
  let n=0; for(let i=1;i<=42;i++){const d=addDays(date,-i),L=logs[d];if(kcalOn(d)!=null&&L&&L.checkin&&L.checkin.bw!=null&&L.checkin.bw!=='')n++}
  return n;
}
// The estimate over time: one point per week, each from its own 28-day window.
function tdeeSeries(date,weeks){
  const out=[];
  for(let i=(weeks||12)-1;i>=0;i--){
    const d=addDays(date,-7*i); if(d<plan.startMonday) continue;
    const t=tdeeOn(d); if(t&&t.measured) out.push({d,v:t.tdee,w:t.w,mean:t.measured.mean});
  }
  return out;
}
// US Navy circumference method. Men use waist and neck, women add the hips. Measurements
// are in inches with lb, cm with kg. Typical error is 3–4 points, so it is a trend tool.
function measBefore(date){
  let best=null;
  for(const [d,L] of Object.entries(logs)) if(d<date&&inProgram(d)&&L.meas&&L.meas.waist&&L.meas.neck&&(!best||d>best.d)) best={d,m:L.meas};
  return best;
}
function navyBf(m,date){
  const ht=+plan.height, sex=plan.sex;
  if(!ht||!sex||!m||!m.waist||!m.neck) return null;
  const toIn=v=>u()==='kg'?+v/2.54:+v;
  const w=toIn(m.waist), nk=toIn(m.neck), hp=m.hip?toIn(m.hip):null, h=toIn(ht);
  let v;
  if(sex==='f'){ if(!hp) return null; v=163.205*Math.log10(w+hp-nk)-97.684*Math.log10(h)-78.387 }
  else { if(w<=nk) return null; v=86.010*Math.log10(w-nk)-70.041*Math.log10(h)+36.76 }
  return v>0&&v<70?Math.round(v*10)/10:null;
}
function bfSeries(date){
  return progLogs().filter(([d,L])=>d<=date&&L.meas&&L.meas.waist&&L.meas.neck)
    .map(([d,L])=>({d,m:L.meas,bf:navyBf(L.meas,d)})).filter(x=>x.bf!=null).sort((a,b)=>a.d<b.d?-1:1);
}
function latestBw(date){let best=null;for(const [d,L] of Object.entries(logs)) if(d<=date&&L.checkin&&L.checkin.bw&&(!best||d>best.d)) best={d,v:+L.checkin.bw};return best?best.v:(plan.bodyweight?+plan.bodyweight:null)}
// Daily weigh-ins are noisy; everything that reacts to bodyweight uses a 7-day average
// and falls back to the latest single reading until there are two in the window.
function bwAvg(date,days){
  days=days||7; const from=addDays(date,-(days-1)), xs=[];
  for(const [d,L] of Object.entries(logs)) if(d>=from&&d<=date&&L.checkin&&L.checkin.bw) xs.push(+L.checkin.bw);
  return xs.length?{avg:xs.reduce((a,b)=>a+b,0)/xs.length,n:xs.length}:null;
}
function bwFor(date){const a=bwAvg(date,7);return a?a.avg:latestBw(date)}
// Change per week from the 7-day average now against the one `back` days ago.
function bwRate(date,back){
  back=back||14; const now=bwAvg(date,7), then=bwAvg(addDays(date,-back),7);
  if(!now||!then||now.n<2||then.n<2) return null;
  return {perWeek:(now.avg-then.avg)/back*7, from:then.avg, to:now.avg, back};
}
function proteinTarget(date){const bw=bwFor(date);if(!bw)return null;const lb=u()==='kg'?bw*2.2046:bw;return Math.round(lb*(+plan.proteinPerLb||0.8)/5)*5}
function readiness(c){
  const part=[], add=(v,w)=>{if(v!=null&&!Number.isNaN(v))part.push([Math.max(0,Math.min(1,v)),w])};
  const tgt=+plan.sleepTarget||8;
  if(c.sleepH!=null&&c.sleepH!=='') add((+c.sleepH-4)/(tgt-4),.25);
  if(c.sleepQ) add((c.sleepQ-1)/4,.15);
  if(c.energy) add((c.energy-1)/4,.2);
  if(c.soreness) add(1-(c.soreness-1)/4,.15);
  if(c.stress) add(1-(c.stress-1)/4,.1);
  const nut=[]; if(c.protein) nut.push({yes:1,close:.6,no:.2}[c.protein]); if(c.fuel) nut.push({on:1,over:.8,under:.3}[c.fuel]); if(c.water) nut.push({yes:1,no:.5}[c.water]); if(c.alcohol) nut.push({none:1,some:.7,lots:.3}[c.alcohol]);
  if(nut.length) add(nut.reduce((a,b)=>a+b,0)/nut.length,.15);
  if(part.length<3) return null;
  const tw=part.reduce((a,x)=>a+x[1],0);
  return Math.round(100*part.reduce((a,x)=>a+x[0]*x[1],0)/tw);
}
function rLevel(sc){return sc==null?null:sc>=75?{k:'go',cls:'light',t:'Ready'}:sc>=55?{k:'care',cls:'mid',t:'Moderate'}:{k:'stop',cls:'heavy',t:'Low'}}
// Black rotates its conditioning; the app lets you pick anything and never noticed when
// you stopped rotating. Looks at the hard sessions only — LISS is meant to be samey.
// What a logged session turned out to be. A FOBBIT run long is an E, whatever it was
// scheduled as, so it does not belong in a count of hard sessions.
function hicWasHard(x){ return !!x&&x.f!=='liss'&&!((IV[x.f]||{}).lead&&fobIsE(x.min)) }
function hicRut(date,n0){
  const xs=hicSessions().filter(x=>x.d<=date&&hicWasHard(x)).slice(-(n0||6));
  if(xs.length<(n0||6)) return null;
  const f=xs[0].f, mod=xs[0].mod;
  // A book session has no tool to be stuck on, so a run that includes one is only ever
  // a rut on the format.
  const sameF=f!=='free'&&xs.every(x=>x.f===f), sameM=xs.every(x=>x.mod===mod&&!hicBook(x.f));
  if(!sameF&&!sameM) return null;
  return {n:xs.length,f:sameF?f:null,mod:sameM?mod:null,since:xs[0].d};
}
// One session you repeat to compare against itself. Results only compare within an
// activity and a format, so a benchmark is the single line worth watching when the rest
// of your conditioning moves around.
function benchmark(){
  const b=plan.benchmark;
  if(b&&MOD[b.mod]&&HIC[b.fmt]&&!HIC[b.fmt].noMetric&&!HIC[b.fmt].noCompare) return b;
  // not chosen yet: the hard pairing you have done most
  const tally={};
  for(const x of hicSessions()) if(x.f!=='liss'&&!(HIC[x.f]||{}).noCompare&&x.v!=null) tally[hicKey(x.mod,x.f)]=(tally[hicKey(x.mod,x.f)]||0)+1;
  const top=Object.keys(tally).sort((a0,b0)=>tally[b0]-tally[a0])[0];
  if(!top) return null;
  const [mod,fmt]=top.split('|');
  return {mod:mod==='book'?defMod():mod,fmt,auto:true};
}
// The best of a set of results for a format: the lowest for one done for time.
function hicBest(f,xs){ return xs.reduce((a0,x)=>a0==null||hicBetter(f,x.v,a0)?x.v:a0,null) }
function benchmarkState(date){
  const b=benchmark(); if(!b) return null;
  const xs=hicSessions().filter(x=>x.d<=date&&(hicBook(b.fmt)||x.mod===b.mod)&&x.f===b.fmt&&x.v!=null);
  const last=xs[xs.length-1]||null, first=xs[0]||null;
  const days=last?Math.round((D(date)-D(last.d))/864e5):null;
  const every=+plan.benchEvery||35;
  return {...b,xs,last,first,days,every,due:!last||days>=every,best:hicBest(b.fmt,xs)};
}
function suggestions(date){
  const c=ci(date), sc=readiness(c), lv=rLevel(sc), wk=weekOf(date), dp=dayPlan(date), out=[];
  if(!lv) return out;
  const add=(tone,title,text,act)=>out.push({tone,title,text,act});
  const heavy=wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
  const hicFmt=dp.t==='hic'?effFmt(date):null;
  // today's session
  if(dp.t==='lift'){
    if(dp.deload) add('go','Deload day','Keep it easy regardless of how you feel. The point is recovery.');
    else if(lv.k==='go'&&sc>=85&&!(c.soreness>=4)) add('go','Green light: room for extra volume',`Operator allows 3–5 sets. If bar speed stays crisp, add a 4th set on squat and bench${heavy?' (heavy week: stop at 4)':''}. Deadlift stays at 1–3.`);
    else if(lv.k==='go') add('go','Train as written','Recovery looks good. Run the session as prescribed.');
    else if(lv.k==='care') add('care','Train as written, no extras','Hold at 3 sets (deadlift 1–2) and keep accessories to two movements.');
    else add('stop','Do the minimum today','3 sets on each lift, 1 set of deadlift, skip accessories. If the 70% warm-up feels heavy, lower today’s working weight 5–10%. Type it into the working weight box and the warm-ups recalculate. A lighter session still beats a skipped one.');
  }
  if(hicFmt&&hicFmt!=='liss'){
    const low={map:'8 rounds instead of 10',anaerobic:'6 rounds instead of 8',threshold:'3 rounds instead of 4',long:'4 rounds instead of 5'}[hicFmt];
    const hm=modOf(date), last=lastHic(hicFmt,hm,date).last;
    if(lv.k==='go') add('go','Push the conditioning',last?`Last ${HIC[hicFmt].name}${hicBook(hicFmt)?'':' ('+MOD[hm].name+')'}: ${resLine(last.v,last.u)}. Try to beat it.`:`Go hard and record your result as a baseline.`);
    else if(lv.k==='care') add('care','Conditioning: low end of the range',`Do ${low}. Hold the same pace, just fewer rounds.`);
    else add('stop','Swap today’s HIC to LISS','30–45 min conversational. Change the format in the conditioning card so your history stays clean.');
  }
  if(dp.plyo&&(lv.k==='stop'||c.soreness>=4)) add('care','Plyos: halve the contacts','Cut, don’t skip. Tick “halve the contacts” and drop depth jumps today. Stop the moment a jump comes up short.');
  if(dp.t==='test'||dp.t==='rm5'){
    if(lv.k!=='go') add('care','Testing on a so-so day','If you can move the test a day, do it. If not, take the lower number. Starting light and adding later works. Starting heavy and stalling doesn’t.');
    else add('go','Good day to test','Ramp in singles, stop when the bar slows.');
  }
  if(dp.t==='off'&&lv.k==='stop') add('go','Good timing for a rest day','Prioritize sleep tonight. An easy walk helps more than lying still.');
  // recovery
  const tgt=+plan.sleepTarget||8;
  if(c.sleepH!=null&&c.sleepH!==''&&+c.sleepH<6) add('care','Short on sleep','Have caffeine early (nothing within 8 h of bed). A 20-minute nap before 3 pm helps. Don’t chase PRs today.');
  const recent=[];for(let i=0;i<7;i++){const d=addDays(date,-i),x=ci(d);if(x.sleepH!=null&&x.sleepH!=='')recent.push(+x.sleepH)}
  if(recent.length>=3){const avg=recent.reduce((a,b)=>a+b,0)/recent.length;if(avg<tgt-1) add('care',`Sleep averaging ${avg.toFixed(1)} h`,`That’s your biggest recovery lever. Set a fixed wake time, keep the room cool and dark, screens off 30 min before bed, and no HIC within 3 h of bedtime. Aim for ${tgt} h.`)}
  if(c.stress>=4) add('care','High stress counts as training load','Do the required sessions but drop anything optional: swap Saturday HIC to LISS and skip extra sets.');
  if(c.soreness>=4&&(dp.t==='lift'||dp.t==='test')) add('care','Very sore','Add 5 minutes to the cardio warm-up and extra hip work; soreness usually eases once warm. Sharp or joint pain is different: skip that lift.');
  // nutrition
  const pt=proteinTarget(date);
  if(c.protein==='no'||c.protein==='close') add('care','Protein',pt?`Aim for about ${pt} g today: 4 meals of ~${Math.round(pt/4/5)*5} g. Easy wins: Greek yogurt, eggs, chicken, lean beef, a whey shake.`:'Add your bodyweight (in Setup or below) to get a daily protein target.');
  const training=dp.t!=='off'&&dp.t!=='convert';
  if(c.fuel==='under'&&training) add('care','Fuel the session',`Under-eating shows up first in conditioning numbers. Eat carbs 2–3 h before training (rice, oats, potatoes, fruit)${plan.goal==='lose'?'. You can stay in a deficit, just put most of your carbs around training':''}.`);
  if(c.water==='no') add('care','Hydrate','Start with 16–24 oz of water now, and add 16–24 oz for each hour of hard conditioning. A pinch of salt helps on HIC days.');
  if(hicFmt&&hicFmt!=='liss'){
    const rut=hicRut(date,6);
    if(rut) add('care','Rotate your conditioning',`Your last ${rut.n} hard sessions were all ${rut.f?HIC[rut.f].name:''}${rut.f&&rut.mod?' on the ':''}${rut.mod?MOD[rut.mod].name.toLowerCase():''}. Black rotates formats and tools on purpose \u2014 pick a different one today and the adaptation stays broad.`);
    const bm=benchmarkState(date);
    if(bm&&bm.due&&bm.last) add('go','Benchmark due',`It has been ${bm.days} days since your ${hicTitle(bm.mod,bm.fmt).replace(' · ',' ')} benchmark (best ${resStr(bm.best,bm.last.u)}). Run that one today and you get a number that compares straight back.`);
  }
  if(c.alcohol==='lots') add('care','After a big night','Expect lower HIC numbers and don’t chase a PR. Extra water and a solid breakfast.');
  // trends
  let lowDays=0;for(let i=0;i<7;i++){const x=readiness(ci(addDays(date,-i)));if(x!=null&&x<55)lowDays++}
  const nm=addDays(mondayOf(date),7), nw=weekOf(nm);
  if(lowDays>=3&&nw&&nw.kind==='cycle') add('stop',`${lowDays} low-readiness days this week`,`Recovery isn’t keeping up. Consider a deload week starting ${fmtD(nm,true)}.`,{act:'insert',kind:'deload',monday:nm,label:'Deload next week'});
  {const r=bwRate(date,14);
    if(r){const perWk=r.perWeek, pct=perWk/r.from*100;
      if(plan.goal==='lose'&&pct<-1) add('care',`Losing ${Math.abs(perWk).toFixed(1)} ${u()}/week`,'That is from your 7-day average, and faster than about 1% of bodyweight per week tends to cost strength and conditioning. Add 200–300 kcal a day, mostly carbs around training.');
      else if(plan.goal==='lose'&&pct>-0.2) add('care','Bodyweight is flat','Two weeks of 7-day averages with no real change: trim about 200 kcal a day, or add one LISS session.');
      else if(plan.goal==='gain'&&pct<0.1) add('care','Not gaining','Add 200–300 kcal a day. Easiest from an extra meal or a bigger post-training meal.');
    }}
  return out;
}
function checkinCard(date){
  if(date>todayStr()) return '';
  const c=ci(date), sc=readiness(c), lv=rLevel(sc), open=openCI.has(date)||sc==null, pt=proteinTarget(date);
  const qs=CI_Q.map(q=>{
    if(q.grp) return `</div><div class="ci-grp"><h4>${q.grp}</h4>`;
    if(q.bw) return `<label class="q"><span>${q.q} <small>(${u()})</small></span>${numIn('checkin.bw',c.bw,latestBw(date)?n(latestBw(date)):'','class="num-in"')}</label>`;
    if(q.kcal) return `<label class="q"><span>${q.q} <small>(kcal, optional)</small></span>${numIn('checkin.kcal',c.kcal,'','class="num-in"')}</label>`;
    if(q.macros){
      const t=macroTarget(date);
      return `<div class="q"><span>${q.q} <small>(g, optional)</small></span><div class="row" style="gap:6px">
      ${[['proG','P',t&&t.p],['carbG','C',t&&t.c],['fatG','F',t&&t.f]].map(([f,lbl,tg])=>
        `<label class="macro-in"><span class="small muted">${lbl}</span>${numIn('checkin.'+f,c[f],tg?String(tg):'','class="num-in"')}</label>`).join('')}
      </div></div>`;
    }
    const hint=q.hint==='target'&&pt?` <small>(~${pt} g)</small>`:'';
    return `<div class="q"><span>${q.q}${hint}</span><div class="seg">${q.opts.map(([v,l])=>`<button class="segb${c[q.f]==v&&c[q.f]!==''&&c[q.f]!=null?' on':''}" data-act="ci" data-f="${q.f}" data-v="${v}" aria-pressed="${c[q.f]==v}">${l}</button>`).join('')}${q.num?numIn('checkin.sleepH',c.sleepH,'exact','class="num-in" style="max-width:84px" aria-label="Exact hours slept"'):''}</div></div>`;
  }).join('');
  const sug=suggestions(date);
  let h=`<div class="card"><div class="lift-h"><h3>Daily check-in</h3>${lv?`<span class="chip ${lv.cls}">${lv.t}</span>`:''}</div>`;
  if(lv) h+=`<div class="ready"><div class="big">${sc}</div><div class="small muted">Readiness out of 100, from sleep, energy, soreness, stress and yesterday’s eating.</div></div>`;
  else h+=`<p class="note" style="margin:0">Answer at least three questions (30 seconds) and the app adjusts today’s suggestions to how you’re recovering.</p>`;
  if(sug.length) h+=`<ul class="sug">${sug.map(x=>`<li class="${x.tone}"><div><b>${esc(x.title)}</b>${esc(x.text)}${x.act?`<div style="margin-top:6px"><button class="btn sm" data-act="${x.act.act}" data-kind="${x.act.kind}" data-monday="${x.act.monday}">${x.act.label}</button></div>`:''}</div></li>`).join('')}</ul>`;
  h+=`<details class="plain" id="ci-${date}"${open?' open':''}><summary>${lv?'Edit answers':'Questions'}</summary><div class="stack" style="gap:16px;margin-top:12px">${qs.replace(/^<\/div>/,'')}</div></div></details>`;
  if(lv) h+=`<p class="small muted" style="margin:0">General training guidance, not medical advice.</p>`;
  return h+`</div>`;
}
function accList(day){const a=(plan.acc||{})[day];return Array.isArray(a)&&a.length?a:ACC[day]}
function accCard(wk,dp){
  /* Unlike the heavy-week rule this one is not contradicted by anything: both books
     that use the word mean a harder stop than we do. TB3's deload is the bridge week,
     "simply taking a week off in between Blocks", and Ageless Athlete takes "a
     complete deload from lifting (and a deep reduction of conditioning)". Dropping the
     supplementary work while keeping three light sessions is the gentler version of
     the same idea, not a departure from it. The deload week itself is ours though --
     TB1 has no strength deload at all -- so the card says so rather than stating it
     flat, the way the heavy-week rule used to. */
  if(dp.deload) return `<div class="card"><h3>Accessories</h3><p class="muted" style="margin:0">None this week. A deload is for recovering, so the supplementary work comes off with the rest of the volume.</p><p class="small muted" style="margin:0"><b>Ours</b>, and so is the deload week \u2014 TB1 prescribes no strength deload, TB3\u2019s is a bridge week off altogether, and <i>Ageless Athlete</i> takes a complete break from lifting. Three light sessions is our lighter reading of all three.</p></div>`;
  const v=wkRx(wk), arx=accRxFor(wk,dp.day);
  /* No book says to skip accessories on a heavy week. That rule was ours and it read
     like the book's. What TB1 gives is a test, and it is about recovery rather than the
     calendar: "If your accessory work is interfering with your recovery to the point
     it's affecting your main lifts, then you're not doing it right. Cut back or
     eliminate it. Leave the main lifts unaffected." Its only weeks-3-and-6 concession
     is to the main lift -- drop a set of the prescribed work if the volume is too much
     -- and the reason it gives is a gruelling conditioning session, not accessories.
     TB1 from the other side: "But if you want to throw in supplementary push-ups,
     pull-ups, ab work etc. go for it."

     So the week no longer decides. The note says what the book says, the judgment is
     yours, and the skip is one tap when you make it. A program that prescribes its
     supplementary work still means it, heavy week or not. */
  const day=dp.acc; if(!day) return '';
  const slots=accSlots(day), done=accDoneCount(sel,day);
  const heavy=!arx&&wk.kind==='cycle'&&tier(+v.p)==='heavy';
  const skipped=accSkipped(sel);
  const title=arx?'Supplementary':'Accessories';
  let h=`<div class="card"><div class="lift-h"><h3>${title}</h3>${arx?`<span class="rx">${arx.s}${arx.sMax?'\u2013'+arx.sMax:''} \u00d7 ${arx.r} @ ${arx.p}%</span>`:''}<span class="small muted">${done} of ${slots.length} done</span></div>
  <p class="muted small" style="margin:0">${arx?`Every one of these, ${arx.sMax?`${arx.s} or ${arx.sMax}`:arx.s} sets of ${arx.r}. The percentage is of your own best for that movement \u2014 if you have never tested it, take ${arx.r} reps you could have done a couple more of.`:'Two or three sets each, a couple of reps short of failure. Nothing that leaves you sore for tomorrow\u2019s HIC.'}</p>`;
  if(heavy) h+=`<div class="banner info"><div class="small"><b>Heavy week.</b> The books do not say to drop these. TB1\u2019s test is whether the work is costing you the main lifts: \u201cif your accessory work is interfering with your recovery to the point it\u2019s affecting your main lifts, then you\u2019re not doing it right. Cut back or eliminate it.\u201d <b>Ours:</b> a heavy week is where that bites first, so cut the accessories back before you cut the lifts.</div></div>`;
  if(skipped) return h+`<div class="row between" style="margin-top:4px"><span class="small muted">Skipped today.</span><button class="btn sm ghost" data-act="accskip">Bring them back</button></div></div>`;
  if(!slots.length) h+=`<div class="muted small">No accessory slots on this day. Add some in Setup \u2192 Accessories.</div>`;
  for(const g of accRunGroups(day)){
    if(g.length>1) h+=`<div class="acc-super"><div class="small" style="font-weight:650">Superset \u00b7 ${esc(g.map(sl=>(ASLOT[sl]||{}).name||sl).join(' + '))}</div>
      <div class="small muted">A set of each, back to back, then rest. ${arx?'':'Two or three rounds.'}</div>
      ${g.map(sl=>accSlotRow(sel,sl)).join('')}</div>`;
    else h+=accSlotRow(sel,g[0]);
  }
  if(!viewing&&slots.length) h+=`<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="accskip">Skip these today</button></div>`;
  return h+`</div>`;
}

/* How long the rest after a set of this job runs for. Written where the sets are, the
   way the warm-up rest is, because that is where you find out it is wrong. One per
   pair: the attribute differs because session mode has its own click handler. */
function accRestSel(slot,inLs,pair){
  const at=inLs?'data-ls':'data-act', cur=accRestSecs(slot), sw=accSwitchSecs(slot);
  let h=`<div class="restsel"><span>Rest after a set</span><div class="seg">${ACC_RESTS.map(v=>`<button class="segb${cur===v?' on':''}" ${at}="accrestset" data-slot="${esc(slot)}" data-v="${v}" aria-pressed="${cur===v}">${warmRestLabel(v)}</button>`).join('')}</div></div>`;
  if(pair) h+=`<div class="restsel"><span>Between the pair</span><div class="seg">${ACC_SWITCHES.map(v=>`<button class="segb${sw===v?' on':''}" ${at}="accswitchset" data-slot="${esc(slot)}" data-v="${v}" aria-pressed="${sw===v}">${accSwitchLabel(v)}</button>`).join('')}</div></div>`;
  return h;
}
// The tick that finishes a set. Same button in both places, so the two cannot drift.
function accTickBtn(date,slot,i,inLs){
  const on=!!(accSets(date,slot)[i]||{}).done;
  return `<button class="wu-chk${on?' on':''}" ${inLs?'data-ls':'data-act'}="accset" data-slot="${esc(slot)}" data-i="${i}" aria-pressed="${on}" aria-label="Set ${i+1} done">\u2713</button>`;
}

// One slot: what it is for, what is filling it today, and what you did.
function accSlotRow(date,slot){
  const id=accOn(date,slot), e=accEx(id), sets=accSets(date,slot), swapped=accSwapped(date,slot);
  const list=accFor(slot,id), all=accAll();
  const isDone=accDone(date,slot), noSets=!sets.length;
  let h=`<div class="acc-slot">
  <div class="acc-head"><span class="acc-role">${esc((ASLOT[slot]||{}).name||slot)}</span>${swapped?'<span class="chip blue">today only</span>':''}${isDone?'<span class="chip light">done</span>':''}</div>`;
  if(viewing){
    h+=`<div><b>${esc(e?e.name:'\u2014')}</b></div>`;
  } else {
    h+=`<select data-act-acc="${esc(slot)}" aria-label="${esc((ASLOT[slot]||{}).name||slot)}">${list.map(k=>`<option value="${esc(k)}"${k===id?' selected':''}>${esc(all[k].name)}${all[k].gear?' \u00b7 '+esc(all[k].gear):''}</option>`).join('')}</select>`;
  }
  if(slot==='pullup') h+=`<div class="small muted">${esc(pullupState(date).st.work)}</div>`;
  // A movement that carries its own prescription says it here, where the sets are logged.
  if(e&&e.rx) h+=`<div class="small"><b>${esc(e.rx)}</b>${e.src?`<div class="small muted">${esc(e.src)}</div>`:''}</div>`;
  // A band exercise with bands on file: pick the color, get the number in the weight
  // field. Still editable afterwards — the band is a shortcut, not a lock.
  if(!viewing&&isBandEx(id)&&bands().length) h+=`<label class="f small">Band<select data-act-band="${esc(slot)}"><option value="">Pick a band\u2026</option>${bands().map(x=>`<option value="${esc(String(x.w))}">${esc(x.n)} \u00b7 ${n(x.w)} ${esc(u())}</option>`).join('')}</select></label>`;
  h+=accLastLine(date,slot,id);
  const grp=accGroupOf(date,slot);
  if(!viewing&&sets.length&&grp[0]===slot) h+=accRestSel(slot,false,grp.length>1);
  for(let i=0;i<sets.length;i++){
    const x=sets[i]||{};
    h+=`<div class="wu-row"><span class="wu-lbl">${i+1}</span>${numIn(`acc.sets.${slot}.${i}.w`,x.w,isBWAcc(id)?'bw':u(),`aria-label="Set ${i+1} weight"`)}<span class="wu-x">\u00d7</span>${numIn(`acc.sets.${slot}.${i}.r`,x.r,'reps',`aria-label="Set ${i+1} reps"`)}${viewing?'<span></span><span></span>':accTickBtn(date,slot,i,false)+`<button class="wu-rm" data-act="accrm" data-slot="${esc(slot)}" data-i="${i}" aria-label="Remove set ${i+1}">\u00d7</button>`}</div>`;
  }
  if(!viewing) h+=`<div class="row" style="gap:8px"><button class="btn sm ghost" data-act="accadd" data-slot="${esc(slot)}">+ Add set</button>${noSets?`<button class="btn sm${isDone?' primary':' ghost'}" data-act="accdone" data-slot="${esc(slot)}">${isDone?'\u2713 Done':'Mark done'}</button>`:''}</div>`;
  return h+`</div>`;
}
// Pull-ups and dips are loaded by bodyweight unless you hang a belt on.
function isBWAcc(id){ return ['abtriad','chinup','dip','pu_prog','pu_band','pu_neg','invrow','plank','sideplank','copen','deadbug','deadhang','nordic','ghr','abwheel','hangknee','hangleg','backext','pullapart','pike'].includes(id) }

function lastHic(fmt,mod,before,shape){
  let best=null,last=null;
  for(const x of hicSessions(true)){ if(x.d>=before||x.f!==fmt||(x.mod!==mod&&!hicBook(fmt))||x.v==null||(shape&&x.shape!==shape)) continue;
    if(!last||x.d>last.d) last=x; if(!best||hicBetter(fmt,hicValue(x),hicValue(best))) best=x; }
  return {best,last};
}
/* Mod #1 prescribes a percentage of a 1RM rather than a rep count. If there is a max on
   file, turn it into the weight on the bar; without one we still show the percentage,
   because the session works either way and you can do the arithmetic. */
function fobLoadLine(bouts){
  const out=[];
  for(const b of (bouts||[])){
    if(!b.pct||!b.lift) continue;
    const mx=(plan.maxes||{})[b.lift], pc=Array.isArray(b.pct)?b.pct:[b.pct,b.pct], nm=esc(liftName(b.lift));
    if(mx==null||mx===''){ out.push(`${nm} at ${pc[0]}–${pc[1]}% of your 1RM. Put a 1RM in Setup and this becomes a weight.`); continue }
    const w=pc.map(p=>rnd(+mx*p/100,(plan.round||{})[b.lift]));
    out.push(`${nm} at ${pc[0]}–${pc[1]}% of ${n(+mx)}: <b>${n(w[0])}${w[1]!==w[0]?' to '+n(w[1]):''} ${u()}</b>.`);
  }
  return out.length?`<div class="small muted">${out.join(' ')}</div>`:'';
}
/* One of Tactical Barbell II's sessions on the day card: what to do, the book's easier
   and harder versions, and its reasoning folded away. The same entry, in full, is in
   the Guide. */
function hicBookBlock(f){
  const H=HIC[f], b=H.book; if(!b) return '';
  let h=`<ul class="tight" style="margin:6px 0 2px">${b.lines.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  const vs=[];
  if(b.basic) vs.push(`<b>Basic:</b> ${esc(b.basic)}`);
  if(b.advanced) vs.push(`<b>Advanced:</b> ${esc(b.advanced)}`);
  if(b.alt) vs.push(`<b>Alternative:</b> ${esc(b.alt)}`);
  if(vs.length) h+=`<div class="small">${vs.join('<br>')}</div>`;
  // Which version you did. Logging the Advanced is the book's cue to swap a cluster
  // session for a new one (TB II p187).
  if(b.basic||b.advanced){
    const v=(lg(sel).hic||{}).ver||'';
    h+=`<div class="restsel"><span>Version done</span><div class="seg">${[['basic','Basic'],['rx','As written'],['advanced','Advanced']].filter(([k])=>k==='rx'||b[k]).map(([k,l])=>`<button class="segb${v===k?' on':''}" data-act="hicver" data-v="${k}" aria-pressed="${v===k}">${l}</button>`).join('')}</div></div>`;
  }
  if(b.load) h+=fobLoadLine(b.load.map(x=>({pct:x.pct,lift:x.lift,reps:''})));
  h+=`<details class="plain" data-px="bkwhy"${openPx.has('bkwhy')?' open':''}><summary>What the book says</summary><div class="small muted" style="margin-top:6px">${esc(b.why)}</div></details>`;
  h+=`<div class="small muted">${esc(hicSrcLabel(f))}.${b.gear?' Needs: '+esc(b.gear.toLowerCase())+'.':''}${b.measure?' Scored by '+(b.measure[0]==='time'?'time, so lower is better':b.measure[0]==='amrap'?'rounds completed':'total '+esc(b.measure[1]))+'.':(b.src==='mti'?' Not scored by MTI':' Not scored by the book')+': log the rounds and the minutes.'}</div>`;
  return h;
}
/* Black's recommendation for the day: the session, why, with the page each reason comes
   from, and what else would do. Picking one sets the day's format like the Format list
   does; "Use the recommendation" clears it. See 04c-hic-rec.js. */
function hicRecBlock(dp,f){
  const R=dp.rec;
  if(!R) return hicWaiting()&&weekOf(sel)&&weekOf(sel).monday<plan.hicRecFrom&&sel>=todayStr()
    ?`<div class="banner info"><div class="small">Black now recommends each session from your cluster, the way the book sets it. It starts Monday so this week isn\u2019t rewritten under you.</div><div><button class="btn sm" data-act="hicnow">Start this week</button></div></div>`:'';
  const nm=k=>esc((HIC[k].book&&HIC[k].book.n?'#'+HIC[k].book.n+' ':'')+HIC[k].name);
  const tag=k=>`<span class="chip">${hicTbCat(k)}</span>${hicMti(k)?' <span class="chip blue">MTI</span>':''}`;
  const pick=(k,sub)=>`<button class="segb${k===f?' on':''}" data-act="hicpick" data-f="${esc(k)}" aria-pressed="${k===f}">${nm(k)}${sub?` <span class="small muted">${esc(sub)}</span>`:''}</button>`;
  const cl=hicCluster(), inCl=cl.map(c=>c.f);
  let h=`<div class="rec"><div class="rec-h"><span class="small muted">Recommended</span><span>${tag(R.f)}</span></div>
    <div style="font-weight:700">${nm(R.f)}</div>
    <ul class="why">${R.why.map(([t,c])=>`<li>${esc(t)} <span class="cite">${esc(c)}</span></li>`).join('')}</ul>`;
  if(f!==R.f) h+=`<div><button class="btn sm" data-act="hicpick" data-f="">Use the recommendation</button></div>`;
  h+=`</div>`;
  const others=R.need==='E'?[]:inCl.filter(k=>k!==R.f);
  if(others.length) h+=`<div class="restsel"><span>Your cluster</span><div class="seg">${others.map(k=>pick(k)).join('')}</div></div>`;
  const like=hicLike(R.need,R.f,[R.f,...inCl],2), lbl=TB_CAT[R.need].toLowerCase();
  if(like.books.length) h+=`<div class="restsel"><span>Also ${esc(lbl)}, from the books</span><div class="seg">${like.books.map(k=>pick(k)).join('')}</div></div>`;
  if(like.mti.length) h+=`<div class="restsel"><span>Also ${esc(lbl)}, from MTI</span><div class="seg">${like.mti.map(k=>pick(k)).join('')}</div></div>`;
  // The mix the book asks for needs both kinds in the cluster to rotate between.
  if(R.need!=='E'&&!inCl.some(k=>hicTbCat(k)==='GC')){
    const gc=hicLike('GC',null,inCl,2);
    h+=`<div class="banner info"><div class="small">Your cluster has no general conditioning, and the book asks for a mix: avoid doing only aerobic/anaerobic work (TB II p112). Add one and the recommendation will rotate it in.</div>
      <div class="seg">${[...gc.books,...gc.mti].map(k=>`<button class="segb" data-act="hicadd" data-f="${esc(k)}">+ ${nm(k)}${hicMti(k)?' · MTI':''}</button>`).join('')}</div></div>`;
  }
  if(hicGrad(R.f)){
    const sw=hicLike(hicTbCat(R.f),R.f,inCl,2);
    h+=`<div class="banner info"><div class="small"><b>Ready to swap.</b> You have done the Advanced version of ${nm(R.f)}. The book says swap it for a new session now (TB II p187). Same kind:</div>
      <div class="seg">${[...sw.books,...sw.mti].map(k=>`<button class="segb" data-act="hicswap" data-from="${esc(R.f)}" data-f="${esc(k)}">${nm(k)}${hicMti(k)?' · MTI':''}</button>`).join('')}</div></div>`;
  }
  return h;
}
function hicCard(dp,note){
  const L=lg(sel).hic||{}, f=L.format||dp.fmt, H=HIC[f], mod=modOf(sel), M=MOD[mod], met=metricFor(mod,f), bk=hicBook(f)?H.book:null;
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${bk?esc(H.name):`${esc(mod==='other'&&L.what?L.what:M.name)} · ${H.name}`}</span><span class="chip">${H.sys}</span></div>`;
  const lead0=(IV[f]||{}).lead&&!bk?ivOpts(sel,f):null, free0=(IV[f]||{}).free?freeShape(sel):null;
  h+=hicRecBlock(dp,f);
  h+=`<div style="font-size:18px;font-weight:700">${lead0?`${lead0.rounds} bouts \u00b7 ${esc(secsLabel(lead0.every))} of base between`:free0?`${free0.rounds} \u00d7 ${esc(freeLabel(free0))}`:H.sess}</div>${note}`;
  // The book's session, as the book gives it: the prescription, its versions, and the
  // reasoning folded away. The activity does not apply: the session says what you do.
  if(bk) h+=hicBookBlock(f);
  else h+=`<div class="restsel"><span>Activity</span><div class="seg">${Object.entries(MOD).map(([k,x])=>`<button class="segb${k===mod?' on':''}" data-act="mod" data-v="${k}" aria-pressed="${k===mod}">${x.name}</button>`).join('')}</div></div>`;
  if(bk){ if(f!=='liss') h+=`<div class="note">Warm-up: 5 to 10 min easy, a jog or a spin, then a few pickups. The book has you warmed up before the first rep.</div>` }
  else if((IV[f]||{}).lead){
    // What a FOBBIT is, and nothing about which one. Every number that varies between
    // them is read from the selection, so this cannot go stale when you change it.
    const fo=ivOpts(sel,f), held=(fo.bouts||[]).some(b=>b.hold);
    h+=`<div class="note">Hold an easy aerobic base, step off it every ${esc(fobEveryLabel(fo.fob))} for a bout of work, then get back on it.${(fo.bouts||[]).length>1?' The movements rotate in order.':''} ${(IV[f]||{}).fob?'Pick which FOBBIT below. ':''}Row, skip, cycle or take the stairs if you would rather not run.</div>`;
    if(held) h+=`<div class="small muted"><b>A bout of reps is not on the clock.</b> ${fo.count==='total'?'The timer holds at each one until you tap Done, so the wall clock reads longer than the session.':'Only the base counts toward the session, so the timer holds at each set until you tap Done, and the wall clock will read a good deal longer than the session length.'}</div>`;
  }
  else if(f!=='liss') h+=`<div class="small muted">Warm-up: ${M.wu||'5 min easy, then 3 × 15 s at HIC pace with 45 s easy between.'}</div>`;
  if(M.tip&&!bk&&(f!=='liss'||mod==='ruck')) h+=`<div class="small muted">${M.tip}</div>`;
  if(dp.plyo&&(mod==='run'||bk)&&f!=='liss') h+=`<div class="banner warn"><div class="small">Plyos already loaded your legs today. Keep sprint volume at the low end of the range, or ride instead.</div></div>`;
  h+=`<div class="grid2"><label class="f">Format<select id="hic-fmt" data-bind="hic.format">${hicOptions(f,null,{cluster:!!dp.rec})}</select></label>`;
  if(mod==='other'&&!bk&&!(HIC[f]||{}).noMetric) h+=`<label class="f">Activity<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="e.g. hill sprints, assault runner"></label>`;
  if((IV[f]||{}).fob){
    const fb=fobOf(sel), F=FOBBIT[fb];
    h+=`<label class="f">Which one<select data-act-fob="1" aria-label="Which FOBBIT">${Object.entries(FOBBIT).map(([k,x])=>`<option value="${esc(k)}"${k===fb?' selected':''}>${esc(x.name)}${x.gear?' \u00b7 '+esc(x.gear):''}</option>`).join('')}</select></label>`;
    // What the timer will actually do, so a halved day reads as halved here too.
    const o=ivOpts(sel,f);
    if(fobDef(fb)){
      h+=`<div class="small"><b>${esc(boutsLine(o.bouts))}</b>, between ${esc(fobEveryLabel(fb))} of base.${o.ease?' Reps are halved today.':''}</div>`;
      h+=fobLoadLine(o.bouts);
    }
    if(F&&F.bpm) h+=`<div class="small muted">Base pace: ${F.bpm[0]}\u2013${F.bpm[1]} bpm, or the talk test.</div>`;
    if(F&&F.note) h+=`<div class="small muted">${esc(F.note)}</div>`;
    if(fobDef(fb)) h+=`<div class="small muted">${F.src==='ours'?'The shape is the book\u2019s; these movements are the app\u2019s own.':'From '+esc(fobSrcLabel(fb))+'.'}</div>`;
    if(!fobDef(fb)) h+=`<label class="f">Movements<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="e.g. sandbag clean / push-up"></label>`;
    h+=`<label class="f">Bouts done${numIn('hic.rounds',L.rounds,String(o.rounds))}</label>`;
  }
  else if(bk||(HIC[f]||{}).noMetric){
    const o=ivOpts(sel,f);
    h+=`<label class="f">${bk&&!(IV[f]||{}).lead?'Rounds done':'Bouts done'}${numIn('hic.rounds',L.rounds,String(o.rounds))}</label>`;
  }
  {
    const plan0=ivPartsLabel(f,ivOpts(sel,f)).total;
    h+=`<label class="f">Minutes${numIn('hic.min',L.min,String(plan0))}</label>`;
  }
  if(met&&met[0]==='time') h+=`<label class="f">${metricLabel(met)}<input type="text" inputmode="numeric" id="in-hic-time" data-bind="hic.time" value="${esc(L.time||'')}" placeholder="e.g. 8:20"></label>`;
  else if(met) h+=`<label class="f">${metricLabel(met)}${f==='liss'?' <span style="font-weight:500">(optional)</span>':''}${numIn('hic.'+met[0],L[met[0]],'')}</label>`;
  if(M.load) h+=`<label class="f">Ruck load (${u()})${numIn('hic.load',L.load,'')}</label>`;
  if(M.elev) h+=`<label class="f">Elevation gain (${elevUnit()})${numIn('hic.elev',L.elev,'')}</label>`;
  h+=`</div>`;
  {
    const plan0=ivPartsLabel(f,ivOpts(sel,f)).total;
    if(L.min==null||L.min==='') {
      const pl=ivPartsLabel(f,ivOpts(sel,f));
      h+=`<div class="row" style="align-items:baseline"><span class="small muted">No minutes logged.</span><button class="btn sm" data-act="minplan" data-v="${plan0}">Use ${plan0} min</button>${(IV[f]||{}).lead&&(L.rounds==null||L.rounds==='')?`<button class="btn sm" data-act="boutplan" data-v="${ivOpts(sel,f).rounds}">Use ${ivOpts(sel,f).rounds} bouts</button>`:''}</div><div class="note">That is ${esc(pl.text)}${pl.rounds?((IV[f]||{}).lead?(()=>{const fo=ivOpts(sel,f),hd=(fo.bouts||[]).some(b=>b.hold);
        return `, counted as ${pl.rounds} \u00d7 ${esc(secsLabel(fo.every))} of base${hd?`; the ${pl.rounds} bouts of reps sit on top, so the clock will say more`:` and ${pl.rounds} timed bouts, which are counted in`}`})():(IV[f]||{}).free?`, from ${pl.rounds} rounds of ${esc(freeLabel(freeShape(sel)))}`:`, from ${pl.rounds} rounds (there is no easy period after the last one, so ${pl.rounds} \u00d7 hard + ${pl.rounds-1} \u00d7 easy)`):''}. Change the field if you did more or less.</div>`;
    }
  }
  {
    const o=ivOpts(sel,f), r=IV[f], running=iv&&iv.date===sel&&!iv.done;
    h+=`<div class="ivset"><div class="lift-h"><span class="lift-name">Interval timer</span><span class="small muted mono">${ivPartsLabel(f,o).total} min${(IV[f]||{}).lead&&o.count!=='total'?' of base':' total'}</span></div>`;
    if(r&&r.lead) h+=`<div class="restsel"><span>Session</span><div class="seg">${(o.minOpts||[]).map(v=>`<button class="segb${o.mins===v?' on':''}" data-act="ivopt" data-k="mins" data-v="${v}" aria-pressed="${o.mins===v}">${v} min</button>`).join('')}</div></div>`
      +`<div class="small muted">${o.rounds} \u00d7 ${esc(secsLabel(o.every))} of base${o.count==='total'?', with the bouts counted in':''}. ${o.isE?'<b>Over 30 minutes, so this counts as an E session rather than a HIC</b> \u2014 that is the book\u2019s line, not ours.':'Under 30 minutes, so it counts as a HIC.'}</div>`;
    else if(r&&r.free){
      // Quick picks for the common shapes, and the three numbers for anything else.
      h+=`<div class="restsel"><span>Quick picks</span><div class="seg">${FREE_PRESETS.map(([w,e,m])=>{const on=o.work===w&&o.rest===e&&o.mins===m;return `<button class="segb${on?' on':''}" data-act="ivfree" data-w="${w}" data-r="${e}" data-m="${m}" aria-pressed="${on}">${w}/${e} \u00b7 ${m} min</button>`}).join('')}</div></div>`;
      const iv0=((lg(sel).hic||{}).iv)||{};
      h+=`<div class="grid3"><label class="f">Hard (sec)${numIn('hic.iv.work',iv0.work,String(o.work))}</label><label class="f">Easy (sec)${numIn('hic.iv.rest',iv0.rest,String(o.rest))}</label><label class="f">Length (min)${numIn('hic.iv.mins',iv0.mins,String(o.mins))}</label></div>`;
      h+=`<div class="small muted">${o.rounds} rounds of ${esc(freeLabel(o))}, ${mmss(o.rounds*(o.work+o.rest))} on the clock${o.rounds*(o.work+o.rest)!==o.mins*60?` \u2014 the nearest whole number of rounds to ${o.mins} min`:''}.${o.rounds>=FREE_MAX_ROUNDS?` Capped at ${FREE_MAX_ROUNDS} rounds.`:''}</div>`;
    }
    else if(r&&r.rounds){
      // The book's range as buttons, the eased count beside them when it falls outside, and
      // a field for any other number -- half a session on the 95% week is TB2's own advice.
      const [lo,hi]=r.rounds, vs=[...new Set([...Array.from({length:hi-lo+1},(_,i)=>lo+i),o.def])].sort((p0,q)=>p0-q);
      const own=((lg(sel).hic||{}).iv||{}).rounds;
      if(vs.length>1) h+=`<div class="restsel"><span>Rounds</span><div class="seg">${vs.map(v=>`<button class="segb${o.rounds===v?' on':''}" data-act="ivopt" data-k="rounds" data-v="${v}" aria-pressed="${o.rounds===v}">${v}</button>`).join('')}</div></div>`;
      h+=`<div class="grid3"><label class="f">Rounds (any number)${numIn('hic.iv.rounds',own,String(o.rounds),'min="1" max="'+FREE_MAX_ROUNDS+'"')}</label></div>`
        +`<div class="small muted">${o.rounds} round${o.rounds===1?'':'s'}. The book gives ${lo===hi?lo:lo+' to '+hi}${o.rounds<lo||o.rounds>hi?(o.ease&&o.rounds===o.def?'; this week is eased below it':'; this is your own count'):''}.</div>`;
    }
    if(ivOpts(sel,f).ease&&easyCondWeek(sel)) h+=`<div class="note"><b>Easy conditioning week.</b> Your lifts are at ${wkRx(weekOf(sel)).p}% this week. TB2 asks for the rounds cut in half here \u2014 \u201cdon\u2019t strain, just grease the groove with little effort\u201d \u2014 and says the easy week is meant to land on the heavy lifting weeks. This is deliberate, not a missed week.</div>`;
  if(f==='liss') h+=`<div class="restsel"><span>Minutes</span><div class="seg">${[30,35,40,45].map(v=>`<button class="segb${o.lissMin===v?' on':''}" data-act="ivopt" data-k="lissMin" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    h+=`<div class="row" style="gap:14px">${f!=='liss'?`<label class="check"><input type="checkbox" id="iv-warm" data-act-change="ivwarm" ${o.warm?'checked':''}> Warm-up (5 min + 3 pickups ≈ 8 min)</label>`:''}<label class="check"><input type="checkbox" id="iv-cool" data-act-change="ivcool" ${o.cool?'checked':''}> 5 min cool-down</label><label class="check"><input type="checkbox" id="iv-voice" data-pbind="voice" ${plan.voice?'checked':''}> Spoken cues</label><label class="check"><input type="checkbox" id="iv-quiet" data-pbind="quietTimer" ${plan.quietTimer?'checked':''}> Silent (keep my music)</label></div>`;
    if(plan.quietTimer) h+=`<div class="note">Silent: the timer vibrates and counts down on screen, and never opens an audio channel, so whatever you are listening to keeps playing. Turn rest alerts on in Setup if you want a notification at each change.</div>`;
    h+=`<div><button class="btn primary" data-act="ivstart" data-f="${f}" ${running||sel!==todayStr()?'disabled':''}>${running?'Timer running':'Start intervals'}</button>${sel!==todayStr()?' <span class="small muted">Available on the day.</span>':''}</div></div>`;
  }
  if(f!=='liss'&&met){const shape=free0?freeLabel(free0):null, hist=lastHic(f,mod,sel,shape), nm=(bk?'':M.name+' ')+H.name+(shape?' '+shape:''), tm=met[1]==='mm:ss';
    h+= hist.last?`<div class="small muted">Last ${esc(nm)}: <span class="mono">${resStr(hist.last.v,met[1])}</span>${tm?'':' '+met[1]}${flatEquiv(hist.last)!=null?` (<span class="mono">${n(flatEquiv(hist.last))}</span> ${met[1]} flat)`:''} on ${fmtD(hist.last.d,true)} · Best <span class="mono">${resStr(hicValue(hist.best),met[1])}</span>${flatEquiv(hist.best)!=null?' flat':''}${tm?' (fastest)':''}</div>`:`<div class="small muted">First logged ${esc(nm)} session. Results only compare against the same ${bk?'session':'activity and format'}${shape?', and for Freeform the same hard and easy times':''}.</div>`}
  return h+`</div>`;
}
const openPx=new Set();
let popKey=null;
function plyoSets(ex,cut){return Math.max(1,Math.round(ex.s*plyoShare()/(cut?2:1)))}
function plyoContactsDone(ph,L,cut){let c=0;ph.ex.forEach((e,i)=>{const t=((L.sets||[])[i]||[]).filter(Boolean).length;c+=t*e.c/e.s});return Math.round(c)}
function plyoPullback(date){
  const c=ci(date), out=[];
  if(c.soreness>=4) out.push('you logged high soreness today');
  let short=0;for(let i=0;i<3;i++){const x=ci(addDays(date,-i));if(x.sleepH!=null&&x.sleepH!==''&&+x.sleepH<6.5)short++}
  if(short>=2) out.push('sleep has been short for several nights');
  const wed=lg(addDays(date,-1)); if(+wed.rpe>=9||Object.values(wed.lifts||{}).some(x=>ground(x))) out.push('yesterday’s lifting was hard');
  return out;
}
// The jump-prep drills. Shared by the Thursday plyo session and the jump-test days,
// where three maximal attempts off a cold ankle is exactly how a calf goes.
function plyoWarmBlock(L,cls){
  const done=(L.warm||[]).filter(Boolean).length;
  return `<details class="plain${cls||''}" data-px="wu"${openPx.has('wu')?' open':''}><summary>Jump warm-up · ${done} of ${PLYO_WARMUP.length} done · about 8 min, not counted</summary><div class="stack" style="margin-top:8px">${PLYO_WARMUP.map(([id,l,d,why],i)=>`<div class="pwu"><button class="wu-chk${(L.warm||[])[i]?' on':''}" data-act="pwu" data-i="${i}" aria-pressed="${!!(L.warm||[])[i]}" aria-label="${esc(l)} done">✓</button><details class="px" data-px="wu-${id}"${openPx.has('wu-'+id)?' open':''}><summary><span>${l}</span><span class="mono small">${d}</span></summary><div class="small muted" style="margin:4px 0 6px">${why}</div>${plyoEntry(id)}</details></div>`).join('')}</div></details>`
}
// The upper-body block: throws, not ground contacts, and the first thing to drop.
// Each phase is a set of slots (a movement pattern); which movement fills a slot is the
// person's choice and is remembered per phase, so the block fits whatever kit is around.
function plyoUpperPhase(wk){return wk.kind==='cycle'?PLYO_UPPER[Math.floor((wk.plyoIdx%9)/3)]:PLYO_UPPER[0]}
function upKey(ph,k){return PLYO_UPPER.indexOf(ph)+'-'+k}
function plyoUpperEx(ph){
  return ph.slots.map((sl,k)=>{
    const want=(plan.plyoUp||{})[upKey(ph,k)]||sl.def;
    const o=sl.opts.find(x=>x.id===want)||sl.opts[0];
    return {...o,s:sl.s,slot:sl.name,opts:sl.opts,k};
  });
}
function plyoUpperCard(wk,cut,pullback){
  const on=!!plan.plyoUpper, ph=plyoUpperPhase(wk), L=(lg(sel).plyo||{}).up||{};
  let h=`<div class="ivset"><div class="lift-h"><span class="lift-name">Upper body${on?' · '+esc(ph.name):''}</span><label class="check"><input type="checkbox" id="p-upper" data-act="plyoupper" ${on?'checked':''}> Include</label></div>`;
  if(!on) return h+`<div class="note">Optional upper-body power: throws, explosive pulls and speed presses. Operator's bench is deliberately sub-maximal and the bike does nothing for the upper body, so this fills a real gap. Pick a movement per slot from whatever you have — med ball, bodyweight, barbell or a band. Five minutes, full rest, every rep maximal.</div></div>`;
  h+=`<div class="stack" style="gap:10px">`;
  plyoUpperEx(ph).forEach((e,i)=>{
    const n0=cut?Math.ceil(e.s/2):e.s, sets=(L[i])||[];
    h+=`<div class="pex"><label class="f up-pick"><span class="small muted">${esc(e.slot)}</span><select id="plyoup-${upKey(ph,i)}" data-pbind="plyoUp.${upKey(ph,i)}">${e.opts.map(o=>`<option value="${o.id}"${o.id===e.id?' selected':''}>${esc(o.label)} · ${esc(o.gear)}</option>`).join('')}</select></label>
    <details class="px" data-px="up${i}"${openPx.has('up'+i)?' open':''}><summary><span>${esc(e.label)}</span><span class="mono small">${n0} × ${esc(e.r)} · ${e.rest} s</span></summary>${plyoEntry(e.id)}</details>
    <div class="sets">${Array.from({length:n0},(_,j)=>`<button class="setb sm${sets[j]?' on':''}" data-act="upset" data-i="${i}" data-j="${j}" aria-pressed="${!!sets[j]}">${esc(String(e.r).split(' ')[0])}<small>Set ${j+1}</small></button>`).join('')}</div></div>`;
  });
  h+=`</div><div class="note">Throws and explosive reps, not ground contacts, so they do not count toward the contact target. Bench is on all three lifting days and Friday is the day after: if it ever feels flat, this is the first block to cut.</div>`;
  if(pullback||cut) h+=`<div class="banner warn"><div class="small">You are already pulling back today. Drop this block or do one movement.</div></div>`;
  return h+`</div>`;
}
function plyoCard(wk,dp){
  const ph=plyoPhase(wk), L=lg(sel).plyo||{}, cut=!!(dp.plyoCut||L.cut);
  const done=plyoContactsDone(ph,L,cut), target=Math.round(ph.target*plyoShare()/(cut?2:1));
  // Plyos move independently of the week's sessions, so what comes after them varies.
  const after=dp.t==='hic'?' before the conditioning':dp.t==='lift'||dp.t==='rm5'||dp.t==='test'?' before you lift':'';
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Plyos · ${ph.name}</span><span class="rx">~${target} contacts</span></div><div class="small muted">${esc(ph.desc)} 15–20 min of actual work${after}.</div>`;
  const pb=plyoPullback(sel);
  if(pb.length&&!cut) h+=`<div class="banner warn"><div class="small"><b>Pull-back check:</b> ${esc(pb.join('; '))}. The program says cut the session in half (or warm-up only). Cut, don’t skip.</div></div>`;
  h+=plyoWarmBlock(L);
  h+=`<div class="stack" style="gap:12px">`;
  ph.ex.forEach((e,i)=>{
    const n0=plyoSets(e,cut), sets=((L.sets||[])[i])||[];
    h+=`<div class="pex"><details class="px" data-px="ex${i}"${openPx.has('ex'+i)?' open':''}><summary><span>${esc(e.label)}${e.low?' <span class="chip">low intensity</span>':''}</span><span class="mono small">${n0} × ${e.r} · ${e.rest>=120?e.rest/60+' min':e.rest+' s'}</span></summary>${plyoEntry(e.id)}</details>
    <div class="sets">${Array.from({length:n0},(_,j)=>`<button class="setb sm${sets[j]?' on':''}" data-act="pset" data-i="${i}" data-j="${j}" aria-pressed="${!!sets[j]}">${esc(e.r.split(' ')[0])}<small>Set ${j+1}</small></button>`).join('')}</div></div>`;
  });
  h+=`</div>`;
  h+=`<div class="grid3"><label class="f">First broad jump (in)${numIn('plyo.mark',L.mark,'')}</label><label class="f">Best broad jump (in)${numIn('plyo.best',L.best,'')}</label><label class="f">Contacts done${numIn('plyo.contacts',L.contacts,String(done))}</label></div>`;
  if(L.mark) h+=`<div class="small">Stop the session if a jump drops below <b class="mono">${n(Math.round(L.mark*.95*10)/10)} in</b> (5% off your first jump).</div>`;
  if(!dp.plyoCut) h+=`<label class="check"><input type="checkbox" id="p-cut" data-bind="plyo.cut" ${L.cut?'checked':''}> Hard lifting week: halve the contacts</label>`;
  h+=plyoUpperCard(wk,cut,pb.length>0);
  h+=`<details class="plain"><summary>The three rules, and when to pull back</summary><div class="stack small" style="margin-top:8px"><div><b>1. Watch your distance, not your set count.</b> If any jump drops more than about 5% off your first broad jump, the session is over, even with sets remaining.</div><div><b>2. Every rep is maximal or near it.</b> Rest fully between sets. If you are breathing hard, you are doing conditioning, not plyometrics.</div><div><b>3. Cut, don’t skip.</b> After an unusually hard lifting week, halve the contacts rather than dropping the session.</div><div><b>Cut the session in half, or do the warm-up only, if:</b><ul class="tight" style="margin-top:4px">${PLYO_PULLBACK.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></details>`;
  return h+`</div>`;
}
function jumpCard(sub){
  const J=lg(sel).jumps||{};
  const f=(id,lbl,key,unit)=>`<div class="pex"><details class="px" data-px="jt-${id}"${openPx.has('jt-'+id)?' open':''}><summary><span>${lbl}</span><span class="mono small">3 attempts · best counts</span></summary>${plyoEntry(id)}</details><label class="f">Best (${unit})${numIn('jumps.'+key,J[key],'')}</label></div>`;
  return `<div class="card"><h3>Jump tests</h3><p class="muted small" style="margin:0">${sub} Maximal efforts: do the jump warm-up above first, rest a full minute between attempts so each one is fresh, and measure the same way every time.</p>
  <div class="stack" style="gap:10px;margin-top:10px">${f('broad','Broad jump','broad','in')}${f('vertj','Vertical','vertical','in')}${f('triple','Standing triple jump','triple','in')}</div></div>`;
}
/* ---------------- the retest attempt plan ----------------
Tactical Barbell I's test day: warm up, then "add weight to give you a load you think you
can lift for about three to five repetitions", rest five full minutes, and lift it for as
many good reps as you can. Ten easy ones means far more weight and another go; five or
fewer is "just about right". The book leaves "a load you think you can lift" to you.

That guess is what this fills in, and the guess is the app's, not the book's. It is the
same evidence the end-of-cycle review reads (`cycleStats`, `recommend`): how the heavy
sets were rated, grinders, missed sets, pain. Fast heavy sets predict a max above the
one you trained on; a grinder predicts the same max; sharp pain or grinding at moderate
weights predicts less. The opening target, the warm-up ramp under it and session mode
all start from the prediction, and the plan then reads the result the way the book
does. With no finished cycle behind the lift -- a bridge week, a first program -- the
prediction is the current max and everything is as it was. */
function attemptPlan(k,date,isRm5){
  const wk=weekOf(date), c=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):1, m=maxFor(c)[k];
  const cur=m?m.v:((plan.prevMaxes||{})[k]??null); if(cur==null) return null;
  let pred=cur, rec=null, why='';
  if(wk&&wk.kind!=='bridge'&&m){
    const cs=cycleStats(c), S=cs.stats[k];
    if(S&&(S.n>=3||S.sharp)){ const r=recommend(S,cs.readiness); rec=r[0]; why=r[1]; pred=reviewOptions(k,cur)[rec] }
  }
  const bw=isBW(k)?bwFor(date):null, rd=plan.round[k];
  const at=(p)=>isBW(k)?(bw?floorTo((bw+pred)*p-bw,rd):null):floorTo(pred*p,rd);
  // An untouched single stays the max exactly as stored, not floored to a plate.
  const first=isRm5?at(.87):(isBW(k)&&!bw?null:pred);
  const singles=isRm5?null:[at(.9),at(.95),first].filter((v,i,a)=>v!=null&&a.indexOf(v)===i);
  return {cur,pred,rec,why,cycle:c,first,singles};
}
// What the result says to do next, in the book's terms. A weight for about four reps
// off the set just done, for the cases where the book says go again.
function attemptNext(k,date,T,isRm5){
  if(!isRm5||T.w==null||T.w==='') return '';
  const reps=+T.r||5, e=estMax(k,T.w,reps,date); if(e==null) return '';
  const bw=isBW(k)?bwFor(date):null, rd=plan.round[k];
  const again=isBW(k)?(bw?floorTo((bw+e)*.9-bw,rd):null):floorTo(e*.9,rd), f=v=>isBW(k)?fmtLoad(k,v):n(v);
  if(reps>=10) return `Ten or more reps means it needs far more weight. Rest five minutes and repeat${again!=null?` at about <b>${f(again)} ${u()}</b>`:' heavier'}.`;
  if(reps>5) return `More than five reps, so the estimate is looser than it would be from a heavier set. If it felt easy, rest five minutes and try${again!=null?` <b>${f(again)} ${u()}</b>`:' more'}; otherwise this number will do.`;
  return 'Five or fewer: that is the number. You are done with this lift.';
}
function attemptBlock(k,isRm5){
  const ap=attemptPlan(k,sel,isRm5); if(!ap) return '';
  const T=(lg(sel).test||{})[k]||{}, f=v=>isBW(k)?fmtLoad(k,v):n(v);
  let h=`<div class="note"><b>Attempt plan.</b> `;
  h+=ap.rec?`Cycle ${ap.cycle}: ${esc(ap.why)} Predicted max <b>${f(ap.pred)} ${u()}</b>${ap.pred!==ap.cur?` (you trained on ${f(ap.cur)})`:', the one you trained on'}. `
           :'Nothing to predict from yet, so the plan starts at your current max. ';
  if(isRm5) h+=ap.first!=null?`Open at <b>${f(ap.first)} ${u()}</b> for the test set, after five full minutes of rest. `:'';
  else if(ap.singles&&ap.singles.length) h+=`Singles at ${ap.singles.map(v=>'<b>'+f(v)+'</b>').join(', then ')} ${u()}, with a full rest before each. `;
  const next=attemptNext(k,sel,T,isRm5);
  if(next) h+=`<br><b>Your result:</b> ${next}`;
  h+=`<br><span class="muted">Test day is collecting numbers, not a workout: take your time. The prediction is the app\u2019s, from the same evidence as the end-of-cycle review; the five-minute rest and what to do with the result are Tactical Barbell I\u2019s.</span></div>`;
  return h;
}
function testCard(k,defReps,isRm5){
  const T=(lg(sel).test||{})[k]||{}, reps=T.r||defReps, e=estMax(k,T.w,reps,sel), cur=currentMax(k)??((plan.prevMaxes||{})[k]??null);
  const ap=attemptPlan(k,sel,isRm5), est=ap?ap.first:null, planned=!!(ap&&ap.rec&&ap.pred!==ap.cur);
  const tgt=T.target!=null&&T.target!==''?+T.target:(T.w!=null&&T.w!==''?+T.w:est);
  return `<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${isRm5?'5RM · 2 in reserve':'Heavy single'}${isBW(k)?' · added weight':''}</span></div>
  <div class="grid4"><label class="f">Target${numIn('test.'+k+'.target',T.target,est?n(est):'')}</label><label class="f">Result weight${numIn('test.'+k+'.w',T.w,'')}</label><label class="f">Reps${numIn('test.'+k+'.r',T.r,String(defReps))}</label><label class="f">Est. 1RM<div class="big" style="font-size:34px">${e?n(floorTo(e,plan.round[k])):'—'}</div></label></div>
  ${warmupLog(k,testRamp(k,tgt,isRm5),tgt!=null?`Calculated from a target of ${isBW(k)?fmtLoad(k,tgt):n(tgt)} ${u()}${T.target?'':T.w?' (your result)':planned?' (from the attempt plan)':' (from your current max)'}.`:'')}
  ${attemptBlock(k,isRm5)}
  <div class="small muted">${isRm5?'If the bar slows, you have found your number. Bad day: take the lower number.':'Work up in singles. Stop when the bar slows.'}${cur!=null?(currentMax(k)==null?' Last program’s max: ':' Current max: ')+'<span class="mono">'+(isBW(k)?'+':'')+n(cur)+'</span>.':''}${k==='pull'?' Note the machine and pin setting.':''}${isBW(k)?' Enter the weight you added (0 for bodyweight). Uses your latest bodyweight.':''}</div></div>`;
}
function currentMax(k){const wk=weekOf(sel);if(!wk)return null;const c=wk.kind==='cycle'?wk.cycle:wk.refCycle;const m=maxFor(c)[k];return m?m.v:null}
function bestPullups(){let b=null;for(const [d,L] of Object.entries(logs)) if(d<sel&&L.pullups&&(!b||+L.pullups>b.v)) b={d,v:+L.pullups};return b?`<div class="small muted">Previous best: <span class="mono">${b.v}</span> on ${fmtD(b.d,true)}</div>`:''}
function weekResults(wk,field){
  const out={};for(let i=0;i<7;i++){const d=addDays(wk.monday,i),T=(lg(d)[field])||{};for(const k of LK){const t=T[k];if(t&&t.w!=null&&t.w!==''){const def=dayPlan(d).t==='rm5'?5:1;const e=estMax(k,t.w,t.r||def,d);if(e)out[k]=floorTo(e,plan.round[k])}}}
  return out;
}
function applyCard(wk){
  const res=weekResults(wk,'test'), nc=wk.nextCycle, cur=nc?(plan.cycleMaxes[nc]||{}):{};
  const rows=activeLifts().map(k=>{const proj=nc?maxFor(nc)[k]:null;return `<tr><td>${esc(liftName(k))}</td><td class="n">${res[k]!=null?n(res[k]):'—'}</td><td class="n">${proj?n(proj.v):'—'}</td></tr>`}).join('');
  const applied=nc&&LK.every(k=>res[k]==null||+cur[k]===res[k]);
  return `<div class="card"><h3>Feed results forward</h3><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Tested</th><th class="n">Cycle ${nc||'—'} now</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note" style="margin:0">If a lift didn't move, that's information, not failure. Leave it blank to keep the projected number.</p>
  <div><button class="btn primary" data-act="applytest" data-monday="${wk.monday}" ${!nc||!Object.keys(res).length||applied?'disabled':''}>${applied&&Object.keys(res).length?'Applied to Cycle '+nc:'Use for Cycle '+(nc||'—')}</button></div></div>`;
}
function convertCard(wk){
  const res=weekResults(wk,'test');
  const rows=activeLifts().map(k=>`<tr><td>${esc(liftName(k))}</td><td class="n">${res[k]!=null?n(res[k]):'—'}</td><td class="n">${plan.maxes[k]!=null&&plan.maxes[k]!==''?n(plan.maxes[k]):'—'}</td></tr>`).join('');
  const done=LK.every(k=>res[k]==null||+plan.maxes[k]===res[k]);
  return `<div class="card"><h3>Convert 5RMs to maxes</h3><p class="small muted" style="margin:0">Each 5RM ÷ 0.87, rounded down. Missing a lift? Enter it in Setup.</p><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Est. 1RM</th><th class="n">Saved max</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div><button class="btn primary" data-act="savemaxes" data-monday="${wk.monday}" ${!Object.keys(res).length||done?'disabled':''}>${done&&Object.keys(res).length?'Saved as your maxes':'Save as my maxes'}</button></div></div>`;
}
function painAt(L){const a=L.painAt;return Array.isArray(a)?a:a?[a]:[]}
function footer(active){
  if(!active) return '';
  const L=lg(sel), dp=dayPlan(sel), lifting=dp.t==='lift'||dp.t==='rm5'||dp.t==='test';
  const after=lifting?`<div class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px">
    <div class="restsel"><span>How did it move?</span><div class="seg">${FEELS.map(([v,l])=>`<button class="segb${L.feel===v?' on':''}" data-act="sfeel" data-v="${v}" aria-pressed="${L.feel===v}">${l}</button>`).join('')}</div></div>
    <div class="restsel"><span>Anything hurt?</span><div class="seg">${PAINS.map(([v,l])=>`<button class="segb${L.pain===v?' on':''}" data-act="spain" data-v="${v}" aria-pressed="${L.pain===v}">${l}</button>`).join('')}</div></div>
    ${L.pain&&L.pain!=='none'?`<div class="restsel"><span>Where</span><div class="seg">${Object.entries(PAIN_AT).map(([k,x])=>`<button class="segb${painAt(L).includes(k)?' on':''}" data-act="spainat" data-v="${k}" aria-pressed="${painAt(L).includes(k)}">${x.name}</button>`).join('')}</div></div>
    <div class="small muted">${L.pain==='sharp'?'Sharp pain counts against that lift at the end of the cycle. Stop the movement causing it rather than working around it.':'Logged as a flag. It won’t move your numbers, but it shows up in the cycle review if it keeps happening.'}</div>`:''}
  </div>`:'';
  return `<div class="card"><div class="grid2"><label class="f">Session RPE<select id="rpe" data-bind="rpe" data-type="num"><option value="">—</option>${[5,6,7,8,9,10].map(v=>`<option value="${v}"${+L.rpe===v?' selected':''}>${v}</option>`).join('')}</select></label><div style="display:flex;align-items:flex-end"><button class="btn ${L.done?'':'primary'}" style="width:100%" data-act="done">${L.done?'✓ Done · undo':'Mark session done'}</button></div></div><label class="f">Notes<textarea id="notes" data-bind="notes" placeholder="Machine settings, how it moved, anything to remember">${esc(L.notes||'')}</textarea></label>${after}</div>`;
}
