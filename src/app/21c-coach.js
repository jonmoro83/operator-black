/* ---------------- the coach ---------------- */
/* A conversation, not a series of lookups. Advice only: the coach can read the plan
   and the books and cannot change anything, which the card says rather than leaving
   to be inferred. Suggestions come back as their own items so that turning them into
   one-tap actions later is a change to this file, not to the contract with the
   server. */
let coach={q:'',busy:false,err:null,last:null,turns:null,loaded:false,log:null,logOpen:false};
const LIBNAME={tb1:'TB1',tb2:'TB2',tb3:'TB III',aa:'Ageless Athlete',mti:'MTI',guide:'Guide'};

function coachLoad(){
  if(coach.loaded) return; coach.loaded=true;
  api('GET','/coach').then(r=>{ coach.turns=r.turns||[];
    coach.used=r.used; coach.cap=r.cap; coach.configured=r.configured; coach.debrief=r.debrief||null; render() })
    .catch(()=>{ coach.turns=[]; render() });
}
/* What the app has scheduled for the next seven days, for the coach. The server cannot
   run the scheduler, and without this the coach chose conditioning on its own and
   disagreed with the day's card. On Black each conditioning day carries the
   recommendation and its reasons; see 04c-hic-rec.js. */
function coachAhead(){
  try{
    const t=realToday(), days=[];
    for(let i=0;i<7;i++){
      const d=addDays(t,i), dp=dayPlan(d); if(!dp||dp.t==='pre') continue;
      const o={d,day:dp.short||''}, f=effFmt(d);
      if(f&&HIC[f]){
        o.cond={session:HIC[f].name,kind:TB_CAT[hicTbCat(f)]};
        const R=dp.rec;
        if(R){ o.cond.recommended=HIC[R.f].name; if(f!==R.f) o.cond.picked=true; o.cond.why=R.why.map(([w,c])=>w+' ('+c+')') }
      }
      days.push(o);
    }
    const P=CPROTO[cprotoKey()];
    return {days,...(P.recommend?{cluster:hicCluster().map(c=>HIC[c.f].name),eSession:HIC[hicE()].name}:{})};
  }catch(e){ return null }
}
function coachAsk(){
  const q=coach.q.trim(); if(!q||coach.busy) return false;
  // Shown straight away with no answer under it, so a slow reply looks like thinking
  // rather than like nothing happening.
  coach.turns=(coach.turns||[]).concat([{id:'pending',asked_at:Date.now(),question:q,answer:'',cites:[],pending:true}]);
  coach.busy=true; coach.err=null; coach.q='';
  render();
  api('POST','/coach',{q,today:realToday(),ahead:coachAhead()})
    .then(r=>{ coach.last=r; coach.used=r.used; coach.busy=false;
      coach.turns=(coach.turns||[]).filter(t=>!t.pending)
        .concat([{id:r.id,asked_at:Date.now(),question:q,answer:r.answer,cites:r.cites||[]}]);
      render() })
    .catch(e=>{ coach.err=(e&&e.message)||'That did not go through.'; coach.busy=false;
      // The question comes back into the box rather than being lost with the attempt.
      coach.turns=(coach.turns||[]).filter(t=>!t.pending); coach.q=q; render() });
  return true;
}
/* The Monday debrief. Written by the server's cron, not asked for, so it lands on
   Today until it has been read -- and stays at the top of Coach for the week either
   way, because "I dismissed it" should not mean "I can never find it again". */
function debriefSeen(){
  const d=coach.debrief; if(!d||d.seen) return false;
  d.seen=true; render();
  api('POST','/coach/debrief/seen',{week:d.week}).catch(()=>{});
  return true;
}
function debriefHtml(d,today){
  return `<div class="card coach-t"><div class="lift-h"><h3>Coach's debrief</h3><span class="small muted">Week of ${esc(fmtLong(d.week))}</span></div>
  <div class="coach-a">${mdLite(d.answer)}</div>
  ${(d.suggestions||[]).map((s,i)=>suggHtml(s,'debrief',i)).join('')}
  ${citeLine(d.cites)}
  ${today?`<div class="row" style="gap:10px;align-items:center;margin-top:8px"><button class="btn sm" data-act="debriefseen">Got it</button><button class="btn sm ghost" data-act="view" data-view="coach">Talk it over</button></div>`:''}</div>`;
}
function debriefCard(){
  if(viewing||sel!==todayStr()) return '';
  coachLoad();
  const d=coach.debrief;
  return d&&!d.seen?debriefHtml(d,true):'';
}

