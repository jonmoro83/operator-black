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
  const tk=o.tick||fmtTick;
  for(let v=lo;v<=hi+1e-9;v+=step){const yy=y(v).toFixed(1);g+=`<line class="ch-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="ch-ax" x="${L-6}" y="${(+yy+3.5).toFixed(1)}" text-anchor="end">${tk(v)}</text>`}
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
  const e=pts[pts.length-1], end=`<text class="ch-end" x="${(x(pts.length-1)+8).toFixed(1)}" y="${(y(e.y)+4).toFixed(1)}">${esc(o.endLabel?o.endLabel(e):tk(e.y))}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">${g}${area}${raw2}<path class="ch-line" d="${path}"/>${proj}${dots}${xl}${end}${hits}</svg>`;
}
function dense2(pts){return pts.length>40?1.4:pts.length>20?1.8:2.4}
function r1(v){return String(Math.round(v*10)/10)}
function nice(r){const e=Math.pow(10,Math.floor(Math.log10(r||1))),f=r/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function fmtTick(v){return Math.abs(v)>=1000?(Math.round(v/100)/10)+'k':String(Math.round(v*10)/10)}
function fmtWhole(v){return String(Math.round(v))}
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
    if(!best||e>best.e) best={e,w:used,r:v.r,p:v.p,d,max:v.m.v,grinder:ground(x),off:x.used!=null&&x.used!==''};
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
/* What a macro was, on the day it was eaten. Grams are logged the morning after, in
   the same check-in as the calories, so they belong to the day before -- the same
   offset `kcalOn` applies and for the same reason. */
function macroOn(d,f){ const v=ci(addDays(d,1))[f]; return v==null||v===''?null:+v }
function macroMean(t,days){
  const got={p:[],c:[],f:[]}, key={p:'proG',c:'carbG',f:'fatG'};
  for(let i=days-1;i>=0;i--){ const d=addDays(t,-i);
    for(const k of ['p','c','f']){ const v=macroOn(d,key[k]); if(v!=null) got[k].push(v) } }
  const mean=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;
  return {p:mean(got.p),c:mean(got.c),f:mean(got.f),days:Math.max(got.p.length,got.c.length,got.f.length)};
}
/* The windows worth averaging over, and how many days back each one reaches.

   `logged` is the days in the window that actually have grams, which is the number
   that makes an average honest: four days entered out of a fourteen-day window is a
   different claim from fourteen out of fourteen, and the card has to say which. */
let macroWin='week';
const MACRO_WINS=[['week','This week'],['14','14 days'],['cycle','This block']];
function setMacroWin(v){ if(!MACRO_WINS.some(([k])=>k===v)) return false; macroWin=v; return true }
function macroWinDays(t){
  if(macroWin==='14') return 14;
  if(macroWin==='cycle'){
    const wk=weekOf(t);
    if(wk&&wk.kind==='cycle'){
      // Back to the first week of this cycle, however many weeks in we are.
      const back=(wk.w-1)*7+dow(t)+1;
      return Math.max(1,Math.min(back,70));
    }
    return 7+dow(t)+1;
  }
  return dow(t)+1;                      // Monday to today
}
function macroWinLabel(t){
  const d=macroWinDays(t);
  if(macroWin==='week') return d===1?'today':`the ${d} days since Monday`;
  if(macroWin==='14') return 'the last 14 days';
  return `the ${d} days of this block so far`;
}
/* The book's answer to a scale that will not move: "If you're not putting on weight
   after a month or two, add another 500 calories per day using the same ratio."
   Only offered on real evidence -- a fortnight of weigh-ins going the wrong way --
   because a week of noise is not a stall. */
function macroAdvice(t){
  // Only the two goals that have a direction. Holding steady is the goal being met,
  // so there is nothing to say -- which the two tests below fall through to.
  const g=macroGoal();
  const r=bwRate(t,14); if(!r) return null;
  const per=u()==='kg'?r.perWeek*2.2046:r.perWeek;
  if(g==='gain'&&per<0.25) return {dir:1,per,
    text:'The scale has not moved in a fortnight. The book’s answer is another 500 calories a day in the same ratio — then give it a month before judging it again.'};
  if(g==='lose'&&per>-0.25) return {dir:-1,per,
    text:'Weight is holding rather than coming down. Five hundred calories a day off the target is the usual next step — ours, not the book’s, which only covers building.'};
  return null;
}
/* Whether the "where these numbers come from" note is showing.

   In JS, not a <details>: open state kept in the DOM does not survive a render, which
   is the rule the mobility panels already encode. morph() preserves a node, but it
   also syncs attributes, so an `open` the render does not know about would be stripped
   off anyway. */
let macroWhy=false;
function setMacroWhy(v){ macroWhy=!!v; return macroWhy }
function macroRow(lbl,target,avg){
  // Verdict first, number second. "40 short" is the thing being looked for; 200 is
  // only the evidence for it, so it is the caption and not the headline.
  const gap=avg==null?null:avg-target;
  const near=gap!=null&&Math.abs(gap)<=Math.max(5,target*0.05);
  const word=gap==null?'':near?'On target':`${Math.abs(gap)} ${gap<0?'short':'over'}`;
  const tone=gap==null?'muted':near?'ok':'off';
  return `<div class="mrow">
    <span class="mrow-l">${esc(lbl)}</span>
    <span class="mrow-n mono">${target}<span class="mrow-u">g</span></span>
    <span class="mrow-r">${avg==null?`<span class="small muted">none logged</span>`
      :`<span class="mrow-v ${tone}">${esc(word)}</span><span class="small muted">avg ${avg}</span>`}</span>
  </div>`;
}
function macroCard(t){
  const tgt=macroTarget(t), got=macroMean(t,macroWinDays(t)), adv=macroAdvice(t);
  const lb=bwLb(t);
  let h=`<div class="card"><div class="lift-h"><h3>Macros</h3>${tgt?`<span class="chip ${tgt.src==='tb3'?'light':''}">${tgt.src==='tb3'?'TB III':'Ours'}</span>`:''}</div>`;
  if(!lb) return h+`<p class="small muted" style="margin:0">Log your bodyweight in the daily check-in and a target appears here.</p></div>`;
  if(!tgt) return h+`<p class="small muted" style="margin:0">A target for ${esc(macroGoal()==='lose'?'losing':'holding')} needs your daily burn first, which needs your height and age in Setup, or a few weeks of calories and weigh-ins.</p></div>`;

  h+=`<div class="seg wide">${MACRO_WINS.map(([v,l])=>`<button class="segb${macroWin===v?' on':''}" data-act="macrowin" data-v="${v}" aria-pressed="${macroWin===v}">${esc(l)}</button>`).join('')}</div>`;
  h+=`<div class="mrows">`;
  for(const [k,lbl] of [['p','Protein'],['c','Carbs'],['f','Fat']]) h+=macroRow(lbl,tgt[k],got[k]);
  h+=`</div>`;
  h+=`<div class="mtot"><span class="small muted">Calories a day</span><span class="mono">${n(tgt.kcal)}${tgt.bump?` <span class="small muted">incl. ${tgt.bump>0?'+':''}${tgt.bump*MACRO_STEP}</span>`:''}</span></div>`;

  // One disclosure for the two explanations that used to sit open under every card.
  h+=`<div><button class="linkb" data-act="macrowhy" aria-expanded="${macroWhy}">Where these numbers come from</button>`;
  if(macroWhy){
    h+=`<div class="small muted" style="margin-top:6px;line-height:1.45">${tgt.src==='tb3'
      ?`The book’s formula for building: bodyweight × 1.3 for protein, × 2 for carbs, half for fat.`
      :`Protein and a fat floor off your bodyweight, carbohydrate taking the rest of the target. The books do not cover ${macroGoal()==='lose'?'losing':'holding'}, so these are ours.`}
      ${got.days?`<b>Averages are of days already eaten</b>, not today — grams are logged the morning after, so today’s are not in yet. ${got.days} of ${esc(macroWinLabel(t))} ${got.days===1?'has':'have'} grams against ${macroWinDays(t)===got.days?'them all':'them'}.${got.days<macroWinDays(t)/2?' Too few to read much into.':''}`
        :`Nothing logged over ${esc(macroWinLabel(t))}. The three boxes are in the daily check-in, under yesterday’s eating — they are for the day before, so today’s go in tomorrow.`}</div>`;
  }
  h+=`</div>`;

  if(adv) h+=`<div class="banner info"><div class="small">${esc(adv.text)}</div>
    <button class="btn primary wide" data-act="macrobump" data-v="${adv.dir}" style="margin-top:8px">${adv.dir>0?'Add':'Take off'} 500 a day</button></div>`;
  else if(tgt.bump) h+=`<div class="row between"><span class="small muted">Target adjusted by ${tgt.bump>0?'+':''}${tgt.bump*MACRO_STEP} a day.</span><button class="btn sm ghost" data-act="macrobump" data-v="0">Back to the formula</button></div>`;
  return h+`</div>`;
}
function energyCard(t){
  const est=tdeeOn(t), pred=est&&est.predicted, meas=est&&est.measured, ts=tdeeSeries(t,12);
  const bf=bfSeries(t), last=bf[bf.length-1];
  const kc=[]; for(let i=27;i>=0;i--){const v=kcalOn(addDays(t,-i));if(v)kc.push(v)}
  if(!meas&&!pred&&!bf.length) return `<div class="card"><h3>Energy and composition</h3><p class="small muted" style="margin:0">Log calories in the daily check-in, add your height, sex and birth year in Setup, and take neck and waist measurements weekly. Then this card estimates what you burn and what you are made of.</p></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Energy and composition</h3><span class="small muted">Estimates, not measurements</span></div>`;
  h+=`<div class="miles">`;
  h+=`<div class="mile"><span class="l">Burn per day</span>${est?`<span class="big">${n(est.tdee)}</span><span class="small muted">${meas?`${Math.round(est.w*100)}% your own data${pred?`, rest the formula (${n(pred)})`:''}`:`the formula only · Mifflin-St Jeor × ${actFactor()}`}</span>`:'<span class="small muted">Needs height, sex and birth year</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Eaten per day</span>${kc.length?`<span class="big">${n(Math.round(kc.reduce((a,b)=>a+b,0)/kc.length))}</span><span class="small muted">${kc.length} of the last 28 days logged</span>`:'<span class="small muted">Log calories in the check-in</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Body fat</span>${last?`<span class="big">${r1(last.bf)}<small style="font-size:14px;color:var(--muted);margin-left:2px">%</small></span><span class="small muted">${fmtD(last.d,true)}${bf.length>1?` · ${last.bf>bf[0].bf?'+':''}${r1(last.bf-bf[0].bf)} since ${fmtD(bf[0].d)}`:''}</span>`:'<span class="small muted">Needs neck and waist</span>'}</div></div>`;
  if(meas){
    const rt=meas.dw/meas.gap*7, own=meas.tdee-meas.mean;
    h+=`<div class="small">Over the last ${meas.days} days you ate <b class="mono">${n(meas.mean)}</b> a day and your weight trend ${Math.abs(rt)<.05?'held flat':`moved ${rt>0?'+':'−'}${r1(Math.abs(rt))} ${u()} a week`}. On its own that puts your burn at <b class="mono">${n(meas.tdee)}</b>, a ${own>0?'deficit':'surplus'} of <b class="mono">${n(Math.abs(own))}</b> a day.${est.w<.95&&pred?` The number above still leans ${Math.round((1-est.w)*100)}% on the formula while your history builds — ${Math.ceil((42-tdeeHistory(t))/7)} more week${Math.ceil((42-tdeeHistory(t))/7)===1?'':'s'} of logging both and it is all yours.`:''}</div>`;
    const goal=plan.goal, tgt=goal==='lose'?est.tdee-Math.round(est.tdee*.18/10)*10:goal==='gain'?est.tdee+250:est.tdee;
    if(goal&&goal!=='maintain') h+=`<div class="small muted">Your goal is set to ${goal==='lose'?'lose fat':'build'}. About <b class="mono">${n(tgt)}</b> a day would ${goal==='lose'?'take off roughly 1% of bodyweight a month without wrecking the lifting':'add weight slowly enough to stay mostly lean'}. Protein target is on the Today card.</div>`;
  } else if(pred){
    h+=`<div class="small muted">That is the formula's guess from your height, weight, age and activity. Log calories for ${28} days alongside your weigh-ins and this switches to your own numbers, which are the only ones that count.</div>`;
  }
  if(ts.length>=2){
    const a0=ts[0], b0=ts[ts.length-1], dr=b0.v-a0.v;
    h+=`<div class="sm" style="margin-top:12px"><div class="sm-h"><b>Burn over time</b><span class="v">${n(b0.v)}<small>${dr>0?'+':''}${n(dr)} since ${fmtD(a0.d)}</small></span></div>`;
    h+=lineChart(ts.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: about ${n(x.v)} a day, ${Math.round(x.w*100)}% from your own data`})),{label:'Estimated daily burn',minStep:25,tick:fmtWhole});
    h+=`<div class="small muted">Each point is the 28 days ending that week, so it follows you rather than holding a number set on day one.${Math.abs(dr)>=100?(dr<0?` It has come down about ${n(-dr)} since ${fmtD(a0.d)} — normal in a long deficit, and a reason to take a maintenance break rather than cut harder.`:` It has risen about ${n(dr)} since ${fmtD(a0.d)}.`):''}</div></div>`;
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
/* The three lines at the top of Status: a verdict apiece, not a number apiece. Each
   one follows the book rather than dashboard convention, and where it does not, the
   comment says so.

   TB2 on consistency: "Don't miss a single conditioning session, and don't miss a
   single strength session... Many overestimate how consistent they are, and tend to
   miss more sessions then they think." So Keeping up counts them against a standard
   of none, and says what the standard is.

   TB2 on judging progress: "Compare yourself with yourself no earlier than every six
   months. Make no judgments until six months are up... Anything less is a waste of
   time. No changes of importance will happen in the short term." A four-week progress
   verdict is exactly the line a fitness app draws here and exactly the one the book
   forbids, so the second line is a clock and an inventory of what has actually been
   measured instead.

   TB2 again: "Think long term. Consistency is king. Progress takes time." */
const VERDICT_WIN=28;                 // four weeks, the window the rest of Status uses
const ASSESS_DAYS=182;                // six months, the book's own interval
// Ours, not the book's. The book's standard is none missed; a red line for one missed
// session in four weeks would be noise inside a week, so two is the grace.
const MISS_GRACE=2;
// Ours. Readiness is a 0-100 scale, so ten points is a visible move rather than drift.
const READY_DROP=10;
// A program three days old has two sessions behind it, and calling one of them missed
// before the app was even installed is not a verdict, it is a nag.
const MISS_FLOOR=4;
function keepingUp(t){
  let n0=0,d0=0;
  for(let i=VERDICT_WIN;i>=1;i--){const d=addDays(t,-i);if(d<plan.startMonday)continue;const st=sessState(d,t);if(st==='rest')continue;n0++;if(st==='done')d0++}
  if(n0<MISS_FLOOR) return {cls:'muted',v:'Nothing to count yet',w:`${n0?`${d0} of ${n0} so far. `:''}Four sessions have to be behind you before this says anything worth hearing.`};
  const miss=n0-d0;
  if(!miss) return {cls:'ok',v:'Nothing missed',w:`All ${n0} sessions in the last four weeks. That is the standard the book sets — not a single strength or conditioning session — and you are holding it.`};
  return {cls:miss<=MISS_GRACE?'warn':'off',v:`${miss} missed`,w:`${d0} of ${n0} sessions in the last four weeks. The book asks for none missed, and warns that most people think they miss fewer than they do.`};
}
// Only a max somebody entered counts as measured. A projected max is the increment
// doing arithmetic, and a locked one is that arithmetic frozen; neither is evidence.
function measuredLifts(curC){
  const out=[];
  for(const k of activeLifts()){
    const base=maxFor(1)[k]; if(!base) continue;
    // The latest cycle anybody typed a number into. Cycle 1 is the starting point
    // rather than a retest, so it is where the comparison runs to, not from.
    let hit=null;
    for(let c=curC;c>=2;c--){ const m=maxFor(c)[k]; if(m&&m.src==='set'){ hit={c,v:m.v}; break } }
    if(hit) out.push({k,c:hit.c,d:hit.v-base.v});
  }
  return out;
}
function assessClock(t){
  const since=Math.round((D(t)-D(plan.startMonday))/864e5);
  const period=Math.max(0,Math.floor(since/ASSESS_DAYS));
  const at=addDays(plan.startMonday,(period+1)*ASSESS_DAYS);
  // For the four weeks after each six-month mark, the answer is "now".
  return {since,period,at,due:period>=1&&since-period*ASSESS_DAYS<VERDICT_WIN,left:Math.round((D(at)-D(t))/864e5)};
}
function progressLine(t){
  const wk=weekOf(t), curC=wk?(wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle)):1;
  const got=measuredLifts(curC), up=got.filter(x=>x.d>0), c=assessClock(t);
  const said=got.length
    ? `${got.length} lift${got.length===1?'':'s'} retested since you started${up.length?`, ${up.length} of ${got.length===up.length?'them':got.length} up on where ${up.length===1?'it':'they'} began`:', none of them up yet'}.`
    : 'Nothing has been retested yet, so none of the maxes on this page are measured — they are the increment doing arithmetic.';
  const wks=Math.floor(c.since/7);
  if(c.due) return {cls:'ok',v:`${c.period*6} months in — compare`,w:`${said} The book's interval is up: look at where you were on ${fmtD(addDays(plan.startMonday,(c.period-1)*ASSESS_DAYS))} against where you are now, and re-assess.`};
  if(c.since<7) return {cls:'muted',v:'Just started',w:`${said} The book asks for no judgment until six months are up, which is ${fmtD(c.at,true)}.`};
  if(c.period) return {cls:'muted',v:`${wks} weeks in`,w:`${said} You passed the ${c.period*6}-month mark on ${fmtD(addDays(plan.startMonday,c.period*ASSESS_DAYS))}. The next comparison the book asks for is ${fmtD(c.at,true)}, ${c.left} day${c.left===1?'':'s'} away.`};
  return {cls:'muted',v:`${wks} week${wks===1?'':'s'} in`,w:`${said} The book asks you to make no judgment until six months are up — ${fmtD(c.at,true)}, ${c.left} day${c.left===1?'':'s'} away. Keep plodding.`};
}
function watchLine(t){
  const from=addDays(t,-(VERDICT_WIN-1)), out=[];
  const flags=progLogs().filter(([d,L])=>d>=from&&d<=t&&(L.pain==='sharp'||L.pain==='niggle'));
  const sharp=flags.filter(([,L])=>L.pain==='sharp').length;
  if(flags.length){
    const where={}; for(const [,L] of flags) for(const w of painAt(L)) where[w]=(where[w]||0)+1;
    const spots=Object.entries(where).sort((a,b)=>b[1]-a[1]).map(([k,c])=>((PAIN_AT[k]||{}).name||k)+' ×'+c).join(' · ');
    out.push({r:sharp?3:2,v:sharp?'Sharp pain logged':'Something hurting',
      w:`${flags.length} session${flags.length===1?'':'s'} with something hurting in the last four weeks${sharp?`, ${sharp} of them sharp`:''}${spots?` — ${spots}`:''}. ${sharp?'Sharp pain holds that lift back at the end of the cycle.':'Noted, not acted on — worth watching if it keeps appearing.'}`});
  }
  const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
  const now=[],was=[];
  for(let i=0;i<7;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)now.push(r)}
  for(let i=7;i<14;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)was.push(r)}
  if(now.length>=3&&was.length>=3){
    const drop=Math.round(mean(was)-mean(now));
    if(drop>=READY_DROP) out.push({r:2,v:'Readiness falling',
      w:`Down ${drop} points on the week before. The book's answer to that is the rest day, not a harder session: rest periodically, and do not ignore it.`});
  }
  let gr=0; for(let i=VERDICT_WIN;i>=0;i--){const L=lg(addDays(t,-i));for(const x of Object.values(L.lifts||{})) gr+=groundSets(x)}
  if(gr>=3) out.push({r:1,v:'Sets are grinding',
    w:`${gr} grinder sets in four weeks. That is what the end-of-cycle review reads when it decides whether a max goes up, and it usually means the max is already where it should be.`});
  if(!out.length) return {cls:'ok',v:'Nothing flagged',w:'No pain logged in four weeks, readiness holding, nothing grinding.'};
  out.sort((a,b)=>b.r-a.r);
  return {cls:out[0].r>=3?'off':'warn',v:out[0].v,w:out.map(x=>x.w).join(' ')};
}
function verdictBlock(t){
  const rows=[['Keeping up',keepingUp(t)],['Progress',progressLine(t)],['Watch',watchLine(t)]];
  return `<div class="card"><div class="vb">${rows.map(([l,x])=>
    `<div class="vb-r"><div class="vb-h"><span class="vb-l">${l}</span><span class="vb-v ${x.cls}">${x.v}</span></div><div class="vb-w">${x.w}</div></div>`).join('')}</div></div>`;
}
// Status answers "how am I doing", History answers "what happened". Every trend line
// that was here as well as there has gone to History: maxes by cycle, readiness,
// results per activity, jumps. What stays is the current number and its direction.
function strengthRows(curC){
  let h=`<div class="mrows lifts">`;
  for(const k of activeLifts()){
    const cur=maxFor(curC)[k], base=maxFor(1)[k], hv=heavySet(k);
    const d=cur&&base?cur.v-base.v:null;
    const dir=d==null||!base||cur.v===base.v?'muted':d>0?'ok':'off';
    const say=d==null?'No max yet':!base||cur.v===base.v?'Level since C1':`${d>0?'+':'−'}${n(Math.abs(d))} since C1`;
    h+=`<div class="mrow"><span class="mrow-l">${esc(liftName(k))}</span>`;
    h+=cur?`<span class="mrow-n mono">${n(cur.v)}</span><span class="mrow-u">${u()}</span>`:`<span class="mrow-u">—</span>`;
    h+=`<span class="mrow-r"><span class="mrow-v ${dir}">${say}</span>${hv?`<span class="mrow-u">${fmtLoad(k,hv.w)} × ${hv.r} at ${hv.p}%${hv.grinder?', ground':''}</span>`:''}</span></div>`;
  }
  return h+`</div>`;
}
function vStatus(){
  const t=todayStr(), wk=weekOf(t);
  if(!wk) return `<div class="card"><h2>Status</h2><p class="muted" style="margin:0">The program starts the week of ${fmtLong(plan.startMonday)}.</p></div>`;
  const list=weeks(), ci0=wk.idx;
  let h='';
  // The answer leads; the orientation and the evidence follow it.
  h+=verdictBlock(t);
  // --- where you are
  const wt=weekTitle(wk);
  h+=`<div class="card"><div class="lift-h"><h2>${wt.t}</h2><span class="chip ${wt.cls}">${wt.chip}</span></div>`;
  if(wk.kind==='cycle'){
    const first=ci0-(wk.w-1);
    h+=`<div class="cyc" aria-label="Cycle ${wk.cycle} progress">${waveOf().map((v,i)=>{const cls=tier(+v.p);return `<div class="chip ${cls}${i<wk.w-1?' past':''}${i===wk.w-1?' now':''}" style="border-radius:6px">W${i+1}<small>${v.s}×${v.r} ${v.p}%</small></div>`}).join('')}</div>`;
    h+=`<div class="small muted">Cycle ${wk.cycle} ends ${fmtD(addDays(list[first+5].monday,4),true)}.</div>`;
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
  const yest=addDays(t,-1), a4=adh(addDays(mon,-28),yest);
  let tw=0,td=0;for(let i=0;i<7;i++){const d=addDays(mon,i),st=sessState(d,t);if(st!=='rest'){tw++;if(st==='done')td++}}
  const pct=a=>a.n?Math.round(a.d/a.n*100)+'%':'—';
  // Readiness is a 7-day average here and a 28-day line in History. It used to be both,
  // two cards apart, which is one metric answering the same question twice.
  h+=`<div class="card"><div class="lift-h"><h3>This week</h3><span class="small muted mono">${td}/${tw} sessions</span></div><div class="wkdots">${wd}</div>
  <div class="miles two"><div class="mile"><span class="l">Last 4 weeks</span><span class="big">${pct(a4)}</span><span class="small muted">${a4.d} of ${a4.n} sessions done</span></div><div class="mile"><span class="l">Readiness · 7 days</span>${(()=>{const xs=[];for(let i=0;i<7;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)xs.push(r)}if(!xs.length)return '<span class="small muted">No check-ins yet</span>';const av=Math.round(xs.reduce((a,b)=>a+b,0)/xs.length),lv=rLevel(av);return `<span class="big">${av}</span><span><span class="chip ${lv.cls}">${lv.t}</span> <span class="small muted">${xs.length} check-in${xs.length>1?'s':''}</span></span>`})()}</div></div>${heatmap(t,12)}</div>`;
  // --- what you look at daily, before what you look at monthly
  h+=macroCard(t);
  h+=bwCard(t);
  h+=energyCard(t);
  // --- strength
  const curC=wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle);
  h+=`<div class="card"><div class="lift-h"><h3>Strength</h3><span class="small muted">Current max and where it has gone</span></div>${strengthRows(curC)}<div class="small muted">Max by cycle, with every projection, is charted in History.</div></div>`;
  // --- conditioning
  {
    const all=hicSessions();
    const since=addDays(t,-27), mix={}; for(const x of all) if(x.d>=since) mix[x.mod]=(mix[x.mod]||0)+1;
    h+=`<div class="card"><div class="lift-h"><h3>Conditioning</h3><span class="small muted">Volume per week, and the session you repeat</span></div>`;
    h+=Object.keys(mix).length?`<div class="row" style="gap:6px"><span class="small muted">Last 4 weeks:</span>${Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([m,c])=>`<span class="chip">${MOD[m].name} · ${c}</span>`).join('')}</div>`:'';
    {
      // climbing: what the hills actually added up to
      const wkStart=mondayOf(t);
      const gain=(from)=>all.reduce((a,x)=>a+(x.d>=from&&x.elev?+x.elev:0),0);
      const thisWeek=gain(wkStart), fourWeeks=gain(since), prevFour=all.reduce((a,x)=>a+(x.d>=addDays(since,-28)&&x.d<since&&x.elev?+x.elev:0),0);
      if(fourWeeks||thisWeek) h+=`<div class="miles two"><div class="mile"><span class="l">Climbing this week</span><span class="big">${n(thisWeek)}<small style="font-size:14px;color:var(--muted);margin-left:4px">${elevUnit()}</small></span><span class="small muted">${n(Math.round(thisWeek/elevPerDist()*10)/10)} ${u()==='kg'?'km':'mi'} of flat walking</span></div><div class="mile"><span class="l">Last 4 weeks</span><span class="big">${n(fourWeeks)}<small style="font-size:14px;color:var(--muted);margin-left:4px">${elevUnit()}</small></span><span class="small muted">${prevFour?(fourWeeks>=prevFour?'up from ':'down from ')+n(prevFour)+' the 4 before':'first four weeks logged'}</span></div></div>`;
    }
    {
      const cw=condWeeks(12), tot=cw.reduce((a,x)=>a+x.min,0), thisWk=mondayOf(t);
      // this week is still running, so it is drawn hollow and left out of the average
      const full=cw.filter(x=>x.mon!==thisWk), last4=full.slice(-4);
      const av=last4.length?Math.round(last4.reduce((a,x)=>a+x.min,0)/last4.length):0;
      const anyEst=cw.some(x=>x.est>0);
      const now=cw.find(x=>x.mon===thisWk);
      h+=`<div class="sm"><div class="sm-h"><b>Minutes per week</b>${last4.length?`<span class="v">${av}<small>min / week, last ${last4.length}</small></span>`:now&&now.n?`<span class="v">${now.min}<small>min this week so far</small></span>`:''}</div>`;
      h+=cw.length>=2&&tot?lineChart(cw.map(x=>({y:x.min,xl:fmtD(x.mon),hollow:x.mon===thisWk,tip:`Week of ${fmtD(x.mon,true)}: ${x.min} min across ${x.n} session${x.n===1?'':'s'}${x.mon===thisWk?' so far':''}`})),{min:0,minStep:10,label:'Conditioning minutes per week'}):`<div class="none">${tot?`${now&&now.n===1?'One session':`${now?now.n:0} sessions`} this week. The trend starts once a second week has sessions in it.`:'Log a conditioning session and this fills in.'}</div>`;
      const drew=cw.length>=2&&tot;
      if(tot&&(drew||anyEst)) h+=`<div class="small muted">${drew?'This week is dashed: it is still running.':''}${anyEst?`${drew?' ':''}Sessions where you did not log minutes count the planned length of that format, warm-up and cool-down included — log the real number on the day’s card and it uses that instead.`:''}</div>`;
      h+=`</div>`;
    }
    {
      const bm=benchmarkState(t);
      if(bm&&bm.xs.length){
        const dir=bm.xs.length>1?bm.last.v-bm.first.v:null;
        h+=`<div class="sm"><div class="sm-h"><b>Benchmark · ${MOD[bm.mod].name} ${HIC[bm.fmt].name}</b><span class="v">${n(bm.best)}<small>${esc(bm.last.u)} best</small></span></div>`;
        h+=bm.xs.length>=2?lineChart(bm.xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${n(x.v)} ${x.u}`})),{label:'Benchmark session',minStep:1}):'<div class="none">One so far. Repeat it and this becomes the line worth watching.</div>';
        h+=`<div class="small muted">${bm.auto?'Picked automatically as the hard session you repeat most. ':''}${bm.due?`<b>Due:</b> ${bm.days==null?'never run':bm.days+' days since the last one'}. Run the same activity and format to compare like with like.`:`Last run ${fmtD(bm.last.d,true)}, ${bm.days} days ago. Due again around day ${bm.every}.`}${dir!=null?` ${dir>0?'Up':dir<0?'Down':'Level'} ${dir?n(Math.abs(dir))+' '+bm.last.u:''} since ${fmtD(bm.first.d)}.`:''}</div></div>`;
      }
    }
    h+=`<div class="small muted">Every activity you have logged, charted and tabled, is in History.</div>`;
    h+=`</div>`;
  }
  h+=pullupCard(t);
  h+=prBoard();
  h+=`<div class="row between" style="padding:0 2px"><span class="small muted">Readiness, jumps, maxes by cycle and every session you have logged.</span><button class="btn sm" data-act="view" data-view="history">Open History</button></div>`;
  return h;
}
