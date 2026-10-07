/* ---------------- persistence ---------------- */
// One JSON document per path (plan/main, logs/YYYY-MM-DD), stored in D1 behind /api.
// The phone keeps its own copy (ob.cache) so the app opens offline, and an outbox of
// unsent documents (ob.outbox) so changes made offline survive closing the app.
// Writes are debounced per document; failed writes retry until they land.
const writers={};
let loaded=false, signedOut=false;
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
let outbox=LS.get('ob.outbox')||{};
function saveOutbox(){LS.set('ob.outbox',outbox)}
let cacheTimer=null;
function saveCache(){clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>LS.set('ob.cache',{plan:stash?stash.plan:plan,logs,programs}),800)}
// Who's signed in. Everything on the server is theirs alone; the phone's copy is wiped
// if a different person signs in on the same device.
let me=LS.get('ob.user');
function docFor(path){return path==='plan/main'?(stash?stash.plan:plan):path.startsWith('programs/')?programs[path.slice(9)]:logs[path.slice(5)]}
function pending(path){const w=writers[path];return !!(w&&(w.dirty||w.busy||w.timer))||!!outbox[path]}
function anyPending(){return Object.keys(writers).some(pending)||Object.keys(outbox).length>0}
function waitingCount(){return Object.keys(outbox).length}
async function api(method,path,body){
  const r=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'manual',
    headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  // An expired Access session answers with a redirect to the login page.
  if(r.type==='opaqueredirect'){const e=new Error('signed out');e.status=401;throw e}
  if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e}
  return r.status===204?null:r.json();
}
function errText(e){
  if(e&&(e.status===401||e.status===403)) return 'Signed out · tap to sign in';
  if(e&&e.status===413) return 'Entry too large to save';
  const w=waitingCount();
  if(e&&e.status) return 'Server error '+e.status+' · retrying';
  return 'Offline'+(w?' · '+w+' waiting':' · saved on phone');
}
function queueWrite(path,get){
  if(!loaded){setStatus('Still loading…',true);return}
  const w=writers[path]||(writers[path]={});
  w.get=get;w.dirty=true;clearTimeout(w.timer);
  outbox[path]=clone(get()); saveOutbox(); saveCache();
  setStatus(navigator.onLine===false?errText(null):'Saving…',navigator.onLine===false);
  w.timer=setTimeout(()=>{w.timer=null;flush(path)},500);
  // The calendar is generated from the plan, so a plan write is the only thing that can
  // change it. calPush debounces and compares before uploading, so this is usually free.
  if(path==='plan/main'&&typeof calPush==='function') calPush();
}
async function flush(path){
  const w=writers[path]||(writers[path]={get:()=>outbox[path]});
  if(w.busy){w.again=true;return} if(!w.dirty)return;
  w.dirty=false;w.busy=true;
  const body=clone(w.get()), sent=JSON.stringify(body);
  try{
    await api('PUT','/doc/'+path,body);
    if(outbox[path]&&JSON.stringify(outbox[path])===sent){delete outbox[path];saveOutbox()}
    signedOut=false; if(!anyPendingExcept(path)) setStatus('Saved');
  }
  catch(e){
    if(e&&(e.status===401||e.status===403)) signedOut=true;
    setStatus(errText(e),true);
    if(!(e&&e.status===413)){ w.dirty=true; clearTimeout(w.timer); w.timer=setTimeout(()=>{w.timer=null;flush(path)},signedOut?30000:5000) }
  }
  w.busy=false; if(w.dirty&&!w.timer||w.again){w.again=false;flush(path)}
}
function anyPendingExcept(path){return Object.keys(writers).some(p=>p!==path&&pending(p))||Object.keys(outbox).some(p=>p!==path)}
function setStatus(t,err){const el=document.getElementById('status');el.textContent=t;el.className=err?'err':'';el.classList.toggle('link',signedOut);if(typeof acctPaint==='function')acctPaint()}
function readOnly(){
  if(schemaAhead){ setStatus('App out of date · read-only',true); render(); return true }
  if(viewing){ setStatus('Archived program · read-only',true); render(); return true }
  return false;
}
// Bring stored data up to SCHEMA, then save whatever actually changed. Runs on every load
// and after every sync, and costs one integer comparison when there is nothing to do.
function migrate(){
  const at=+(plan.schema||0);
  if(at===SCHEMA) return false;
  if(at>SCHEMA){ schemaAhead=true; return false }   // the backwards half: stop writing
  schemaAhead=false;
  const d={logs,programs}, before={};
  for(const [id,L] of Object.entries(logs)) before['logs/'+id]=JSON.stringify(L);
  for(const [id,P] of Object.entries(programs)) before['programs/'+id]=JSON.stringify(P);
  for(const m of MIGRATIONS) if(m.to>at&&m.to<=SCHEMA) m.run(d);
  plan.schema=SCHEMA; planV++;
  queueWrite('plan/main',()=>plan);
  for(const [id,L] of Object.entries(logs)) if(JSON.stringify(L)!==before['logs/'+id]) queueWrite('logs/'+id,()=>logs[id]);
  for(const [id,P] of Object.entries(programs)) if(JSON.stringify(P)!==before['programs/'+id]) queueWrite('programs/'+id,()=>programs[id]);
  return true;
}
function setLog(date,path,v){ if(readOnly()) return; if(!logs[date]) logs[date]={date}; setPath(logs[date],path,v); logsV++; queueWrite('logs/'+date,()=>logs[date]); }
function setPlan(path,v){ if(readOnly()) return; setPath(plan,path,v); planV++; queueWrite('plan/main',()=>plan); }
function mutatePlan(fn){ if(readOnly()) return; fn(plan); planV++; queueWrite('plan/main',()=>plan); render(); }

