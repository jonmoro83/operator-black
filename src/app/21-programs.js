/* ---------- programs: archive and start over ---------- */
// Logs are stored by date and programs never overlap, so a program is just a start
// date plus its plan. Archiving copies the current plan (frozen weeks, maxes, reviews
// included) into programs/<id> with an end date; nothing about the logs changes.
const PREF_KEYS=['unit','bar','bodyweight','lift3Name','machineNote','l3','acc','basis','tmPct','round','wave','inc','deloadEvery','testEvery','deload','goal','sleepTarget','proteinPerLb','rest','cardio','ivRounds','cal','accSlots','accPick','accCustom'];
let newProg=null;
// "Next deload: Mon 12/28 (after Cycle 2)" from the live calendar
function nextScheduled(kind){
  const t=realToday(), list=weeks();
  const w=list.find(x=>x.kind===kind&&addDays(x.monday,6)>=t);
  const label=kind==='deload'?'deload':'retest';
  if(!w) return 'No '+label+' weeks scheduled.';
  return 'Next '+label+': '+fmtD(w.monday,true)+(w.after?' (after Cycle '+w.after+')':'')+(w.inserted?' (added from Plan)':'')+'.';
}
function progName(p){p=p||plan;return p.programName||('Block '+(p.programSeq||1))}
function archiveList(){return Object.values(programs).sort((a,b)=>a.startMonday<b.startMonday?1:-1)}
function enterArchive(id){
  const p=programs[id]; if(!p) return;
  if(!stash) stash={plan,sel};
  plan=deepMerge(clone(DEF),p.plan); viewing=p; planV++;
  if(sel>p.end||sel<p.startMonday) sel=p.end;
  openWarm.clear(); openPx.clear(); render(); window.scrollTo(0,0);
}
function exitArchive(){
  if(!stash){render();return}
  plan=stash.plan; sel=realToday(); stash=null; viewing=null; planV++;
  render(); window.scrollTo(0,0);
}
// Days this device kept its own version of while the server had a different one.
function syncCard(){
  const list=conflicts(); if(!list.length) return '';
  const label=p=>p.startsWith('logs/')?fmtLong(p.slice(5)):p.startsWith('programs/')?'an archived program':p;
  return `<div class="card"><div class="lift-h"><h2>Changes that crossed</h2><span class="chip">${list.length}</span></div>
  <p class="small muted" style="margin:0">These days were changed on another device while this one still had changes of its own waiting to send. <b>This device\u2019s version was kept</b> and the other was dropped. That is usually what you want, but it is worth a look if something reads wrong.</p>
  <div class="stack">${list.map(c=>`<div class="banner"><div class="small"><b>${esc(label(c.path))}</b><div class="muted">noticed ${esc(fmtD(c.at.slice(0,10),true))} ${esc(c.at.slice(11,16))}</div></div></div>`).join('')}</div>
  <div class="row"><button class="btn ghost" data-act="syncclear">Dismiss</button></div>
  <div class="small muted">Only ever caused by using the app on two devices at once while one of them is offline. Noted on this device only.</div></div>`;
}

// Accessories in Setup: which jobs each day covers, what is doing each job this block
// and next, and your own additions. The picks are per cycle on purpose \u2014 they are
// programme choices, like the cluster lifts, not something to re-decide every session.
let accNew={name:'',slot:'hpull',gear:''}, accLater=false;
function accSetupCard(){
  const cyc=accCycleOf(todayStr()), all=accAll();
  const days=[['mon','Operator 1 \u00b7 Monday'],['wed','Operator 2 \u00b7 Wednesday'],['fri','Operator 3 \u00b7 Friday']];
  const later=accLater||cyc==null;              // with no cycle running there is only "later"
  let h=`<div class="card"><h2>Accessories</h2>
  <p class="small muted" style="margin:0">Each lifting day covers a few jobs and you choose what does each one. The same job can appear on more than one day with a different movement on each. Skipped automatically on heavy weeks and deloads. To change one movement for a single session, use the picker on that day\u2019s card instead.</p>`;
  if(cyc!=null) h+=`<div class="restsel"><span>Editing</span><div class="seg"><button class="segb${later?'':' on'}" data-act="acclater" data-v="0" aria-pressed="${!later}">Cycle ${cyc} (now)</button><button class="segb${later?' on':''}" data-act="acclater" data-v="1" aria-pressed="${later}">Later cycles</button></div></div>
  <div class="small muted">${later?'What a new cycle starts on. Your current block is untouched.':'This block only. Later cycles keep their own choices.'}</div>`;

  for(const [d,label] of days){
    const sl=accSlots(d), spare=Object.keys(ASLOT).filter(k=>!sl.includes(k));
    h+=`<div style="border-top:1px solid var(--line);padding-top:10px"><div class="small" style="font-weight:650">${label}</div>`;
    if(!sl.length) h+=`<div class="small muted" style="margin-top:4px">Nothing on this day.</div>`;
    for(const k of sl){
      const pick=accPickFor(d,k,later?null:cyc), list=accFor(k);
      h+=`<div style="margin-top:8px"><div class="row between" style="gap:8px"><span class="acc-role">${esc(ASLOT[k].name)}</span><button class="btn sm ghost" data-act="accslotrm" data-day="${d}" data-slot="${k}">Remove</button></div>
      <select data-act-accpick="${d}:${k}" aria-label="${esc(ASLOT[k].name)} on ${esc(label)}">${list.map(x=>`<option value="${x}"${x===pick?' selected':''}>${esc(all[x].name)}${all[x].gear?' \u00b7 '+esc(all[x].gear):''}</option>`).join('')}</select></div>`;
    }
    if(spare.length) h+=`<label class="f" style="margin-top:8px">Add a job<select data-act-accadd="${d}"><option value="">Choose\u2026</option>${spare.map(k=>`<option value="${k}">${esc(ASLOT[k].name)}</option>`).join('')}</select></label>`;
    h+=`</div>`;
  }

  const mine=accCustom();
  h+=`<div style="border-top:1px solid var(--line);padding-top:12px"><div class="small" style="font-weight:650">Your own</div>
  <p class="small muted" style="margin:2px 0 0">Anything the list is missing. It appears everywhere the built-in ones do, and syncs to your other devices.</p>
  ${mine.length?`<div class="stack" style="gap:6px;margin-top:6px">${mine.map(x=>`<div class="row between"><span class="small">${esc(x.name)} <span class="muted">\u00b7 ${esc((ASLOT[x.slot]||{}).name||x.slot)}${x.gear?' \u00b7 '+esc(x.gear):''}</span></span><button class="btn sm ghost" data-act="accmineRm" data-id="${esc(x.id)}">Remove</button></div>`).join('')}</div>`:''}
  <div class="grid3" style="margin-top:8px"><label class="f">Name<input type="text" data-accnew="name" value="${esc(accNew.name)}" placeholder="e.g. Spider curl"></label>
  <label class="f">Job<select data-accnew="slot">${Object.entries(ASLOT).map(([k,v])=>`<option value="${k}"${k===accNew.slot?' selected':''}>${esc(v.name)}</option>`).join('')}</select></label>
  <label class="f">Kit<input type="text" data-accnew="gear" value="${esc(accNew.gear)}" placeholder="e.g. EZ bar"></label></div>
  <div class="row"><button class="btn" data-act="accmineAdd"${accNew.name.trim()?'':' disabled'}>Add it</button></div></div>`;

  const legacy=Object.values(plan.acc||{}).some(a=>Array.isArray(a)&&a.length);
  if(legacy) h+=`<div class="banner info"><div class="small">Your old typed-in accessory lists have been replaced by the jobs above. Nothing was lost \u2014 they are still in your plan, and what you ticked on past days still shows on those days.</div></div>`;
  return h+`</div>`;
}

