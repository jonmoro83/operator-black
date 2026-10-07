/* ---------------- views ---------------- */
function render(){
  const a=document.activeElement, aid=a&&a.id, pos=a&&typeof a.selectionStart==='number'?a.selectionStart:null;
  document.querySelectorAll('#nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===view?'page':'false'));
  const m=document.getElementById('main');
  m.classList.toggle('ro',!!viewing);
  if(wz&&!viewing){m.innerHTML=vWelcome();if(aid){const el=document.getElementById(aid);if(el)el.focus({preventScroll:true})}return}
  m.innerHTML=archiveBanner()+(['status','plan','history'].includes(view)?programPicker():'')+({today:vToday,status:vStatus,plan:vPlan,releases:vReleases,history:vHistory,setup:vSetup,guide:vGuide}[view]||vToday)();
  if(aid){const el=document.getElementById(aid); if(el){el.focus({preventScroll:true}); try{if(pos!=null&&el.setSelectionRange)el.setSelectionRange(pos,pos)}catch(e){}}}
  showToast();
}

function vToday(){
  const t=todayStr(), wk=weekOf(sel), dp=dayPlan(sel), mon=mondayOf(sel);
  let h=`<div class="dnav"><button class="btn sm ghost" data-act="go" data-date="${addDays(sel,-1)}" aria-label="Previous day">‹</button><h2>${fmtLong(sel)}</h2>${sel!==t?`<button class="btn sm" data-act="go" data-date="${t}">Today</button>`:''}<button class="btn sm ghost" data-act="go" data-date="${addDays(sel,1)}" aria-label="Next day">›</button></div>`;
  h+=`<div class="week">`;
  for(let i=0;i<7;i++){const d=addDays(mon,i), p=dayPlan(d);
    h+=`<button class="day${d===sel?' sel':''}${d===t?' today':''}" data-act="go" data-date="${d}"><span class="dn">${DAYN[i]}</span><span class="dd">${+d.slice(8)}</span><span class="dl">${esc(p.short||'')}</span><span class="dot${lg(d).done?' on':''}"></span></button>`}
  h+=`</div>`;
  if(!wk){ return h+checkinCard(sel)+`<div class="card"><h3>Not started</h3><p class="muted">The program starts the week of ${fmtLong(plan.startMonday)}. Change the start date in Setup.</p></div>` }
  const wt=weekTitle(wk);
  h+=`<div class="wkline"><b>${wt.t}</b><span class="chip ${wt.cls}">${wt.chip}</span>${wk.kind==='cycle'&&(dp.t==='plyohic'||dp.t==='plyobase')?`<span class="small muted">Plyo: ${plyoPhase(wk).name} · ~${dp.plyoCut||(lg(sel).plyo||{}).cut?Math.round(plyoPhase(wk).target/2):plyoPhase(wk).target} contacts</span>`:''}${wk.inserted?'<span class="chip">Added</span>':''}${isReordered(mon)?'<span class="chip blue">Days moved</span>':''}${!viewing&&dp.t!=='pre'?`<button class="btn sm ghost" style="margin-left:auto" data-act="move">Move…</button>`:''}</div>`;
  if(moveOpen&&!viewing) h+=moveCard();
  h+=weekSummaryCard();
  h+=weeklyCard();
  h+=prCard(sel);
  h+=finishCard(sel,dp);
  h+=banners(wk,dp);
  if(sel===todayStr()){const rc=reviewCycleFor(sel);if(rc) h+=reviewCard(rc);const dc=deloadCheckCycle(sel);if(dc) h+=deloadCheckCard(dc)}
  h+=checkinCard(sel);
  h+=sessionHtml(wk,dp);
  return h;
}
// Kind of each of the week's seven prescribed sessions, by slot.
function slotKinds(mon){return [0,1,2,3,4,5,6].map(sl=>sessKind(dayPlanSlot(mon,sl)))}
function edgeKinds(mon){
  const p=addDays(mon,-1), n=addDays(mon,7);
  return [idxOf(p)>=0?sessKind(dayPlan(p)):'other', weekOf(n)?sessKind(dayPlan(n)):'other'];
}
// The valid week order that moves the fewest days, optionally forcing one day's session.
// Days already gone in the current week stay where they are.
function bestOrder(mon,fixDay,fixSlot){
  const K=slotKinds(mon), cur=dayOrder(mon), ek=edgeKinds(mon), prevK=ek[0], nextK=ek[1];
  const t=realToday(), pinTo=mondayOf(t)===mon?dow(t):-1;
  const used=new Array(7).fill(false), ord=new Array(7);
  let best=null, bestCost=99;
  (function go(i,prev,cost){
    if(cost>=bestCost) return;
    if(i===7){ if((prev==='strength'||prev==='hic')&&prev===nextK) return; best=ord.slice(); bestCost=cost; return }
    for(let sl=0;sl<7;sl++){
      if(used[sl]) continue;
      if(i<pinTo&&sl!==cur[i]) continue;           // days already past this week don't move
      if(fixDay!=null&&fixDay===i&&sl!==fixSlot) continue;
      if(fixDay!=null&&fixDay!==i&&sl===fixSlot) continue;
      const k=K[sl]; if((k==='strength'||k==='hic')&&k===prev) continue;
      used[sl]=true; ord[i]=sl;
      go(i+1,k,cost+(cur[i]===sl?0:1));
      used[sl]=false;
    }
  })(0,prevK,0);
  return best?{ord:best,moved:bestCost}:null;
}
let moveOpen=false;
function moveCard(){
  const mon=mondayOf(sel), ord=dayOrder(mon), me=dow(sel), mine=ord[me];
  const past=mondayOf(realToday())===mon&&me<dow(realToday());
  let h=`<div class="card"><div class="lift-h"><h3>Change ${DAYN[me]}’s session</h3><button class="btn sm ghost" data-act="movex">Close</button></div>`;
  if(past) h+=`<div class="banner warn"><div class="small">${DAYN[me]} has already passed this week, so it stays put. Open today to rearrange what’s left.</div></div>`;
  else{
    h+=`<p class="small muted" style="margin:0">Pick what you’ll do on ${DAYN[me]}. The week keeps all seven sessions; the app shuffles the rest as little as it can and never puts two strength days or two hard conditioning days together.</p><div class="stack">`;
    // Two days can share a label (Tue and Sat are both "HIC"): offer the one that
    // needs the least shuffling, and only call it impossible if neither works.
    const byLabel=new Map();
    for(let sl=0;sl<7;sl++){
      if(sl===mine) continue;
      const lbl=dayPlanSlot(addDays(mon,sl),sl).short||'Session', r=bestOrder(mon,me,sl), was=byLabel.get(lbl);
      if(!was||(r&&(!was.r||r.moved<was.r.moved))) byLabel.set(lbl,{sl,r});
    }
    for(const [lbl,{sl,r}] of byLabel){
      h+=`<button class="btn" style="justify-content:space-between;gap:10px" data-act="swap" data-sl="${sl}" ${r?'':'disabled'}><span>${esc(lbl)}</span><span class="small${r?'':' muted'}">${r?(r.moved>1?`moves ${r.moved-1} other day${r.moved>2?'s':''} →`:'no other changes →'):'nothing valid this week'}</span></button>`;
    }
    h+=`</div>`;
  }
  if(isReordered(mon)) h+=`<div><button class="btn sm ghost" data-act="ordreset">Reset this week to the standard order</button></div>`;
  return h+`</div>`;
}
// Shown once a day is marked done: what actually got logged, and anything still missing.
function finishCard(date,dp){
  const L=lg(date); if(!L.done||['off','pre','convert'].includes(dp.t)) return '';
  const bits=[], gaps=[];
  if(dp.t==='lift'||dp.t==='rm5'||dp.t==='test'){
    const wk=weekOf(date);
    for(const k of (dp.lifts||[])){
      const x=(L.lifts||{})[k]||{}, t=((L.test||{})[k])||{};
      if(dp.t==='lift'&&wk){const r=rx(wk,k),nS=r.s,dn=(x.sets||[]).filter(Boolean).length;
        bits.push(`${liftName(k,date)} ${dn}/${nS}${r.sMax>nS?'+':''}${x.grinder?' · grinder':''}`); if(dn<nS) gaps.push(`${liftName(k)}: ${nS-dn} set${nS-dn>1?'s':''} unticked`);}
      else if(t.w!=null&&t.w!=='') bits.push(`${liftName(k,date)} ${isBW(k)?fmtLoad(k,+t.w):n(t.w)} × ${t.r||'?'}`);
    }
    const w=(L.warmup||[]).filter(Boolean).length; if(w) bits.push(`warm-up ${w} done`);
  }
  if(dp.t==='hic'||dp.t==='plyohic'||dp.cardio){
    const f=effFmt(date), mod=modOf(date), met=metricFor(mod,f), v=met?(L.hic||{})[met[0]]:null;
    if(v!=null&&v!=='') bits.push(`${MOD[mod].name} ${HIC[f].name} ${n(v)} ${met[1]}`); else gaps.push('conditioning result not logged');
  }
  if(dp.t==='plyohic'||dp.t==='plyobase'){const c=(L.plyo||{}).contacts; if(c) bits.push(`${c} contacts`); if((L.plyo||{}).best||(L.plyo||{}).mark) bits.push(`broad jump ${r1((L.plyo||{}).best||(L.plyo||{}).mark)} in`)}
  if(dp.t==='travel'){
    const items=travelList(dp.slot), tv=(L.travel||{}), n0=items.filter((_,i)=>tv[i]).length;
    bits.push(`${n0} of ${items.length} movements`);
    if(n0<items.length) gaps.push(`${items.length-n0} movement${items.length-n0>1?'s':''} unticked`);
    const w=(L.warmup||[]).filter(Boolean).length; if(w) bits.push(`warm-up ${w} done`);
  }
  const m=(L.mobility||[]).filter(Boolean).length; if(m) bits.push(`mobility ${m} done`);
  if(!L.rpe) gaps.push('no session RPE');
  return `<div class="card done"><div class="lift-h"><h3>Session complete</h3><span class="chip light">✓ ${esc(dp.short||'Done')}${L.rpe?' · RPE '+L.rpe:''}</span></div>
  ${bits.length?`<div class="small">${esc(bits.join(' · '))}</div>`:''}
  ${gaps.length?`<div class="small muted">Still open: ${esc(gaps.join(', '))}.</div>`:'<div class="small muted">Everything logged. Nice work.</div>'}</div>`;
}
function banners(wk,dp){
  let h='';
  const needMax=dp.t==='lift'&&(dp.lifts||[]).some(k=>!maxFor(wk.kind==='cycle'?wk.cycle:wk.refCycle)[k]);
  if(needMax) h+=`<div class="banner warn"><div><b>Some maxes are missing.</b> Working weights need a 1RM for every lift. Finish the bridge week tests or enter maxes in Setup.</div><div><button class="btn sm" data-act="view" data-view="setup">Open Setup</button></div></div>`;
  if(wk.kind==='bridge'&&dp.t!=='convert') h+=`<div class="banner info"><div><b>Bridge week.</b> Testing and calibration, not training. Leave two reps in reserve on every test set. Sunday turns your 5RMs into maxes.</div></div>`;
  const hol=holidayOn(sel);
  if(hol&&(dp.t==='lift'||dp.t==='test')){const alt={0:'Sun or Tue',2:'Tue or Thu',3:'Wed or Fri',4:'Thu or Sat',5:'Fri or Sun'}[dow(sel)]||'an adjacent day';h+=`<div class="banner warn"><div><b>${hol}.</b> Shift this session to ${alt} if the gym is closed.</div></div>`}
  if(sel===todayStr()&&(wk.kind==='cycle')){
    const hs=hardSessions(), nm=addDays(mondayOf(sel),7), nw=weekOf(nm);
    if(hs>=2&&nw&&nw.kind==='cycle') h+=`<div class="banner alert"><div><b>${hs} hard lifting sessions in the last two weeks</b> (RPE 9+, a grinder, or missed sets). Operator is meant to stay sub-maximal. Lower the max on the lift that's grinding, or take a deload week starting ${fmtD(nm,true)}.</div><div class="row"><button class="btn sm" data-act="insert" data-kind="deload" data-monday="${nm}">Deload next week</button></div></div>`;
  }
  return h;
}
function sessionHtml(wk,dp){
  let h='';
  const note=dp.note?`<p class="muted small" style="margin:0">${esc(dp.note)}</p>`:'';
  if(dp.t==='off'){ return h+`<div class="card"><h3>Rest</h3><p style="margin:0">${esc(dp.note||'Full rest. Walk, sleep, eat.')} Deep stretching belongs today if you want it — the block below is the long version.</p></div>`+mobCard(sel,dp)+footer(false) }
  if(dp.t==='lift'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    h+=warmupCard(sel);
    for(const k of dp.lifts) h+=liftCard(wk,k,dp);
    h+=accCard(wk,dp);
    return h+mobCard(sel,dp)+footer(true);
  }
  if(dp.t==='travel') return h+warmupCard(sel)+travelCard(dp)+mobCard(sel,dp)+footer(true);
  if(dp.t==='hic') return h+hicCard(dp,note)+mobCard(sel,dp)+footer(true);
  if(dp.t==='plyohic') return h+plyoCard(wk,dp)+`<div class="divider">Rest 10 min</div>`+hicCard(dp,'')+mobCard(sel,dp)+footer(true);
  if(dp.t==='rm5'||dp.t==='test'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    if(dp.note) h+=`<div class="banner info"><div>${esc(dp.note)}</div></div>`;
    h+=warmupCard(sel);
    if(dp.jumps) h+=plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('First, before any lifting.');
    for(const k of dp.lifts) h+=testCard(k,dp.t==='rm5'?5:1,dp.t==='rm5');
    if(dp.pullups) h+=`<div class="card"><h3>Max unassisted pull-ups</h3><p class="muted small" style="margin:0">The number the Lift 3 substitution was aimed at. One all-out set, full hang to chin over bar.</p><label class="f">Reps${numIn('pullups',lg(sel).pullups,'0','class="num-in"')}</label>${bestPullups()}</div>`;
    if(dp.apply) h+=applyCard(wk);
    if(dp.cardio) h+=`<div class="divider">Then, easy</div>`+hicCard(dp,'');
    return h+mobCard(sel,dp)+footer(true);
  }
  if(dp.t==='se') return h+warmupCard(sel)+seCard(dp)+mobCard(sel,dp)+footer(true);
  if(dp.t==='plyobase') return h+warmupCard(sel)+plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('Baselines. Three good attempts each, keep the best.')+mobCard(sel,dp)+footer(true);
  if(dp.t==='convert') return h+convertCard(wk)+mobCard(sel,dp)+footer(false);
  return h;
}
function mobKind(dp){
  if(dp.t==='travel') return dp.slot==='day3'?'dead':'lift';
  if(dp.t==='plyohic'||dp.t==='plyobase') return 'plyo';
  if(dp.t==='hic') return 'hic';
  if(dp.t==='off'||dp.t==='convert'||dp.t==='pre') return 'off';
  return (dp.lifts||[]).includes('dead')?'dead':'lift';
}
function mobList(kind){const a=(plan.mob||{})[kind];return Array.isArray(a)&&a.length?a.map(x=>Array.isArray(x)?x:[x,'']):MOB[kind].items}
// "45–60 sec per side" -> a 60 s hold, two sides. Reps and breaths get no timer.
function holdSecs(dose){
  const m=String(dose||'').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(sec|min)/i);
  if(!m) return null;
  const v=+(m[2]||m[1]), s=m[3].toLowerCase()==='min'?v*60:v;
  return s>=10?{s,sides:/per side/i.test(dose)?2:1}:null;
}
function travelList(slot){const a=(plan.travel||{})[slot];return Array.isArray(a)&&a.length?a.map(x=>Array.isArray(x)?x:[x,'']):TRAVEL[slot].items}
function travelCard(dp){
  const L=lg(sel).travel||{}, items=travelList(dp.slot), done=items.filter((_,i)=>L[i]).length;
  return `<div class="card"><div class="lift-h"><span class="lift-name">${esc(TRAVEL[dp.slot].name)}</span><span class="rx">${done} of ${items.length}</span></div>
  <p class="small muted" style="margin:0">Rep targets rather than percentages \u2014 a week on hotel kit keeps the habit without touching your maxes. Leave two reps in reserve, as always.</p>
  <div class="stack">${items.map(([n,d],i)=>checkRow('travel.'+i,L[i],n,d)).join('')}</div>
  <div class="small muted">Edit these in Setup \u2192 Travel week.</div></div>`;
}
function checkRow(bind,on,name,dose){
  const h=holdSecs(dose), e=mlibEntry(name), id='c-'+bind.replace(/\./g,'-'), key='m-'+bind.replace(/\./g,'-');
  const open=!!e&&openPx.has(key);
  // No <details> here: ticking the box re-renders, and a native disclosure would be
  // rebuilt before its toggle event landed. The button drives openPx and the panel is
  // rendered from it, so the two cannot race.
  const info=e?`<button class="libinfo${open?' on':''}" data-act="mlib" data-k="${key}" aria-expanded="${open}" aria-label="How to do ${esc(name)}">i</button>`:'<span></span>';
  return `<div class="crow"><input type="checkbox" id="${id}" data-bind="${bind}" ${on?'checked':''}><label class="crow-n" for="${id}">${esc(name)}</label>${info}${dose?`<span class="mono small muted">${esc(dose)}</span>`:'<span></span>'}${h?`<button class="btn sm ghost hold" data-act="hold" data-n="${esc(name)}" data-s="${h.s}" data-sides="${h.sides}" aria-label="Time ${esc(name)}">\u23f1</button>`:'<span></span>'}</div>${open?libBody(e):''}`;
}


