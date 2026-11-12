/* ---------------- persistence ---------------- */
// One JSON document per path (plan/main, logs/YYYY-MM-DD), stored in D1 behind /api.
// The phone keeps its own copy (ob.cache) so the app opens offline, and an outbox of
// unsent documents (ob.outbox) so changes made offline survive closing the app.
// Writes are debounced per document; failed writes retry until they land.
const writers={};
let loaded=false, signedOut=false;
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
let outbox=LS.get('ob.outbox')||{};
/* ---------------- when the phone will not store it ----------------
localStorage has a ceiling (about 5 MB on an iPhone) and the cached copy holds every day
ever logged, so it grows toward it. A write past the ceiling throws, LS.set swallowed
that, and nothing looked at the answer: unsent changes would have lived in memory only
while the status line said "saved on phone".

Two rules. The outbox outranks the cache: unsent changes exist nowhere else, and the
cache is a copy of what the server already has, so when the outbox will not fit the
cache is dropped to make room. And a cache that could not be rewritten is removed rather
than left behind, because an old copy is worse than none: opened offline, a stale plan
looks current, and one edit on top of it is queued to overwrite the newer one on the
server (see migrate() for the day that happened by another road). Without a cache the
app needs signal to open, and says so in Setup. */
let cacheOff=false, outboxOff=false;
function dropCache(){try{localStorage.removeItem('ob.cache')}catch(e){} cacheOff=true}
function saveOutbox(){
  if(LS.set('ob.outbox',outbox)){outboxOff=false;return}
  dropCache();
  outboxOff=!LS.set('ob.outbox',outbox);
}
let cacheTimer=null;
function writeCache(){
  if(LS.set('ob.cache',{plan:stash?stash.plan:plan,logs,programs})) cacheOff=false; else dropCache();
  return !cacheOff;
}
function saveCache(){clearTimeout(cacheTimer);cacheTimer=setTimeout(writeCache,800)}
function storageCard(){
  if(!cacheOff&&!outboxOff) return '';
  return `<div class="card"><div class="lift-h"><h2>This phone can\u2019t keep an offline copy</h2></div>
  <div class="banner warn"><div class="small">${outboxOff
    ?'<b>Changes made without signal are not being held on this phone.</b> Keep the app open until the status reads Saved.'
    :'Its storage for this app is full, so the app needs signal to open until there is room. Nothing is lost: everything is on the server, and changes you make offline are still held until they send.'}</div></div></div>`;
}
/* ---------------- what the server last held ----------------
A clash is the server's copy of a document changing while this phone has unsent changes
to it. Knowing that takes knowing what the server held when the changes began: `seen` is
a short hash of each document as the server last gave it (or took it), and `bases` keeps
that hash for a document from the moment it first has something unsent, on disk, so it
survives the app being closed with the change still waiting. The plan is hashed in its
filled-in form, so a default added by an update is not mistaken for someone's edit. */
const seen={};
let bases=LS.get('ob.bases')||{};
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))|0;return h}
function docHash(path,d){return hashStr(JSON.stringify(path==='plan/main'?deepMerge(clone(DEF),d):d))}
// Did the server's copy move under unsent changes? With no base on record -- a change
// queued by an older build, or to a day this phone had never seen -- any difference counts.
function crossed(path,theirs,mine){
  const h=docHash(path,theirs); seen[path]=h;
  if(path in bases&&bases[path]===h) return false;
  return JSON.stringify(path==='plan/main'?deepMerge(clone(DEF),theirs):theirs)!==JSON.stringify(mine);
}
// Who's signed in. Everything on the server is theirs alone; the phone's copy is wiped
// if a different person signs in on the same device.
let me=LS.get('ob.user');
function docFor(path){return path==='plan/main'?(stash?stash.plan:plan):path.startsWith('programs/')?programs[path.slice(9)]:logs[path.slice(5)]}
function pending(path){const w=writers[path];return !!(w&&(w.dirty||w.busy||w.timer))||!!outbox[path]}
function anyPending(){return Object.keys(writers).some(pending)||Object.keys(outbox).length>0}
function waitingCount(){return Object.keys(outbox).length}
// `keepalive` lets a request finish after the page around it is frozen or closed --
// which, for scheduling a lock-screen alert, is the moment it matters.
async function api(method,path,body,opt){
  const r=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'manual',keepalive:!!(opt&&opt.keepalive),
    // Every write names the person this page believes it is, so the server can refuse
    // one that arrives under somebody else's session. Encoded: a header is Latin-1 only.
    headers:Object.assign(body?{'content-type':'application/json'}:{},me&&method!=='GET'?{'x-ob-user':encodeURIComponent(me)}:{},opt&&opt.headers||{}),body:body?JSON.stringify(body):undefined});
  // An expired Access session answers with a redirect to the login page.
  if(r.type==='opaqueredirect'){const e=new Error('signed out');e.status=401;throw e}
  // `full` hands back the status and ETag too, for the one caller that sends If-None-Match
  // and has to tell a 304 from an answer.
  if(opt&&opt.full&&r.status===304) return {status:304,etag:r.headers.get('etag'),data:null};
  if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e}
  const data=r.status===204?null:await r.json();
  return opt&&opt.full?{status:r.status,etag:r.headers.get('etag'),data}:data;
}
// The ETag of the last full /api/state this page received. In memory only: a fresh page
// always loads in full, and a 304 is only ever trusted against a copy this page holds.
let stateTag=null;
function errText(e){
  if(e&&(e.status===401||e.status===403)) return 'Signed out · tap to sign in';
  if(e&&e.status===413) return 'Entry too large to save';
  if(e&&e.status===409) return 'Checking who is signed in…';
  if(refused(e)) return 'Can’t save this entry ('+e.status+')';
  const w=waitingCount(), hold=outboxOff?' · keep the app open':'';
  if(e&&e.status) return 'Server error '+e.status+' · retrying'+hold;
  return outboxOff?'Offline · not saved on phone'+hold:'Offline'+(w?' · '+w+' waiting':' · saved on phone');
}
// An answer that asking again will not change: too large, not a real date. Not the ones
// that mean "sign in" or "later".
function refused(e){return !!(e&&e.status>=400&&e.status<500&&![401,403,408,409,429].includes(e.status))}
let whoAsked=0;
function queueWrite(path,get){
  if(!loaded){setStatus('Still loading…',true);return}
  const w=writers[path]||(writers[path]={});
  w.get=get;w.dirty=true;clearTimeout(w.timer);
  // The first unsent change to this document: note what the server held when it began.
  if(!(path in outbox)){ if(path in seen) bases[path]=seen[path]; else delete bases[path]; LS.set('ob.bases',bases) }
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
    // The server now holds what was sent: that is the base for anything still waiting.
    seen[path]=docHash(path,body);
    if(outbox[path]&&JSON.stringify(outbox[path])===sent){delete outbox[path];saveOutbox();delete bases[path]}
    else if(outbox[path]) bases[path]=seen[path];
    LS.set('ob.bases',bases);
    signedOut=false; if(!anyPendingExcept(path)) setStatus('Saved');
  }
  catch(e){
    if(e&&(e.status===401||e.status===403)) signedOut=true;
    setStatus(errText(e),true);
    // 409: the session belongs to somebody else now. Ask the server who; connect() drops
    // the previous person's queue when it hears. At most once every 30 seconds, so a
    // disagreement that will not settle cannot become a loop.
    if(e&&e.status===409){ if(Date.now()-whoAsked>30000){ whoAsked=Date.now(); connect() } }
    // Refused for good: it stays in the outbox, so nothing typed is lost, and goes up
    // again the next time the app opens or comes forward -- not every five seconds.
    else if(!refused(e)){ w.dirty=true; clearTimeout(w.timer); w.timer=setTimeout(()=>{w.timer=null;flush(path)},signedOut?30000:5000) }
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
/* `write` is false for the migration that runs at boot, off the phone's cached copy,
   and that distinction matters more than it looks.

   A queued write makes a document *pending*, and applyState deliberately keeps a pending
   local document instead of the server's, so unsent edits are never silently lost. Boot
   used to migrate the cache and queue a plan write before the server had been heard from,
   which turned "this phone's copy is a few days behind" into "this phone's copy wins".

   A real account lost its maxes and most of its Setup this way, somewhere between the
   4 and 11 October backups — a window with three schema bumps in it. The logs were never
   touched, because only plan/main is written at boot, which is exactly the signature of
   this bug rather than of a bad migration. Found on 12 October while looking for
   something else, and first blamed on that day's bump; the 11 October backup showed the
   damage already done, so the date was wrong and the mechanism was not.

   So the boot pass migrates in memory only, to draw a correct screen. The write happens
   in applyState, against whichever copy actually won. Offline, the migrated shape still
   goes into the local cache and is written on the next sync. */
function migrate(write){
  const at=+(plan.schema||0);
  if(at===SCHEMA) return false;
  if(at>SCHEMA){ schemaAhead=true; return false }   // the backwards half: stop writing
  schemaAhead=false;
  const d={logs,programs}, before={};
  for(const [id,L] of Object.entries(logs)) before['logs/'+id]=JSON.stringify(L);
  for(const [id,P] of Object.entries(programs)) before['programs/'+id]=JSON.stringify(P);
  for(const m of MIGRATIONS) if(m.to>at&&m.to<=SCHEMA) m.run(d,plan);
  plan.schema=SCHEMA; planV++;
  if(write===false) return true;
  queueWrite('plan/main',()=>plan);
  for(const [id,L] of Object.entries(logs)) if(JSON.stringify(L)!==before['logs/'+id]) queueWrite('logs/'+id,()=>logs[id]);
  for(const [id,P] of Object.entries(programs)) if(JSON.stringify(P)!==before['programs/'+id]) queueWrite('programs/'+id,()=>programs[id]);
  return true;
}
function setLog(date,path,v){ if(readOnly()) return; if(!logs[date]) logs[date]={date}; if(path!=='hic.format'&&(path==='done'||path.startsWith('hic'))) hicStamp(date); setPath(logs[date],path,v); logsV++; queueWrite('logs/'+date,()=>logs[date]); }
function setPlan(path,v){ if(readOnly()) return; setPath(plan,path,v); planV++; queueWrite('plan/main',()=>plan); }
function mutatePlan(fn){ if(readOnly()) return; fn(plan); planV++; queueWrite('plan/main',()=>plan); render(); }

/* ---------------- when two devices disagree ----------------
Writes replace whole documents and the last one in wins. For one person that is almost
always right, because a device with nothing to say sends nothing: only documents this
phone actually changed are ever uploaded.

The exception is both devices editing the same day while offline. Below, a document with
unsent local changes is kept and the server's copy dropped — which is a defensible
choice, but it used to happen in silence. Now it is written down and shown in Setup, so
"my Tuesday looks wrong" has an answer instead of being a mystery.

Device-local, like the error log: it describes what this phone did, not what happened. */
const CONFLICT_KEEP=10;
function conflicts(){const v=LS.get('ob.conflicts');return Array.isArray(v)?v:[]}
function clearConflicts(){LS.set('ob.conflicts',[]);render()}
function noteConflict(path){
  try{
    const all=conflicts().filter(c=>c.path!==path);
    all.unshift({path,at:new Date().toISOString()});
    LS.set('ob.conflicts',all.slice(0,CONFLICT_KEEP));
  }catch(e){}
}

function applyState(st){
  let changed=false;
  for(const [id,d] of Object.entries(st.programs||{})){
    if(pending('programs/'+id)){ if(crossed('programs/'+id,d,programs[id])) noteConflict('programs/'+id); continue }
    seen['programs/'+id]=docHash('programs/'+id,d);
    if(JSON.stringify(d)!==JSON.stringify(programs[id])){programs[id]=d;changed=true}
  }
  // The plan is the document a clash costs most on, and it used to be the one that was
  // not written down: logs and programs were noted, the plan was kept in silence.
  if(st.plan){ if(pending('plan/main')){ if(crossed('plan/main',st.plan,stash?stash.plan:plan)) noteConflict('plan/main') } else seen['plan/main']=docHash('plan/main',st.plan) }
  if(stash){ // viewing an archive: refresh the current plan behind it
    if(!pending('plan/main')&&st.plan) stash.plan=deepMerge(clone(DEF),st.plan);
  } else if(!pending('plan/main')){
    const next=st.plan?deepMerge(clone(DEF),st.plan):clone(DEF);
    if(JSON.stringify(next)!==JSON.stringify(plan)){plan=next;planV++;changed=true}
  }
  for(const [id,d] of Object.entries(st.logs||{})){
    if(pending('logs/'+id)){ if(crossed('logs/'+id,d,logs[id])) noteConflict('logs/'+id); continue }
    seen['logs/'+id]=docHash('logs/'+id,d);
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
  amAdmin=LS.get('ob.admin')===true;
  { const c=LS.get('ob.catalog'); if(Array.isArray(c)) catalog=c }
  if(c){ if(c.plan) plan=deepMerge(clone(DEF),c.plan); logs=c.logs||{}; programs=c.programs||{}; }
  // The cache is the server's copy as this phone last knew it, for everything with
  // nothing unsent, so a change made before the server has been heard from has a base.
  if(c){
    if(c.plan&&!outbox['plan/main']) seen['plan/main']=docHash('plan/main',c.plan);
    for(const [id,d] of Object.entries(logs)) if(!outbox['logs/'+id]) seen['logs/'+id]=docHash('logs/'+id,d);
    for(const [id,d] of Object.entries(programs)) if(!outbox['programs/'+id]) seen['programs/'+id]=docHash('programs/'+id,d);
  }
  for(const [path,doc] of Object.entries(outbox)){
    if(path==='plan/main') plan=deepMerge(clone(DEF),doc);
    else if(path.startsWith('logs/')) logs[path.slice(5)]=doc;
    else if(path.startsWith('programs/')) programs[path.slice(9)]=doc;
    writers[path]={get:()=>docFor(path),dirty:true};
  }
  planV++;
  // In memory only: see migrate(). A stale cache must never win by being migrated.
  // Unsent changes with no cache under them (it was dropped for room) are laid out and
  // will send, but the app is not "loaded" until the server answers: everything else on
  // screen is defaults, and an edit made on top of defaults would be queued to replace
  // the real thing.
  if(c||Object.keys(outbox).length){ loaded=!!c; migrate(false) }
  return !!c;
}
function flushAll(){for(const p of new Set([...Object.keys(writers),...Object.keys(outbox)])){const w=writers[p]||(writers[p]={get:()=>docFor(p)});if(outbox[p])w.dirty=true;if(w.dirty){clearTimeout(w.timer);w.timer=null;flush(p)}}}
// A different person signed in on this phone: drop the previous person's local copy
// and unsent changes so nothing of theirs is shown or uploaded to the new account.
function switchUser(user){
  for(const w of Object.values(writers)) clearTimeout(w.timer);
  for(const k of Object.keys(writers)) delete writers[k];
  outbox={}; saveOutbox(); bases={}; LS.set('ob.bases',bases); for(const k of Object.keys(seen)) delete seen[k]; LS.set('ob.cache',null); LS.set('ob.rest',null); LS.set('ob.iv',null); LS.set('ob.push',null); LS.set('ob.admin',null); amAdmin=false; LS.set('ob.catalog',null); catalog=[]; stateTag=null;
  plan=clone(DEF); logs={}; programs={}; stash=null; viewing=null; planV++;
  rest=null; iv=null; showRest(); ivShow();
  me=user; LS.set('ob.user',user);
}
async function connect(){
  if(!loaded) setStatus('Loading…');
  try{
    const r=await api('GET','/state',null,{full:true,headers:stateTag?{'if-none-match':stateTag}:{}}); signedOut=false;
    // A 304 means nothing on the server has changed since this page last read it in
    // full, so there is nothing to apply. Everything after applyState still runs.
    if(r.status!==304){
      const st=r.data; stateTag=r.etag;
      // Remembered so the tab does not vanish on a cold or offline open. It is a hint for
      // the page only: every admin route checks again, so a stale yes grants nothing.
      // After the switch, not before it: switchUser clears both for the person leaving,
      // and used to clear the newcomer's too, so an administrator signing in on a shared
      // phone lost the Admin tab and the shared exercise list until the next full read.
      if(st.user&&me&&st.user!==me){ switchUser(st.user); stateTag=r.etag }
      if(st.user&&!me){me=st.user;LS.set('ob.user',me)}
      amAdmin=!!st.admin; LS.set('ob.admin',amAdmin);
      if(Array.isArray(st.catalog)){ catalog=st.catalog; LS.set('ob.catalog',catalog) }
      loaded=true; applyState(st);
      if(!st.plan&&!Object.keys(st.logs||{}).length&&!plan.onboarded&&!wz){wz=wzNew(false);plan.startMonday=nextMonday();planV++;render()}
    }
    loaded=true;
    if(!viewing&&freezePast()) render();
    flushAll(); if(!anyPending()) setStatus('Saved');
    // Then re-check what the server holds: after a restart mid-session the page has to
    // pick its alerts back up, and a cancel made while offline still has to land.
    healAlerts().then(()=>alarmSync());
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
