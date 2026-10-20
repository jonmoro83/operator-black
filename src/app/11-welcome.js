/* ---------- welcome setup ---------- */
// Guided first run for a new person (no saved plan, no logs), or re-run from Setup.
let wz=null;
function st0Saved(){return !!plan.onboarded}
function nextMonday(){const t=realToday();return dow(t)===0?t:addDays(mondayOf(t),7)}
function wzNew(rerun){
  return {rerun:!!rerun,step:0,unit:plan.unit||'lb',bw:plan.bodyweight||'',l3:Object.assign({pull:true,ohp:false,wpu:false},rerun?(plan.l3||{}).on:{}),
    start:rerun?plan.startMonday:nextMonday(),mode:rerun&&!plan.bridge?'maxes':'bridge',rm:'1rm',maxes:rerun?clone(plan.maxes):{},cardio:defMod(),deload:rerun?(+plan.deloadEvery||0):0,test:rerun?(+plan.testEvery||0):3,
    stempl:rerun?stemplKey():'operator',cproto:rerun?cprotoKey():'black',bb:false,
    plyo:rerun?plan.plyoOn!==false:true,plyoDow:rerun?plyoDowDefault():3,
    plyoPer:rerun?plyoPerWeek():1,plyoDow2:rerun?plyoDow2():6};
}
const WZ_STEPS=['You','Program','Lift 3','Start','Conditioning','Plyos','Deloads','Ready'];
function vWelcome(){
  const w=wz, steps=WZ_STEPS.map((t,i)=>`<span class="chip${i===w.step?' blue':i<w.step?' light':''}">${i+1}. ${t}</span>`).join('');
  let h=`<div class="card"><div class="lift-h"><h2>${w.rerun?'Welcome setup':'Welcome to Operator + Black'}</h2>${w.rerun?'':'<button class="btn sm ghost" data-act="wzskip">Skip</button>'}</div><div class="row" style="gap:6px">${steps}</div>`;
  const on=L3K.filter(k=>w.l3[k]);
  if(w.step===0){
    h+=`<p style="margin:0">A training log for Tactical Barbell’s <b>Operator</b> (squat, bench and a third lift, three days a week, never near failure) and the <b>Black</b> conditioning protocol (three hard cardio sessions a week), plus plyometrics on Thursdays. It works out your weights, rest and intervals.</p>
    <div class="grid2"><label class="f">Units<div class="seg">${['lb','kg'].map(x=>`<button class="segb${w.unit===x?' on':''}" data-act="wzset" data-k="unit" data-v="${x}">${x}</button>`).join('')}</div></label><label class="f">Bodyweight (${w.unit}, optional)<input type="number" inputmode="decimal" step="any" id="wz-bw" data-wz="bw" value="${w.bw??''}"></label></div>
    <div class="small muted">Bodyweight is used for protein targets and weighted pull-ups.</div>`;
  } else if(w.step===1){
    h+=`<p style="margin:0">Two choices, and the week is built from them. Everything here is from the books \u2014 the app only arranges it.</p>
    <label class="f">Strength template<div class="stack">${Object.entries(STEMPL).map(([k,T])=>`<button class="btn${w.stempl===k?' primary':''}" style="justify-content:flex-start;text-align:left;height:auto;padding:10px 12px" data-act="wzset" data-k="stempl" data-v="${k}"><span><b>${w.stempl===k?'\u2713 ':''}${esc(T.name)}</b> <span class="small">\u00b7 ${tplDays(T,{w:1}).length} days \u00b7 ${esc(T.book)}</span><br><span class="small">${esc(T.blurb)}</span></span></button>`).join('')}</div></label>
    <label class="f">Conditioning protocol<div class="stack">${Object.entries(CPROTO).map(([k,P])=>`<button class="btn${w.cproto===k?' primary':''}" style="justify-content:flex-start;text-align:left;height:auto;padding:10px 12px" data-act="wzset" data-k="cproto" data-v="${k}"><span><b>${w.cproto===k?'\u2713 ':''}${esc(P.name)}</b> <span class="small">\u00b7 ${esc(P.book)}</span><br><span class="small">${esc(P.blurb)}</span></span></button>`).join('')}</div></label>
    <label class="check"><input type="checkbox" id="wz-bb" data-act-change="wzbb" ${w.bb?'checked':''}> Start with <b>Base Building</b> first</label>
    <div class="note">Tactical Barbell II\u2019s Block I: eight weeks of aerobic base and strength-endurance before you go near a heavy barbell cycle. The book\u2019s advice is to do it first if you have not built that base, and once or twice a year after.</div>
    ${wzWarnings(w)}`;
  } else if(w.step===2){
    h+=`<p style="margin:0">Monday and Wednesday include a third lift. Pick the ones you’ll use; with more than one, you can swap on any day.</p>
    <div class="stack">${L3K.map(k=>`<button class="btn${w.l3[k]?' primary':''}" style="justify-content:flex-start" data-act="wzl3" data-v="${k}">${w.l3[k]?'✓ ':''}${esc(liftName(k))}${k==='wpu'?' <span class="small">(once you can do a strict pull-up)</span>':''}</button>`).join('')}</div>`;
  } else if(w.step===3){
    const lifts=['squat','bench',...on,'dead'];
    h+=`<label class="f" style="max-width:260px">Start the week of<input type="date" id="wz-start" data-wz="start" value="${w.start}"></label>
    <div class="stack">
      <button class="btn${w.mode==='bridge'?' primary':''}" style="justify-content:flex-start;text-align:left" data-act="wzset" data-k="mode" data-v="bridge">${w.mode==='bridge'?'✓ ':''}Start with a bridge week: test your 5-rep maxes over one easy week (recommended)</button>
      <button class="btn${w.mode==='maxes'?' primary':''}" style="justify-content:flex-start;text-align:left" data-act="wzset" data-k="mode" data-v="maxes">${w.mode==='maxes'?'✓ ':''}I know my maxes: start Cycle 1 straight away</button>
    </div>`;
    if(w.mode==='maxes') h+=`<div class="seg">${[['1rm','1-rep maxes'],['5rm','5-rep maxes']].map(([v,l])=>`<button class="segb${w.rm===v?' on':''}" data-act="wzset" data-k="rm" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="grid4">${lifts.map(k=>`<label class="f">${esc(liftName(k))}${isBW(k)?' (added)':''}<input type="number" inputmode="decimal" step="any" id="wz-m-${k}" data-wz="maxes.${k}" value="${w.maxes[k]??''}"></label>`).join('')}</div>
      ${w.rm==='5rm'?'<div class="small muted">5-rep maxes are converted to 1-rep maxes (÷ 0.87).</div>':''}`;
    else h+=`<div class="note">The bridge week tests two lifts per test day, then converts your 5-rep maxes into Cycle 1’s numbers on Sunday.</div>`;
    if(w.rerun) h+=`<div class="banner warn"><div class="small">Changing the start week or bridge choice re-plans your whole calendar, locked weeks included.</div></div>`;
  } else if(w.step===4){
    h+=`<label class="f">Main conditioning tool<div class="seg">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<button class="segb${w.cardio===k?' on':''}" data-act="wzset" data-k="cardio" data-v="${k}">${x.name}</button>`).join('')}</div></label>
    <div class="note">Three hard sessions a week, all on this by default. You can switch activity on any single day — sprints, rower, ruck, hike, swim and more — and the app compares results only against the same activity.</div>`;

  } else if(w.step===5){
    h+=`<p style="margin:0">Jumps and bounds, 15 to 20 minutes of real work, in three-week phases. A nervous-system stimulus rather than a workout — quality of each rep matters far more than how many.</p>
    <label class="check"><input type="checkbox" id="wz-plyo" data-act-change="wzplyo" ${w.plyo?'checked':''}> Schedule plyometrics</label>
    <div class="small muted">Leave it off if you would rather not; you can turn it on later in Setup.</div>
    ${w.plyo?`<label class="f">Sessions a week<div class="seg">${[[1,'One'],[2,'Two, shorter']].map(([v,l])=>`<button class="segb${w.plyoPer===v?' on':''}" data-act="wzset" data-k="plyoPer" data-v="${v}">${l}</button>`).join('')}</div></label>
      <div class="small muted">${w.plyoPer===2?'The week\u2019s contacts split across the two rather than doubling, so it is the same work with fresher reps in it. Two a week is the usual recommendation, with 48 to 72 hours between.':'One session with the whole phase target in it.'}</div>
      <label class="f">${w.plyoPer===2?'Which two days':'Which day'}${plyoDayRow(w.plyoPer===2?[w.plyoDow,w.plyoDow2]:[w.plyoDow],w.plyoPer,'wzplyoday')}</label>
      ${w.plyoPer===2?'<div class="note">Both are lit, numbered in the order the week runs them. Tapping a third replaces whichever you picked longer ago.</div>':''}
      <div class="note">They go first on whatever day you pick, and you can move one a week at a time from the Move… button on any day.</div>
      ${wzPlyoWarn(w)}`:''}`;
  } else if(w.step===6){
    h+=`<p style="margin:0">How the block itself runs. Both of these apply to the whole program, not just one part of it.</p>
    <label class="f">Scheduled deload week<div class="seg">${DELOAD_OPTS.map(([v,l])=>`<button class="segb${w.deload===v?' on':''}" data-act="wzset" data-k="deload" data-v="${v}">${l}</button>`).join('')}</div></label>
    <div class="note">A deload week drops to ${plan.deload.s}×${plan.deload.r} @ ${plan.deload.p}%, swaps conditioning to easy steady work, halves plyos and skips accessories. <b>As needed</b> schedules none: the app still offers one when your check-ins show low readiness or repeated hard sessions, and you can add one from the Plan tab any time. Tactical Barbell doesn’t mandate a fixed deload, so this is your call.</div>
    <label class="f">Retest week<div class="seg">${[[0,'Never'],[2,'Every 2 cycles'],[3,'Every 3 cycles'],[4,'Every 4 cycles']].map(([v,l])=>`<button class="segb${w.test===v?' on':''}" data-act="wzset" data-k="test" data-v="${v}">${l}</button>`).join('')}</div></label>
    <div class="note">A retest week takes three easy days, then heavy singles across two days, and feeds the results into the next cycle. Every 3 cycles matches the 18-week block.</div>
    <div class="small muted">The app checks in every second cycle to ask whether the deload setting still fits.</div>`;
  } else {
    const lifts=['squat','bench',...on,'dead'];
    h+=`<dl class="kv"><dt>Units</dt><dd>${w.unit}${w.bw?' · bodyweight '+esc(w.bw):''}</dd><dt>Lift 3</dt><dd>${on.map(liftName).map(esc).join(', ')}</dd><dt>Starts</dt><dd>${fmtLong(mondayOf(w.start))} · ${w.mode==='bridge'?'bridge week':'Cycle 1'}</dd>${w.mode==='maxes'?`<dt>Maxes</dt><dd>${lifts.map(k=>esc(liftName(k))+' '+(w.maxes[k]!=null&&w.maxes[k]!==''?(w.rm==='5rm'?n(floorTo(+w.maxes[k]/.87,5)):n(+w.maxes[k])):'—')).join(' · ')}</dd>`:''}<dt>Program</dt><dd>${esc(STEMPL[w.stempl].name)} + ${esc(CPROTO[w.cproto].name)}${w.bb?' \u00b7 after Base Building':''}</dd><dt>Conditioning</dt><dd>${MOD[w.cardio].name}</dd><dt>Plyos</dt><dd>${w.plyo?(w.plyoPer===2?esc(DAYN[w.plyoDow])+' and '+esc(DAYN[w.plyoDow2]):esc(DAYN[w.plyoDow])):'none'}</dd><dt>Deloads</dt><dd>${deloadLabel(w.deload).toLowerCase()}${w.test?' · retest every '+w.test+' cycles':' · no retest weeks'}</dd></dl>
    ${wzWarnings(w)}
    <div class="note">Everything can be changed later in Setup. Tip: turn on <b>Rest alerts</b> in Setup to get notified when a rest ends.</div>`;
  }
  h+=`<div class="row">${w.step>0?'<button class="btn" data-act="wzback">‹ Back</button>':''}${w.step<7?'<button class="btn primary" data-act="wznext">Next ›</button>':`<button class="btn primary" data-act="wzdone">${w.rerun?'Save':'Start my program'}</button>`}${w.rerun?'<button class="btn ghost" data-act="wzcancel">Cancel</button>':''}</div></div>`;
  return h;
}
// What the books say about the pairing you have picked. Shown while choosing and again
// on the summary, because the summary is the last chance to notice.
/* Setting one wizard field from a tapped button.

   A dataset value is always a string, and several of these fields are compared against
   numbers to decide what looks selected. Which keys were numeric used to be a hardcoded
   pair, so every numeric field added afterwards was stored as a string and never looked
   chosen — which is what happened to the plyo day. The field's own starting type is the
   answer, and it cannot be forgotten. */
