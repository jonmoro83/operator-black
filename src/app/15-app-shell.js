/* ---------- what's new (RELEASES comes from releases.js) ---------- */
const APP_VERSION=RELEASES[0].v;
// deploys are tagged v<version>-<commit>, so the server can name the latest version too
function tagVersion(t){const m=/^v(\d+\.\d+)/.exec(String(t||''));return m?m[1]:null}
function vReleases(){
  return `<div class="card"><div class="lift-h"><h2>What\u2019s new</h2><button class="btn sm ghost" data-act="view" data-view="setup">Back to Setup</button></div>
  <p class="small muted" style="margin:0">What each release added. The app updates itself: when a new one is deployed you get a banner at the top, and reloading is all it takes.</p></div>
  ${RELEASES.map(r=>`<div class="card"><div class="lift-h"><h3>${esc(r.title)}</h3><span class="chip${r.v===APP_VERSION?' blue':''}">${r.v===APP_VERSION?'Current \u00b7 ':''}${esc(r.v)}</span></div>
  <div class="small muted">${fmtLong(r.date)}</div>
  <ul class="tight small">${r.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}`;
}

/* ---------- undo ---------- */
// One step back for the things that are easy to tap by mistake. Snapshots are taken
// before the change and expire after a few seconds.
let undoItem=null, undoTimer=null;
function snapLog(date){
  const before=logs[date]?clone(logs[date]):null;
  return ()=>{ logs[date]=before?before:{date}; planV++; queueWrite('logs/'+date,()=>logs[date]); render(); };
}
function snapPlan(){
  const before=clone(plan);
  return ()=>{ plan=before; planV++; queueWrite('plan/main',()=>plan); render(); };
}
function offerUndo(label,restore){
  undoItem={label,restore};
  clearTimeout(undoTimer); undoTimer=setTimeout(()=>{undoItem=null;showToast()},7000);
  showToast();
}
function showToast(){
  const el=document.getElementById('toast');
  if(!undoItem){el.hidden=true;return}
  document.getElementById('toast-msg').textContent=undoItem.label;
  el.hidden=false;
}
function doUndo(){
  if(!undoItem) return;
  const r=undoItem.restore; undoItem=null; clearTimeout(undoTimer);
  r(); showToast();
}
document.getElementById('toast-undo').addEventListener('click',doUndo);

/* ---------- appearance ---------- */
// Theme and gym mode are per device, so they live in localStorage rather than the plan.
function themePref(){const t=LS.get('ob.theme');return t==='light'||t==='dark'?t:'auto'}
function gymOn(){return !!LS.get('ob.gym')}
function applyTheme(){
  const t=themePref(), r=document.documentElement;
  if(t==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',t);
  r.setAttribute('data-gym',gymOn()?'1':'0');
  let dark=t==='dark';
  if(t==='auto'){ try{dark=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches}catch(e){dark=false} }
  // one meta we control, so an explicit choice also moves the phone's status bar
  document.querySelectorAll('meta[name="theme-color"][media]').forEach(m=>m.remove());
  let m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}
  m.content=dark?'#0f1311':'#e8ebe6';
}
try{ if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(themePref()==='auto')applyTheme()}) }catch(e){}

/* ---------- app updates ---------- */
// The server stamps each page with its fingerprint. On open, on return from the
// background and every 30 min, compare it with what's deployed now; if they differ,
// offer a reload. Reloading is safe: data, unsent changes and the timer live on the phone.
const APP_VER=(document.querySelector('meta[name="app-version"]')||{}).content||null;
const upd={latest:null,at:null,tag:null,checked:null,err:null,busy:false,lastCheck:0};
async function checkUpdate(manual){
  if(!manual&&Date.now()-upd.lastCheck<10000) return;
  upd.lastCheck=Date.now(); upd.busy=!!manual; if(manual&&view==='setup') render();
  try{ const v=await api('GET','/version'); Object.assign(upd,{latest:v.page,at:v.deployedAt,tag:v.tag,checked:Date.now(),err:null}) }
  catch(e){ upd.err=navigator.onLine===false?'Offline. Check again when you have signal.':'Couldn’t check for updates.' }
  upd.busy=false; showUpdate(); if(view==='setup') render();
}
function updateAvailable(){return !!(APP_VER&&upd.latest&&upd.latest!==APP_VER&&APP_VER!=='dev')}
function showUpdate(){
  const el=document.getElementById('upd'); el.hidden=!updateAvailable(); if(el.hidden) return;
  const t=upd.at?new Date(upd.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):null;
  el.querySelector('span').textContent='A new version of the app is ready'+(t?' (deployed '+t+').':'.');
}
function applyUpdate(){
  const go=()=>location.reload();
  try{ navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{}).finally(go) }catch(e){ go() }
}
document.getElementById('upd-go').addEventListener('click',applyUpdate);
document.getElementById('upd-what').addEventListener('click',()=>{view='releases';render();window.scrollTo(0,0)});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkUpdate(false) });
setInterval(()=>checkUpdate(false),30*60*1000);