function warmupCard(date){
  const W=lg(date).warmup||[], short=!!lg(date).warmShort;
  const idx=WARMUP.map((x,i)=>i).filter(i=>!short||WARMUP[i].s);
  const done=idx.filter(i=>W[i]).length;
  let rows='', g=null;
  for(const i of idx){ const x=WARMUP[i]; if(x.g!==g){g=x.g;rows+=`<h4 class="sub-h">${esc(g)}</h4>`} rows+=checkRow('warmup.'+i,W[i],x.n,x.d); }
  return `<details class="plain card" data-px="gwu"${openPx.has('gwu')?' open':''}><summary><b>Warm-up</b> · ${done} of ${idx.length} done · ${short?'7 min':'12–15 min'}</summary>
  <div class="stack" style="margin-top:10px">
    <div class="restsel"><span>Version</span><div class="seg"><button class="segb${short?'':' on'}" data-act="wshort" data-v="0">Full · 12–15 min</button><button class="segb${short?' on':''}" data-act="wshort" data-v="1">Short · 7 min</button></div></div>
    ${rows}
    <div class="small muted">Keep static holds easy before lifting. Long aggressive holds right before heavy squats blunt force output — the deep work belongs in the mobility block at the end.</div>
    <div class="row"><button class="btn" data-act="guide" data-k="warmup">Guide me through it</button>${done?`<button class="btn sm ghost" data-act="wclear">Clear</button>`:''}</div>
  </div></details>`;
}
function mobCard(date,dp){
  const kind=mobKind(dp), M=MOB[kind], items=mobList(kind), L=lg(date).mobility||[], done=items.filter((_,i)=>L[i]).length;
  return `<details class="plain card" data-px="mob"${openPx.has('mob')?' open':''}><summary><b>Mobility</b> · ${done} of ${items.length} done · ${esc(M.name)}</summary>
  <div class="stack" style="margin-top:10px"><div class="small muted">${esc(M.why)} Hold each one easy; this is the place for the longer holds.</div>
    ${items.map(([n,d],i)=>checkRow('mobility.'+i,L[i],n,d)).join('')}
    <div class="row"><button class="btn" data-act="guide" data-k="mobility">Guide me through it</button>${done?`<button class="btn sm ghost" data-act="mclear">Clear</button>`:''}</div>
  </div></details>`;
}
/* ---------- strength-endurance circuits ---------- */
function seCluster(date){const o=(lg(date).se||{}).cluster;return SE_CLUSTERS[o]?o:(((plan.se||{}).cluster)in SE_CLUSTERS?plan.se.cluster:'bw')}
function seList(key){
  if(key==='mine'){const a=(plan.se||{}).custom;return Array.isArray(a)?a.filter(Boolean):[]}
  return (SE_CLUSTERS[key]||SE_CLUSTERS.bw).ex;
}
// What you're actually doing today. Starts as the cluster, and stays that way until you
// change something — a bar that's taken, a bell you'd rather use — which is per day only.
function seDayList(date){const a=(lg(date).se||{}).ex;return Array.isArray(a)&&a.length?a:seList(seCluster(date))}
function seEdited(date){const a=(lg(date).se||{}).ex;return Array.isArray(a)&&a.length>0}
// Everything the app knows about, for the swap list.
function seVocab(){
  const out=[];
  for(const c of Object.values(SE_CLUSTERS)) for(const e of c.ex) if(!out.includes(e)) out.push(e);
  for(const e of ((plan.se||{}).custom||[])) if(e&&!out.includes(e)) out.push(e);
  return out;
}
function seRestSecs(){const v=+((plan.se||{}).rest);return SE_RESTS.includes(v)?v:60}
function seDone(date){const d=(lg(date).se||{}).done;return Array.isArray(d)?d:[]}
let seEdit=null;
function seSwap(i,name,ex){
  const pool=seVocab().filter(e=>!ex.includes(e));
  return `<div class="seswap"><div class="small muted">Swap this one for today. The cluster and your other days stay as they are.</div>
  <div class="seg">${pool.map(e=>`<button class="segb" data-act="seput" data-i="${i}" data-v="${esc(e)}">${esc(e)}</button>`).join('')||'<span class="small muted">Nothing else on the list.</span>'}</div>
  <div class="row" style="align-items:flex-end"><label class="f" style="flex:1">Or type one<input type="text" id="se-ex-${i}" data-seex="${i}" value="${esc(name)}"></label><button class="btn sm ghost" data-act="serm" data-i="${i}">Remove</button><button class="btn sm" data-act="seedit" data-i="${i}">Done</button></div></div>`;
}
function seCard(dp){
  const key=seCluster(sel), ex=seDayList(sel), done=seDone(sel), C=dp.circuits, R=dp.reps, edited=seEdited(sel);
  const ticks=ex.reduce((a,_,i)=>a+((done[i]||[]).filter(Boolean).length),0), total=ex.length*C;
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Strength-endurance</span><span class="rx">${C} circuit${C>1?'s':''} × ${R} reps</span></div>
  <div class="small muted">Light resistance, high repetition, short rests. Work down the cluster, rest ${seRestSecs()?seRestSecs()+' sec':'as little as you can'} between exercises, then 2 minutes before the next circuit. Can't get all ${R} at once? Rest-pause until they're done, then move on.</div>
  <div class="restsel"><span>Cluster</span><div class="seg">${Object.entries(SE_CLUSTERS).map(([k,c])=>`<button class="segb${k===key&&!edited?' on':''}" data-act="secl" data-v="${k}" aria-pressed="${k===key&&!edited}">${c.name}</button>`).join('')}</div>${edited?`<span class="chip blue">Changed for today</span><button class="btn sm ghost" data-act="sereset">Back to ${esc(SE_CLUSTERS[key].name)}</button>`:''}</div>`;
  if(!ex.length) return h+`<div class="banner warn"><div class="small">No exercises in your own cluster yet. Add five to eight in <b>Setup → Strength-endurance</b>, or pick one of the book's above.</div></div></div>`;
  h+=`<div class="setbl">${ex.map((name,i)=>`<div class="serow"><button class="sename" data-act="seedit" data-i="${i}" aria-expanded="${seEdit===i}">${esc(name)}<span class="swap">swap</span></button><div class="sets">${Array.from({length:C},(_,j)=>`<button class="setb sm${(done[i]||[])[j]?' on':''}" data-act="setick" data-i="${i}" data-j="${j}" aria-pressed="${!!(done[i]||[])[j]}">${R}<small>${j+1}</small></button>`).join('')}</div>${seEdit===i?seSwap(i,name,ex):''}</div>`).join('')}</div>
  <div><button class="btn sm ghost" data-act="seadd">+ Add an exercise</button></div>
  <div class="row between"><span class="small muted">${ticks} of ${total} sets</span><span class="small muted">${esc(SE_CLUSTERS[key].note)}</span></div>
  <div class="restsel"><span>Rest between exercises</span><div class="seg">${SE_RESTS.map(v=>`<button class="segb${seRestSecs()===v?' on':''}" data-act="serest" data-v="${v}">${v?v+'s':'none'}</button>`).join('')}</div></div>
  ${key==='bar'||key==='db'||key==='kb'?`<div class="small muted">Use roughly 15–30% of your one-rep max. Don't test for it, and if it feels heavy take weight off.</div>`:''}
  </div>`;
  return h;
}
function warmupShort(){return `<div class="stack small"><div><b>1 · Raise temp</b> Bike, rower or easy jog, 4–5 min</div><div><b>2 · Breathe</b> 90/90 breathing ×5 breaths · cat/cow ×8–10</div><div><b>3 · T-spine</b> Thread the needle 6–8/side · open book 8/side · quadruped extension 8/side</div><div><b>4 · Hips</b> 90/90 switches ×10 · 90/90 lean 20–30 s/side · couch stretch 45–60 s/side · frog rocks ×10 · world's greatest ×5/side</div><div><b>5 · Activate</b> Leg swings 10 each way · band pull-aparts + dislocates ×15 · glute bridge or BW squat ×10</div><div class="muted">Short version (7 min): bike 4 min, 90/90 breathing, cat/cow, 90/90 switches, couch stretch, band pull-aparts. Keep static holds easy before heavy squats.</div></div>`}
function liftCard(wk,k,dp){
  const r=rx(wk,k), L=(lg(sel).lifts||{})[k]||{}, sets=L.sets||[];
  const isDead=k==='dead'&&wk.kind==='cycle';
  const nSets=r.sMax;
  const setLbl=r.sMax>r.s?r.s+'–'+r.sMax:String(r.s);
  const bar=isBarbell(k);
  const T=L.used!=null&&L.used!==''?+L.used:r.w, has=T!=null&&(isBW(k)||T>0);
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${setLbl} × ${r.r} @ ${r.p}%${plan.basis==='tm'?' TM':''}</span></div>`;
  if(VARS[k]&&!viewing){
    const V=varsOf(k), v=r.vr, cur=V[v];
    h+=`<label class="restsel"><span>This session</span><select class="varsel" data-act-var="${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===v?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    if(v!==varRef(k)) h+=`<div class="small muted">${esc(cur.note)}</div>`;
  }
  if(L3K.includes(k)&&l3On().length>1) h+=`<div class="restsel"><span>This session</span><div class="seg">${l3On().map(v=>`<button class="segb${v===k?' on':''}" data-act="l3swap" data-v="${v}" aria-pressed="${v===k}">${esc(liftName(v))}</button>`).join('')}</div></div>`;
  if(has){
    h+=`<div class="row between"><div class="big">${fmtLoad(k,T)}<small>${isBW(k)?(T>0?u()+' added':'bodyweight'):u()}</small></div><div class="stack small" style="text-align:right;gap:2px">${bar?`<span class="plates">${plates(T)}</span>`:''}${r.w&&T!==r.w?`<span class="chip mid" style="align-self:flex-end">Prescribed ${n(r.w)}</span>`:''}<span class="muted">${r.m?`Max ${isBW(k)?'+'+n(r.m.v):n(r.m.src==='ratio'?Math.round(r.m.v):r.m.v)} · Cycle ${r.c}${r.m.src==='proj'?' (projected)':''}`:''}</span></div></div>`;
    if(bar) h+=plateSvg(T);
    if(r.m&&r.m.src==='ratio') h+=`<div class="small muted"><b>Swapped for this session.</b> This cycle is built on the ${esc(varsOf(k)[r.m.bv].name.toLowerCase())}, so the weight is your ${n(r.m.from)} max at the ${Math.round(r.m.r*100)}% a ${esc(varsOf(k)[r.vr].name.toLowerCase())} usually carries against it. Change the lift for the whole cycle in Setup instead if this is not a one-off.</div>`;
    if(isBW(k)) h+=`<div class="small muted">${T>0?`Hang ${n(T)} ${u()} from a belt. `:'Today’s percentage is at or below your bodyweight: do bodyweight reps. '}Based on ${r1(bwFor(sel))} ${u()} bodyweight${(bwAvg(sel,7)||{}).n>1?' (7-day average)':''}.</div>`;
    if(k==='pull'&&plan.machineNote) h+=`<div class="small muted">Machine: ${esc(plan.machineNote)}</div>`;
  } else h+=`<div class="muted">${isBW(k)&&r.m&&!bwFor(sel)?'Enter your bodyweight (Setup or the daily check-in) to calculate the added weight.':`No max entered for ${esc(liftName(k))}. Add it in Setup.`}</div>`;
  h+=`<div class="sets">`;
  for(let i=0;i<nSets;i++) h+=`<button class="setb${sets[i]?' on':''}${popKey===k+':'+i?' pop':''}${i>=r.s?' opt':''}" data-act="set" data-lift="${k}" data-i="${i}" aria-pressed="${!!sets[i]}">${r.r}<small>Set ${i+1}</small></button>`;
  if(!viewing&&nSets<SETCAP(r)) h+=`<button class="setb add" data-act="addset" data-lift="${k}" aria-label="Add a set to ${esc(liftName(k))}">+<small>Set</small></button>`;
  const ex=+L.extra||0;
  const rm=restMins(k), heavyNote=(k==='squat'||k==='dead')&&r.t==='heavy'&&rm<5;
  h+=`</div><div class="restsel"><span>Rest</span><div class="seg">${[2,3,4,5].map(m=>`<button class="segb${rm===m?' on':''}" data-act="restmin" data-lift="${k}" data-v="${m}" aria-pressed="${rm===m}">${m} min</button>`).join('')}</div>${heavyNote?'<span>Heavy week: the book calls 5\u201310 min normal at this load.</span>':''}</div>`;
  h+=`<div class="row between"><label class="check"><input type="checkbox" id="g-${k}" data-bind="lifts.${k}.grinder" ${L.grinder?'checked':''}> Felt like a grinder</label><label class="f" style="flex-direction:row;align-items:center;gap:8px">${isBW(k)?'Added weight':'Working weight'}${numIn('lifts.'+k+'.used',L.used,r.w!=null?n(isBW(k)?Math.max(0,r.w):r.w):'','class="num-in"')}</label></div>`;
  if(L.grinder&&r.m&&!dp.deload&&r.p<=85) h+=`<div class="banner warn"><div>A grinder at ${r.p}% means the max is too high. Lower it rather than pushing through.</div><div><button class="btn sm" data-act="lower" data-lift="${k}" data-c="${r.c}">Lower Cycle ${r.c} max 5% (${n(floorTo(r.m.v*.95,plan.round[k]))})</button></div></div>`;
  if(ex>0&&!sets[nSets-1]&&!viewing) h+=`<div><button class="btn sm ghost" data-act="rmset" data-lift="${k}">− Remove the last set</button></div>`;
  if(isDead) h+=`<div class="small muted">Deadlift stays 1–3 sets. Rest 5 min on heavy weeks.</div>`;
  else if(r.sMax>r.s) h+=`<div class="small muted">${r.s} sets is the prescription. The dashed ones are optional — take them when you have it in you, leave them when you don’t. The two-minute rest still applies to every set you take.</div>`;
  h+=warmupLog(k,ramp(k,has?T:null,r.t,dp.deload),has?`Calculated from today's working weight (${fmtLoad(k,T)} ${u()}). Change the working weight above and the warm-ups recalculate.`:'');
  return h+`</div>`;
}
const openWarm=new Set();
function wuList(k){const W=((lg(sel).lifts||{})[k]||{}).warmup;return Array.isArray(W)?W:W?Object.keys(W).reduce((a,i)=>(a[+i]=W[i],a),[]):[]}
function warmupLog(k,sug,basis){
  const W=wuList(k), rows=Math.max(sug.length,W.length), open=openWarm.has(k)||(!sug.length&&W.length>0);
  let done=0, chips='';
  for(let i=0;i<rows;i++){const x=W[i]||{}, s=sug[i]; if(x.done) done++;
    const w=x.w!=null&&x.w!==''?x.w:s&&s.w, r=x.r!=null&&x.r!==''?x.r:s&&s.r;
    if(w!=null) chips+=`<span class="chipw${x.done?' on':''}">${isBW(k)?fmtLoad(k,+w):n(w)}×${r??'?'}</span>`}
  let body='';
  for(let i=0;i<rows;i++){const x=W[i]||{}, s=sug[i];
    const ew=x.w!=null&&x.w!==''?+x.w:s&&s.w, pl=isBarbell(k)&&ew?platesShort(ew):'';
    body+=`<div class="wu-row"><span class="wu-lbl">${s?s.lbl:'+'+(i+1)}</span>${numIn(`lifts.${k}.warmup.${i}.w`,x.w,s?n(s.w):u(),`aria-label="Warm-up ${i+1} weight"`)}<span class="wu-x">×</span>${numIn(`lifts.${k}.warmup.${i}.r`,x.r,s?String(s.r):'reps',`aria-label="Warm-up ${i+1} reps"`)}<button class="wu-chk${x.done?' on':''}" data-act="wu" data-lift="${k}" data-i="${i}" aria-pressed="${!!x.done}" aria-label="Warm-up ${i+1} done">✓</button>${s?'<span></span>':`<button class="wu-rm" data-act="wurm" data-lift="${k}" data-i="${i}" aria-label="Remove warm-up ${i+1}">×</button>`}${pl?`<span class="wu-pl">${pl}</span>`:''}</div>`}
  return `<details class="wu" data-lift="${k}"${open?' open':''}><summary><span class="wu-t">Warm-up${rows?` ${done}/${rows}`:''}</span>${chips||'<span class="muted">none logged</span>'}</summary><div class="wu-body">${sug.length?`<div class="small muted">${basis?basis+' ':''}Tap ✓ to log a set as suggested, or type what you actually used.</div>`:'<div class="small muted">Enter a target weight above to get calculated warm-ups.</div>'}${viewing?'':`<div class="restsel"><span>Rest between warm-ups</span><div class="seg">${WARM_RESTS.map(v=>`<button class="segb${warmRestSecs(k)===v?' on':''}" data-act="warmrest" data-lift="${k}" data-v="${v}" aria-pressed="${warmRestSecs(k)===v}">${warmRestLabel(v)}</button>`).join('')}</div></div>`}${body}<div><button class="btn sm ghost" data-act="wuadd" data-lift="${k}">+ Add warm-up set</button></div></div></details>`;
}