function applyState(st){
  let changed=false;
  for(const [id,d] of Object.entries(st.programs||{})){
    if(pending('programs/'+id)) continue;
    if(JSON.stringify(d)!==JSON.stringify(programs[id])){programs[id]=d;changed=true}
  }
  if(stash){ // viewing an archive: refresh the current plan behind it
    if(!pending('plan/main')&&st.plan) stash.plan=deepMerge(clone(DEF),st.plan);
  } else if(!pending('plan/main')){
    const next=st.plan?deepMerge(clone(DEF),st.plan):clone(DEF);
    if(JSON.stringify(next)!==JSON.stringify(plan)){plan=next;planV++;changed=true}
  }
  for(const [id,d] of Object.entries(st.logs||{})){
    if(pending('logs/'+id)) continue;
    if(JSON.stringify(d)!==JSON.stringify(logs[id])){logs[id]=d;changed=true;logsV++}
  }
  // entries removed on the server go away here too (unless this phone has unsent changes)
  if(st.logs) for(const id of Object.keys(logs)) if(!(id in st.logs)&&!pending('logs/'+id)){delete logs[id];changed=true;logsV++}
  saveCache();
  if(!stash&&!pending('plan/main')&&migrate()) changed=true;
  if(changed) render();
}
// Open instantly from the phone's copy, with any unsent changes laid on top.
function loadLocal(){
  const c=LS.get('ob.cache');
  if(c){ if(c.plan) plan=deepMerge(clone(DEF),c.plan); logs=c.logs||{}; programs=c.programs||{}; }
  for(const [path,doc] of Object.entries(outbox)){
    if(path==='plan/main') plan=deepMerge(clone(DEF),doc);
    else if(path.startsWith('logs/')) logs[path.slice(5)]=doc;
    else if(path.startsWith('programs/')) programs[path.slice(9)]=doc;
    writers[path]={get:()=>docFor(path),dirty:true};
  }
  planV++;
  if(c||Object.keys(outbox).length){ loaded=true; migrate() }
  return !!c;
}
function flushAll(){for(const p of new Set([...Object.keys(writers),...Object.keys(outbox)])){const w=writers[p]||(writers[p]={get:()=>docFor(p)});if(outbox[p])w.dirty=true;if(w.dirty){clearTimeout(w.timer);w.timer=null;flush(p)}}}
// A different person signed in on this phone: drop the previous person's local copy
// and unsent changes so nothing of theirs is shown or uploaded to the new account.
function switchUser(user){
  for(const w of Object.values(writers)) clearTimeout(w.timer);
  for(const k of Object.keys(writers)) delete writers[k];
  outbox={}; saveOutbox(); LS.set('ob.cache',null); LS.set('ob.rest',null); LS.set('ob.iv',null); LS.set('ob.push',null);
  plan=clone(DEF); logs={}; programs={}; stash=null; viewing=null; planV++;
  rest=null; iv=null; showRest(); ivShow();
  me=user; LS.set('ob.user',user);
}
async function connect(){
  if(!loaded) setStatus('Loading…');
  try{
    const st=await api('GET','/state'); signedOut=false;
    if(st.user&&me&&st.user!==me) switchUser(st.user);
    if(st.user&&!me){me=st.user;LS.set('ob.user',me)}
    loaded=true; applyState(st);
    if(!st.plan&&!Object.keys(st.logs||{}).length&&!plan.onboarded&&!wz){wz=wzNew(false);plan.startMonday=nextMonday();planV++;render()}
    if(!viewing&&freezePast()) render();
    flushAll(); if(!anyPending()) setStatus('Saved');
    healAlerts();
  }
  catch(e){
    if(e&&(e.status===401||e.status===403)) signedOut=true;
    setStatus(loaded?errText(e):(signedOut?'Signed out · tap to sign in':'Can’t reach server · reload'),true);
  }
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') connect() });
window.addEventListener('online',()=>{ flushAll(); connect() });
window.addEventListener('offline',()=>setStatus(errText(null),true));
document.getElementById('status').addEventListener('click',()=>{ if(signedOut) location.replace('/') });
