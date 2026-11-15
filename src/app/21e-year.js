/* The year planner (04e-year.js), drawn in Setup → Programs under the program you are
   on: every block with its dates, tap one to move it, change its cycles, add after it
   or remove it; and planning back from a goal, which fills it. */
function yearSection(){
  if(newProg) return '';
  const bl=yrBlocks(), n=nextQueued(), sw=progSwitchMonday(), st=yrFirstStart();
  const extra=bl.length&&st>sw?Math.round((D(st)-D(sw))/(7*864e5)):0;
  let h=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><div class="lift-h"><h3>Your year</h3>${bl.length?`<span class="mono muted small">to ${esc(fmtLong(yrEnd()))}</span>`:''}</div>
  <div class="row between small"><span><b>${esc(progName())}</b> <span class="muted">now</span></span><span class="mono muted">${fmtD(plan.startMonday)} – ${fmtD(addDays(st,-1))}</span></div>`;
  if(extra) h+=`<div class="small muted">Runs ${extra} week${extra===1?'':'s'} past its handover, so the plan lands on your date.</div>`;
  if(!bl.length) h+=`<p class="note" style="margin:0">Nothing planned after it yet. Line up what comes next, or plan the year back from a goal.</p>`;
  if(yrAdd===0&&!bl.length) h+=yrAddSheet(0);
  for(const b of bl){ h+=yrRow(b,n); if(yrAdd===b.i+1) h+=yrAddSheet(b.i+1) }
  if(yg) h+=ygSheet();
  else if(yrAdd==null) h+=`<div class="row"><button class="btn" data-act="yradd" data-i="${bl.length}">Add a block at the end</button><button class="btn" data-act="yrgoal">Plan a year from a goal…</button></div>`;
  h+=`<p class="note" style="margin:0">Only the first is lined up for real. The rest are your plan: each starts from what the one before leaves you, and you can change any of them until it starts.</p>`;
  return h+`</div>`;
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
  const G=YR_GOALS[yg.goal], r=ygPlan(yg.goal,yg.date);
  let h=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><h3>What is the year for?</h3>
  <div class="seg">${Object.entries(YR_GOALS).map(([k,x])=>`<button class="segb${yg.goal===k?' on':''}" data-act="ygset" data-v="${k}" aria-pressed="${yg.goal===k}">${esc(x.label)}</button>`).join('')}</div>
  <label class="f">${esc(G.date)}<input type="date" id="yg-date" data-yg="date" value="${esc(yg.date)}"></label>`;
  if(!r) return h+`</div>`;
  h+=`<div class="small muted">${r.gap} weeks between the end of ${esc(progName())} (${fmtD(addDays(progSwitchMonday(),-1),true)}) and ${esc(G.name)}.</div>`;
  if(r.short) h+=`<div class="banner warn"><div class="small"><b>Shorter than the book’s shortest.</b> Even ${r.need} weeks does not fit in ${r.gap}. Pick a later date, or change program now. <span class="mono muted">${esc(r.cite)}</span></div></div>`;
  else if(r.cut) h+=`<div class="banner warn"><div class="small"><b>Shortened to fit.</b> ${esc(r.cut)} <span class="mono muted">${esc(r.cite)}</span></div></div>`;
  if(!r.short){
    h+=`<h3>Worked back from the date</h3><div class="stack" style="gap:4px">${yrLay(r.items).map(b=>`<div class="row between small"><span><b>${esc(itemName(b.it))}</b></span><span class="mono muted">${fmtD(b.start)} – ${fmtD(b.end)}</span></div>`).join('')}</div>`;
    if(r.extra) h+=`<div class="small muted">${esc(progName())} runs ${r.extra} week${r.extra===1?'':'s'} longer first: too short for a block of its own.</div>`;
    h+=`<p class="small muted" style="margin:0">After it: a week off, then the chooser again from where you are. <span class="mono">TB I p58</span></p>`;
  }
  return h+`<div class="row">${r.short?'':`<button class="btn primary" data-act="yruse">${yrItems().length?'Replace your year with this':'Use this plan'}</button>`}<button class="btn ghost" data-act="yrclose">Cancel</button></div></div>`;
}