function archiveBanner(){
  if(schemaAhead) return `<div class="banner alert"><div><b>This copy of the app is out of date.</b> Your training data was last saved by a newer version, and writing to it from here could undo something. Nothing will be saved until you reload. If reloading does not help, close the app and open it again.</div><div><button class="btn sm primary" data-act="reload">Reload</button></div></div>`;
  if(!viewing) return '';
  return `<div class="banner info"><div><b>Viewing ${esc(viewing.name)}</b> · ${fmtD(viewing.startMonday)} – ${fmtD(viewing.end)} · archived, read-only</div><div><button class="btn sm primary" data-act="progexit">Back to current program</button></div></div>`;
}
function programPicker(){
  const list=archiveList(); if(!list.length) return '';
  const cur=stash?stash.plan:plan;
  return `<div class="restsel"><span>Program</span><div class="seg"><button class="segb pv${!viewing?' on':''}" data-act="progexit">${esc(progName(cur))} (current)</button>${list.map(p=>`<button class="segb pv${viewing&&viewing.id===p.id?' on':''}" data-act="progview" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>`;
}
// Maxes to carry into a new program: next cycle's if a review or retest already set
// them, otherwise the current cycle's.
function carryMaxes(){
  const wk=weekOf(realToday()); let c=1;
  if(wk) c=wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle||1);
  const cur=maxFor(c), nx=maxFor(c+1), out={};
  for(const k of LK){const pick=nx[k]&&nx[k].src==='set'?nx[k]:cur[k]; if(pick) out[k]=pick.v}
  return out;
}
function programsCard(){
  if(viewing) return '';
  const list=archiveList(), cm=carryMaxes();
  let h=`<div class="card"><h2>Programs</h2><div class="grid2"><label class="f">Current program<input type="text" id="p-pname" data-pbind="programName" value="${esc(plan.programName||'')}" placeholder="${esc(progName())}"></label><label class="f">Started<input type="text" value="${fmtLong(plan.startMonday)}" disabled></label></div>`;
  if(list.length) h+=`<div class="stack small">${list.map(p=>`<div class="row between"><span><b>${esc(p.name)}</b> <span class="muted">${fmtD(p.startMonday)}–${fmtD(p.end)}</span></span><button class="btn sm" data-act="progview" data-id="${p.id}">View</button></div>`).join('')}</div>`;
  if(!newProg) h+=`<div class="row"><button class="btn" data-act="prognew">Start a new program…</button><button class="btn ghost" data-act="wzrerun">Run welcome setup again</button></div>`;
  else {
    const carried=activeLifts().filter(k=>cm[k]!=null).map(k=>esc(liftName(k))+' '+(isBW(k)?'+':'')+n(cm[k])).join(' · ')||'no maxes yet';
    h+=`<div class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px">
    <div class="grid2"><label class="f">New program name<input type="text" id="np-name" data-np="name" value="${esc(newProg.name)}"></label><label class="f">Starts (week of)<input type="date" id="np-start" data-np="start" value="${newProg.start}"></label></div>
    <label class="check"><input type="radio" name="np-mode" id="np-carry" data-np="mode" value="carry" ${newProg.mode==='carry'?'checked':''}> <span>Carry my maxes forward <span class="small muted">(${carried})</span></span></label>
    <label class="check"><input type="radio" name="np-mode" id="np-bridge" data-np="mode" value="bridge" ${newProg.mode==='bridge'?'checked':''}> <span>Start with a bridge week and re-test <span class="small muted">(your current maxes show on test days for reference)</span></span></label>
    <p class="small muted" style="margin:0">${esc(progName())} will be archived. Its calendar, maxes, reviews and every logged session stay viewable here and from History, Status and Plan. Your settings (Lift 3, accessories, rest times, conditioning, wave and deload rules) carry over.</p>
    ${newProg.err?`<div class="banner warn"><div class="small">${esc(newProg.err)}</div></div>`:''}
    <div class="row"><button class="btn primary" data-act="progstart">${newProg.arm?'Tap again to confirm':'Archive and start '+esc(newProg.name||'new program')}</button><button class="btn ghost" data-act="progcancel">Cancel</button></div></div>`;
  }
  return h+`</div>`;
}
function startProgram(){
  const np=newProg, start=mondayOf(np.start||realToday());
  if(start<=plan.startMonday){np.err='The new program has to start after '+fmtLong(plan.startMonday)+'.';np.arm=false;render();return}
  if(start<mondayOf(realToday())){np.err='Pick this week or a later one. Past weeks belong to the current program.';np.arm=false;render();return}
  const end=addDays(start,-1), oldName=progName();
  // Stamp format and activity on this program's conditioning entries so they keep
  // their meaning once the plan that implied them is archived.
  for(const [d,L] of Object.entries(logs)) if(d>=plan.startMonday&&d<=end&&L.hic){const f=effFmt(d);if(f&&!L.hic.format)setLog(d,'hic.format',f);if(!L.hic.mod)setLog(d,'hic.mod',modOf(d))}
  let id='p-'+plan.startMonday.replace(/-/g,''); while(programs[id]) id+='b';
  programs[id]={id,name:oldName,startMonday:plan.startMonday,end,archivedAt:realToday(),plan:clone(plan)};
  queueWrite('programs/'+id,()=>programs[id]);
  const cm=carryMaxes(), keep={}; for(const k of PREF_KEYS) if(plan[k]!==undefined) keep[k]=clone(plan[k]);
  const next=deepMerge(clone(DEF),keep);
  next.startMonday=start; next.programName=np.name||('Block '+((plan.programSeq||1)+1)); next.programSeq=(plan.programSeq||1)+1;
  if(np.mode==='carry'){next.bridge=false;next.maxes=Object.assign({},clone(DEF.maxes),cm)}
  else {next.bridge=true;next.maxes=clone(DEF.maxes);next.prevMaxes=cm}
  plan=next; planV++; queueWrite('plan/main',()=>plan);
  newProg=null; sel=realToday(); view='today'; render(); window.scrollTo(0,0);
}

// Rearranging in the calendar: tap a session, tap the day to move it to, see the
// whole week previewed, then apply. calMove = {from, to, ord, moved}.
let calRe=false, calMove=null;
function calOrd(mon){return calMove&&calMove.ord&&mondayOf(calMove.from)===mon?calMove.ord:dayOrder(mon)}
function calCard(){
  const t=realToday(), thisMon=mondayOf(t);
  if(!calMonth) calMonth=(viewing?viewing.end:(sel||t)).slice(0,7);
  const y=+calMonth.slice(0,4), m=+calMonth.slice(5,7);
  const first=S(Date.UTC(y,m-1,1)), last=S(Date.UTC(y,m,0)), start=mondayOf(first);
  const rows=Math.round(((D(mondayOf(last))-D(start))/864e5)/7)+1;
  const re=calRe&&!viewing;
  let h=`<div class="card"><div class="dnav"><button class="btn sm ghost" data-act="calm" data-v="-1" aria-label="Previous month">‹</button><h2 style="flex:1;text-align:center">${MON[m-1]} ${y}</h2><button class="btn sm ghost" data-act="calm" data-v="1" aria-label="Next month">›</button></div>`;
  if(!viewing) h+=`<div class="row between"><button class="btn sm${re?' primary':''}" data-act="calre">${re?'✓ Rearranging':'Rearrange days'}</button>${calMonth!==t.slice(0,7)?`<button class="btn sm ghost" data-act="calm" data-v="0">This month</button>`:''}</div>`;
  if(re) h+=`<div class="banner info"><div class="small">${calMove?(calMove.ord?`<b>${esc(dayPlanSlot(calMove.from,slotOf(calMove.from)).short||'Session')}</b> moves to ${fmtD(calMove.to,true)}${calMove.moved>1?`, and ${calMove.moved-1} other day${calMove.moved>2?'s':''} shift`:' with no other changes'}. The preview is below.`:`Tap the day to move <b>${esc(dayPlanSlot(calMove.from,slotOf(calMove.from)).short||'')}</b> to. Greyed days can’t take it without doubling up strength or hard conditioning.`):'Tap a session, then tap the day you want to do it on. The week keeps all seven sessions and never lands two strength days or two hard conditioning days together.'}</div>${calMove?`<div class="row">${calMove.ord?`<button class="btn sm primary" data-act="calapply">Apply</button>`:''}<button class="btn sm ghost" data-act="calcancel">Cancel</button></div>`:''}</div>`;
  h+=`<div class="cal"><div class="cal-h">${DAYN.map(d=>`<span>${d[0]}</span>`).join('')}</div>`;
  for(let r=0;r<rows;r++){
    const mon=addDays(start,r*7), wk=weekOf(mon), wt=wk?weekTitle(wk):null;
    const cur=dayOrder(mon), ord=calOrd(mon), editable=re&&wk&&mon>=thisMon;
    h+=`<div class="cal-w">${wt?`<b>${esc(wt.t)}</b><span class="chip ${wt.cls}">${esc(wt.chip)}</span>${isReordered(mon)?'<span class="chip blue">days moved</span>':''}`:'<span class="muted">Before the program starts</span>'}</div>`;
    for(let i=0;i<7;i++){
      const d=addDays(mon,i), dp=dayPlanSlot(d,ord[i]), out=d<first||d>last, st=sessState(d,t);
      const gone=mon===thisMon&&i<dow(t), picked=calMove&&calMove.from===d, shifted=ord[i]!==cur[i];
      let cls='', act='open', dis='';
      if(re){
        if(!editable||gone){cls=' dim';dis='disabled'}
        else if(calMove&&!calMove.ord){ const ok=bestOrder(mon,i,slotOf(calMove.from));
          if(mondayOf(calMove.from)!==mon||(!ok&&!picked)){cls=' dim';dis='disabled'} }
        act='calpick';
      }
      h+=`<button class="cal-d${out?' out':''}${d===t?' today':''}${d===sel&&!re?' sel':''}${picked?' picked':''}${shifted?' shifted':''}${cls}" data-act="${act}" data-date="${d}" ${dis} aria-label="${fmtLong(d)} ${esc(dp.short||'')}"><span class="n">${+d.slice(8)}</span><span class="l">${esc(dp.short||'')}</span><span class="dot ${re?'':st}"></span></button>`;
    }
  }
  h+=`</div>`;
  if(!re) h+=`<div class="row small muted" style="gap:12px"><span><i class="lg done"></i>done</span><span><i class="lg missed"></i>missed</span></div>`;
  return h+`</div>`;
}
function vPlan(){
  const head=`<div class="card" style="padding:10px 12px"><div class="seg">${[['list','Weeks'],['cal','Calendar']].map(([v,l])=>`<button class="segb${planMode===v?' on':''}" data-act="planmode" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  return head+(planMode==='cal'?calCard():vPlanList());
}
function vPlanList(){
  const t=todayStr(), ti=Math.max(0,idxOf(t)), list=weeks(ti+planShow+2), from=Math.max(0,ti-4), to=ti+planShow;
  let h=`<div class="card" style="gap:6px"><h2>Plan</h2><p class="small muted" style="margin:0">Cycles run back to back forever. Deload every ${+plan.deloadEvery?plan.deloadEvery+' cycle'+(plan.deloadEvery>1?'s':''):'— (off)'} · retest every ${+plan.testEvery?plan.testEvery+' cycle'+(plan.testEvery>1?'s':''):'— (off)'}. Add a deload, retest or off week anywhere; everything after it shifts back a week.</p></div><div class="card" style="gap:0;padding-block:4px">`;
  for(let i=from;i<=to&&i<list.length;i++){
    const wk=list[i], wt=weekTitle(wk), past=wk.idx<ti, cur=wk.idx===ti;
    let done=0,tot=0; for(let d=0;d<7;d++){const dd=addDays(wk.monday,d),p=dayPlan(dd); if(p.t!=='off'){tot++; if(lg(dd).done) done++}}
    const hol=[];for(let d=0;d<7;d++){const dd=addDays(wk.monday,d),x=holidayOn(dd);if(x)hol.push(x)}
    let sub=[];
    if(wk.kind==='cycle') sub.push('Plyo: '+plyoPhase(wk).name);
    if(wk.kind==='cycle'&&wk.w===1){const m=maxFor(wk.cycle);sub.push(activeLifts().map(k=>m[k]?n(m[k].v):'—').join(' / '))}
    if(hol.length) sub.push('⚑ '+hol.join(', '));
    let menu='';
    if(!past){
      const opts=[];
      if(wk.kind==='bb') opts.push(`<button class="btn sm" data-act="bbremove" data-monday="${wk.monday}">Remove the whole block</button>`);
      else if(wk.inserted) opts.push(`<button class="btn sm" data-act="uninsert" data-monday="${wk.monday}">Remove this week</button>`);
      else if(wk.rule) opts.push(`<button class="btn sm" data-act="skip" data-rule="${wk.rule}">Skip this ${wk.kind==='test'?'retest':'deload'}</button>`);
      if(!wk.inserted) opts.push(`<span class="lbl">Start here instead</span><button class="btn sm" data-act="bbadd" data-monday="${wk.monday}" data-ver="standard">Base Building · 8 weeks</button><button class="btn sm ghost" data-act="bbadd" data-monday="${wk.monday}" data-ver="strength">Base Building · strength-first</button>`);
      if(!wk.inserted) opts.push(`<span class="lbl">Insert this week</span>${['deload','test','travel','off'].map(k=>`<button class="btn sm" data-act="insert" data-kind="${k}" data-monday="${wk.monday}">${{deload:'Deload',test:'Retest',travel:'Travel',off:'Off week'}[k]}</button>`).join('')}`);
      menu=`<details class="menu"><summary>Change</summary><div class="pop">${opts.join('')}</div></details>`;
    }
    h+=`<div class="wk-row${cur?' cur':''}${past?' past':''}"><div class="wk-date">${fmtD(wk.monday)}–${fmtD(addDays(wk.monday,6))}</div><div class="wk-main"><div class="row" style="gap:8px"><span class="t">${wt.t}</span><span class="chip ${wt.cls}">${wt.chip}</span>${wk.inserted?'<span class="chip">Added</span>':''}</div>${sub.length?`<div class="small muted">${esc(sub.join(' · '))}</div>`:''}</div><div class="row" style="gap:6px;justify-content:flex-end">${done?`<span class="small mono muted">${done}/${tot}</span>`:''}${menu}</div></div>`;
  }
  h+=`</div><div class="row"><button class="btn" data-act="more">Show 26 more weeks</button></div>`;
  const sk=Object.keys(plan.skips||{}).filter(k=>plan.skips[k]);
  if(sk.length) h+=`<div class="card"><h3>Skipped</h3><div class="row">${sk.map(k=>{const [kind,c]=k.split('@');return `<button class="btn sm" data-act="unskip" data-rule="${k}">Restore ${kind==='test'?'retest':'deload'} after Cycle ${c}</button>`}).join('')}</div></div>`;
  return h;
}

function vHistory(){
  const t=todayStr(), wk=weekOf(t), curC=wk?(wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle)):1;
  const list=weeks(), range={};
  for(const w of list){ if(w.kind==='cycle'){ (range[w.cycle]||(range[w.cycle]={a:w.monday,b:w.monday})).b=w.monday } }
  let h=`<div class="card"><h2>Maxes by cycle</h2><p class="small muted" style="margin:0">Type a number to override a cycle. Blank cells follow the previous cycle plus the increment. Later cycles update automatically.</p><div class="tbl-wrap"><table><thead><tr><th>Cycle</th><th>Dates</th>${activeLifts().map(k=>`<th class="n">${esc(liftName(k))}</th>`).join('')}</tr></thead><tbody>`;
  for(let c=1;c<=curC+(viewing?0:2);c++){
    const m=maxFor(c), r=range[c], o=plan.cycleMaxes[c]||{};
    h+=`<tr class="${c===curC?'cur':c<curC?'past':''}"><td><b>${c}</b></td><td class="small mono">${r?fmtD(r.a)+'–'+fmtD(addDays(r.b,4)):''}</td>${activeLifts().map(k=>c===1&&(o[k]==null||o[k]==='')?`<td class="n"><span title="Set in Setup">${m[k]?n(m[k].v):'—'}</span></td>`:`<td class="n"><input type="number" inputmode="decimal" step="any" id="cm-${c}-${k}" data-cmax="${c}.${k}" value="${o[k]??''}" placeholder="${m[k]?n(m[k].v):''}" aria-label="Cycle ${c} ${esc(liftName(k))}"></td>`).join('')}</tr>`;
  }
  h+=`</tbody></table></div></div>`;
  // Recovery
  const cis=progLogs().filter(([d,L])=>L.checkin&&readiness(L.checkin)!=null).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,14);
  h+=`<div class="card"><h2>Recovery</h2>`;
  if(!cis.length) h+=`<div class="empty">No check-ins yet. Answer the daily check-in on the Today tab and your readiness trend shows up here.</div>`;
  else{
    const avg=(f)=>{const xs=cis.slice(0,7).map(([d,L])=>L.checkin[f]).filter(v=>v!=null&&v!=='').map(Number);return xs.length?(xs.reduce((a,b)=>a+b,0)/xs.length):null};
    const ar=cis.slice(0,7).map(([d,L])=>readiness(L.checkin));const ra=ar.reduce((a,b)=>a+b,0)/ar.length;
    h+=`<div class="grid3"><div class="stack" style="gap:2px"><span class="small muted">Readiness · last 7</span><span class="big" style="font-size:32px">${Math.round(ra)}</span></div><div class="stack" style="gap:2px"><span class="small muted">Sleep · last 7</span><span class="big" style="font-size:32px">${avg('sleepH')!=null?avg('sleepH').toFixed(1):'—'}<small>h</small></span></div><div class="stack" style="gap:2px"><span class="small muted">Bodyweight</span><span class="big" style="font-size:32px">${latestBw(todayStr())?n(latestBw(todayStr())):'—'}<small>${u()}</small></span></div></div>`;
    h+=`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Ready</th><th class="n">Sleep</th><th class="n">Energy</th><th class="n">Sore</th><th class="n">BW</th></tr></thead><tbody>${cis.map(([d,L])=>{const c=L.checkin,r=readiness(c),lv=rLevel(r);return `<tr><td>${fmtD(d,true)}</td><td class="n"><span class="chip ${lv.cls}">${r}</span></td><td class="n">${c.sleepH!=null&&c.sleepH!==''?n(c.sleepH):'—'}</td><td class="n">${c.energy||'—'}</td><td class="n">${c.soreness||'—'}</td><td class="n">${c.bw?n(c.bw):'—'}</td></tr>`}).join('')}</tbody></table></div>`;
  }
  h+=`</div>`;
  // HIC
  const hic=hicSessions().reverse();
  h+=`<div class="card"><h2>Conditioning</h2>`;
  if(!hic.length) h+=`<div class="empty">No conditioning logged yet. Results you enter on HIC and LISS days show up here.</div>`;
  else{
    const groups={};for(const x of hic) if(x.f!=='liss'&&x.v!=null)(groups[x.mod+'|'+x.f]=groups[x.mod+'|'+x.f]||[]).push(x);
    const top=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).slice(0,4);
    if(top.length) h+=`<div class="grid4">${top.map(key=>{const xs=groups[key],[m,f]=key.split('|'),b=xs.reduce((a,x)=>Math.max(a,x.v),0);return `<div class="stack" style="gap:2px"><span class="small muted">${MOD[m].name} · ${HIC[f].name}</span><span class="big" style="font-size:32px">${n(b)}<small style="font-size:13px;color:var(--muted);margin-left:3px">${esc(xs[0].u)}</small></span><span class="small muted">best · ${xs.length} logged</span></div>`}).join('')}</div>`;
    h+=`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Format</th><th>Activity</th><th class="n">Result</th></tr></thead><tbody>${hic.slice(0,20).map(x=>`<tr><td>${fmtD(x.d,true)}</td><td>${HIC[x.f].name}</td><td>${esc(x.mod==='other'&&x.what?x.what:MOD[x.mod].name)}${x.load?` <span class="small muted">(${n(x.load)} ${u()})</span>`:''}</td><td class="n">${[x.v!=null?n(x.v)+' '+x.u:'',x.min?x.min+' min':'',x.elev?'↑'+n(x.elev)+' '+elevUnit():'',flatEquiv(x)!=null?'≈ '+n(flatEquiv(x))+' '+x.u+' flat':''].filter(Boolean).join(' · ')||'—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  h+=`</div>`;
  // Jumps
  const jm=progLogs().filter(([d,L])=>(L.plyo&&(L.plyo.best||L.plyo.mark))||(L.jumps&&(L.jumps.broad||L.jumps.vertical))).sort((a,b)=>a[0]<b[0]?1:-1);
  h+=`<div class="card"><h2>Jumps</h2>`;
  h+=jm.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Broad</th><th class="n">Vertical</th><th class="n">Triple</th></tr></thead><tbody>${jm.slice(0,15).map(([d,L])=>`<tr><td>${fmtD(d,true)}</td><td class="n">${n((L.jumps&&L.jumps.broad)||(L.plyo&&(L.plyo.best||L.plyo.mark)))}</td><td class="n">${n(L.jumps&&L.jumps.vertical)}</td><td class="n">${n(L.jumps&&L.jumps.triple)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No jumps yet. Log Thursday's first broad jump on the plyo card, or a full set on a test day.</div>`;
  h+=`</div>`;
  // Sessions
  const ss=progLogs().filter(([d,L])=>L.done||L.notes).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,20);
  h+=`<div class="card"><h2>Recent sessions</h2>`+(ss.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Session</th><th class="n">RPE</th><th>Notes</th></tr></thead><tbody>${ss.map(([d,L])=>`<tr><td><button class="btn sm ghost" data-act="open" data-date="${d}">${fmtD(d,true)}</button></td><td>${esc(dayPlan(d).short||'')}</td><td class="n">${L.rpe||'—'}</td><td class="small">${esc((L.notes||'').slice(0,80))}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">Nothing logged yet. Mark a session done on Today and it appears here with its RPE and notes.</div>`)+`</div>`;
  return h;
}

function pIn(path,val,attrs){return `<input type="number" inputmode="decimal" step="any" id="p-${path.replace(/\./g,'-')}" data-pbind="${path}" data-type="num" value="${val??''}" ${attrs||''}>`+oddNote(path,val)}
function vSetup(){
  let h=`<div class="card" id="account"><h2>Account</h2><dl class="kv"><dt>Signed in</dt><dd>${esc(me||'Not signed in')}</dd></dl>
  <p class="small muted" style="margin:0">Sign-in goes through Cloudflare Access, and everything you log — plan, sessions, archived programs and backups — belongs to this address alone. Signing out leaves this phone’s copy in place; it syncs again the moment you sign back in.</p>
  <div class="row"><a class="btn" href="${signedOut?'/':'/cdn-cgi/access/logout'}">${signedOut?'Sign in':'Sign out'}</a><button class="btn ghost" data-act="view" data-view="guide">Guide</button></div></div>
  <div class="card"><h2>Maxes</h2><p class="small muted" style="margin:0">True 1RM for Cycle 1. Later cycles add the increment below unless a retest or a manual override replaces it.</p>
  <div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k,todayStr()))} 1RM${isBW(k)?' (added)':''}${pIn('maxes.'+k,plan.maxes[k])}</label>`).join('')}</div>
  <details class="plain"><summary>Have a 5RM instead?</summary><div class="stack" style="margin-top:8px"><p class="small muted" style="margin:0">Enter a clean 5RM. The 1RM is the 5RM ÷ 0.87, rounded down.</p><div class="grid4">${activeLifts().filter(k=>!isBW(k)).map(k=>`<label class="f">${esc(liftName(k))} 5RM<input type="number" inputmode="decimal" step="any" id="c5-${k}" data-calc="${k}" value="${calc5[k]??''}"><span class="mono small">${calc5[k]?'→ '+n(floorTo(calc5[k]/.87,plan.round[k])):''}</span></label>`).join('')}</div><div><button class="btn sm" data-act="calc5">Use these as maxes</button></div></div></details></div>`;
  {
    const t=themePref();
    h+=`<div class="card"><h2>Appearance</h2><p class="small muted" style="margin:0">Set per device, so your phone and laptop can differ.</p>
    <label class="f">Theme<div class="seg">${[['auto','Match device'],['light','Light'],['dark','Dark']].map(([v,l])=>`<button class="segb${t===v?' on':''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div></label>
    <label class="check"><input type="checkbox" id="p-gym" data-act="gym" ${gymOn()?'checked':''}> <span>Gym mode: bigger buttons and stronger contrast for sweaty hands</span></label></div>`;
  }
  h+=programsCard();
  h+=`<div class="card"><h2>Program</h2><div class="grid2"><label class="f">Start (Monday of first week)<input type="date" id="p-start" data-pbind="startMonday" value="${plan.startMonday}"></label></div>
  <label class="check"><input type="checkbox" id="p-bridge" data-pbind="bridge" ${plan.bridge?'checked':''}> Begin with the bridge (calibration) week</label>
  <div class="grid4"><label class="f">Units<select id="p-unit" data-pbind="unit"><option value="lb"${u()==='lb'?' selected':''}>lb</option><option value="kg"${u()==='kg'?' selected':''}>kg</option></select></label><label class="f">Bar weight${pIn('bar',plan.bar)}</label><label class="f">Bodyweight${pIn('bodyweight',plan.bodyweight)}</label><label class="f">Percent of<select id="p-basis" data-pbind="basis"><option value="1rm"${plan.basis!=='tm'?' selected':''}>True 1RM</option><option value="tm"${plan.basis==='tm'?' selected':''}>Training max</option></select></label></div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Plates your gym has (${u()})</div><div class="seg">${ALL_PLATES[u()].map(v=>`<button class="segb${plateSet().includes(v)?' on':''}" data-act="platetoggle" data-v="${v}" aria-pressed="${plateSet().includes(v)}">${n(v)}</button>`).join('')}</div><div class="small muted">Plate math only uses these. If a weight can’t be loaded exactly, the lift card says so and shows the nearest you can load.</div></div>
  ${plan.basis==='tm'?`<label class="f" style="max-width:200px">Training max % of 1RM${pIn('tmPct',plan.tmPct)}</label>`:''}
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Round working weights to</div><div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k))}${pIn('round.'+k,plan.round[k])}</label>`).join('')}</div></div></div>`;
  const on=l3On(), L3=plan.l3||{};
  h+=`<div class="card"><h2>Lift 3</h2><p class="small muted" style="margin:0">Pick the variants you use on Mondays and Wednesdays. Each keeps its own max. With more than one, choose how they rotate. You can also swap on any day from the lift card.</p>
  <div class="stack">${L3K.map(k=>`<label class="check"><input type="checkbox" id="l3-${k}" data-pbind="l3.on.${k}" ${on.includes(k)&&(L3.on||{})[k]?'checked':''}> ${esc(liftName(k))}${k==='wpu'?' <span class="small muted">(percentages use bodyweight + added weight)</span>':''}</label>`).join('')}</div>
  ${on.length>1?`<div class="grid2"><label class="f">Rotation<select id="l3-mode" data-pbind="l3.mode">${[['same','Same every session'],['alt-day','Alternate Monday ↔ Wednesday'],['alt-week','Alternate each week'],['alt-cycle','Alternate each cycle']].map(([v,l])=>`<option value="${v}"${L3.mode===v?' selected':''}>${l}</option>`).join('')}</select></label>${L3.mode==='same'||!L3.mode?`<label class="f">Default<select id="l3-primary" data-pbind="l3.primary">${on.map(k=>`<option value="${k}"${L3.primary===k?' selected':''}>${esc(liftName(k))}</option>`).join('')}</select></label>`:''}</div>`:''}
  ${on.includes('pull')?`<div class="grid2"><label class="f">Pulldown name<input type="text" id="p-l3" data-pbind="lift3Name" value="${esc(plan.lift3Name)}"></label><label class="f">Machine and pin setting<input type="text" id="p-mn" data-pbind="machineNote" value="${esc(plan.machineNote)}" placeholder="e.g. Hammer Strength pulldown, seat 4"></label></div>`:''}
  ${on.some(k=>plan.maxes[k]==null||plan.maxes[k]==='')?`<div class="banner warn"><div class="small">Add a 1RM above for ${on.filter(k=>plan.maxes[k]==null||plan.maxes[k]==='').map(liftName).join(' and ')}. Until then its sessions show no working weight.</div></div>`:''}</div>`;
  {
    const sup=alertsSupport(), on=alertsOn();
    h+=`<div class="card"><div class="lift-h"><h2>Rest alerts</h2>${on?'<span class="chip light">On</span>':'<span class="chip">Off</span>'}</div><p class="small muted" style="margin:0">A notification when each rest ends, even with the phone locked or another app open. Set per device.</p>`;
    if(sup==='install') h+=`<div class="banner info"><div class="small">On iPhone, alerts only work in the home-screen app. In Safari tap <b>Share → Add to Home Screen</b>, open Operator from there, then turn alerts on. Needs iOS 16.4 or later.</div></div>`;
    else if(sup==='unsupported') h+=`<div class="small muted">This browser can’t receive push notifications.</div>`;
    else if(sup==='denied') h+=`<div class="banner warn"><div class="small">Notifications are blocked for this app. Turn them on in iOS Settings → Notifications → Operator, then come back here.</div></div>`;
    else h+=`<div class="row">${on?`<button class="btn" data-act="alerttest" ${alerts.busy?'disabled':''}>Send a test</button><button class="btn ghost" data-act="alertoff" ${alerts.busy?'disabled':''}>Turn off</button>`:`<button class="btn primary" data-act="alerton" ${alerts.busy?'disabled':''}>${alerts.busy?'Turning on…':'Turn on rest alerts'}</button>`}</div>`;
    if(alerts.msg) h+=`<div class="small">${esc(alerts.msg)}</div>`;
    h+=`<div class="small muted">Alerts use the standard notification sound. Silent mode and Focus apply, and they also show on a paired Apple Watch. With the app open you’ll get both the in-app beep and the notification.</div></div>`;
  }
  {
    const q=!!plan.quietTimer;
    h+=`<div class="card"><div class="lift-h"><h2>Sound</h2>${q?'<span class="chip">Silent</span>':'<span class="chip light">Beeps on</span>'}</div>
    <p class="small muted" style="margin:0">On iPhone, a web app that makes any sound takes over the audio session and pauses whatever you were listening to. If the timer keeps stopping your music, this is why.</p>
    <label class="check"><input type="checkbox" id="p-quiet" data-pbind="quietTimer" ${q?'checked':''}> Silent timers \u2014 keep my music playing</label>
    <div class="small muted">Silent turns off the beeps and the spoken cues for rests and intervals. The countdown, the vibration and the screen still work, and rest alerts still arrive as notifications, which do not touch your music.</div></div>`;
  }
  {
    const v=!!plan.voice&&!plan.quietTimer;
    h+=`<div class="card"><div class="lift-h"><h2>Spoken cues</h2>${v?'<span class="chip light">On</span>':'<span class="chip">Off</span>'}</div>
    <p class="small muted" style="margin:0">The app’s own voice, separate from notifications. It reads interval changes (“Round 3 of 8. Go hard.”), ten seconds left in a rest, and what’s next when one ends.</p>
    <label class="check"><input type="checkbox" id="p-voice" data-pbind="voice" ${v?'checked':''}> Speak cues while the app is on screen</label>
    ${plan.quietTimer?`<div class="small" style="color:var(--muted)">Silent timers are on, so cues stay quiet whatever this says.</div>`:''}
    ${v?`<div><button class="btn" data-act="voicetest">Try a cue</button></div>`:''}
    <div class="small muted">Only while the app is on screen — iOS silences a web app the moment the phone locks. For a whole session, set Auto-Lock to Never. The <b>Send a test</b> button above is a notification, not speech: it will never be read aloud.</div></div>`;
  }
  {
    const fmtAt=t=>{if(!t)return '';const d=new Date(t);return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+', '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
    const status=!APP_VER||APP_VER==='dev'?'Version unknown in this preview.':!upd.latest?(upd.err||'Not checked yet.'):updateAvailable()?'A newer version is available.':'You’re on the latest version.';
    const latestV=tagVersion(upd.tag), rel=RELEASES[0];
    h+=`<div class="card"><h2>About this app</h2><dl class="kv">
    <dt>This app</dt><dd><b>${esc(APP_VERSION)}</b> · ${esc(rel.title)} <span class="small muted">(${esc((APP_VER||'—').slice(0,8))})</span></dd>
    <dt>Latest</dt><dd>${latestV?`<b>${esc(latestV)}</b> `:''}<span class="small muted">${upd.latest?esc(upd.latest.slice(0,8)):'—'}${upd.at?` · deployed ${esc(fmtAt(upd.at))}`:''}</span></dd></dl>
    <div class="small">${esc(status)}${upd.checked?` <span class="muted">Last checked ${esc(new Date(upd.checked).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}.</span>`:''}</div>
    <div class="row">${updateAvailable()?'<button class="btn primary" data-act="updnow">Reload to update</button>':''}<button class="btn" data-act="updcheck" ${upd.busy?'disabled':''}>${upd.busy?'Checking…':'Check for updates'}</button></div>
    <div class="small muted">The app checks on its own whenever you open it or come back to it. If a new version is ready, a banner appears at the top.</div>
    <div><button class="btn" data-act="view" data-view="releases">What’s new in each release</button></div></div>`;
  }
  {
    const key=((plan.se||{}).cluster)in SE_CLUSTERS?plan.se.cluster:'bw';
    h+=`<div class="card"><h2>Strength-endurance</h2><p class="small muted" style="margin:0">Circuits of five to eight exercises covering the whole body, light and high-rep. Used by Base Building, and you can pick a different cluster on any single day.</p>
    <div class="restsel"><span>Default cluster</span><div class="seg">${Object.entries(SE_CLUSTERS).map(([k,c])=>`<button class="segb${key===k?' on':''}" data-act="sedef" data-v="${k}">${c.name}</button>`).join('')}</div></div>
    <label class="f">My own cluster<textarea id="se-mine" data-seMine rows="7" placeholder="One exercise per line, five to eight of them">${esc(((plan.se||{}).custom||[]).join('\n'))}</textarea></label>
    <div class="small muted">Pick movements you can get to without queueing, since the short rests are the point. Anything one arm or one leg at a time splits the reps. With barbells or dumbbells use roughly 15–30% of your one-rep max.</div></div>`;
  }
  const mobs=plan.mob||{};
  h+=`<div class="card"><h2>Mobility</h2><p class="small muted" style="margin:0">The block at the end of each session, matched to what that day loaded. One movement per line; add the dose after a comma.</p><div class="grid3">${[['lift','After lifting'],['dead','After deadlift day'],['hic','After conditioning'],['plyo','After plyos'],['off','Rest days']].map(([k,l])=>`<label class="f">${l}<textarea id="mob-${k}" data-mobday="${k}" rows="6">${esc(mobList(k).map(([n,d])=>d?n+', '+d:n).join('\n'))}</textarea></label>`).join('')}</div></div>`;
  h+=`<div class="card"><h2>Travel week</h2><p class="small muted" style="margin:0">What you do on a week away from the barbell. Add a travel week from the Plan tab: the cycle pauses and picks up after it, and the week stays out of the end-of-cycle review. One movement per line, dose after a comma.</p><div class="grid3">${['day1','day2','day3'].map(k=>`<label class="f">${esc(TRAVEL[k].name)}<textarea id="trv-${k}" data-trvday="${k}" rows="5">${esc(travelList(k).map(([n,d])=>d?n+', '+d:n).join('\n'))}</textarea></label>`).join('')}</div></div>`;
  const accs=plan.acc||{};
  h+=accSetupCard();
  h+=`<div class="card"><h2>Conditioning</h2><p class="small muted" style="margin:0">Your main tool for HIC and LISS days. You can switch activity on any session from its card.</p><label class="f" style="max-width:260px">Climbing counts as distance<div class="row" style="align-items:center;gap:8px">${pIn('elevPer.'+u(),elevPerDist(),'style="max-width:110px"')}<span class="small muted">${elevUnit()} of gain = 1 ${u()==='kg'?'km':'mi'}</span></div></label>
  <label class="f" style="max-width:260px">Default activity<select id="p-cardio" data-pbind="cardio.def">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<option value="${k}"${defMod()===k?' selected':''}>${x.name}</option>`).join('')}</select></label>
  ${(()=>{const b=benchmark()||{};return `<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px"><div class="small muted" style="font-weight:650">Benchmark session</div>
  <p class="small muted" style="margin:4px 0 0">One hard session you repeat to compare against itself. Results only compare within an activity and a format, so if the rest of your conditioning moves around, this is the line worth watching.${b.auto?' Picked for you from what you repeat most — choosing here pins it.':''}</p>
  <div class="grid3"><label class="f">Activity<select id="p-bmod" data-pbind="benchmark.mod">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<option value="${k}"${b.mod===k?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
  <label class="f">Format<select id="p-bfmt" data-pbind="benchmark.fmt">${Object.entries(HIC).filter(([k,x])=>k!=='liss'&&!x.noMetric).map(([k,x])=>`<option value="${k}"${b.fmt===k?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
  <label class="f">Repeat every (days)${pIn('benchEvery',plan.benchEvery)}</label></div></div>`})()}</div>`;
  const ptS=proteinTarget(todayStr());
  {
    const wk=weekOf(todayStr()), cyc=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):null;
    h+=`<div class="card"><h2>Lift variants</h2><p class="small muted" style="margin:0">Which squat and which deadlift this program runs on. Tactical Barbell picks its cluster lifts for a block and keeps them for the block, so this is a per-cycle choice \u2014 and the max you enter above is that lift\u2019s max, used as it stands with no conversion.</p>`;
    for(const k of ['squat','dead']){
      const V=varsOf(k), bv=blockVar(k,todayStr()), def=varDefault(k), m=cyc?maxFor(cyc)[k]:null;
      h+=`<div class="stack" style="gap:8px;margin-top:14px"><div class="small muted" style="font-weight:650">${esc(k==='squat'?'Squat':'Deadlift')}</div>
      <div class="grid2">${cyc?`<label class="f">Cycle ${cyc} (now)<select id="p-cv-${k}" data-pbind="cycleVar.${cyc}.${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===bv?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`:''}
      <label class="f">Later cycles<select id="p-var-${k}" data-pbind="liftVar.${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===def?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>
      <div class="small muted">${esc(V[bv].note)}</div>`;
      if(m) h+=`<div class="small muted">Your ${n(m.v)} ${u()} max is read as a <b>${esc(V[bv].name.toLowerCase())}</b> max.${bv!==varRef(k)?` If that number came from a ${esc(V[varRef(k)].name.toLowerCase())}, the usual equivalent is about <b class="mono">${n(rnd(m.v*V[bv].r,plan.round[k]))}</b> \u2014 change it in Maxes if so.`:''}</div>`;
      const mine=((plan.customVar||{})[k])||[];
      h+=`<details class="plain"><summary>Your own variants <small class="muted">\u00b7 ${mine.length||'none'}</small></summary>
      <p class="small muted" style="margin:8px 0 0">Anything the list is missing: a bar, a tempo, a stance. Give it a name and what share of your ${esc(V[varRef(k)].name.toLowerCase())} it carries \u2014 that is all the program needs to work out the weight. Not sure? Use what you can actually lift on it against what you lift on the ${esc(V[varRef(k)].short.toLowerCase())}.</p>
      ${mine.length?`<div class="stack" style="gap:6px;margin-top:8px">${mine.map((c,i)=>`<div class="row between"><span>${esc(c.name)} <span class="small muted mono">${Math.round(+c.r*100)}%</span>${bv===c.id||def===c.id?' <span class="chip">in use</span>':''}</span><button class="btn sm ghost" data-act="vardel" data-k="${k}" data-i="${i}">Remove</button></div>`).join('')}</div>`:''}
      <div class="grid3" style="margin-top:8px"><label class="f">Name<input type="text" id="cv-name-${k}" placeholder="e.g. Pin squat"></label><label class="f">% of ${esc(V[varRef(k)].short)}<input type="number" inputmode="decimal" id="cv-pct-${k}" placeholder="85"></label><div style="display:flex;align-items:flex-end"><button class="btn" data-act="varadd" data-k="${k}">Add</button></div></div>
      ${cvErr[k]?`<div class="small" style="color:var(--red)">${esc(cvErr[k])}</div>`:''}</details>`;
      h+=`</div>`;
    }
    h+=`<div class="small muted" style="margin-top:14px">Changing the lift mid-cycle is a deviation from the template: the wave builds to heavy weeks on a max you set for a particular lift. For one session \u2014 a taken rack, a sore back \u2014 swap it on the lift\u2019s card on Today instead, and the weight is scaled for you.</div></div>`;
  }
  h+=`<div class="card"><h2>About you</h2><p class="small muted" style="margin:0">Only used for the energy and body-fat estimates on Status. Nothing else in the app reads them, and leaving them blank just hides those estimates.</p>
  <div class="grid4"><label class="f">Sex<select id="p-sex" data-pbind="sex"><option value=""${!plan.sex?' selected':''}>—</option><option value="m"${plan.sex==='m'?' selected':''}>Male</option><option value="f"${plan.sex==='f'?' selected':''}>Female</option></select></label>
  <label class="f">Height (${u()==='kg'?'cm':'in'})${pIn('height',plan.height)}</label>
  <label class="f">Birth year${pIn('birthYear',plan.birthYear)}</label>
  <label class="f">Daily activity<select id="p-act" data-pbind="activity">${ACT.map(([v,l])=>`<option value="${v}"${actFactor()===v?' selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
  <div class="small muted">The formulas: Mifflin-St Jeor for the predicted burn, the US Navy circumference method for body fat. Both are estimates — once you have logged calories and weigh-ins for a few weeks, Status uses your own numbers instead.</div></div>
  <div class="card"><h2>Recovery and nutrition</h2><p class="small muted" style="margin:0">Used by the daily check-in to tailor suggestions.</p><div class="grid3"><label class="f">Goal<select id="p-goal" data-pbind="goal"><option value="lose"${plan.goal==='lose'?' selected':''}>Lose fat</option><option value="maintain"${plan.goal==='maintain'?' selected':''}>Maintain</option><option value="gain"${plan.goal==='gain'?' selected':''}>Build</option></select></label><label class="f">Sleep target (h)${pIn('sleepTarget',plan.sleepTarget)}</label><label class="f">Protein (g per lb)${pIn('proteinPerLb',plan.proteinPerLb)}</label></div><div class="small muted">${ptS?`Daily protein target: <b class="mono">${ptS} g</b> from ${r1(bwFor(todayStr()))} ${u()} bodyweight${(bwAvg(todayStr(),7)||{}).n>1?' (7-day average)':''}.`:'Enter your bodyweight above (or in a check-in) to get a protein target.'} 0.7–1.0 g per lb covers most people training this hard.</div></div>`;
  h+=`<div class="card"><h2>The wave</h2><p class="small muted" style="margin:0">Six weeks, repeating. Sources disagree on weeks 5–6 (some use 3×3 @ 85% and 3×1 @ 95%). Check your copy of the book.</p>
  <p class="small muted" style="margin:0"><b>Up to</b> sets a standing ceiling for a week, and is optional twice over: you can also just tap <b>+</b> on any lift card to add a set on the day. Leave this blank and the week is exactly the sets prescribed. Set it higher and the extra sets show on the lift card as dashed buttons you can take or leave — this is the Operator I/A idea, where you decide the volume session by session. <i>Ageless Athlete</i> allows as many as ten sets per lift, and calls a couple of extra sets the gentlest way to add size. The two-minute rest rule still applies to every set.</p><div class="tbl-wrap"><table class="wavetbl"><thead><tr><th>Week</th><th class="n">Sets</th><th class="n">Up to</th><th class="n">Reps</th><th class="n">%</th><th></th></tr></thead><tbody>${(Array.isArray(plan.wave)?plan.wave:[]).map((v,i)=>`<tr><td><b>${i+1}</b></td><td class="n">${pIn('wave.'+i+'.s',v.s)}</td><td class="n">${pIn('wave.'+i+'.sMax',v.sMax,'placeholder="'+v.s+'"')}</td><td class="n">${pIn('wave.'+i+'.r',v.r)}</td><td class="n">${pIn('wave.'+i+'.p',v.p)}</td><td><span class="chip ${tier(+v.p)}">${{light:'Light',mid:'Medium',heavy:'Heavy'}[tier(+v.p)]}</span></td></tr>`).join('')}</tbody></table></div></div>`;
  {
    const byBook=(+plan.testEvery||0)===2&&(+plan.deloadEvery||0)===0;
    h+=`<div class="card"><h2>Cycles, deloads and retests</h2>
    <div class="row between" style="align-items:center"><span class="small muted">${byBook?'Running the book\u2019s cadence: two cycles, then retest, no scheduled deload.':'Your cadence differs from the book\u2019s.'}</span>${byBook?'<span class="chip light">By the book</span>':'<button class="btn sm" data-act="bookcadence">Match the book</button>'}</div>`;
  }
  h+=`
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Added to the max each new cycle</div><div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k))}${pIn('inc.'+k,plan.inc[k])}</label>`).join('')}</div></div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Scheduled deload week <span style="font-weight:400">\u00b7 not in the book</span></div><p class="small muted" style="margin:0 0 2px">Operator runs its cycles back to back and retests; there is no deload week in it. What the book does prescribe is a full week or more off every three to six months \u2014 add that from the Plan tab when you want it. A scheduled light week is our addition, off by default, and worth having if you are running this year-round.</p><div class="seg">${[[0,'As needed'],[1,'After every cycle'],[2,'After every 2 cycles']].map(([v,l])=>`<button class="segb${(+plan.deloadEvery||0)===v?' on':''}" data-act="deloadevery" data-v="${v}" aria-pressed="${(+plan.deloadEvery||0)===v}">${l}</button>`).join('')}${[0,1,2].includes(+plan.deloadEvery||0)?'':`<button class="segb on" aria-pressed="true">Every ${+plan.deloadEvery} cycles</button>`}</div><div class="small muted">${nextScheduled('deload')}${(+plan.deloadEvery||0)===0?' The app still offers a one-tap deload when readiness is low or sessions run hard, and you can add one from Plan anytime.':''}</div>
  <label class="check"><input type="checkbox" id="p-askdl" data-pbind="askDeload" ${plan.askDeload!==false?'checked':''}> Ask me to confirm this every 2 cycles (weeks 5–6 of cycles 2, 4, 6…)</label></div>
  <label class="f" style="max-width:260px">Retest after every N cycles (0 = never)${pIn('testEvery',plan.testEvery)}</label>
  <p class="small muted" style="margin:0"><b>2 is the book\u2019s recommendation</b> \u2014 two six-week blocks, so twelve weeks between tests, which it calls the optimal length of a strength phase. 1 (six weeks) is the minimum and is offered to experienced lifters who respond better to testing often. Going longer is explicitly fine: if the loads still feel heavy, stay on your current numbers and test when they feel solid.</p>
  <p class="small muted" style="margin:0">A retest week doubles as a deload: 3 easy days, then heavy singles. When both land on the same cycle, the retest wins.</p>
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Deload week lifting</div><div class="grid3"><label class="f">Sets${pIn('deload.s',plan.deload.s)}</label><label class="f">Reps${pIn('deload.r',plan.deload.r)}</label><label class="f">% of max${pIn('deload.p',plan.deload.p)}</label></div></div>
  <div class="banner"><div class="small">Past weeks are locked: changing these rules, the wave or maxes only re-plans from the current week on. Changing the start date or the bridge week re-plans everything, locked weeks included.</div></div></div>`;
  const bk=backups.list;
  h+=syncCard();
  h+=crashCard();
  h+=calFeedCard();
  h+=`<div class="card"><h2>Backups</h2><p class="small muted" style="margin:0">A full copy of your plan and every logged session is saved automatically every Sunday. The last 26 of those are kept, so about six months, and your own backups are counted separately: the newest six you take by hand and the newest six taken before a restore. Taking a few by hand can’t push out the weekly history.</p>
  ${backups.err?`<div class="small muted">${esc(backups.err)}</div>`:!bk?'<div class="small muted">Loading backups…</div>':bk.length?`<div class="tbl-wrap"><table><thead><tr><th>Backup</th><th class="n">Sessions</th><th class="n">Size</th><th></th></tr></thead><tbody>${bk.slice(0,6).map(x=>`<tr><td>${esc(x.name.replace(/-(manual|before-restore(-\d{6})?)$/,''))}${x.name.endsWith('-manual')?' <span class="chip">manual</span>':''}${x.name.includes('-before-restore')?' <span class="chip">before restore</span>':''}</td><td class="n">${x.logs??'—'}</td><td class="n">${x.bytes?Math.max(1,Math.round(x.bytes/1024))+' KB':'—'}</td><td class="n" style="white-space:nowrap"><a class="btn sm ghost" href="/api/backups/${encodeURIComponent(x.name)}">Download</a><button class="btn sm ghost" data-act="restore" data-name="${esc(x.name)}" ${restoreState.busy?'disabled':''}>${restoreState.arm===x.name?'Tap again':'Restore'}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="small muted">No backups yet. The first automatic one runs Sunday.</div>'}
  <div class="row"><button class="btn" data-act="backupnow" ${backups.busy?'disabled':''}>${backups.busy?'Backing up…':'Back up now'}</button><a class="btn ghost" href="/api/export">Download current data</a><label class="btn ghost" for="restore-file">Restore from a file…</label><input type="file" id="restore-file" accept="application/json,.json" hidden></div>
  ${restoreState.file?`<div class="banner warn"><div class="small"><b>Restore ${esc(restoreState.file.name)}?</b> It holds ${restoreState.file.logs} logged day${restoreState.file.logs===1?'':'s'}${restoreState.file.from?' from '+esc(fmtLong(restoreState.file.from.slice(0,10))):''}${restoreState.file.user&&me&&restoreState.file.user!==me?`, saved by <b>${esc(restoreState.file.user)}</b>, not you`:''}. This replaces everything in your account. A safety backup is taken first.</div><div class="row"><button class="btn sm primary" data-act="restorefile" ${restoreState.busy?'disabled':''}>Replace my data with this file</button><button class="btn sm ghost" data-act="restorecancel">Cancel</button></div></div>`:''}
  ${restoreState.msg?`<div class="small">${esc(restoreState.msg)}</div>`:''}
  ${backupCheckLine()}
  <div class="small muted">Restoring replaces your plan, every logged day and archived programs with the backup’s. A “before restore” backup of your current data is saved first, so a restore can be undone.</div></div>`;
  h+=`<div class="card"><h2>Export to a spreadsheet</h2><p class="small muted" style="margin:0">CSV files for Numbers, Excel or Google Sheets, covering every program. <b>Sessions</b>: one row per day (check-in, conditioning, plyos, jumps, notes). <b>Lifts</b>: one row per lift per session (prescribed vs working weight, sets done, grinders, warm-ups, test results).</p><div class="row"><button class="btn" data-act="csv" data-v="sessions">Export sessions</button><button class="btn" data-act="csv" data-v="lifts">Export lifts</button></div></div>`;
  if(!backups.list&&!backups.busy&&!backups.err&&!backups.loading) loadBackups();
  return h;
}
let calc5={};
// Restore: from a listed backup (two taps) or a chosen file (confirm banner).
const restoreState={arm:null,busy:false,msg:null,file:null};
async function doRestore(path,body){
  restoreState.busy=true; restoreState.msg='Restoring…'; render();
  try{
    const r=await api('POST',path,body);
    // Drop anything unsent: it belongs to the data being replaced.
    for(const w of Object.values(writers)) clearTimeout(w.timer);
    for(const k of Object.keys(writers)) delete writers[k];
    outbox={}; saveOutbox();
    const st=await api('GET','/state');
    if(stash){stash=null;viewing=null}
    plan=st.plan?deepMerge(clone(DEF),st.plan):clone(DEF); logs=st.logs||{}; programs=st.programs||{}; planV++; saveCache();
    restoreState.msg=`Restored ${r.restored.logs} logged day${r.restored.logs===1?'':'s'}${r.restored.programs?' and '+r.restored.programs+' archived program'+(r.restored.programs===1?'':'s'):''}${r.from?' from '+fmtLong(String(r.from).slice(0,10)):''}. Your previous data was saved as backup “${r.safetyBackup}”.`;
    restoreState.file=null; backups.list=null; loadBackups();
  }catch(e){ restoreState.msg=e&&e.status===413?'That file is too large to restore.':e&&e.status===400?'That file isn’t a backup this app can restore.':'Restore failed. Check your connection and try again. Nothing was changed.' }
  restoreState.busy=false; restoreState.arm=null; render();
}
document.addEventListener('change',e=>{
  const t=e.target; if(t.id!=='restore-file'||!t.files||!t.files[0]) return;
  const f=t.files[0], rd=new FileReader();
  rd.onload=()=>{ try{ const d=JSON.parse(rd.result); if(!d||typeof d.logs!=='object') throw 0;
      restoreState.file={name:f.name,data:d,logs:Object.keys(d.logs).length,from:d.backedUpAt||d.exportedAt||null,user:d.user||null}; restoreState.msg=null }
    catch(err){ restoreState.file=null; restoreState.msg='That file isn’t a backup this app can restore.' }
    t.value=''; render(); };
  rd.readAsText(f);
});
const backups={list:null,err:null,busy:false,loading:false};
// Every backup is read straight back after it is written and checked against what was
// meant to be stored. "There are backups" and "the backups are good" are different
// claims; this is the second one, and it is worth saying out loud either way.
function backupCheckLine(){
  const c=backups.check;
  if(!c) return '';
  const when=c.at?fmtD(String(c.at).slice(0,10),true):'';
  if(c.ok) return `<div class="small muted">\u2713 Checked ${esc(when)}: the newest backup was read back and matched what it should hold${c.logs!=null?' ('+c.logs+' logged day'+(c.logs===1?'':'s')+')':''}.</div>`;
  return `<div class="banner alert"><div><b>The last backup did not verify.</b> It was written on ${esc(when)} but did not read back as what it should hold. Take one now, and if this keeps happening do not rely on these backups \u2014 use <b>Download current data</b> instead.</div><div><button class="btn sm primary" data-act="backupnow">Back up now</button></div></div>`;
}

async function loadBackups(){
  backups.loading=true;
  try{const r=await api('GET','/backups');backups.list=r.backups;backups.check=r.check||null;backups.err=null}
  catch(e){backups.err=e&&(e.status===401||e.status===403)?'Sign in again to see backups.':navigator.onLine===false?'Backups need a connection.':'Couldn’t load backups.'}
  backups.loading=false; if(view==='setup') render();
}

function vGuide(){
  return `<div class="card guide"><h2>How the week works</h2><p>Operator keeps strength work minimal and sub-maximal so conditioning can carry the real weekly load. Three lifts, three sets, never near failure.</p>
  <dl class="kv"><dt>Mon</dt><dd>Operator Day 1: squat, bench, Lift 3 + accessories</dd><dt>Tue</dt><dd>HIC: MAP</dd><dt>Wed</dt><dd>Operator Day 2: squat, bench, Lift 3 + accessories</dd><dt>Thu</dt><dd>Plyos first, rest 10 min, then HIC: Anaerobic</dd><dt>Fri</dt><dd>Operator Day 3: squat, bench, deadlift + accessories</dd><dt>Sat</dt><dd>HIC: Threshold / Long HIC alternating, or LISS after a heavy week</dd><dt>Sun</dt><dd>Off</dd></dl></div>
  <div class="card guide"><h3>Strength rules</h3><ul class="tight"><li>Sets can range 3–5 depending on what you can handle. Deadlift stays 1–3 sets.</li><li>Minimum 2 min rest between sets; 5 min on heavy squat and deadlift weeks.</li><li>If a set grinds at 70–80%, your max is too high. Lower it rather than pushing through.</li><li>Ramp: skip the 85% single on light weeks; add a 90% single on heavy weeks. Deadlift needs only 2–3 ramp sets; Lift 3 needs one light set of 10 and one at 70%.</li></ul></div>
  <div class="card guide"><h3>Conditioning: Black</h3><div class="tbl-wrap"><table><thead><tr><th>Format</th><th>Session</th><th>System</th></tr></thead><tbody>${Object.values(HIC).map(x=>`<tr><td><b>${x.name}</b></td><td>${x.sess}</td><td class="small muted">${x.sys}</td></tr>`).join('')}</tbody></table></div><ul class="tight"><li>Black sets the dose, not the tool. The ${MOD[defMod()].name.toLowerCase()} is your default; switch activity on any HIC or LISS day (sprints, rower, cycling, ruck, swim and more).</li><li>Keep the format and activity fixed to track progress. Results only compare within the same activity.</li><li>If most sessions are on a bike, watch hip flexors and saddle position: it compounds with squats and deadlifts.</li><li>Running and rucking add impact and back load. On Thursdays, plyos come first, so keep sprint volume low that day.</li></ul>
  <p><b>Optional sets (Operator I/A).</b> K. Black's intermediate/advanced take on Operator hands you the volume decision: rather than a fixed three sets, you work somewhere in a range and choose on the day. Tap <b>+</b> at the end of the sets on any lift card and you get another one, for that lift on that day only — the program is not touched and tomorrow is back to normal. If you want the room there every week instead, give the week an <b>Up to</b> value in Setup. Either way the surplus sets show dashed, and nothing is counted as missed if you skip them. In <i>Ageless Athlete</i> Jim Madden calls this the part of I/A he considers essential, and a few extra sets on weighted pull-ups his favourite way to add upper-body size without derailing recovery. Deadlift has always worked this way here: one set required, up to three.</p>
  <p><b>What this is not.</b> Full Operator I/A also floats your lifting days 48 to 72 hours apart, so the wave advances by session rather than by week. This app runs on a calendar, so it does not do that — and Madden says he mostly keeps a fixed three-sessions-a-week schedule himself, taking his variability in sets and intensity instead. That is the part you have here.</p>
  <p><b>Easy week.</b> Every third week the conditioning load comes down, and it is meant to land on the wave's 90% and 95% weeks so the heavy lifting gets the energy. The app does this for you: fewer rounds, shorter LISS, on weeks 3 and 6 of each cycle. It is not a week you have missed.</p>
  <p><b>FOBBITs.</b> Named for the soldier who never leaves the forward operating base — the session you can run with no ground to cover and barely any kit. You keep moving on an easy base — a pace just under a jog — and step off every two minutes for a set of reps, alternating two movements: twenty kettlebell swings, then ten snatches per arm. Twenty minutes of base is the standard dose; fifteen is the easy version with the reps halved, thirty the hard one. The sets are not on the clock, so the session runs longer than its name. It is an aerobic-based HIC, so it earns its place on a hard day, with one catch worth knowing: <b>run it past 30 minutes and it stops counting as a HIC</b> and becomes an easy session instead, because the intensity is not high enough to hold for that long.</p>
  <p class="small muted">Good for weather, for a hotel, for a day when the bike is taken, and for keeping impact off the legs the day before a heavy squat.</p></div>
  <div class="card guide"><h3>Plyometrics</h3><p>A nervous-system stimulus, not a workout. Quality of each rep matters far more than how many you do: 15 to 20 minutes of actual work, once a week, before HIC and never after. Phases rotate every 3 training weeks. Deload weeks use the extensive session at half volume.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Phase</th><th>Exercise</th><th>Sets × reps</th><th class="n">Contacts</th><th class="n">Rest</th></tr></thead><tbody>${PLYO.map(ph=>ph.ex.map((e,i)=>`<tr><td>${i?'':`<b>${ph.name}</b><br><span class="small muted">~${ph.target}</span>`}</td><td>${esc(e.label)}</td><td class="mono small">${e.s} × ${esc(e.r)}</td><td class="n">${e.c}</td><td class="n">${e.rest>=120?e.rest/60+' min':e.rest+' s'}</td></tr>`).join('')).join('')}</tbody></table></div>
  <ul class="tight"><li><b>Watch distance, not set count.</b> If any jump drops more than ~5% off your first broad jump, the session is over.</li><li><b>Every rep maximal or near it.</b> If you’re breathing hard, you’re doing conditioning.</li><li><b>Cut, don’t skip.</b> After a hard lifting week, halve the contacts.</li><li><b>Counting contacts:</b> one landing = one contact, even on two feet. The volumes are calibrated that way.</li></ul>
  <p><b>Progressing between blocks.</b> Add contacts before you add intensity. Raise intensity by shortening ground contact time, not by jumping higher or adding box height. If your broad jump hasn’t moved after two full blocks, the limiter is usually recovery or strength, not jump volume.</p></div>
  <div class="card guide"><h3>Plyo exercise library</h3><p class="small muted">Setup, execution, cues and the errors that matter. Tap an exercise to open it. The same entries open from Thursday’s card.</p>
  <div class="stack" style="gap:10px">${[['Warm-up drills',['pogo','askip']],['Jump tests',['broad','vertj','triple']],['Extensive',['broad','box','lbound']],['Unilateral + reactive',['cbroad','slhop','bdist','hurdle']],['Elastic',['depth','sllat','bheight']],['Upper body (optional)',['slam','scoop','dbsnatch','highpull','chestpass','plyopush','plyopushbox','speedpress','explpull','bandrow','rotthrow','bandrot']]].map(([g,ids])=>`<div class="stack" style="gap:6px"><h4 style="margin:6px 0 0;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${g}</h4>${ids.map(id=>`<details class="px"><summary><span>${esc(PLIB[id].name)}</span></summary>${plyoEntry(id)}</details>`).join('')}</div>`).join('')}</div></div>
  <div class="card guide"><h3>Base Building</h3><p>Tactical Barbell II's Block I: eight weeks of aerobic base and strength-endurance before you go back to heavy barbell work. Add it from the Plan tab and it runs in place of your next cycle; Operator picks up where it left off afterwards, at the same maxes.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Day</th>${[1,2,3,4,5,6,7,8].map(w=>`<th>W${w}</th>`).join('')}</tr></thead><tbody>${[0,1,2,3,4,5,6].map(d=>`<tr><td>${d+1}</td>${[1,2,3,4,5,6,7,8].map(w=>{const r=BB_WEEKS[w-1][d],k=r[0];return `<td class="small">${k==='se'?'SE '+r[1]+'×'+r[2]:k==='e'?'E '+r[1]+(r[2]?'–'+r[2]:'')+'M':k==='ms'?'Strength':k==='hic'?'HIC':k==='rec'?'Recovery':'Rest'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>
  <ul class="tight"><li>Weeks 1–5 are endurance and strength-endurance dense, with no barbell work at all. That is deliberate: it frees the energy for the long sessions and gives tendons and joints a break before heavy lifting returns.</li><li>Weeks 6–8 taper the long work and bring back two strength days and the aerobic-leaning HIC sessions.</li><li>Every E session is a minimum of 30 minutes. Day 6 is the long one, with a recovery day before it and a rest day after, so push the duration there.</li><li>Recovery days are movement drills, mobility, an easy swim or bike, a walk, yoga, or nothing at all.</li><li>At least one completely free day a week. Walking and pick-up sport are fine.</li><li>Eat for it. The book asks for 1–2 g of protein per pound of bodyweight through the block and is firmly against going low-carb while the volume is up.</li><li><b>Strength-first</b> reverses it: lift for the first five weeks, strength-endurance for the last three. The book doesn't give rep numbers for those late SE weeks, so the app ramps 3×30, 3×40, 3×50.</li></ul></div>
  <div class="card guide"><h3>Strength-endurance circuits</h3><p>Five to eight exercises covering the whole body, done one after another. Do your reps, take a short rest, move to the next. After a full circuit, rest two minutes and go again. The shorter you can make the rests, the better — down to none if you can hold it together.</p>
  <ul class="tight"><li>Reps run 20 to 50. If you can't get them all in one go, rest-pause until they're done, then move on. Failing at 25 now and hitting 40 later is the whole point.</li><li>Barbells and dumbbells: roughly <b>15–30% of your one-rep max</b>. Don't test for it. Too heavy, take weight off.</li><li>Pick movements you can reach without queueing. A busy bench breaks the rests that make this work.</li><li>Avoid anything you can't do for high reps. A rule of thumb: be good for 15–20 reps before putting a movement in. Pull-ups, pistols and one-arm push-ups sit in that grey area.</li><li>One arm or one leg at a time splits the reps: 30 means 15 a side.</li></ul>
  <div class="sm-grid">${Object.entries(SE_CLUSTERS).filter(([k])=>k!=='mine').map(([k,c])=>`<div class="sm"><div class="sm-h"><b>${c.name}</b></div><ul class="tight">${c.ex.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><div class="small muted">${esc(c.note)}</div></div>`).join('')}</div>
  <p class="small muted">Set your own in Setup → Strength-endurance, or switch cluster on any single SE day from the session card.</p></div>
  <div class="card guide"><h3>Accessories</h3>
  <p><b>Jobs, not a list.</b> Each lifting day covers a few jobs — a horizontal pull, some core, a carry, arms — and you choose what does each one. Setup → Accessories sets which jobs a day covers and what fills them. The choice is per cycle, like your cluster lifts, because that is what it is: a programme decision, not something to re-make every session. It is also per day, so a job that comes round three times a week can be a different movement each time.</p>
  <p><b>Swapping on the day.</b> If your biceps slot is barbell curls and the bar is taken, change it on the day’s card. That session uses what you picked and is logged as it, the block’s choice is untouched, and the card marks it <b>today only</b> so you can see at a glance that it was a substitution.</p>
  <p><b>Logging.</b> Sets, weight and reps, like the main lifts, or just <b>Mark done</b> if you would rather not count. Everything is recorded against the job and against the exercise, so a year later the log still says it was hammer curls and not what happens to be in that slot now.</p>
  <p><b>Missing a movement?</b> Setup → Accessories → Your own takes a name, the job it does and the kit it needs. It then appears everywhere the built-in ones do and follows you to your other devices.</p>
  <ul class="tight"><li>After the main lifts, never before. Two or three sets of each job, a couple of reps short of failure.</li><li>Skip entirely on heavy weeks and deloads.</li><li>Legs need almost nothing. Keep the pull-up progression in.</li></ul></div>
  <div class="card guide"><h3>Deloads and retests</h3>
  <p><b>What the book does.</b> Operator runs six-week blocks back to back and retests after two of them — twelve weeks, which it calls the optimal length of a strength phase. Six weeks is the minimum between tests and suits experienced lifters; waiting longer is fine, and if the loads still feel heavy the advice is to keep your current numbers rather than test on schedule. There is no deload week: the recovery it prescribes is a full week or more off every three to six months. Rest two to three days before a test day, ramp up, and take a 3–5 rep max rather than a true single if you prefer — the calculator does the rest.</p>
  <p><b>What we add.</b> An optional scheduled deload, off by default, because a light week every few cycles suits running this year-round outside a unit. Turn it on in Setup if you want it.</p>
  <p>Deload weeks drop to ${plan.deload.s}×${plan.deload.r} @ ${plan.deload.p}% (deadlift 1 set), swap all HIC to LISS, halve plyos and drop accessories. Retest weeks take three easy days, then heavy singles split across Thursday (squat, bench, jumps) and Saturday (deadlift, Lift 3, max pull-ups). Saturday's card feeds results into the next cycle.</p><p>Need a deload sooner? Add one from the Plan tab, or from the warning on Today after repeated hard sessions.</p></div>
  <div class="card guide"><h3>Calendar feed</h3>
  <p>Your plan, subscribed to in the calendar app you already use. Every training day turns up as an all-day entry with the session on it: which lifts, the sets and reps, the percentage and the actual weight to put on the bar. Rest days are left out. It covers eighteen weeks ahead and a fortnight behind, and it is read-only, so nothing you do in your calendar changes your training.</p>
  <p><b>Turning it on.</b> Setup &rarr; Calendar feed &rarr; <b>Turn on the feed</b>. You get a private web address ending in <code>.ics</code>. That address is all anyone needs to read your schedule, so treat it like a password: don\u2019t post it anywhere, and don\u2019t let it into a shared document.</p>
  <p><b>On iPhone or iPad.</b> The quickest way is the <b>Add to iPhone</b> button on that card, which opens Calendar with the address already filled in. Tap Subscribe, then Add. If the button does nothing, copy the address and go to Settings &rarr; Apps &rarr; Calendar &rarr; Calendar Accounts &rarr; Add Account &rarr; Other &rarr; Add Subscribed Calendar, and paste it there. On older versions of iOS the same screen is at Settings &rarr; Calendar &rarr; Accounts.</p>
  <p><b>On Android.</b> Google Calendar can only add a subscription on a computer, not in the phone app. Open <b>calendar.google.com</b>, find <b>Other calendars</b> in the left column, press <b>+</b>, choose <b>From URL</b>, paste the address and press Add calendar. Then open Google Calendar on the phone, go to the menu &rarr; Settings, find the new calendar in the list and turn <b>Sync</b> on. That last step catches people out: until you do it the calendar exists on your account but never appears on the phone.</p>
  <p><b>Putting it at the time you train.</b> By default every session is an all-day entry, which sits at the top of the day and blocks nothing out. On the same Setup card, switch <b>In the calendar</b> to <b>At a set time</b> and give it your usual training time, and each session is booked properly instead: 75 minutes for a lifting day, 90 for a retest, and for conditioning however long the timer says that format actually runs, so a 23-minute MAP session books 23 minutes. If you train later at weekends, put that time in the <b>Saturdays and Sundays</b> box; leave it empty to use the same time all week.</p>
  <p>The time is read as the local time wherever you are. Set 6am and it stays 6am in another country, rather than sliding to 1am because of the time difference. That is what you want for a training time, and it is why the entries carry no timezone.</p>
  <p><b>Reminders.</b> Pick one under <b>Reminder</b> and every session gets an alert: at the start, or 15 minutes, half an hour, one hour or two hours before. The reminder hangs off the session time, so it needs <b>At a set time</b> to mean anything precise. If you would rather keep all-day entries, the one reminder on offer there is <b>8pm the night before</b>, which is the useful one anyway for packing a bag. Reminders are off until you choose one.</p>
  <p><b>How often it updates.</b> The app writes the calendar, not the server, because the schedule is worked out on your phone and a second copy on the server would eventually disagree with it. So the feed is as fresh as the last time you opened the app. Move a week, change a max, swap a lift: open the app once and the calendar follows. Your calendar app then picks the change up on its own schedule. iPhone usually does that within a few hours, and you can force it by pulling down in Calendar. <b>Google is slow</b> and can take most of a day for the first sync and for later changes. That is Google\u2019s refresh interval, not something this app can hurry.</p>
  <p><b>What is in it, and what is not.</b> The feed carries the schedule only: dates, session types, lifts, prescriptions and working weights. It does not carry what you logged, your maxes, bodyweight, measurements, readiness scores or anything about your account. Someone who found the address would learn what you are planning to lift, and nothing else.</p>
  <p><b>If you need to revoke it.</b> <b>New address</b> on the same card issues a fresh one and stops the old address working immediately. Use it if the link gets out. You then have to re-subscribe on your devices, because the old subscription is pointing at an address that no longer exists. <b>Turn off</b> removes the feed entirely.</p>
  <p><b>If the calendar says it cannot connect.</b> Check the address is the current one, since <b>New address</b> invalidates the previous link. If it is right and it still fails, open this app once to make sure the feed has been written, then try again.</p></div>
  <div class="card guide"><h3>Warm-up</h3>${warmupShort()}</div>
  <div class="card guide"><h3>Warm-up and mobility library</h3><p class="small muted">Every movement in the warm-up and the mobility blocks, with what it is for and the ways it usually goes wrong. The same entries open from the checklists on the day.</p>
  <div class="stack" style="gap:10px">${[
    ['Raise and reset',['raise','breath9090','catcow','breathwall']],
    ['Spine and t-spine',['thread','openbook','quadtspine','foamtspine','childlat','deadhang']],
    ['Hips',['hip9090','lean9090','couch','frog','wgs','fig4','pigeon','quadstand']],
    ['Hamstrings and posterior chain',['fold','seatedfold','hamstring']],
    ['Ankles and feet',['calfstraight','calfbent','kneewall','footroll']],
    ['Activation',['legswing','bandpull','glutebridge']]
  ].map(([g,ids])=>`<div><h4 class="sub-h">${esc(g)}</h4><div class="stack" style="gap:6px;margin-top:6px">${ids.map(id=>`<details class="px" data-px="ml-${id}"${openPx.has('ml-'+id)?' open':''}><summary><span>${esc(MLIB[id].name)}</span></summary>${libBody(MLIB[id])}</details>`).join('')}</div></div>`).join('')}</div></div>`;
}
