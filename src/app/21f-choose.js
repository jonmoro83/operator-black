/* ---------- the Choose tab (3.107) ----------
Asked 2026-11-15: "The chooser is way too cumbersome. It needs to be its own tab and
much more user friendly." The user chose, from the prototype, A, one question at a
time, as a tab between Plan and History. Three short steps with big buttons, then one
screen with the program, when it starts, and the one button that schedules it. The
reasons, the other paths and the coach's swaps sit behind links on that screen.
The chooser underneath is the same (04d-prog-rec.js); this is how it is asked. Last
time's answers come back selected, so going again is Next, Next, Next. */
const CHZ_TILES=[
  ['general','All-round','Strength and conditioning both'],
  ['endurance','An endurance event','A ski tour, a big hike, selection, a long ruck'],
  ['run','Running','A race, or running better'],
  ['size','Getting bigger','Muscle first'],
  ['fight','A fight gym or sport','Hard training somewhere else too'],
  ['minimal','Least time','Keep what you have'],
];
// Step 2's questions, in the order a person knows the answers.
const CHZ_QUICK=['barbell','exp','bb','older','other','cond'];
function chzTile(a){ return a.other==='yes'&&a.goal==='general'?'fight':a.goal }
function chzSetTile(v){
  if(!chz) return false;
  if(v==='fight'){ chzSet('goal','general'); chzSet('other','yes') }
  else { const was=chzTile(chz.a); chzSet('goal',v); if(was==='fight') chzSet('other','no') }
  return true;
}
// The tab opens on what follows the current program unless something else asked.
function chzTab(){
  if(!chz||chz.ctx==='wz') chzOpen('next');
  if(!chz.tab){ chz.tab=true; chz.step=0 }
  if(chz.ctx==='next') chz.full=true;
  return chz;
}
function vChoose(){
  if(viewing) return `<div class="card"><p class="note" style="margin:0">Go back to your current program to choose what comes next.</p></div>`;
  if(chzDone&&!chz) return `<div class="card"><h2>Scheduled</h2><div class="small"><b>${esc(chzDone.line)}</b>, from ${esc(fmtD(chzDone.start,true))}. It is on the Plan and the calendar from that week, and starts by itself that Monday.</div>
    <div class="row"><button class="btn primary" data-act="chzsee">See it on the calendar</button><button class="btn ghost" data-act="chzdoneok">Choose again</button></div></div>`;
  const c=chzTab();
  if(c.ctx==='warn'||c.ctx==='reason') return `<div class="card">${chooserFlow()}</div>`;
  const head=c.ctx==='now'?'Change program now':c.ctx==='add'?'Add to your year':`After ${esc(progName())}`;
  const dots=`<div class="chz-dots" aria-label="${c.step<3?'Step '+(c.step+1)+' of 3':'Your program'}">${[0,1,2,3].map(i=>`<i class="${i<=c.step?'on':''}"></i>`).join('')}<span class="small muted">${c.step<3?'Step '+(c.step+1)+' of 3':'Your program'}</span></div>`;
  const back=c.step?`<button class="btn" data-act="chzstep" data-v="${c.step-1}">Back</button>`:'';
  const bar=(main)=>`<div class="chz-bar"><div class="row" style="flex-wrap:nowrap">${back}${main}</div></div>`;
  const over=chzDirty()?`<button class="btn ghost sm" data-act="chzreset">Start over</button>`:'';
  let h=`<div class="row between" style="padding:0 2px"><h3>${head}</h3>${over}</div>`+dots;
  if(c.step===0){
    const nx=c.ctx==='next'?chzBookNext():null;
    h+=`<h2 class="chz-q">What are you training for?</h2>${chzTagLine('goal')}
    <div class="chz-tiles">${CHZ_TILES.map(([k,l,s])=>`<button class="chz-tile${chzTile(c.a)===k?' on':''}" data-act="chzgoal" data-v="${k}" aria-pressed="${chzTile(c.a)===k}"><b>${esc(l)}</b><span>${esc(s)}</span></button>`).join('')}</div>`;
    if(chzCoachOn()) h+=c.say||c.fill?`<div class="card">${chzGoalBox()||'<p class="note" style="margin:0">Answering the questions yourself.</p>'}</div>`:`<div><button class="btn ghost" data-act="chzsay">Or describe it in your own words</button></div>`;
    if(nx&&!nx.oms) h+=`<div class="banner info"><div class="small"><b>The books’ next step after ${esc(progName())}:</b> ${esc(pickLine(nx))}.${nx.why.map(([t,c])=>` ${esc(t)} <span class="mono muted">${esc(c==='ours'?'Ours.':c)}</span>`).join('')}</div><div><button class="btn sm" data-act="chzlinebook">Line it up</button></div></div>`;
    return h+bar(`<button class="btn primary" style="flex:1" data-act="chzstep" data-v="1">Next</button>`);
  }
  if(c.step===1){
    h+=`<h2 class="chz-q">How many days a week can you lift?</h2>${chzTagLine('days')}
    <div class="seg wide chz-big">${['2','3','4'].map(v=>`<button class="segb${c.a.days===v?' on':''}" data-act="chz" data-k="days" data-v="${v}" aria-pressed="${c.a.days===v}">${v}</button>`).join('')}</div>
    <p class="note" style="margin:0">Barbell days only. Conditioning goes on the other days.</p>`;
    return h+bar(`<button class="btn primary" style="flex:1" data-act="chzstep" data-v="2">Next</button>`);
  }
  if(c.step===2){
    h+=`<h2 class="chz-q">A few quick ones</h2><div class="stack" style="gap:10px">${CHZ_QUICK.map(k=>{ const q=CHZ_Q.find(x=>x.k===k);
      return `<div class="card" style="gap:6px"><span class="small" style="font-weight:700">${esc(q.q)}</span>${chzTagLine(k)}<div class="seg wide">${q.opts.map(([v,l])=>`<button class="segb${c.a[k]===v?' on':''}" data-act="chz" data-k="${k}" data-v="${v}" aria-pressed="${c.a[k]===v}">${esc(l)}</button>`).join('')}</div></div>` }).join('')}</div>`;
    return h+bar(`<button class="btn primary" style="flex:1" data-act="chzstep" data-v="3">See my program</button>`);
  }
  return h+chzAnswer()+`<div class="row">${back}</div>`;
}
// Where an answer came from, when the coach filled it in from your goal.
function chzTagLine(k){ const g=chzTag(k); return g?`<div class="small"><span class="chip${g.q?' blue':''}">${esc(g.t)}</span>${g.q?` <span class="small muted" style="font-weight:400">“${esc(g.q)}”</span>`:''}</div>`:'' }
function chzAnswer(){
  const c=chz, r=chzResult(), pk=r.picks[0], btn=chzBtn(c.ctx);
  if(!pk) return `<div class="card"><p class="note" style="margin:0">Nothing fits those answers. Go back and change one.</p></div>`;
  const src=pickSrc(pk), aim=String(c.aim||(plan.programGoals||{}).aim||'').trim();
  let h=`<div class="card"><div class="row between"><span class="small muted">The books suggest</span><span class="chip${src==='Ours'?'':' blue'}">${esc(src)}</span></div>
  <h2 class="chz-pick">${esc(pickName(pk))}</h2><div class="small">${esc(pickLine(pk))}</div>
  ${pk.why[0]?`<div class="small">${esc(pk.why[0][0])} <span class="mono muted">${esc(pk.why[0][1]==='ours'?'Ours.':pk.why[0][1])}</span></div>`:''}
  ${pk.why.length>1?`<details class="plain"><summary class="small"><b>Why this</b></summary><div style="margin-top:6px">${whyList(pk.why)}</div></details>`:''}
  ${pk.cl?`<details class="plain"${c.sw?' open':''}><summary class="small"><b>Conditioning sessions</b> (${pk.cl.fs.length} + E)</summary><div class="stack" style="gap:8px;margin-top:6px">${pickSessions(pk)}${aim&&chzCoachOn()?swapList(c.sw,chzClusterFor(pk,c.a),aim,'chzswap','chzswaptake'):''}</div></details>`:''}
  </div>`;
  if(r.picks.length>1){ const p2=r.picks[1];
    h+=`<div class="card"><span class="small muted">Or the other path</span><h2>${esc(pickName(p2))}</h2><div class="small">${esc(pickLine(p2))}</div>${p2.why[0]?`<div class="small">${esc(p2.why[0][0])} <span class="mono muted">${esc(p2.why[0][1]==='ours'?'Ours.':p2.why[0][1])}</span></div>`:''}${btn(p2,1,true)}</div>` }
  for(const [t,cite] of r.notes) h+=`<div class="banner info"><div class="small">${esc(t)} <span class="mono muted">${esc(cite)}</span></div></div>`;
  if(r.alts.length) h+=`<details class="plain card"><summary><b>Also fits</b> <span class="small muted">${r.alts.length} more</span></summary><div class="stack" style="gap:10px;margin-top:10px">${r.alts.map((a,j)=>`<div class="stack" style="gap:4px"><b>${esc(a.oms?'The OMS rotation':pickName(a))}</b>${a.oms?'<div class="small muted">Set it up under OMS rotation in Setup.</div>':`<div class="small">${esc(pickLine(a))}</div>${btn(a,r.picks.length+j,false)}`}</div>`).join('')}</div></details>`;
  if(c.ctx==='next'){ const st=chzStart();
    h+=`<div class="card">${yrFromSeg(progHandovers(),st,'chzstart',x=>x.start,'When it starts')}<p class="note" style="margin:0">It starts by itself that Monday, and the Plan shows it from then. Nothing changes before.</p></div>
    <div><button class="btn ghost" data-act="chznow">I need to change now instead</button></div>`;
  } else if(c.ctx==='now') h+=`<p class="note" style="margin:0">The new program starts next week, with your maxes carried over. You confirm it on the next screen.</p>`;
  return h+chzBar();
}
