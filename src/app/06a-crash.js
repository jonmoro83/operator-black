/* ---------------- when something breaks ----------------
render() writes one big innerHTML. Before this, a single thrown error anywhere in a view
left a blank page with no clue what happened — mid-session, in a gym, with a loaded bar.

Three parts: render() catches and paints something you can act on, the last few errors
are kept so the failure is reportable rather than "it just broke", and Setup shows them.

Errors are kept on the device only. A stack trace can carry a lift name or a date, and
there is no reason for that to reach the server. */

const CRASH_KEEP = 5;

function crashList(){ const v=LS.get('ob.errs'); return Array.isArray(v)?v:[] }
function crashClear(){ LS.set('ob.errs',[]); render() }

function crashLog(err,where){
  try{
    const e={
      at:new Date().toISOString(),
      where:where||'app',
      view:typeof view==='string'?view:'',
      msg:String((err&&err.message)||err||'Unknown error').slice(0,300),
      // A few frames is enough to find it; the whole trace is noise on a phone screen.
      stack:String((err&&err.stack)||'').split('\n').slice(1,5).map(s=>s.trim()).join('\n').slice(0,600),
      v:typeof APP_VERSION==='string'?APP_VERSION:'',
    };
    const all=[e,...crashList()].slice(0,CRASH_KEEP);
    LS.set('ob.errs',all);
  }catch(e2){}
  try{ if(typeof console!=='undefined'&&console.error) console.error('[operator-black]',where,err) }catch(e3){}
}

// What you see instead of a blank screen. Deliberately plain strings: whatever broke the
// view might break any helper, so this uses nothing but escaping.
function crashHtml(err){
  const msg=esc(String((err&&err.message)||err||'Unknown error').slice(0,300));
  return `<div class="banner alert"><div><b>Something went wrong drawing this screen.</b>
    Your training is saved — this is the display, not your data. Reload, and if it keeps
    happening send me the details below.<div class="mono small" style="margin-top:6px;word-break:break-word">${msg}</div></div>
    <div class="row"><button class="btn sm primary" data-act="reload">Reload</button><button class="btn sm" data-act="errcopy">Copy details</button></div></div>`;
}

// Everything a report needs, as text you can paste into a message.
function crashReport(){
  const list=crashList();
  if(!list.length) return 'No errors recorded.';
  const head=`Operator + Black ${typeof APP_VERSION==='string'?APP_VERSION:''} · ${typeof navigator!=='undefined'?navigator.userAgent:''}`;
  return head+'\n\n'+list.map(e=>`${e.at} · ${e.where} · view ${e.view||'?'} · v${e.v||'?'}\n${e.msg}\n${e.stack||''}`).join('\n\n---\n\n');
}

function crashCard(){
  const list=crashList();
  if(!list.length) return '';
  return `<div class="card"><div class="lift-h"><h2>Problems</h2><span class="chip alert">${list.length}</span></div>
  <p class="small muted" style="margin:0">Errors this app hit on this device. They are kept here only — never sent anywhere — and a stack trace can name a lift or a date, so read before you share. If one of these lines up with something going wrong, send it to me.</p>
  <div class="stack">${list.map(e=>`<div class="banner"><div class="small"><b>${esc(fmtD(e.at.slice(0,10),true))} ${esc(e.at.slice(11,16))}</b> · ${esc(e.where)}${e.view?' · '+esc(e.view):''}${e.v?' · v'+esc(e.v):''}<div class="mono" style="word-break:break-word;margin-top:4px">${esc(e.msg)}</div></div></div>`).join('')}</div>
  <div class="row"><button class="btn" data-act="errcopy">Copy all details</button><button class="btn ghost" data-act="errclear">Clear</button></div></div>`;
}

// Anything that escapes a handler, a timer or a promise lands here too, so a failure
// that never touches render() is still reportable rather than silent.
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('error',e=>{ crashLog(e.error||e.message,'window') });
  window.addEventListener('unhandledrejection',e=>{ crashLog(e.reason,'promise') });
}
