/* ---------------- views ---------------- */
// A thrown error in any view used to leave a blank page. Now it leaves a banner you can
// read, copy and reload from. See 06a-crash.js.
function render(){
  try{ renderMain() }
  catch(err){
    crashLog(err,'render');
    try{ document.getElementById('main').innerHTML=crashHtml(err) }catch(e2){}
  }
}
function renderMain(){
  // Focus and the caret used to be saved here and put back after the innerHTML swap.
  // morph() does not disturb them, so there is nothing to save -- except where it
  // cannot morph at all, which is the test harness, and there nothing has focus.
  const a=document.activeElement, aid=a&&a.id, pos=a&&typeof a.selectionStart==='number'?a.selectionStart:null;
  // The Admin tab exists in the markup for everyone and is shown to nobody until the
  // server says otherwise. If a stored view points at it and this address is not an
  // administrator, fall back rather than render a screen that will only refuse.
  if(view==='admin'&&!amAdmin&&loaded) view='setup';
  const ab=document.querySelector&&document.querySelector('#nav button[data-view="admin"]');
  if(ab) ab.hidden=!amAdmin;
  /* Seven tabs do not fit a phone -- at 390px the row is about 480px wide -- so `nav`
     scrolls sideways. Which is fine until the tab you are on is the one off the end:
     Guide sits last, so opening it from the account menu used to leave the row still
     showing Today and no sign of where you were. Bring the current one into view. */
  document.querySelectorAll('#nav button').forEach(b=>{
    const on=b.dataset.view===view;
    b.setAttribute('aria-current',on?'page':'false');
    if(on&&!b.hidden&&b.scrollIntoView) try{ b.scrollIntoView({block:'nearest',inline:'nearest'}) }catch(e){}
  });
  const m=document.getElementById('main');
  m.classList.toggle('ro',!!viewing);
  if(wz&&!viewing){ if(!morph(m,vWelcome())&&aid){const el=document.getElementById(aid);if(el)el.focus({preventScroll:true})} return }
  const html=copyBox()+archiveBanner()+(['status','plan','history'].includes(view)?programPicker():'')+({today:vToday,status:vStatus,plan:vPlan,releases:vReleases,history:vHistory,setup:vSetup,coach:vCoach,guide:vGuide,admin:vAdmin}[view]||vToday)();
  // Only the fallback path needs focus putting back; morph never took it away.
  if(!morph(m,html)&&aid){const el=document.getElementById(aid); if(el){el.focus({preventScroll:true}); try{if(pos!=null&&el.setSelectionRange)el.setSelectionRange(pos,pos)}catch(e){}}}
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
  h+=`<div class="wkline"><b>${wt.t}</b><span class="chip ${wt.cls}">${wt.chip}</span>${dp.plyo||dp.t==='plyobase'?`<span class="small muted">Plyo: ${plyoPhase(wk).name} · ~${dp.plyoCut||(lg(sel).plyo||{}).cut?Math.round(plyoPhase(wk).target/2):plyoPhase(wk).target} contacts</span>`:''}${wk.inserted?'<span class="chip">Added</span>':''}${isReordered(mon)?'<span class="chip blue">Days moved</span>':''}${!viewing&&dp.t!=='pre'?`<button class="btn sm ghost" style="margin-left:auto" data-act="move">Move…</button>`:''}</div>`;
  if(moveOpen&&!viewing) h+=moveCard();
  h+=noteCard(sel);
  h+=aimsCard(sel);
  h+=debriefCard();
  h+=weekSummaryCard();
  h+=weeklyCard();
  h+=prCard(sel);
  h+=finishCard(sel,dp);
  h+=banners(wk,dp);
  if(sel===todayStr()){const rc=reviewCycleFor(sel);if(rc) h+=reviewCard(rc);const dc=deloadCheckCycle(sel);if(dc) h+=deloadCheckCard(dc)}
  h+=checkinCard(sel);
  // The pre-training ones have a window in front of the session, so they go above it;
  // the daily tick-list sits with the rest of the day's logging, below.
  if(!['off','pre','convert'].includes(dp.t)) h+=suppCard(sel,'pre');
  h+=suppCard(sel,'daily');
  h+=dayHtml(wk,sel);
  h+=addonCard(sel);
  return h;
}
/* ---------------- moving a session ----------------
One thing, done one way: pick the day, the session goes there, nothing else changes.

What this replaces is worth remembering. There were three mechanisms -- swap two days,
shift the week around a request, and stack one day onto another -- because the data
model was a permutation and a straight move could not be said in it. Every one of them
moved something the person had not asked about, and between them they refused more than
they allowed. The model holds dates now, so there is one verb and it never refuses. */
function moveTargets(date){
  // A fortnight either side. Far enough for "I'll pick it up next week", short enough
  // that the list is still a list.
  const out=[]; for(let i=-7;i<=14;i++){ const d=addDays(date,i); if(idxOf(d)>=0) out.push(d) }
  return out;
}
function moveWarn(date,ss){
  const out=[], at=dayPlans(date).filter(x=>!(x.sess.monday===ss.monday&&x.sess.slot===ss.slot));
  const me=dayPlanSlot(ss.home,ss.slot), mk=stackKindOf(me);
  if(at.some(x=>stackKindOf(x)===mk&&mk==='lift')) out.push('Two lifting sessions in one day is a lot of barbell work at once. Do the heavier one first and cut the accessories on the second.');
  else if(at.length&&mk==='lift') out.push('Lifting goes first, then the conditioning.');
  else if(at.length) out.push(`${DAYN[dow(date)]} already has a session. Both will be listed, in that order.`);
  const near=[addDays(date,-1),addDays(date,1)];
  if(mk==='lift'&&near.some(d=>dayPlans(d).some(x=>stackKindOf(x)==='lift'&&!(x.sess.monday===ss.monday&&x.sess.slot===ss.slot))))
    out.push('That puts lifting on back-to-back days. The book asks you not to, so keep one of them light.');
  return out;
}
/* The card for sessions that were not prescribed. It sits at the bottom of the day,
   under whatever the program asked for, because that is the order they happen in and
   because it must never be mistaken for the session. */
