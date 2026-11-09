/* ---------- what's new (the notes load when the page is opened) ---------- */
// APP_VERSION and RELEASES_SRC are stamped into the bundle by build.js from releases.js.
// The notes themselves, 180 releases and growing, used to load ahead of the app on every
// open to be read on one page. Now that page asks for them, and renders again when they
// arrive. In the test harness RELEASES is already defined, so this returns it at once.
function releases(){
  if(typeof RELEASES!=='undefined') return RELEASES;
  if(!releases.busy&&!releases.failed&&typeof document!=='undefined'&&document.createElement&&document.head){
    releases.busy=true;
    const s=document.createElement('script'); s.src=RELEASES_SRC;
    s.onload=()=>{releases.busy=false;render()};
    s.onerror=()=>{releases.busy=false;releases.failed=true;render()};
    document.head.appendChild(s);
  }
  return null;
}
// deploys are tagged v<version>-<commit>, so the server can name the latest version too
function tagVersion(t){const m=/^v(\d+\.\d+)/.exec(String(t||''));return m?m[1]:null}
function vReleases(){
  const R=releases();
  let h=`<div class="card"><div class="lift-h"><h2>What\u2019s new</h2><button class="btn sm ghost" data-act="view" data-view="setup">Back to Setup</button></div>
  <p class="note" style="margin:0">What each release added. The app updates itself: when a new one is deployed you get a banner at the top, and reloading is all it takes.</p></div>`;
  if(!R) return h+`<div class="card"><p class="note" style="margin:0">${releases.failed?'The release notes could not be loaded. Check your connection and open this page again.':'Loading the release notes\u2026'}</p></div>`;
  return h+R.map(r=>`<div class="card"><div class="lift-h"><h3>${esc(r.title)}</h3><span class="chip${r.v===APP_VERSION?' blue':''}">${r.v===APP_VERSION?'Current \u00b7 ':''}${esc(r.v)}</span></div>
  <div class="small muted">${fmtLong(r.date)}</div>
  <ul class="tight small">${r.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
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
/* The palettes. The colors themselves live in app.css as token blocks keyed by
   `data-palette`; this table is the list the picker draws from, with each palette's
   ground and live color so a swatch can show a palette other than the one in use, and
   so the phone's status bar can be painted to match. Per device, like the theme. */
const PALETTES=[
  {id:'graphite',name:'Graphite · ice',    dark:['#101214','#8fd3ff'],light:['#e7e9ec','#0b6fb8']},
  {id:'phosphor',name:'Graphite · phosphor',dark:['#0e1011','#86f29a'],light:['#e6e8ea','#1f8a4c']},
  {id:'olive',   name:'Olive · coyote',    dark:['#121510','#d6c08a'],light:['#e3e2d4','#7a5f24']},
  {id:'night',   name:'Night ops',              dark:['#070907','#7dff9a'],light:['#e2e7e2','#1f7a46']},
  {id:'navy',    name:'Navy',                   dark:['#071325','#7fd6ff'],light:['#e4eaf3','#0b6fb8']},
  {id:'steel',   name:'Gunmetal · signal', dark:['#15181b','#ffd23f'],light:['#e5e7ea','#8a6400']},
  {id:'blackout',name:'Blackout',               dark:['#050505','#ffffff'],light:['#e8e8e8','#0a0a0a']},
];
function palettePref(){const p=LS.get('ob.palette');return PALETTES.some(x=>x.id===p)?p:'graphite'}
function themeIsDark(){
  const t=themePref(); if(t!=='auto') return t==='dark';
  try{return !!(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){return false}
}
function applyTheme(){
  const t=themePref(), r=document.documentElement;
  if(t==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',t);
  r.setAttribute('data-gym',gymOn()?'1':'0');
  r.setAttribute('data-palette',palettePref());
  // one meta we control, so an explicit choice also moves the phone's status bar
  document.querySelectorAll('meta[name="theme-color"][media]').forEach(m=>m.remove());
  let m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}
  const P=PALETTES.find(x=>x.id===palettePref());
  m.content=(themeIsDark()?P.dark:P.light)[0];
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
