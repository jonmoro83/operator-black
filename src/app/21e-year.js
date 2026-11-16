/* The year planner (04e-year.js), drawn in Setup → Programs under the program you are
   on: every block with its dates, tap one to move it, change its cycles, add after it
   or remove it; and planning back from a goal, which fills it. */
function yearSection(){
  if(newProg) return '';
  const bl=yrBlocks(), n=nextQueued(), sw=progSwitchMonday(), st=yrFirstStart();
  const hb=progHandovers().filter(x=>x.start<=st).pop(), base=hb?hb.start:sw, extra=bl.length&&st>base?Math.round((D(st)-D(base))/(7*864e5)):0;
  let h=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><div class="lift-h"><h3>Your year</h3>${bl.length?`<span class="mono muted small">to ${esc(fmtLong(yrEnd()))}</span>`:''}</div>
  <div class="row between small"><span><b>${esc(progName())}</b> <span class="muted">now</span></span><span class="mono muted">${fmtD(plan.startMonday)} – ${fmtD(addDays(st,-1))}</span></div>`;
  if(bl.length) h+=yrFromSeg(progHandovers(),st,'yrfrom',x=>x.start);
  if(extra) h+=`<div class="small muted">Runs ${extra} week${extra===1?'':'s'} past its handover, so the plan lands on your date.</div>`;
  if(!bl.length) h+=`<p class="note" style="margin:0">Nothing planned after it yet. Line up what comes next, or plan the year back from a goal.</p>`;
  if(yrAdd===0&&!bl.length) h+=yrAddSheet(0);
  for(const b of bl){ h+=yrRow(b,n); if(yrAdd===b.i+1) h+=yrAddSheet(b.i+1) }
  if(yg) h+=ygSheet();
  else if(yrAdd==null) h+=`<div class="row"><button class="btn" data-act="yradd" data-i="${bl.length}">Add a block at the end</button><button class="btn" data-act="yrgoal">Plan a year from a goal…</button></div>`;
  h+=`<p class="note" style="margin:0">The first starts by itself on its Monday, and the Plan shows it from then. The rest are your plan: each starts from what the one before leaves you, and you can change any of them until it starts.</p>`;
  return h+`</div>`;
}
// Where the year starts, when there is a choice: the chooser's two handovers.
// Where the year starts: the chooser's two handovers, or a Monday of your own.
function yrFromSeg(hs,on,act,val,label){
  const cyc=hs.find(x=>x.k==='cycle'), last=hs[hs.length-1], own=!hs.some(x=>x.start===on), min=addDays(mondayOf(realToday()),7);
  let h=`<div class="f"><span>${esc(label||'Start the plan')}</span>${hs.length>1||own?`<div class="seg">${hs.map(x=>`<button class="segb${x.start===on?' on':''}" data-act="${act}" data-v="${esc(val(x))}" aria-pressed="${x.start===on}">${esc(x.label)} · ${esc(fmtD(x.start,true))}</button>`).join('')}</div>`:''}</div>
  <label class="f">Or pick a date <span style="font-weight:500">(it starts on that week’s Monday)</span><input type="date" id="${act}-date" data-startpick="${act}" value="${esc(on)}" min="${min}"></label>`;
  if(cyc&&cyc.start===on) h+=`<p class="note" style="margin:0">This block will not be retested, so the plan starts from the maxes you have then. The book’s point to change is after the retest. <span class="mono muted">TB I p33</span></p>`;
  else if(own&&on<last.start) h+=`<p class="note" style="margin:0">Partway through ${esc(progName())}: it stops there without its retest, so what follows starts from the maxes you have then. The book’s point to change is after the retest (TB I p33), and a new cluster after at least two blocks (p49).</p>`;
  else if(own) h+=`<p class="note" style="margin:0">${esc(progName())} carries on past its handover (${esc(fmtD(last.start,true))}) with more cycles until then.</p>`;
  return h;
}
function yrRow(b,n){
  const it=b.it, open=yrSel===b.i, first=n&&n.qi===b.i, i=b.i;
  let h=`<div class="card" style="background:var(--bg);gap:6px;padding:10px 12px">
  <button class="btn ghost" style="justify-content:flex-start;text-align:left;padding:0;min-height:0;border:0;display:block" data-act="yrsel" data-i="${i}" aria-expanded="${open}">
  <span class="lift-h"><b>${esc(itemName(it))}</b><span class="chip${first?' blue':''}">${first?'Lined up next · ':''}${b.weeks} week${b.weeks===1?'':'s'}</span></span>
  <span class="mono muted small" style="display:block">${fmtD(b.start,true)} – ${fmtD(b.end)}</span>
  ${it.off?`<span class="small muted" style="display:block">A week off every few months. <span class="mono">TB I p58</span></span>`:it.why?`<span class="small muted" style="display:block">${esc(it.why[0])} <span class="mono">${esc(it.why[1])}</span></span>`:''}</button>`;
  if(b.warn) h+=`<div class="banner warn"><div class="small">No week off in the ${b.since} weeks before this. The book takes one every few months. <span class="mono muted">TB I p58</span></div><div><button class="btn sm" data-act="yroff" data-i="${i}">Add a week off before this</button></div></div>`;
  if(first&&nextDue()) h+=`<div class="row"><button class="btn sm primary" data-act="nextstart">Start it</button></div>`;
  if(open){
    const cyc=!it.off&&!itemFixed(it);
    h+=`<div class="row" style="gap:6px"><button class="btn sm" data-act="yrmv" data-i="${i}" data-v="-1" aria-label="Move earlier"${i?'':' disabled'}>↑</button><button class="btn sm" data-act="yrmv" data-i="${i}" data-v="1" aria-label="Move later"${i<yrItems().length-1?'':' disabled'}>↓</button>
    ${cyc?`<span class="small">Cycles before the retest</span><button class="btn sm" data-act="yrcyc" data-i="${i}" data-v="-1" aria-label="Fewer cycles">−</button><b>${itemCycles(it)}</b><button class="btn sm" data-act="yrcyc" data-i="${i}" data-v="1" aria-label="More cycles">+</button>`:''}</div>
    <div class="row"><button class="btn sm" data-act="yradd" data-i="${i+1}">Add after</button><button class="btn sm ghost" data-act="yrrm" data-i="${i}">Remove</button></div>`;
  }
  return h+`</div>`;
}
function yrAddSheet(i){
  const nx=yrBookAfter(i);
  return `<div class="stack" style="gap:8px"><h3>Add ${i?'after '+esc(itemName(yrItems()[i-1])):'first'}</h3>`
    +pickCard(nx,`<button class="btn primary" data-act="yraddbook" data-i="${i}">Add it</button>`).replace(/<span class="chip blue">[^<]*<\/span>/,'<span class="chip blue">The books’ next step</span>')
    +`<div class="row"><button class="btn" data-act="yraddoff" data-i="${i}">A week off</button><button class="btn" data-act="yraddchz" data-i="${i}">Something else: answer the questions</button><button class="btn ghost" data-act="yrclose">Cancel</button></div></div>`;
}
function ygSheet(){
  const G=YR_GOALS[yg.goal], r=ygPlan(yg.goal,yg.date,yg.from), hs=progHandovers(), fr=yrFrom(yg.from);
  let h=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><h3>What is the year for?</h3>
  <div class="seg">${Object.entries(YR_GOALS).map(([k,x])=>`<button class="segb${yg.goal===k?' on':''}" data-act="ygset" data-v="${k}" aria-pressed="${yg.goal===k}">${esc(x.label)}</button>`).join('')}</div>
  <label class="f">${esc(G.date)}<input type="date" id="yg-date" data-yg="date" value="${esc(yg.date)}"></label>`+yrFromSeg(hs,fr.start,'ygfrom',h=>h.k);
  if(!r) return h+`</div>`;
  h+=`<div class="small muted">${r.gap} weeks between ${fr.k==='cycle'?'the end of this cycle':fr.k==='date'?'your start':'the end of '+esc(progName())} (${fmtD(fr.k==='date'?fr.start:addDays(fr.start,-1),true)}) and ${esc(G.name)}.</div>`;
  if(r.short) h+=`<div class="banner warn"><div class="small"><b>Shorter than the book’s shortest.</b> Even ${r.need} weeks does not fit in ${r.gap}. Pick a later date, or change program now. <span class="mono muted">${esc(r.cite)}</span></div></div>`;
  else if(r.cut) h+=`<div class="banner warn"><div class="small"><b>Shortened to fit.</b> ${esc(r.cut)} <span class="mono muted">${esc(r.cite)}</span></div></div>`;
  if(!r.short){
    h+=`<h3>Worked back from the date</h3><div class="stack" style="gap:4px">${yrLay(r.items).map(b=>`<div class="row between small"><span><b>${esc(itemName(b.it))}</b></span><span class="mono muted">${fmtD(b.start)} – ${fmtD(b.end)}</span></div>`).join('')}</div>`;
    if(r.extra) h+=`<div class="small muted">${esc(progName())} runs ${r.extra} week${r.extra===1?'':'s'} longer first: too short for a block of its own.</div>`;
    h+=`<p class="small muted" style="margin:0">After it: a week off, then the chooser again from where you are. <span class="mono">TB I p58</span></p>`;
  }
  return h+`<div class="row">${r.short?'':`<button class="btn primary" data-act="yruse">${yrItems().length?'Replace your year with this':'Use this plan'}</button>`}<button class="btn ghost" data-act="yrclose">Cancel</button></div></div>`;
}
/* What's next, on Today in the program's last week: step 4 of the chooser, and the
   prototype's call (2026-11-15) that a lined-up program shows "in the last week, on
   Today". A lined-up program starts by itself on its Monday (the user's call the same
   day, after lining up Fighter with Green and finding the Plan still showing Operator):
   the card says when, and Put it off moves it, and the year behind it, a week later.
   With nothing lined up, the books' next step is offered to line up, and doing nothing
   keeps the program going. The OMS rotation has its own card. */