function addonCard(date){
  if(viewing) return '';
  const list=addonsOf(date);
  let h=`<div class="card"><div class="lift-h"><h3>Anything else today</h3>${list.length?`<span class="chip">${list.length}</span>`:''}</div>`;
  if(!list.length) h+=`<p class="note" style="margin:0">A ride that was not on the plan, a second lifting session, a class. It counts toward your conditioning minutes and your records, and it is left out of how the program itself is going.</p>`;
  list.forEach((a,i)=>{
    h+=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px">
      <div class="row between"><b>${esc(addonLabel(a))}</b><button class="btn sm ghost" data-act="addondel" data-i="${i}" aria-label="Remove this session">Remove</button></div>`;
    if(a.kind==='cond'){
      const M=MOD[a.mod]||MOD[defMod()], met=metricFor(a.mod,a.fmt);
      h+=`<div class="grid2">
        <label class="f">Activity<select id="in-addon-mod-${i}" data-bind="addons.${i}.mod">${Object.entries(MOD).map(([k,x])=>`<option value="${k}"${k===a.mod?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="f">Kind<select id="in-addon-fmt-${i}" data-bind="addons.${i}.fmt">${Object.entries(HIC).map(([k,x])=>`<option value="${k}"${k===a.fmt?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>
      <div class="grid2"><label class="f">Minutes${numIn('addons.'+i+'.min',a.min)}</label>
        ${met?`<label class="f">${esc(metricLabel(met))}${numIn('addons.'+i+'.val',a.val)}</label>`:`<label class="f">What it was<input type="text" id="in-addon-what-${i}" data-bind="addons.${i}.what" value="${esc(a.what||'')}" placeholder="e.g. five-a-side"></label>`}</div>
      ${M&&M.elev?`<label class="f">Elevation gain (${esc(elevUnit())})${numIn('addons.'+i+'.elev',a.elev)}</label>`:''}
      ${met&&a.mod==='other'?`<label class="f">What it was<input type="text" id="in-addon-what-${i}" data-bind="addons.${i}.what" value="${esc(a.what||'')}" placeholder="e.g. five-a-side"></label>`:''}`;
    } else {
      const sets=addonSets(a);
      h+=`<label class="f">Exercise<input type="text" id="in-addon-what-${i}" data-bind="addons.${i}.what" value="${esc(a.what||'')}" placeholder="e.g. Incline bench, or Upper body"></label>
      ${sets.map((st,j)=>`<div class="row" style="gap:6px;align-items:flex-end"><label class="f" style="flex:1">Weight${numIn('addons.'+i+'.sets.'+j+'.w',st.w)}</label><label class="f" style="flex:1">Reps${numIn('addons.'+i+'.sets.'+j+'.r',st.r)}</label><button class="btn sm ghost" data-act="addonsetdel" data-i="${i}" data-j="${j}" aria-label="Remove set ${j+1}">\u2715</button></div>`).join('')}
      <div><button class="btn sm" data-act="addonsetadd" data-i="${i}">Add a set</button></div>`;
    }
    h+=`<label class="f">Notes<input type="text" id="in-addon-note-${i}" data-bind="addons.${i}.note" value="${esc(a.note||'')}" placeholder="How it went"></label></div>`;
  });
  h+=`<div class="row" style="gap:6px;margin-top:12px"><button class="btn" data-act="addon" data-kind="cond">Add cardio</button><button class="btn" data-act="addon" data-kind="lift">Add a lifting session</button></div>`;
  if(list.length) h+=`<div class="note">These sit outside the program. They feed your conditioning minutes, your records and the climbing total; they do not change your maxes, the end-of-cycle review, or whether the program counts as followed.</div>`;
  return h+`</div>`;
}
let moveOpen=false;
function moveCard(){
  const here=dayPlans(sel), mon=mondayOf(sel);
  let h=`<div class="card"><div class="lift-h"><h3>Move a session</h3><button class="btn sm ghost" data-act="movex">Close</button></div>`;
  if(!here.length) h+=`<p class="note" style="margin:0">Nothing on ${DAYN[dow(sel)]} to move. Open the day a session is on and move it here.</p>`;
  here.forEach(dp=>{
    const ss=dp.sess, name=dp.short||'Session';
    h+=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px">
      <div class="row between"><b>${esc(name)}</b>${dp.moved?`<button class="btn sm ghost" data-act="moveback" data-mon="${esc(ss.monday)}" data-sl="${ss.slot}">Back to ${esc(DAYN[dow(ss.home)])} ${esc(fmtD(ss.home,true))}</button>`:''}</div>
      ${dp.moved?`<div class="small muted">Moved here from ${esc(fmtLong(ss.home))}.</div>`:''}
      <div class="row wrap" style="gap:6px">`;
    for(const d of moveTargets(sel)){
      if(d===sel) continue;
      const w=moveWarn(d,ss), near=Math.abs(Math.round((D(d)-D(sel))/864e5))<=7;
      if(!near&&!dayPlans(d).length&&mondayOf(d)===mon) continue;
      h+=`<button class="btn sm${w.length?'':' '}" data-act="moveto" data-mon="${esc(ss.monday)}" data-sl="${ss.slot}" data-to="${esc(d)}" title="${esc(w[0]||'')}">${esc(DAYN[dow(d)])} ${esc(fmtD(d,true))}${w.length?' <span aria-hidden="true">\u26a0</span>':''}</button>`;
    }
    h+=`</div></div>`;
  });
  h+=`<div class="note" style="margin-top:12px">Only the session you pick moves. Nothing else in the week changes, a day can hold more than one, and a day with none is a rest day. A \u26a0 means it is allowed but worth knowing about \u2014 hold the button to read it.</div>`;
  if(isReordered(mon)) h+=`<div><button class="btn sm ghost" data-act="ordreset">Put this week back as it was</button></div>`;
  h+=plyoMovePicker(mon);
  return h+`</div>`;
}
// Plyos ride along with whichever day you put them on, so they get their own picker
// rather than taking part in the session shuffle above.
function plyoMovePicker(mon){
  const wk=weekOf(mon); if(!weekHasPlyo(wk)) return '';
  const cur=plyoDow(mon);
  let h=`<div class="divider">Plyometrics</div><p class="note" style="margin:0">Plyos aren’t part of a session. Put them on any day — they run before the conditioning if they land on a conditioning day, and stand alone if they don’t.</p>
  <div class="row wrap" style="gap:6px">`;
  for(let d=0;d<7;d++){
    const open=plyoDayOpen(mon,d);
    h+=`<button class="btn sm${d===cur?' primary':''}" data-act="plyoday" data-d="${d}" ${open?'':'disabled'} aria-pressed="${d===cur}">${DAYN[d]}</button>`;
  }
  h+=`</div>`;
  if(plyoMoved(mon)) h+=`<div class="small muted">Moved off ${DAYN[(+plan.plyoDow>=0&&+plan.plyoDow<=6?+plan.plyoDow:3)]} for this week only.</div>`;
  return h;
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
        bits.push(`${liftName(k,date)} ${dn}/${nS}${r.sMax>nS?'+':''}${ground(x)?' · ground':''}`); if(dn<nS) gaps.push(`${liftName(k)}: ${nS-dn} set${nS-dn>1?'s':''} unticked`);}
      else if(t.w!=null&&t.w!=='') bits.push(`${liftName(k,date)} ${isBW(k)?fmtLoad(k,+t.w):n(t.w)} × ${t.r||'?'}`);
    }
    const w=(L.warmup||[]).filter(Boolean).length; if(w) bits.push(`warm-up ${w} done`);
  }
  if(dp.t==='hic'||dp.cardio){
    const f=effFmt(date), mod=modOf(date), met=metricFor(mod,f), v=met?(L.hic||{})[met[0]]:null;
    if(v!=null&&v!=='') bits.push(`${MOD[mod].name} ${HIC[f].name} ${n(v)} ${met[1]}`); else gaps.push('conditioning result not logged');
  }
  if(dp.plyo||dp.t==='plyobase'){const c=(L.plyo||{}).contacts; if(c) bits.push(`${c} contacts`); if((L.plyo||{}).best||(L.plyo||{}).mark) bits.push(`broad jump ${r1((L.plyo||{}).best||(L.plyo||{}).mark)} in`)}
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
  if(inBlockCheck(sel)) h+=`<div class="banner info"><div><b>Last lifting day before a recovery week.</b> If you want to know where a lift stands, this is the day to find out — the book prefers it to a whole test week. Take one heavy-ish single above 95%, or a rep max, on one lift at the end of the session. Only if there is something you actually expect to learn.</div></div>`;
  if(wk.kind==='bridge'&&dp.t!=='convert') h+=`<div class="banner info"><div><b>Bridge week.</b> Testing and calibration, not training. Leave two reps in reserve on every test set. Sunday turns your 5RMs into maxes.</div></div>`;
  const hol=holidayOn(sel);
  if(hol&&(dp.t==='lift'||dp.t==='test')){const alt={0:'Sun or Tue',2:'Tue or Thu',3:'Wed or Fri',4:'Thu or Sat',5:'Fri or Sun'}[dow(sel)]||'an adjacent day';h+=`<div class="banner warn"><div><b>${hol}.</b> Shift this session to ${alt} if the gym is closed.</div></div>`}
  if(sel===todayStr()&&(wk.kind==='cycle')){
    const hs=hardSessions(), nm=addDays(mondayOf(sel),7), nw=weekOf(nm);
    if(hs>=2&&nw&&nw.kind==='cycle') h+=`<div class="banner alert"><div><b>${hs} hard lifting sessions in the last two weeks</b> (RPE 9+, a grinder, or missed sets). Operator is meant to stay sub-maximal. Lower the max on the lift that's grinding, or take a deload week starting ${fmtD(nm,true)}.</div><div class="row"><button class="btn sm" data-act="insert" data-kind="deload" data-monday="${nm}">Deload next week</button></div></div>`;
  }
  return h;
}
/* The mobility block and the RPE/notes footer belong to the day, not to each session
   on it, so a day holding two renders them once at the end. `solo` is false for all but
   the last, which is the only one that gets them. */
