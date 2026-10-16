/* ---------------- the coach ---------------- */
/* Advice, not control. The coach can read the plan and the books; it cannot change
   anything, and the card says so rather than leaving you to wonder. Suggestions come
   back as their own items so that turning them into one-tap actions later is a change
   to this file, not to the contract with the server. */
let coach={q:'',busy:false,err:null,last:null,hist:null,web:false,loaded:false};

function coachLoad(){
  if(coach.loaded) return; coach.loaded=true;
  api('coach').then(r=>{ coach.hist=r.history||[]; coach.used=r.used; coach.cap=r.cap; coach.configured=r.configured; render() })
    .catch(()=>{ coach.hist=[]; render() });
}
function coachAsk(){
  const q=coach.q.trim(); if(!q||coach.busy) return false;
  coach.busy=true; coach.err=null; render();
  api('coach',{method:'POST',body:JSON.stringify({q,web:coach.web})})
    .then(r=>{ coach.last=r; coach.used=r.used; coach.q=''; coach.busy=false;
      coach.hist=[{id:r.id,asked_at:Date.now(),question:q,answer:r.answer,cites:r.cites||[]}].concat(coach.hist||[]).slice(0,20);
      render() })
    .catch(e=>{ coach.err=(e&&e.message)||'That did not go through.'; coach.busy=false; render() });
  return true;
}
// A citation is only worth printing if it can be found again, so it carries the book
// and the page rather than just a name.
function citeLine(cites){
  if(!cites||!cites.length) return '';
  const byDoc={}; for(const c of cites){ (byDoc[c.doc]=byDoc[c.doc]||[]).push(c.ref) }
  const parts=Object.entries(byDoc).map(([d,refs])=>`${esc(LIBNAME[d]||d)} ${esc(refs.slice(0,4).join(', '))}`);
  return `<div class="small muted">Read from: ${parts.join(' · ')}</div>`;
}
const LIBNAME={tb1:'TB1',tb2:'TB2',tb3:'TB III',aa:'Ageless Athlete'};

function vCoach(){
  coachLoad();
  let h=`<div class="card"><div class="lift-h"><h2>Coach</h2>${coach.cap?`<span class="small muted">${coach.used||0} of ${coach.cap} this month</span>`:''}</div>
  <p class="small muted" style="margin:0">It can read your plan, your last four weeks and your copies of the four books. It cannot change anything — everything it says is a suggestion you act on yourself.</p>`;
  if(coach.configured===false) h+=`<div class="banner warn"><div class="small">No API key set on the server, so the coach cannot answer yet.</div></div>`;
  h+=`<label class="f">Ask<textarea id="coach-q" data-coachq="1" rows="3" placeholder="e.g. I have missed two HICs this week, what should I drop?">${esc(coach.q)}</textarea></label>
  <div class="row" style="gap:14px;align-items:center"><button class="btn primary" data-act="coachask" ${coach.busy||!coach.q.trim()?'disabled':''}>${coach.busy?'Thinking…':'Ask'}</button>
  <label class="check"><input type="checkbox" id="coach-web" data-act-change="coachweb" ${coach.web?'checked':''}> Let it search the web too</label></div>`;
  if(coach.err) h+=`<div class="banner warn"><div class="small">${esc(coach.err)}</div></div>`;
  h+=`</div>`;

  const items=coach.hist===null?null:coach.hist;
  if(items===null) h+=`<div class="card"><p class="small muted" style="margin:0">Loading…</p></div>`;
  else if(!items.length) h+=`<div class="card"><p class="small muted" style="margin:0">Nothing asked yet. It answers from the books first and says so when it is going beyond them.</p></div>`;
  for(const x of (items||[])){
    h+=`<div class="card"><div class="small muted">${esc(fmtD(new Date(x.asked_at).toISOString().slice(0,10),true))}</div>
    <div style="font-weight:650;margin:2px 0 6px">${esc(x.question)}</div>
    <div class="coach-a">${mdLite(x.answer)}</div>`;
    const sugg=coach.last&&coach.last.id===x.id?coach.last.suggestions:null;
    if(sugg&&sugg.length){
      h+=`<div class="small muted" style="font-weight:650;margin-top:8px">Worth considering</div>`;
      for(const s of sugg) h+=`<div class="acc-slot"><div style="font-weight:650">${esc(s.title||'')}</div><div class="small muted">${esc(s.detail||'')}</div></div>`;
      h+=`<div class="small muted">Nothing here has been applied. Make the changes yourself in Plan or Setup.</div>`;
    }
    h+=citeLine(x.cites)+`</div>`;
  }
  return h;
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
