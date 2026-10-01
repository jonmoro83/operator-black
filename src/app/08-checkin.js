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
function measOn(date){
  let best=null;
  for(const [d,L] of Object.entries(logs)) if(d<=date&&inProgram(d)&&L.meas&&L.meas.waist&&L.meas.neck&&(!best||d>best.d)) best={d,m:L.meas};
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
function hicRut(date,n0){
  const xs=hicSessions().filter(x=>x.d<=date&&x.f!=='liss').slice(-(n0||6));
  if(xs.length<(n0||6)) return null;
  const f=xs[0].f, mod=xs[0].mod;
  const sameF=xs.every(x=>x.f===f), sameM=xs.every(x=>x.mod===mod);
  if(!sameF&&!sameM) return null;
  return {n:xs.length,f:sameF?f:null,mod:sameM?mod:null,since:xs[0].d};
}
// One session you repeat to compare against itself. Results only compare within an
// activity and a format, so a benchmark is the single line worth watching when the rest
// of your conditioning moves around.
function benchmark(){
  const b=plan.benchmark;
  if(b&&MOD[b.mod]&&HIC[b.fmt]) return b;
  // not chosen yet: the hard pairing you have done most
  const tally={};
  for(const x of hicSessions()) if(x.f!=='liss'&&x.v!=null) tally[x.mod+'|'+x.f]=(tally[x.mod+'|'+x.f]||0)+1;
  const top=Object.keys(tally).sort((a0,b0)=>tally[b0]-tally[a0])[0];
  if(!top) return null;
  const [mod,fmt]=top.split('|');
  return {mod,fmt,auto:true};
}
function benchmarkState(date){
  const b=benchmark(); if(!b) return null;
  const xs=hicSessions().filter(x=>x.d<=date&&x.mod===b.mod&&x.f===b.fmt&&x.v!=null);
  const last=xs[xs.length-1]||null, first=xs[0]||null;
  const days=last?Math.round((D(date)-D(last.d))/864e5):null;
  const every=+plan.benchEvery||35;
  return {...b,xs,last,first,days,every,due:!last||days>=every,best:xs.reduce((a0,x)=>Math.max(a0,x.v),0)};
}
function suggestions(date){
  const c=ci(date), sc=readiness(c), lv=rLevel(sc), wk=weekOf(date), dp=dayPlan(date), out=[];
  if(!lv) return out;
  const add=(tone,title,text,act)=>out.push({tone,title,text,act});
  const heavy=wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
  const hicFmt=(dp.t==='hic'||dp.t==='plyohic')?effFmt(date):null;
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
    if(lv.k==='go') add('go','Push the conditioning',last?`Last ${HIC[hicFmt].name} (${MOD[hm].name}): ${n(last.v)} ${last.u}. Try to beat it.`:`Go hard and record your result as a baseline.`);
    else if(lv.k==='care') add('care','Conditioning: low end of the range',`Do ${low}. Hold the same pace, just fewer rounds.`);
    else add('stop','Swap today’s HIC to LISS','30–45 min conversational. Change the format in the conditioning card so your history stays clean.');
  }
  if(dp.t==='plyohic'&&(lv.k==='stop'||c.soreness>=4)) add('care','Plyos: halve the contacts','Cut, don’t skip. Tick “halve the contacts” and drop depth jumps today. Stop the moment a jump comes up short.');
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
    if(bm&&bm.due&&bm.last) add('go','Benchmark due',`It has been ${bm.days} days since your ${MOD[bm.mod].name} ${HIC[bm.fmt].name} benchmark (best ${n(bm.best)}). Run that one today and you get a number that compares straight back.`);
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
    const hint=q.hint==='target'&&pt?` <small>(~${pt} g)</small>`:'';
    return `<div class="q"><span>${q.q}${hint}</span><div class="seg">${q.opts.map(([v,l])=>`<button class="segb${c[q.f]==v&&c[q.f]!==''&&c[q.f]!=null?' on':''}" data-act="ci" data-f="${q.f}" data-v="${v}" aria-pressed="${c[q.f]==v}">${l}</button>`).join('')}${q.num?numIn('checkin.sleepH',c.sleepH,'exact','class="num-in" style="max-width:84px" aria-label="Exact hours slept"'):''}</div></div>`;
  }).join('');
  const sug=suggestions(date);
  let h=`<div class="card"><div class="lift-h"><h3>Daily check-in</h3>${lv?`<span class="chip ${lv.cls}">${lv.t}</span>`:''}</div>`;
  if(lv) h+=`<div class="ready"><div class="big">${sc}</div><div class="small muted">Readiness out of 100, from sleep, energy, soreness, stress and yesterday’s eating.</div></div>`;
  else h+=`<p class="small muted" style="margin:0">Answer at least three questions (30 seconds) and the app adjusts today’s suggestions to how you’re recovering.</p>`;
  if(sug.length) h+=`<ul class="sug">${sug.map(x=>`<li class="${x.tone}"><div><b>${esc(x.title)}</b>${esc(x.text)}${x.act?`<div style="margin-top:6px"><button class="btn sm" data-act="${x.act.act}" data-kind="${x.act.kind}" data-monday="${x.act.monday}">${x.act.label}</button></div>`:''}</div></li>`).join('')}</ul>`;
  h+=`<details class="plain" id="ci-${date}"${open?' open':''}><summary>${lv?'Edit answers':'Questions'}</summary><div class="stack" style="gap:16px;margin-top:12px">${qs.replace(/^<\/div>/,'')}</div></div></details>`;
  if(lv) h+=`<p class="small muted" style="margin:0">General training guidance, not medical advice.</p>`;
  return h+`</div>`;
}
function accList(day){const a=(plan.acc||{})[day];return Array.isArray(a)&&a.length?a:ACC[day]}
function accCard(wk,dp){
  if(dp.deload) return `<div class="card"><h3>Accessories</h3><p class="muted" style="margin:0">None this week. Deload.</p></div>`;
  const v=wkRx(wk);
  if(wk.kind==='cycle'&&tier(+v.p)==='heavy') return `<div class="card"><h3>Accessories</h3><p class="muted" style="margin:0">Skip them. Heavy week.</p></div>`;
  const L=lg(sel).acc||[];
  return `<div class="card"><h3>Accessories</h3><p class="muted small" style="margin:0">2–3 movements, 2–3 sets, a couple of reps short of failure. Nothing that leaves you sore for tomorrow's HIC.</p><div class="stack">${accList(dp.acc).map((a,i)=>`<label class="check"><input type="checkbox" id="acc-${i}" data-bind="acc.${i}" ${L[i]?'checked':''}> ${esc(a)}</label>${/pull-up progression/i.test(a)?`<div class="small muted" style="margin:-2px 0 4px 28px">${esc(pullupState(sel).st.work)}</div>`:''}`).join('')}</div></div>`;
}
function lastHic(fmt,mod,before){
  let best=null,last=null;
  for(const x of hicSessions(true)){ if(x.d>=before||x.f!==fmt||x.mod!==mod||x.v==null) continue;
    if(!last||x.d>last.d) last=x; if(!best||x.v>best.v) best=x; }
  return {best,last};
}
function hicCard(dp,note){
  const L=lg(sel).hic||{}, f=L.format||dp.fmt, H=HIC[f], mod=modOf(sel), M=MOD[mod], met=metricFor(mod,f);
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${esc(mod==='other'&&L.what?L.what:M.name)} · ${H.name}</span><span class="chip">${H.sys}</span></div>`;
  h+=`<div style="font-size:18px;font-weight:700">${H.sess}</div>${note}`;
  h+=`<div class="restsel"><span>Activity</span><div class="seg">${Object.entries(MOD).map(([k,x])=>`<button class="segb${k===mod?' on':''}" data-act="mod" data-v="${k}" aria-pressed="${k===mod}">${x.name}</button>`).join('')}</div></div>`;
  if(f==='fobbit') h+=`<div class="small muted">Keep moving the whole time: an easy base — slow jog, skipping, easy spin — broken every two minutes by a hard burst of something else. The burst is whatever you have: kettlebell swings, burpees, a sandbag, press-ups. ${(+L.min||0)>30?'<b>Over 30 minutes this counts as an easy session, not a HIC</b>, so it does not replace a hard day.':'Keep it under 30 minutes and it is a HIC; longer than that and it counts as an easy session instead.'}</div>`;
  else if(f!=='liss') h+=`<div class="small muted">Warm-up: ${M.wu||'5 min easy, then 3 × 15 s at HIC pace with 45 s easy between.'}</div>`;
  if(M.tip&&(f!=='liss'||mod==='ruck')) h+=`<div class="small muted">${M.tip}</div>`;
  if(dp.t==='plyohic'&&mod==='run'&&f!=='liss') h+=`<div class="banner warn"><div class="small">Plyos already loaded your legs today. Keep sprint volume at the low end of the range, or ride instead.</div></div>`;
  h+=`<div class="grid2"><label class="f">Format<select id="hic-fmt" data-bind="hic.format">${Object.entries(HIC).map(([k,x])=>`<option value="${k}"${k===f?' selected':''}>${x.name}</option>`).join('')}</select></label>`;
  if(mod==='other'&&f!=='fobbit') h+=`<label class="f">Activity<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="e.g. hill sprints, assault runner"></label>`;
  if(f==='fobbit'){
    h+=`<label class="f">Burst movement<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="e.g. kettlebell swings, burpees, sandbag shoulder"></label>`;
    h+=`<label class="f">Bursts done${numIn('hic.rounds',L.rounds,'')}</label>`;
  }
  {
    const plan0=Math.round(ivTotal(ivSegments(f,ivOpts(sel,f)))/60);
    h+=`<label class="f">Minutes${numIn('hic.min',L.min,String(plan0))}</label>`;
  }
  if(met) h+=`<label class="f">${metricLabel(met)}${f==='liss'?' <span style="font-weight:500">(optional)</span>':''}${numIn('hic.'+met[0],L[met[0]],'')}</label>`;
  if(M.load) h+=`<label class="f">Ruck load (${u()})${numIn('hic.load',L.load,'')}</label>`;
  h+=`</div>`;
  {
    const plan0=Math.round(ivTotal(ivSegments(f,ivOpts(sel,f)))/60);
    if(L.min==null||L.min==='') {
      const pl=ivPartsLabel(f,ivOpts(sel,f));
      h+=`<div class="row" style="align-items:baseline"><span class="small muted">No minutes logged.</span><button class="btn sm" data-act="minplan" data-v="${plan0}">Use ${plan0} min</button></div><div class="small muted">That is ${esc(pl.text)}${pl.rounds?((IV[f]||{}).lead?`, from ${pl.rounds} bursts with a base either side of each (${pl.rounds} \u00d7 burst + ${pl.rounds+1} \u00d7 base)`:`, from ${pl.rounds} rounds (there is no easy period after the last one, so ${pl.rounds} \u00d7 hard + ${pl.rounds-1} \u00d7 easy)`):''}. Change the field if you did more or less.</div>`;
    }
  }
  {
    const o=ivOpts(sel,f), r=IV[f], segs=ivSegments(f,o), running=iv&&iv.date===sel&&!iv.done;
    h+=`<div class="ivset"><div class="lift-h"><span class="lift-name">Interval timer</span><span class="small muted mono">${mmss(ivTotal(segs))} total</span></div>`;
    if(r&&r.burst) h+=`<div class="restsel"><span>Burst</span><div class="seg">${r.burst.map(v=>`<button class="segb${o.burst===v?' on':''}" data-act="ivopt" data-k="burst" data-v="${v}" aria-pressed="${o.burst===v}">${v} s</button>`).join('')}</div></div>`;
    if(r&&r.rounds[0]!==r.rounds[1]) h+=`<div class="restsel"><span>Rounds</span><div class="seg">${Array.from({length:r.rounds[1]-r.rounds[0]+1},(_,i)=>r.rounds[0]+i).map(v=>`<button class="segb${o.rounds===v?' on':''}" data-act="ivopt" data-k="rounds" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    if(f==='liss') h+=`<div class="restsel"><span>Minutes</span><div class="seg">${[30,35,40,45].map(v=>`<button class="segb${o.lissMin===v?' on':''}" data-act="ivopt" data-k="lissMin" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    h+=`<div class="row" style="gap:14px">${f!=='liss'?`<label class="check"><input type="checkbox" id="iv-warm" data-act-change="ivwarm" ${o.warm?'checked':''}> Warm-up (5 min + 3 pickups ≈ 8 min)</label>`:''}<label class="check"><input type="checkbox" id="iv-cool" data-act-change="ivcool" ${o.cool?'checked':''}> 5 min cool-down</label><label class="check"><input type="checkbox" id="iv-voice" data-pbind="voice" ${plan.voice?'checked':''}> Spoken cues</label><label class="check"><input type="checkbox" id="iv-quiet" data-pbind="quietTimer" ${plan.quietTimer?'checked':''}> Silent (keep my music)</label></div>`;
    if(plan.quietTimer) h+=`<div class="small muted">Silent: the timer vibrates and counts down on screen, and never opens an audio channel, so whatever you are listening to keeps playing. Turn rest alerts on in Setup if you want a notification at each change.</div>`;
    h+=`<div><button class="btn primary" data-act="ivstart" data-f="${f}" ${running||sel!==todayStr()?'disabled':''}>${running?'Timer running':'Start intervals'}</button>${sel!==todayStr()?' <span class="small muted">Available on the day.</span>':''}</div></div>`;
  }
  if(f!=='liss'&&met){const hist=lastHic(f,mod,sel);
    h+= hist.last?`<div class="small muted">Last ${M.name} ${H.name}: <span class="mono">${n(hist.last.v)}</span> ${met[1]} on ${fmtD(hist.last.d,true)} · Best <span class="mono">${n(hist.best.v)}</span></div>`:`<div class="small muted">First logged ${M.name} ${H.name} session. Results only compare against the same activity and format.</div>`}
  return h+`</div>`;
}
const openPx=new Set();
let popKey=null;
function plyoSets(ex,cut){return cut?Math.ceil(ex.s/2):ex.s}
function plyoContactsDone(ph,L,cut){let c=0;ph.ex.forEach((e,i)=>{const t=((L.sets||[])[i]||[]).filter(Boolean).length;c+=t*e.c/e.s});return Math.round(c)}
function plyoPullback(date){
  const c=ci(date), out=[];
  if(c.soreness>=4) out.push('you logged high soreness today');
  let short=0;for(let i=0;i<3;i++){const x=ci(addDays(date,-i));if(x.sleepH!=null&&x.sleepH!==''&&+x.sleepH<6.5)short++}
  if(short>=2) out.push('sleep has been short for several nights');
  const wed=lg(addDays(date,-1)); if(+wed.rpe>=9||Object.values(wed.lifts||{}).some(x=>x&&x.grinder)) out.push('yesterday’s lifting was hard');
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
  if(!on) return h+`<div class="small muted">Optional upper-body power: throws, explosive pulls and speed presses. Operator's bench is deliberately sub-maximal and the bike does nothing for the upper body, so this fills a real gap. Pick a movement per slot from whatever you have — med ball, bodyweight, barbell or a band. Five minutes, full rest, every rep maximal.</div></div>`;
  h+=`<div class="stack" style="gap:10px">`;
  plyoUpperEx(ph).forEach((e,i)=>{
    const n0=cut?Math.ceil(e.s/2):e.s, sets=(L[i])||[];
    h+=`<div class="pex"><label class="f up-pick"><span class="small muted">${esc(e.slot)}</span><select data-pbind="plyoUp.${upKey(ph,i)}">${e.opts.map(o=>`<option value="${o.id}"${o.id===e.id?' selected':''}>${esc(o.label)} · ${esc(o.gear)}</option>`).join('')}</select></label>
    <details class="px" data-px="up${i}"${openPx.has('up'+i)?' open':''}><summary><span>${esc(e.label)}</span><span class="mono small">${n0} × ${esc(e.r)} · ${e.rest} s</span></summary>${plyoEntry(e.id)}</details>
    <div class="sets">${Array.from({length:n0},(_,j)=>`<button class="setb sm${sets[j]?' on':''}" data-act="upset" data-i="${i}" data-j="${j}" aria-pressed="${!!sets[j]}">${esc(String(e.r).split(' ')[0])}<small>Set ${j+1}</small></button>`).join('')}</div></div>`;
  });
  h+=`</div><div class="small muted">Throws and explosive reps, not ground contacts, so they do not count toward the contact target. Bench is on all three lifting days and Friday is the day after: if it ever feels flat, this is the first block to cut.</div>`;
  if(pullback||cut) h+=`<div class="banner warn"><div class="small">You are already pulling back today. Drop this block or do one movement.</div></div>`;
  return h+`</div>`;
}
function plyoCard(wk,dp){
  const ph=plyoPhase(wk), L=lg(sel).plyo||{}, cut=!!(dp.plyoCut||L.cut);
  const done=plyoContactsDone(ph,L,cut), target=cut?Math.round(ph.target/2):ph.target;
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Plyos · ${ph.name}</span><span class="rx">~${target} contacts</span></div><div class="small muted">${esc(ph.desc)} 15–20 min of actual work, before HIC.</div>`;
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
function testCard(k,defReps,isRm5){
  const T=(lg(sel).test||{})[k]||{}, reps=T.r||defReps, e=estMax(k,T.w,reps,sel), cur=currentMax(k)??((plan.prevMaxes||{})[k]??null);
  const bw=latestBw(sel);
  const est=cur==null?null:isBW(k)?(bw?floorTo((bw+cur)*(isRm5?.87:1)-bw,plan.round[k]):null):(isRm5?floorTo(cur*.87,plan.round[k]):cur);
  const tgt=T.target!=null&&T.target!==''?+T.target:(T.w!=null&&T.w!==''?+T.w:est);
  return `<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${isRm5?'5RM · 2 in reserve':'Heavy single'}${isBW(k)?' · added weight':''}</span></div>
  <div class="grid4"><label class="f">Target${numIn('test.'+k+'.target',T.target,est?n(est):'')}</label><label class="f">Result weight${numIn('test.'+k+'.w',T.w,'')}</label><label class="f">Reps${numIn('test.'+k+'.r',T.r,String(defReps))}</label><label class="f">Est. 1RM<div class="big" style="font-size:34px">${e?n(floorTo(e,plan.round[k])):'—'}</div></label></div>
  ${warmupLog(k,testRamp(k,tgt,isRm5),tgt!=null?`Calculated from a target of ${isBW(k)?fmtLoad(k,tgt):n(tgt)} ${u()}${T.target?'':T.w?' (your result)':' (from your current max)'}.`:'')}
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
  <p class="small muted" style="margin:0">If a lift didn't move, that's information, not failure. Leave it blank to keep the projected number.</p>
  <div><button class="btn primary" data-act="applytest" data-monday="${wk.monday}" ${!nc||!Object.keys(res).length||applied?'disabled':''}>${applied&&Object.keys(res).length?'Applied to Cycle '+nc:'Use for Cycle '+(nc||'—')}</button></div></div>`;
}
function convertCard(wk){
  const res=weekResults(wk,'test');
  const rows=activeLifts().map(k=>`<tr><td>${esc(liftName(k))}</td><td class="n">${res[k]!=null?n(res[k]):'—'}</td><td class="n">${plan.maxes[k]!=null&&plan.maxes[k]!==''?n(plan.maxes[k]):'—'}</td></tr>`).join('');
  const done=LK.every(k=>res[k]==null||+plan.maxes[k]===res[k]);
  return `<div class="card"><h3>Convert 5RMs to maxes</h3><p class="small muted" style="margin:0">Each 5RM ÷ 0.87, rounded down. Missing a lift? Enter it in Setup.</p><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Est. 1RM</th><th class="n">Saved max</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div><button class="btn primary" data-act="savemaxes" data-monday="${wk.monday}" ${!Object.keys(res).length||done?'disabled':''}>${done&&Object.keys(res).length?'Saved as your maxes':'Save as my maxes'}</button></div></div>`;
}
function footer(active){
  if(!active) return '';
  const L=lg(sel);
  return `<div class="card"><div class="grid2"><label class="f">Session RPE<select id="rpe" data-bind="rpe" data-type="num"><option value="">—</option>${[5,6,7,8,9,10].map(v=>`<option value="${v}"${+L.rpe===v?' selected':''}>${v}</option>`).join('')}</select></label><div style="display:flex;align-items:flex-end"><button class="btn ${L.done?'':'primary'}" style="width:100%" data-act="done">${L.done?'✓ Done · undo':'Mark session done'}</button></div></div><label class="f">Notes<textarea id="notes" data-bind="notes" placeholder="Machine settings, how it moved, anything to remember">${esc(L.notes||'')}</textarea></label></div>`;
}