let nextErr=null, nextBegun=null;
function nextCard(){
  if(viewing||sel!==todayStr()||newProg||omsState().on) return '';
  const t=realToday(), cur=esc(progName());
  if(nextBegun) return `<div class="card"><div class="lift-h"><h3>${esc(nextBegun.name)} started today</h3><span class="chip blue">New program</span></div>
    <p class="small" style="margin:0"><b>${esc(nextBegun.line)}</b>, as you lined it up. ${esc(nextBegun.was)} is archived with everything in it, under Setup, Programs, and your maxes carried over.</p>
    <div class="row"><button class="btn ghost" data-act="nextseen">OK</button></div></div>`;
  const n=nextQueued();
  if(n){
    if(!nextDue()) return '';
    const st=n.start<mondayOf(t)?mondayOf(t):n.start;
    return `<div class="card"><div class="lift-h"><h3>${cur} hands over ${fmtD(st,true)}</h3><span class="chip blue">Lined up</span></div>
    <p class="small" style="margin:0">Next: ${n.offFirst?'a week off, then ':''}<b>${esc(pickLine(n))}</b>. It starts by itself that Monday.${n.why?` ${esc(n.why[0])} <span class="mono muted">${esc(n.why[1]==='ours'?'Ours.':n.why[1])}</span>`:''}</p>
    <p class="note" style="margin:0">${cur} is archived with everything in it, and your maxes carry over. The Plan already shows it.</p>
    ${nextErr?`<div class="banner warn"><div class="small">${esc(nextErr)}</div></div>`:''}
    <div class="row"><button class="btn" data-act="nextlater">Put it off a week</button><button class="btn ghost" data-act="nextchange">Change it</button></div></div>`;
  }
  if(plan.nextSnooze===mondayOf(t)) return '';
  const sw=progSwitchMonday(); if(t<addDays(sw,-7)) return '';
  const nx=chzBookNext();
  return `<div class="card"><div class="lift-h"><h3>${cur} hands over ${fmtD(sw,true)}</h3><span class="chip">Nothing lined up</span></div>
  <p class="small" style="margin:0">The books’ next step: <b>${esc(pickLine(nx))}</b>.${nx.why.map(([x,c])=>` ${esc(x)} <span class="mono muted">${esc(c==='ours'?'Ours.':c)}</span>`).join('')}</p>
  <div class="row"><button class="btn primary" data-act="chzlinebook">Line it up</button><button class="btn" data-act="nextchoose">Choose something else</button><button class="btn ghost" data-act="nextsnooze">Not yet</button></div>
  <div class="note">With nothing lined up, ${cur} carries on with another cycle.</div></div>`;
}
// Put off: the whole year moves a week, and the program you are on runs that week longer.
function nextLater(){
  const q=yrItems(); if(!q.length) return false;
  const n=nextQueued(), st=n.start<mondayOf(realToday())?mondayOf(realToday()):n.start;
  q[0]=Object.assign({},q[0],{start:addDays(st,7)}); mutatePlan(p=>{p.nextPrograms=q}); return true;
}
/* Starting it, on its Monday. Run after every sync (05-persistence.js), so it happens
   the first time the app is opened that week, on whichever device. */
