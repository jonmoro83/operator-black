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
// The dates a plan change is liable to move. Taken before and after, the difference is
// what the person actually cares about: "my retest moved a week".
function milestones(){
  const t=realToday(), list=weeks(), out={};
  for(const kind of ['deload','test']){const w=list.find(x=>x.kind===kind&&addDays(x.monday,6)>=t); out[kind]=w?w.monday:null}
  const c=list.find(x=>x.kind==='cycle'&&x.w===1&&x.monday>t); out.cycle=c?c.monday:null;
  out.n=list.find(x=>x.monday<=t&&addDays(x.monday,6)>=t);
  out.now=out.n?(out.n.kind==='cycle'?'Cycle '+out.n.cycle+' week '+out.n.w:weekTitle(out.n).t):null;
  return out;
}
function milestoneDiff(a0,b0){
  const bits=[], name={deload:'deload',test:'retest',cycle:'next cycle'};
  for(const k of ['deload','test','cycle']){
    if(a0[k]===b0[k]) continue;
    if(!b0[k]) bits.push('no '+name[k]+' scheduled now');
    else if(!a0[k]) bits.push(name[k]+' now '+fmtD(b0[k],true));
    else bits.push(name[k]+' '+fmtD(a0[k])+' \u2192 '+fmtD(b0[k]));
  }
  if(a0.now!==b0.now&&b0.now) bits.push('this week is now '+b0.now);
  return bits.join(' \u00b7 ');
}
// Apply a plan change and say what it moved, with the usual undo.
function replan(label,fn){
  const before=milestones(), snap=snapPlan();
  mutatePlan(fn);
  const moved=milestoneDiff(before,milestones());
  offerUndo(label+(moved?' \u00b7 '+moved:''),snap);
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

// The account menu. Sign-out is a Cloudflare Access URL, not an API call: it drops the
// Access session cookie, so the next request lands on the login screen. Nothing local is
// cleared — a different person signing in on this phone is handled by switchUser().
const acctB=document.getElementById('acct'), acctM=document.getElementById('acct-m');
function initials(email){
  const at=String(email||'').split('@')[0];
  const parts=at.split(/[._\-+]/).filter(Boolean);
  const s=(parts.length>1?parts[0][0]+parts[1][0]:at.slice(0,2));
  return s?s.toUpperCase():'•';
}
function acctPaint(){
  document.getElementById('acct-i').textContent=me?initials(me):'•';
  document.getElementById('acct-e').textContent=me||'Not signed in';
  const out=document.getElementById('acct-out');
  out.textContent=signedOut?'Sign in':'Sign out';
  out.setAttribute('href',signedOut?'/':'/cdn-cgi/access/logout');
  // Below 520px the status line is hidden, so the dot is the only sync indicator.
  const st=document.getElementById('status'), t=st.textContent||'', err=st.className==='err';
  document.getElementById('acct-dot').className='acct-dot '+(err?'err':t==='Saved'?'ok':'wait');
  const line=document.getElementById('acct-st');
  line.textContent=t; line.className='acct-st'+(err?' err':'');
}
function acctOpen(on){
  acctM.hidden=!on;
  acctB.setAttribute('aria-expanded',on?'true':'false');
  if(on) acctPaint();
}
acctB.addEventListener('click',e=>{ e.stopPropagation(); acctOpen(acctM.hidden) });
// The menu sits in the header, outside #main, so its items cannot use the data-act
// delegation: they carry data-view and are routed here.
acctM.addEventListener('click',e=>{
  const it=e.target.closest('[role="menuitem"]'); if(!it) return;
  acctOpen(false);
  if(it.dataset.view) goView(it.dataset.view);
});
document.addEventListener('click',e=>{ if(!acctM.hidden&&!e.target.closest('#acct-m,#acct')) acctOpen(false) });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!acctM.hidden){acctOpen(false);acctB.focus()} });
acctPaint();