function wzSet(k,v){
  if(!wz) return false;
  wz[k]=typeof wz[k]==='number'?+v:v;
  return true;
}
function wzPlyoWarn(w){
  const ws=plyoWarnings(w.stempl,w.cproto,w.plyoDow,w.cardio,w.plyoPer===2?w.plyoDow2:null);
  if(!ws.length) return '';
  return `<div class="banner warn"><div class="small">${ws.map(x=>`<div style="margin-top:4px">${esc(x.text)}</div>`).join('')}</div></div>`;
}
function wzWarnings(w){
  const ws=programWarnings(w.stempl,w.cproto,w.bb);
  if(!ws.length) return '';
  return `<div class="banner info"><div class="small"><b>Worth knowing:</b>${ws.map(x=>`<div style="margin-top:4px">${esc(x.text)}</div>`).join('')}</div></div>`;
}
function wzFinish(){
  const w=wz, on=L3K.filter(k=>w.l3[k]); if(!on.length) on.push('pull');
  mutatePlan(p=>{
    const start=mondayOf(w.start), restart=start!==p.startMonday||(w.mode==='bridge')!==!!p.bridge;
    p.unit=w.unit; p.bar=w.unit==='kg'?20:45; if(w.bw!==''&&w.bw!=null) p.bodyweight=+w.bw;
    p.l3=Object.assign({},p.l3||{},{on:Object.fromEntries(L3K.map(k=>[k,on.includes(k)])),primary:on[0]});
    p.cardio=Object.assign({},p.cardio||{},{def:w.cardio}); p.deloadEvery=w.deload; p.testEvery=w.test;
    p.startMonday=start; p.bridge=w.mode==='bridge';
    p.stempl=w.stempl; p.cproto=w.cproto;
    p.plyoOn=!!w.plyo;
    if(w.plyo){ p.plyoDow=+w.plyoDow; p.plyoPerWeek=+w.plyoPer===2?2:1; p.plyoDow2=+w.plyoDow2 }
    // Base Building goes after the bridge week when there is one: the bridge is what
    // gives Base Building's two strength days their numbers.
    if(w.bb){ const at=w.mode==='bridge'?addDays(start,7):start;
      p.inserts=Object.assign({},p.inserts,{[at]:'bb'}); }
    if(restart){p.frozen={};p.lockedMax={}}
    if(w.mode==='maxes'){const m={};for(const k of LK){const v=w.maxes[k];if(v!=null&&v!=='')m[k]=w.rm==='5rm'?floorTo(+v/.87,+(p.round||{})[k]||5):+v}p.maxes=Object.assign({},clone(DEF.maxes),p.maxes||{},m)}
    p.onboarded=true;
  });
  wz=null; sel=realToday(); view='today'; render(); window.scrollTo(0,0);
}