// A citation is only worth printing if it can be found again, so it carries the book
// and the page rather than just a name. An MTI article's ref is its title, and titles
// have commas in them.
function citeLine(cites){
  if(!cites||!cites.length) return '';
  const byDoc={}; for(const c of cites){ (byDoc[c.doc]=byDoc[c.doc]||[]).push(c.ref) }
  const parts=Object.entries(byDoc).map(([d,refs])=>`${esc(LIBNAME[d]||d)} ${esc(refs.slice(0,4).join(d==='mti'?'; ':', '))}`);
  return `<div class="small muted">Read from: ${parts.join(' · ')}</div>`;
}
function vCoach(){
  coachLoad();
  const turns=coach.turns;
  let h=`<div class="card"><div class="lift-h"><h2>Coach</h2>${coach.cap?`<span class="small muted">${coach.used||0} of ${coach.cap} this month</span>`:''}</div>
  <p class="note" style="margin:0">It can read your plan, your last four weeks, this app\u2019s Guide, your copies of the four books and Mountain Tactical Institute\u2019s article archive, which it searches itself, and will search the web when they do not cover something. It cannot change anything by itself. A few of its suggestions come with an Apply button, which says exactly what it will change and can be undone; the rest you act on yourself.</p>`;
  if(coach.configured===false) h+=`<div class="banner warn"><div class="small">No API key set on the server, so the coach cannot answer yet.</div></div>`;
  h+=`</div>`;

  if(coach.debrief) h+=debriefHtml(coach.debrief,false);
  if(turns===null) h+=`<div class="card"><p class="small muted" style="margin:0">Loading…</p></div>`;
  else if(!turns.length) h+=`<div class="card"><p class="note" style="margin:0">Ask it anything about your training. It answers from the books first and says so when it is going beyond them, and it remembers what you have been talking about, whatever the subject, so you can just say “why?”</p></div>`;

  // One continuous conversation (3.90), so a change of day is marked where it happens.
  let day0='';
  for(const x of (turns||[])){
    const dd=x.asked_at?realDay(x.asked_at):'';
    if(dd&&dd!==day0){ day0=dd; h+=`<div class="divider">${esc(dd===realToday()?'Today':fmtLong(dd))}</div>` }
    h+=`<div class="card coach-t"><div class="coach-q">${esc(x.question)}</div>`;
    if(x.pending) h+=`<div class="small muted">Thinking…</div>`;
    else{
      h+=`<div class="coach-a">${mdLite(x.answer)}</div>`;
      if(coach.last&&coach.last.id===x.id&&coach.last.truncated)
        h+=`<div class="note">That answer hit its length limit, so it stops short. Ask for the rest, or ask something narrower.</div>`;
      const sugg=coach.last&&coach.last.id===x.id?coach.last.suggestions:null;
      if(sugg&&sugg.length){
        h+=`<div class="small muted" style="font-weight:650;margin-top:8px">Worth considering</div>`;
        sugg.forEach((s,i)=>{ h+=suggHtml(s,'last',i) });
        h+=`<div class="small muted">Nothing is applied until you tap Apply. The rest is yours to do.</div>`;
      }
      h+=citeLine(x.cites);
    }
    h+=`</div>`;
  }

  h+=`<div class="card"><label class="f">${(turns||[]).length?'Reply':'Ask'}<textarea id="coach-q" data-coachq="1" rows="3" placeholder="${(turns||[]).length?'Follow up, or ask something else…':'e.g. I have missed two HICs this week, what should I drop?'}">${esc(coach.q)}</textarea></label>
  <div class="row" style="gap:10px;align-items:center"><button class="btn primary" data-act="coachask" ${coach.busy||!coach.q.trim()?'disabled':''}>${coach.busy?'Thinking…':'Send'}</button>
  <span class="small muted">Searches the web if the books do not cover it.</span></div>`;
  if(coach.err) h+=`<div class="banner warn"><div class="small">${esc(coach.err)}</div></div>`;
  return h+`</div>`+coachLogCard();
}
/* ---------------- one-tap apply ----------------
A suggestion may arrive with an action. The Worker has already cut it down to one of
four shapes; this decides whether it means anything against the plan as it stands right
now, and words what it would change. That sentence is written here, from the plan, so
the button can never say one thing and do another, and a suggestion whose action no
longer applies -- the week is already a deload, the slot is already there -- simply
shows without a button.

Four actions, chosen by the user from three options on 2026-11-12 ("a short safe list,
with undo"), and each is a change the app already lets you make by hand, done the same
way: a deload or retest week from next Monday (Plan's own insert), next cycle's max held
or lowered 5% (the end-of-cycle review's own write), an accessory job added to a day
(Setup's own list), and the next conditioning session's format. None raises a max.
Every one goes through the Undo toast. */
function coachAct(act){
  if(!act||viewing||schemaAhead) return null;
  const t=realToday();
  if(act.type==='add_week'){
    if(!['deload','test'].includes(act.kind)||lpOn()) return null;
    const mon=addDays(mondayOf(t),7), wk=weeks().find(w=>w.monday===mon);
    if((plan.inserts||{})[mon]||!wk||wk.kind!=='cycle') return null;     // already something else
    const name=act.kind==='deload'?'Deload':'Retest';
    return {text:`adds a ${name.toLowerCase()} week starting ${fmtD(mon,true)}`,
      run:()=>replan(name+' week added',p=>{p.inserts[mon]=act.kind})};
  }
  if(act.type==='next_max'){
    const wk=weekOf(t), k=act.lift; if(!wk||wk.kind!=='cycle'||!activeLifts().includes(k)) return null;
    const c=wk.cycle, cur=maxFor(c)[k]; if(!cur||!['hold','reduce'].includes(act.choice)) return null;
    const v=reviewOptions(k,cur.v)[act.choice], set=((plan.cycleMaxes||{})[c+1]||{})[k];
    if(set!=null&&+set===v) return null;                                  // already so
    const f=x=>(isBW(k)?'+':'')+n(x);
    return {text:`sets Cycle ${c+1}\u2019s ${liftName(k)} max to ${f(v)} ${u()} (this cycle\u2019s is ${f(cur.v)})`,
      run:()=>{ offerUndo('Cycle '+(c+1)+' max set',snapPlan()); mutatePlan(p=>{p.cycleMaxes[c+1]=Object.assign({},p.cycleMaxes[c+1]||{},{[k]:v})}) }};
  }
  if(act.type==='add_accessory'){
    const slot=act.slot; if(!ASLOT[slot]) return null;
    // The training day with the fewest jobs that does not already have this one.
    const days=[]; for(const d of tplDays(stemplOf(),weekOf(t)||{w:1})) if(d.acc&&!days.some(x=>x.acc===d.acc)) days.push(d);
    const open=days.filter(d=>!accSlots(d.acc).includes(slot)).sort((a,b)=>accSlots(a.acc).length-accSlots(b.acc).length)[0];
    if(!open) return null;
    return {text:`adds ${ASLOT[slot].name} to the accessories on ${open.label||open.short}`,
      run:()=>{ offerUndo(ASLOT[slot].name+' added',snapPlan()); mutatePlan(p=>{p.accSlots=Object.assign({},p.accSlots||{},{[open.acc]:accSlots(open.acc).concat([slot])})}) }};
  }
  if(act.type==='set_conditioning'){
    const want=String(act.format||'').toLowerCase().replace(/[\u2019']/g,''), key=Object.keys(HIC).find(k=>HIC[k].name.toLowerCase().replace(/[\u2019']/g,'')===want);
    if(!key) return null;
    let date=null; for(let i=0;i<7&&!date;i++){ const d=addDays(t,i), dp=dayPlan(d); if(dp&&dp.t==='hic'&&!lg(d).done) date=d }
    if(!date||effFmt(date)===key) return null;
    return {text:`sets ${date===t?'today':fmtD(date,true)}\u2019s conditioning to ${HIC[key].name}`,
      run:()=>{ offerUndo('Conditioning set to '+HIC[key].name,snapLog(date)); if(!(lg(date).hic||{}).mod) setLog(date,'hic.mod',modOf(date)); setLog(date,'hic.format',key); render() }};
  }
  return null;
}
function suggOf(src,i){ const list=src==='debrief'?((coach.debrief||{}).suggestions):((coach.last||{}).suggestions); return (list||[])[i]||null }
function suggHtml(s,src,i){
  const can=s.applied?null:coachAct(s.action);
  return `<div class="acc-slot"><div style="font-weight:650">${esc(s.title||'')}</div><div class="small muted">${esc(s.detail||'')}</div>${
    s.applied?`<div class="small"><b>Applied.</b> ${esc(s.applied)}</div>`
    :can?`<div class="small">Will change: ${esc(can.text)}.</div><div><button class="btn sm" data-act="coachapply" data-src="${src}" data-i="${i}">Apply</button></div>`:''}</div>`;
}
function coachApply(src,i){
  const s=suggOf(src,i); if(!s||s.applied) return false;
  const can=coachAct(s.action); if(!can) return false;
  can.run();
  s.applied=can.text.charAt(0).toUpperCase()+can.text.slice(1)+'.';
  render(); return true;
}
/* ---------------- what it has said before ----------------
The screen above is one conversation. This is all of them, newest first, with the day
each thing was said: the only way to judge advice is to read it back against what
happened next, which is the question one-tap apply was waiting on. Loaded when opened. */
function coachLogLoad(){
  coach.logOpen=true; render();
  api('GET','/coach/log').then(r=>{ coach.log=r.turns||[]; render() }).catch(()=>{ coach.log=[]; coach.logErr=true; render() });
  return true;
}
function coachLogCard(){
  if(!coach.logOpen) return `<div class="card"><div class="row between"><span class="small muted">Everything it has told you, by date.</span><button class="btn sm ghost" data-act="coachlog">Earlier conversations</button></div></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Earlier conversations</h3><button class="btn sm ghost" data-act="coachlogx">Close</button></div>`;
  if(coach.log===null) return h+`<p class="small muted" style="margin:0">Loading…</p></div>`;
  if(coach.logErr) return h+`<p class="note" style="margin:0">Could not load them. Try again when you have signal.</p></div>`;
  if(!coach.log.length) return h+`<p class="note" style="margin:0">Nothing yet. Everything you ask is kept here.</p></div>`;
  let day='';
  for(const x of coach.log){
    const d=new Date(x.asked_at), ds=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    if(ds!==day){ day=ds; h+=`<h4 style="margin:10px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${esc(fmtLong(ds))}</h4>` }
    h+=`<details class="px" data-px="cl${esc(x.id)}"${openPx.has('cl'+x.id)?' open':''}><summary><span>${esc(x.question.length>90?x.question.slice(0,88)+'\u2026':x.question)}</span></summary>
      <div class="coach-q" style="margin-top:6px">${esc(x.question)}</div><div class="coach-a">${mdLite(x.answer)}</div>${citeLine(x.cites)}</details>`;
  }
  return h+`</div>`;
}
/* Just enough markdown for what the coach actually returns: paragraphs, bullets, bold
   and inline code. Everything is escaped first, so a model that emits a tag writes
   text rather than markup. */
function mdLite(src){
  const lines=String(src||'').split('\n'); let out='',list=false;
  for(let raw of lines){
    const t=esc(raw.trim())
      .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
      .replace(/`([^`]+)`/g,'<code>$1</code>');
    if(/^[-*]\s+/.test(raw.trim())){ if(!list){out+='<ul class="tight">';list=true} out+=`<li>${t.replace(/^[-*]\s+/,'')}</li>`; continue }
    if(list){out+='</ul>';list=false}
    if(t) out+=`<p>${t}</p>`;
  }
  return out+(list?'</ul>':'');
}