let sessSolo=true;
function sessTail(dp,active){ return sessSolo?mobCard(sel,dp)+footer(active):'' }
/* Every session on the day, in order, each rendered as it would be on its own. The
   divider says which is which, because two sessions in a day is a thing you are doing
   deliberately and the card needs to be readable at the point you are doing it. */
function dayHtml(wk,date){
  const all=dayPlans(date);
  if(all.length<2) return sessionHtml(wk,dayPlan(date));
  let h='';
  all.forEach((dp,i)=>{
    sessSolo=i===all.length-1;
    h+=`<div class="divider">${i?'Then, ':''}${esc(dp.short||'Session')}${dp.moved?` \u00b7 moved from ${esc(fmtD(dp.sess.home,true))}`:''}</div>`;
    h+=sessionHtml(wk,i?dp:Object.assign({},dp,{plyo:dayPlan(date).plyo,plyoN:dayPlan(date).plyoN,plyoCut:dayPlan(date).plyoCut}));
  });
  sessSolo=true;
  return h;
}
function sessionHtml(wk,dp){
  let h='';
  const note=dp.note?`<p class="muted small" style="margin:0">${esc(dp.note)}</p>`:'';
  // Plyos go first whatever else the day holds: they are a nervous-system stimulus and want
  // you fresh. Ten minutes between them and hard conditioning. On a day with nothing else
  // scheduled they are the session, so the rest-day copy below is skipped.
  if(dp.plyo){
    h+=plyoCard(wk,dp);
    if(['off','pre'].includes(dp.t)) return h+sessTail(dp,true);
    h+=`<div class="divider">${dp.t==='hic'?'Rest 10 min':'Then'}</div>`;
  }
  if(dp.t==='off'){ return h+`<div class="card"><h3>Rest</h3><p style="margin:0">${esc(dp.note||'Full rest. Walk, sleep, eat.')} Deep stretching belongs today if you want it — the block below is the long version.</p></div>`+sessTail(dp,false) }
  if(dp.t==='lift'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    h+=warmupCard(sel);
    for(const k of dp.lifts) h+=liftCard(wk,k,dp);
    h+=accCard(wk,dp);
    if(dp.ride||dp.cardio){
      const note=dp.condNote?`<p class="muted small" style="margin:0">${esc(dp.condNote)}</p>`:'';
      h+=`<div class="divider">Then, conditioning</div>`+(dp.ride==='se'?seCard(dp):hicCard(dp,note));
    }
    return h+sessTail(dp,true);
  }
  if(dp.t==='travel') return h+warmupCard(sel)+travelCard(dp)+sessTail(dp,true);
  if(dp.t==='hic') return h+hicCard(dp,note)+sessTail(dp,true);
  if(dp.t==='rm5'||dp.t==='test'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    if(dp.note) h+=`<div class="banner info"><div>${esc(dp.note)}</div></div>`;
    h+=warmupCard(sel);
    if(dp.jumps) h+=plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('First, before any lifting.');
    for(const k of dp.lifts) h+=testCard(k,dp.t==='rm5'?5:1,dp.t==='rm5');
    if(dp.pullups) h+=`<div class="card"><h3>Max unassisted pull-ups</h3><p class="muted small" style="margin:0">The number the Lift 3 substitution was aimed at. One all-out set, full hang to chin over bar.</p><label class="f">Reps${numIn('pullups',lg(sel).pullups,'0','class="num-in"')}</label>${bestPullups()}</div>`;
    if(dp.apply) h+=applyCard(wk);
    if(dp.cardio) h+=`<div class="divider">Then, easy</div>`+hicCard(dp,'');
    return h+sessTail(dp,true);
  }
  if(dp.t==='se') return h+warmupCard(sel)+seCard(dp)+sessTail(dp,true);
  if(dp.t==='plyobase') return h+warmupCard(sel)+plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('Baselines. Three good attempts each, keep the best.')+sessTail(dp,true);
  if(dp.t==='convert') return h+convertCard(wk)+sessTail(dp,false);
  return h;
}
function mobKind(dp){
  if(dp.t==='travel') return dp.slot==='day3'?'dead':'lift';
  if(dp.plyo||dp.t==='plyobase') return 'plyo';
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
  <p class="note" style="margin:0">Rep targets rather than percentages \u2014 a week on hotel kit keeps the habit without touching your maxes. Leave two reps in reserve, as always.</p>
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


/* Which routine, and the list it comes to. `mine` is stored the way the mobility
   lists are: an array of [name, dose] pairs edited as one textarea.

   The core pair is prepended to everything except ours, which already contains it in
   its own positions -- see WARM_CORE. Ticks are an index into whatever this returns,
   so switching routine clears the day's ticks rather than leaving them pointing at
   movements they were never ticked against. */
function warmKey(){ const k=plan.warmRoutine; return WARM_ROUTINES[k]?k:'ours' }
function warmMine(){ const a=plan.warmCustom; return Array.isArray(a)?a.filter(x=>x&&(Array.isArray(x)?x[0]:x)).map(x=>Array.isArray(x)?{n:x[0],d:x[1]||''}:{n:x,d:''}):[] }
function warmRoutine(){ return WARM_ROUTINES[warmKey()] }
function warmItems(){
  const r=warmRoutine(), items=r.items()||[];
  return r.core===false?items:WARM_CORE.concat(items);
}
function warmupCard(date){
  const W=lg(date).warmup||[], ITEMS=warmItems(), R=warmRoutine();
  // A short version is the routine's to declare, not something inferred from the items:
  // the core pair is marked short, so inferring it would offer an empty one on Agile 8.
  const hasShort=!!R.short, short=hasShort&&!!lg(date).warmShort;
  const idx=ITEMS.map((x,i)=>i).filter(i=>!short||ITEMS[i].s);
  const done=idx.filter(i=>W[i]).length;
  let rows='', g=null;
  for(const i of idx){ const x=ITEMS[i]; if(x.g!==g){g=x.g;rows+=`<h4 class="sub-h">${esc(g)}</h4>`} rows+=checkRow('warmup.'+i,W[i],x.n,x.d); }
  return `<details class="plain card" data-px="gwu"${openPx.has('gwu')?' open':''}><summary><b>Warm-up</b> \u00b7 ${esc(R.name)} \u00b7 ${done} of ${idx.length} done${short?' \u00b7 '+esc(R.short||''):(R.mins?' \u00b7 '+esc(R.mins):'')}</summary>
  <div class="stack" style="margin-top:10px">
    ${hasShort?`<div class="restsel"><span>Version</span><div class="seg"><button class="segb${short?'':' on'}" data-act="wshort" data-v="0">Full \u00b7 ${esc(R.mins)}</button><button class="segb${short?' on':''}" data-act="wshort" data-v="1">Short \u00b7 ${esc(R.short)}</button></div></div>`:''}
    ${rows}
    <div class="note">Keep static holds easy before lifting. Long aggressive holds right before heavy squats blunt force output — the deep work belongs in the mobility block at the end.</div>
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
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Strength-endurance</span><span class="rx">${C} circuit${C>1?'s':''} × ${R} reps${dp.pct?' @ '+dp.pct+'%':''}</span></div>
  <div class="note">Light resistance, high repetition, short rests. Work down the cluster, rest ${seRestSecs()?seRestSecs()+' sec':'as little as you can'} between exercises, then 2 minutes before the next circuit. Can't get all ${R} at once? Rest-pause until they're done, then move on.</div>
  <div class="restsel"><span>Cluster</span><div class="seg">${Object.entries(SE_CLUSTERS).map(([k,c])=>`<button class="segb${k===key&&!edited?' on':''}" data-act="secl" data-v="${k}" aria-pressed="${k===key&&!edited}">${c.name}</button>`).join('')}</div>${edited?`<span class="chip blue">Changed for today</span><button class="btn sm ghost" data-act="sereset">Back to ${esc(SE_CLUSTERS[key].name)}</button>`:''}</div>`;
  if(!ex.length) return h+`<div class="banner warn"><div class="small">No exercises in your own cluster yet. Add five to eight in <b>Setup → Strength-endurance</b>, or pick one of the book's above.</div></div></div>`;
  h+=`<div class="setbl">${ex.map((name,i)=>`<div class="serow"><button class="sename" data-act="seedit" data-i="${i}" aria-expanded="${seEdit===i}">${esc(name)}<span class="swap">swap</span></button><div class="sets">${Array.from({length:C},(_,j)=>`<button class="setb sm${(done[i]||[])[j]?' on':''}" data-act="setick" data-i="${i}" data-j="${j}" aria-pressed="${!!(done[i]||[])[j]}">${R}<small>${j+1}</small></button>`).join('')}</div>${seEdit===i?seSwap(i,name,ex):''}</div>`).join('')}</div>
  <div><button class="btn sm ghost" data-act="seadd">+ Add an exercise</button></div>
  <div class="row between"><span class="small muted">${ticks} of ${total} sets</span><span class="small muted">${esc(SE_CLUSTERS[key].note)}</span></div>
  <div class="restsel"><span>Rest between exercises</span><div class="seg">${SE_RESTS.map(v=>`<button class="segb${seRestSecs()===v?' on':''}" data-act="serest" data-v="${v}">${v?v+'s':'none'}</button>`).join('')}</div></div>
  ${dp.pct?`<div class="note">Today is <b>${dp.pct}% of your one-rep max</b> on each lift — the block's own number, not a range to guess at. Reps first, not load: get in the ballpark and err lighter. Failing partway through a set is normal here, so take a breather and make up the difference.</div>`
    :key==='bar'||key==='db'||key==='kb'?`<div class="note">Use roughly 15–30% of your one-rep max. Don't test for it, and if it feels heavy take weight off.</div>`:''}
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
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${r.top?'Best '+r.r+' of the day':`${setLbl} × ${r.r} @ ${r.p}%${plan.basis==='tm'?' TM':''}${r.amrap?' +':''}`}</span></div>`;
  // Tactical Barbell III finishes some weeks on an all-out set, and some of its days
  // carry a note of their own. Both come off the prescription, not off the day type.
  /* A Back "Break" day has no percentage to work from: you climb to the best set you
     have today, and the down sets are a share of that rather than of a 1RM. */
  if(r.top) h+=`<div class="banner info"><div class="small"><b>Work up to your best ${r.r} for today.</b> Warm up, then climb in sets of ${r.r} until you reach the heaviest one you can do with absolutely perfect form. It may take a few attempts to find it, and it is a best for <i>today</i>, not a record to chase.${r.down?` Then, <b>optional</b>: ${r.down===1?'one set':'one to '+({2:'two',3:'three'}[r.down]||r.down)+' sets'} of ${r.r} at ${r.downPct}% of what you just lifted. Only if you are feeling good — the down sets are not the hill to die on.`:''}</div></div>`;
  if(r.amrap) h+=`<div class="banner info"><div class="small"><b>Last set: as many reps as you can.</b> Keep the same weight and keep going past ${r.r}. Stop with something left — this is not a grinder.</div></div>`;
  if(r.note) h+=`<div class="small muted">${esc(r.note)}</div>`;
  if(VARS[k]&&!viewing){
    const V=varsOf(k), v=r.vr, cur=V[v];
    h+=`<label class="restsel"><span>This session</span><select class="varsel" data-act-var="${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===v?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    if(v!==varRef(k)) h+=`<div class="small muted">${esc(cur.note)}</div>`;
  }
  if(L3K.includes(k)&&l3On().length>1) h+=`<div class="restsel"><span>This session</span><div class="seg">${l3On().map(v=>`<button class="segb${v===k?' on':''}" data-act="l3swap" data-v="${v}" aria-pressed="${v===k}">${esc(liftName(v))}</button>`).join('')}</div></div>`;
  if(has){
    h+=`<div class="row between"><div class="big">${fmtLoad(k,T)}<small>${isBW(k)?(T>0?u()+' added':'bodyweight'):u()}</small></div><div class="stack small" style="text-align:right;gap:2px">${bar?`<span class="plates">${plates(T)}</span>`:''}${r.w&&T!==r.w?`<span class="chip mid" style="align-self:flex-end">Prescribed ${n(r.w)}</span>`:''}<span class="muted">${r.m?`Max ${isBW(k)?'+'+n(r.m.v):n(r.m.src==='ratio'?Math.round(r.m.v):r.m.v)} · Cycle ${r.c}${r.m.src==='proj'?' (projected)':''}`:''}</span></div></div>`;
    if(bar) h+=plateSvg(T);
    if(r.m&&r.m.src==='ratio') h+=`<div class="note"><b>Swapped for this session.</b> This cycle is built on the ${esc(varsOf(k)[r.m.bv].name.toLowerCase())}, so the weight is your ${n(r.m.from)} max at the ${Math.round(r.m.r*100)}% a ${esc(varsOf(k)[r.vr].name.toLowerCase())} usually carries against it. Change the lift for the whole cycle in Setup instead if this is not a one-off.</div>`;
    if(isBW(k)) h+=`<div class="note">${T>0?`Hang ${n(T)} ${u()} from a belt. `:'Today’s percentage is at or below your bodyweight: do bodyweight reps. '}Based on ${r1(bwFor(sel))} ${u()} bodyweight${(bwAvg(sel,7)||{}).n>1?' (7-day average)':''}.</div>`;
    if(k==='pull'&&plan.machineNote) h+=`<div class="small muted">Machine: ${esc(plan.machineNote)}</div>`;
  } else h+=`<div class="muted">${isBW(k)&&r.m&&!bwFor(sel)?'Enter your bodyweight (Setup or the daily check-in) to calculate the added weight.':`No max entered for ${esc(liftName(k))}. Add it in Setup.`}</div>`;
  h+=`<div class="sets">`;
  for(let i=0;i<nSets;i++) h+=`<button class="setb${sets[i]?' on':''}${popKey===k+':'+i?' pop':''}${i>=r.s?' opt':''}" data-act="set" data-lift="${k}" data-i="${i}" aria-pressed="${!!sets[i]}" aria-label="Set ${i+1}${setEff(L,i)?', '+setEff(L,i):''}">${r.r}<small>${setEff(L,i)?EFFORT.find(([v])=>v===setEff(L,i))[1]:'Set '+(i+1)}</small></button>`;
  if(!viewing&&nSets<SETCAP(r)) h+=`<button class="setb add" data-act="addset" data-lift="${k}" aria-label="Add a set to ${esc(liftName(k))}">+<small>Set</small></button>`;
  const ex=+L.extra||0;
  const rm=restMins(k), heavyNote=(k==='squat'||k==='dead')&&r.t==='heavy'&&rm<5;
  h+=`</div><div class="restsel"><span>Rest</span><div class="seg">${[2,3,4,5].map(m=>`<button class="segb${rm===m?' on':''}" data-act="restmin" data-lift="${k}" data-v="${m}" aria-pressed="${rm===m}">${m} min</button>`).join('')}</div>${heavyNote?'<span>Heavy week: the book calls 5\u201310 min normal at this load.</span>':''}</div>`;
  // How the most recent set moved, rated where it was just ticked. The whole-lift
  // checkbox it replaces only shows on a day that already used it, so it can be cleared.
  { let last=-1; for(let i=nSets-1;i>=0;i--) if(sets[i]){ last=i; break }
    if(last>=0&&!viewing) h+=`<div class="restsel"><span>Set ${last+1} moved</span><div class="seg">${EFFORT.map(([v,t])=>`<button class="segb${setEff(L,last)===v?' on':''}" data-act="eff" data-lift="${k}" data-i="${last}" data-v="${v}" aria-pressed="${setEff(L,last)===v}">${t}</button>`).join('')}</div></div>`; }
  h+=`<div class="row between">${L.grinder?`<label class="check"><input type="checkbox" id="g-${k}" data-bind="lifts.${k}.grinder" checked> Whole lift marked a grinder</label>`:'<span></span>'}<label class="f" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px">${isBW(k)?'Added weight':'Working weight'}${numIn('lifts.'+k+'.used',L.used,r.w!=null?n(isBW(k)?Math.max(0,r.w):r.w):'','class="num-in"')}</label></div>`;
  if(ground(L)&&r.m&&!dp.deload&&r.p<=85) h+=`<div class="banner warn"><div>A grinder at ${r.p}% means the max is too high. Lower it rather than pushing through.</div><div><button class="btn sm" data-act="lower" data-lift="${k}" data-c="${r.c}">Lower Cycle ${r.c} max 5% (${n(floorTo(r.m.v*.95,plan.round[k]))})</button></div></div>`;
  if(ex>0&&!sets[nSets-1]&&!viewing) h+=`<div><button class="btn sm ghost" data-act="rmset" data-lift="${k}">− Remove the last set</button></div>`;
  if(isDead) h+=`<div class="small muted">Deadlift stays 1–3 sets. Rest 5 min on heavy weeks.</div>`;
  else if(r.sMax>r.s) h+=`<div class="note">${r.s} sets is the prescription. The dashed ones are optional — take them when you have it in you, leave them when you don’t. The two-minute rest still applies to every set you take.</div>`;
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