function nextAuto(){
  const n=nextQueued();
  if(viewing||wz||newProg||omsState().on||!n||realToday()<n.start) return false;
  const was=progName();
  if(!nextStart()) return false;
  const pk=newProg.pick, err=beginProgram(newProg,pickPatch(pk,yrItems().slice(pk.qi+1)));
  newProg=null; nextErr=err;
  if(err) return false;
  nextBegun={name:progName(),line:pickLine(pk),was};
  sel=realToday(); return true;
}
/* The lined-up program, drawn before it starts: the plan it will be, built the way
   starting it builds it, swapped in to draw any day from its first Monday on. It keeps
   its own schedule caches across swaps, so a month of days does not rebuild either
   schedule once per day. */
let fpC={key:''}, previewing=null;
function futurePlan(){
  if(viewing||omsState().on) return null;
  const n=nextQueued(); if(!n) return null;
  const start=n.start<mondayOf(realToday())?mondayOf(realToday()):n.start;
  if(start<=plan.startMonday) return null;
  const key=planV+'|'+start+'|'+JSON.stringify(plan.nextPrograms);
  if(fpC.key!==key){
    const p=planFor({name:'Block '+((plan.programSeq||1)+1),start,mode:'carry'},pickPatch(n,yrItems().slice(n.qi+1)));
    fpC={key,p,line:pickLine(n),v:'f'+key,wc:{v:null,list:[]},mc:{v:null,m:{}}};
  }
  return fpC.p;
}
function withFuture(date,fn){
  if(previewing) return fn();
  const fp=futurePlan(); if(!fp||!date||date<fp.startMonday) return fn();
  const was={plan,planV,wcache,mcache};
  plan=fp; planV=fpC.v; wcache=fpC.wc; mcache=fpC.mc; previewing=fp;
  try{ return fn() }
  finally{ fpC.wc=wcache; fpC.mc=mcache; plan=was.plan; planV=was.planV; wcache=was.wcache; mcache=was.mcache; previewing=null }
}
