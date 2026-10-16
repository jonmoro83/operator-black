/* ---------------- the coach ---------------- */
/* A conversation, not a series of lookups. Advice only: the coach can read the plan
   and the books and cannot change anything, which the card says rather than leaving
   to be inferred. Suggestions come back as their own items so that turning them into
   one-tap actions later is a change to this file, not to the contract with the
   server. */
let coach={q:'',busy:false,err:null,last:null,turns:null,thread:null,loaded:false};
const LIBNAME={tb1:'TB1',tb2:'TB2',tb3:'TB III',aa:'Ageless Athlete'};

function coachLoad(){
  if(coach.loaded) return; coach.loaded=true;
  api('GET','/coach').then(r=>{ coach.turns=r.turns||[]; coach.thread=r.thread||null;
    coach.used=r.used; coach.cap=r.cap; coach.configured=r.configured; render() })
    .catch(()=>{ coach.turns=[]; render() });
}
function coachAsk(){
  const q=coach.q.trim(); if(!q||coach.busy) return false;
  // Shown straight away with no answer under it, so a slow reply looks like thinking
  // rather than like nothing happening.
  coach.turns=(coach.turns||[]).concat([{id:'pending',asked_at:Date.now(),question:q,answer:'',cites:[],pending:true}]);
  coach.busy=true; coach.err=null; coach.q='';
  render();
  api('POST','/coach',{q,thread:coach.thread||undefined})
    .then(r=>{ coach.last=r; coach.used=r.used; coach.thread=r.thread; coach.busy=false;
      coach.turns=(coach.turns||[]).filter(t=>!t.pending)
        .concat([{id:r.id,asked_at:Date.now(),question:q,answer:r.answer,cites:r.cites||[]}]);
      render() })
    .catch(e=>{ coach.err=(e&&e.message)||'That did not go through.'; coach.busy=false;
      // The question comes back into the box rather than being lost with the attempt.
      coach.turns=(coach.turns||[]).filter(t=>!t.pending); coach.q=q; render() });
  return true;
}
function coachNew(){ coach.thread=null; coach.turns=[]; coach.last=null; coach.err=null; render(); return true }

// A citation is only worth printing if it can be found again, so it carries the book
// and the page rather than just a name.
function citeLine(cites){
  if(!cites||!cites.length) return '';
  const byDoc={}; for(const c of cites){ (byDoc[c.doc]=byDoc[c.doc]||[]).push(c.ref) }
  const parts=Object.entries(byDoc).map(([d,refs])=>`${esc(LIBNAME[d]||d)} ${esc(refs.slice(0,4).join(', '))}`);
  return `<div class="small muted">Read from: ${parts.join(' · ')}</div>`;
}
function vCoach(){
  coachLoad();
  const turns=coach.turns;
  let h=`<div class="card"><div class="lift-h"><h2>Coach</h2>${coach.cap?`<span class="small muted">${coach.used||0} of ${coach.cap} this month</span>`:''}</div>
  <p class="small muted" style="margin:0">It can read your plan, your last four weeks and your copies of the four books, and will search the web when they do not cover something. It cannot change anything — everything it says is a suggestion you act on yourself.</p>`;
  if(coach.configured===false) h+=`<div class="banner warn"><div class="small">No API key set on the server, so the coach cannot answer yet.</div></div>`;
  h+=`</div>`;

  if(turns===null) h+=`<div class="card"><p class="small muted" style="margin:0">Loading…</p></div>`;
  else if(!turns.length) h+=`<div class="card"><p class="small muted" style="margin:0">Ask it anything about your training. It answers from the books first and says so when it is going beyond them, and it remembers the rest of this conversation — so you can just say “why?”</p></div>`;

  for(const x of (turns||[])){
    h+=`<div class="card coach-t"><div class="coach-q">${esc(x.question)}</div>`;
    if(x.pending) h+=`<div class="small muted">Thinking…</div>`;
    else{
      h+=`<div class="coach-a">${mdLite(x.answer)}</div>`;
      if(coach.last&&coach.last.id===x.id&&coach.last.truncated)
        h+=`<div class="small muted">That answer hit its length limit, so it stops short. Ask for the rest, or ask something narrower.</div>`;
      const sugg=coach.last&&coach.last.id===x.id?coach.last.suggestions:null;
      if(sugg&&sugg.length){
        h+=`<div class="small muted" style="font-weight:650;margin-top:8px">Worth considering</div>`;
        for(const s of sugg) h+=`<div class="acc-slot"><div style="font-weight:650">${esc(s.title||'')}</div><div class="small muted">${esc(s.detail||'')}</div></div>`;
        h+=`<div class="small muted">Nothing here has been applied. Make the changes yourself in Plan or Setup.</div>`;
      }
      h+=citeLine(x.cites);
    }
    h+=`</div>`;
  }

  h+=`<div class="card"><label class="f">${(turns||[]).length?'Reply':'Ask'}<textarea id="coach-q" data-coachq="1" rows="3" placeholder="${(turns||[]).length?'Follow up, or ask something else…':'e.g. I have missed two HICs this week, what should I drop?'}">${esc(coach.q)}</textarea></label>
  <div class="row" style="gap:10px;align-items:center"><button class="btn primary" data-act="coachask" ${coach.busy||!coach.q.trim()?'disabled':''}>${coach.busy?'Thinking…':'Send'}</button>
  ${(turns||[]).length?`<button class="btn sm ghost" data-act="coachnew">New topic</button>`:''}
  <span class="small muted">Searches the web if the books do not cover it.</span></div>`;
  if(coach.err) h+=`<div class="banner warn"><div class="small">${esc(coach.err)}</div></div>`;
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
