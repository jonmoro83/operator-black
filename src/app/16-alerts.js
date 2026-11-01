/* ---------- rest alerts (push) ---------- */
// When alerts are on for this device, every rest schedules a push for its end time on
// the server, so the phone is notified even when locked or in another app.
const alerts={msg:null,busy:false};
function alertsSupport(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios&&!navigator.standalone?'install':'unsupported';
  }
  if(Notification.permission==='denied') return 'denied';
  return 'ok';
}
function alertsOn(){return !!LS.get('ob.push')&&window.Notification&&Notification.permission==='granted'}
/* ---------- what is still running when the page is not ----------
A locked phone freezes the page: no script, no Web Audio, no beep. The timer itself is
fine -- it is an absolute end time, so it is on the right second whenever you come back
-- but the sound cannot come from here. The only thing that makes a noise while the
screen is off is the alert the server already holds for every rest and every interval
change. Which makes "alerts off" a different thing during a session than it is in a
settings card: it means this session goes silent the moment the screen does. It only
ever said so in Setup, three taps away from the timer, so the timers say it now. */
function coverText(kind){
  if(alertsOn()){
    const st=alarmState[kind||'rest'];
    if(!st) return null;
    if(st.ok) return 'Lock-screen alert set \u2713';
    if(st.busy&&Date.now()-st.t<3000) return null;          // give it a moment before worrying you
    return 'Alert not set'+(st.err?' ('+st.err+')':' yet')+' \u00b7 tap to retry';
  }
  switch(alertsSupport()){
    case 'ok': return 'Alerts off \u00b7 tap for sound when locked';
    case 'denied': return 'Alerts blocked \u00b7 silent once the screen is off';
    case 'install': return 'Add to Home Screen for sound when locked';
    default: return 'No alerts here \u00b7 silent once the screen is off';
  }
}
function showCover(){
  if(typeof document==='undefined') return;
  const set=(id,t,on)=>{ const el=document.getElementById(id); if(!el) return; if(on) el.textContent=t; el.hidden=!on };
  const tr=coverText('rest'), ti=coverText('iv');
  set('rest-push',tr,!!tr&&!!rest&&!rest.done);
  set('iv-push',ti,!!ti&&!!iv&&!iv.done);
}
// Tapping it: turn them on where that is all it takes, or go to the card that explains
// why it is not.
function coverTap(){
  if(alertsOn()){ alarmForce(); return }
  if(alertsSupport()==='ok'){ enableAlerts(); return }
  view='setup'; render();
}
function b64uBytes(str){const b=str.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(str.length/4)*4,'=');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))}
// If this device thinks alerts are on but the server has no subscription for this
// person (e.g. after the move to per-user alert stores), quietly register it again.
/* Re-register this device if the server has lost it -- and, the case that used to
   loop forever in silence, make a *new* subscription when the push service has
   declared the old one dead. A 404 or 410 means that endpoint will never work again,
   so handing the same one back to the server just earns another 410 on the next rest.
   The phone kept saying On throughout. */
async function healAlerts(){
  if(!alertsOn()) return;
  try{
    const st=await api('GET','/push/status');
    const mine=LS.get('ob.push');
    const isDead=Array.isArray(st.dead)&&mine&&st.dead.includes(mine);
    if(st.devices&&!isDead) return;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(sub&&(isDead||sub.endpoint===mine&&isDead)){
      try{ await sub.unsubscribe() }catch(e){}
      sub=null;
    }
    if(!sub){
      const {key}=await api('GET','/push/key');
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)});
      pushNote('re-subscribed',true,'the old endpoint was rejected');
    }
    await api('POST','/push/subscribe',{subscription:sub.toJSON()});
    LS.set('ob.push',sub.endpoint);
  }catch(e){ pushNote('heal',false,e&&e.status?'HTTP '+e.status:(e&&e.message)||'failed') }
}
async function enableAlerts(){
  alerts.busy=true; alerts.msg=null; render();
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){alerts.msg=perm==='denied'?'Notifications are blocked. Turn them on in iOS Settings → Notifications → Operator.':'Notifications weren’t allowed. Tap Turn on again to retry.';return}
    const reg=await navigator.serviceWorker.ready, {key}=await api('GET','/push/key');
    let sub=await reg.pushManager.getSubscription();
    try{ if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)}) }
    catch(e){ if(sub) await sub.unsubscribe(); sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)}) }
    await api('POST','/push/subscribe',{subscription:sub.toJSON()});
    LS.set('ob.push',sub.endpoint); alerts.msg='Rest alerts are on for this device.'; showCover(); alarmSync();
  }catch(e){ alerts.msg=e&&e.status?'The server refused the subscription ('+e.status+'). Try again.':'Couldn’t turn on alerts. Check your connection and try again.' }
  finally{ alerts.busy=false; render() }
}
async function disableAlerts(){
  alerts.busy=true; render();
  try{ const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription(); if(sub){ await api('POST','/push/unsubscribe',{endpoint:sub.endpoint}).catch(()=>{}); await sub.unsubscribe() } }catch(e){}
  // The server drops this device's pending alerts with the subscription.
  alarmState={}; alarmSave();
  LS.set('ob.push',null); alerts.msg='Rest alerts are off for this device.'; alerts.busy=false; showCover(); render();
}
/* What the server thinks, as against what this phone thinks. The two disagreeing is
   the whole of "alerts are on and nothing arrives": a device that unsubscribed itself,
   a queue that is empty because every schedule was refused, an alarm set for a time
   that has already gone by. `/push/status` has always returned it; nothing showed it. */
let pushStat=null;
// Deliberately not `async function`: the test harness exposes top-level declarations by
// scanning for `function name(`, so an async one is invisible to every test.
function checkAlerts(){
  pushStat={busy:true}; render();
  return api('GET','/push/status').then(
    r=>{ pushStat=Object.assign({at:Date.now()},r); render() },
    e=>{ pushStat={at:Date.now(),err:e&&e.status?'HTTP '+e.status:(e&&e.message)||'no answer'}; render() });
}
function pushStatusText(){
  const L=pushLast, S=pushStat, out=[];
  out.push('This phone: alerts '+(alertsOn()?'on':'off')+' \u00b7 '+alertsSupport()+' \u00b7 clock '+new Date().toISOString());
  out.push('Storage: '+storageNote());
  if(L) out.push('Last asked: '+L.what+' at '+clockTime(L.t)+' \u2014 '+(L.ok?'accepted':'REFUSED')+(L.d?' ('+L.d+')':''));
  else out.push('Last asked: nothing yet on this phone');
  if(S&&!S.busy) out.push(S.err?'Server: could not ask ('+S.err+')'
    :'Server: '+S.devices+' device'+(S.devices===1?'':'s')+' registered \u00b7 '+S.queued+' alert'+(S.queued===1?'':'s')+' queued \u00b7 '+(S.pendingAt?'next at '+clockTime(S.pendingAt):'no alarm set'));
  out.push('This phone asked for: '+(Object.entries(alarmState).map(([k,v])=>k+' '+(v.ok?'confirmed':v.busy?'sending':'NOT SET'+(v.err?' ('+v.err+')':''))).join(', ')||'nothing'));
  if(S&&Array.isArray(S.slots)&&S.slots.length) out.push('Server holds: '+S.slots.map(x=>x.kind+' \u00d7'+x.n+' next '+clockTime(x.next)+' \u2192 '+x.to).join('; '));
  if(S&&Array.isArray(S.log)&&S.log.length){
    out.push('Recent sends (how late each went out):');
    for(const l of S.log.slice(-12)) out.push('  '+clockTime(l.sent)+'  '+(l.kind||'?')+' \u201c'+(l.title||'')+'\u201d  '+(l.late/1000).toFixed(1)+' s late'+(l.skipped?' ('+l.skipped+' skipped)':'')+'  \u2192 '+l.to+': '+((l.results||[]).map(r=>r.host+' '+r.status).join(', ')||'no devices'));
  }
  if(S&&S.lastSend) out.push('Last send: '+clockTime(S.lastSend.at)+' \u201c'+(S.lastSend.title||'')+'\u201d \u2014 '+
    ((S.lastSend.results||[]).map(r=>r.host+' '+r.status).join(', ')||'no devices to send to'));
  if(S&&Array.isArray(S.dead)&&S.dead.length) out.push('Rejected endpoints on file: '+S.dead.length);
  return out.join('\n');
}
function pushAdvice(){
  const L=pushLast, S=pushStat, out=[];
  if(!alertsOn()) out.push('Alerts are off on this phone. Turn them on above.');
  if(L&&!L.ok&&/400/.test(L.d)) out.push('The server refused the time. It only accepts alerts between now and two hours ahead, so this is almost always a phone clock that has drifted \u2014 check Settings \u2192 General \u2192 Date & Time \u2192 Set Automatically.');
  if(L&&!L.ok&&/401|403/.test(L.d)) out.push('You were signed out when the alert was scheduled. Open the app, sign in, and start the rest again.');
  if(L&&!L.ok&&/no answer|Failed|network/i.test(L.d)) out.push('The request never reached the server. If you train somewhere with no signal, the alert cannot be scheduled \u2014 the in-app beep is what you get.');
  if(S&&!S.busy&&!S.err&&S.devices===0) out.push('The server has no device registered for you, so there is nothing to push to. Turn alerts off and on again above.');
  if(S&&S.lastSend&&(S.lastSend.results||[]).some(r=>r.status===410||r.status===404))
    out.push('The push service rejected this phone\u2019s subscription as gone (410). That kills alerts dead while the app still says they are on. Reopening the app should now make a fresh one by itself; if it does not, turn alerts off and on again.');
  if(S&&S.lastSend&&(S.lastSend.results||[]).some(r=>String(r.status).startsWith('error')))
    out.push('The server could not reach the push service at all for the last alert. That is usually temporary.');
  if(S&&S.lastSend&&(S.lastSend.results||[]).some(r=>r.status===201||r.status===200))
    out.push('The last alert was accepted by Apple. If it did not appear, it is iOS deciding not to show it: Settings \u2192 Notifications \u2192 Operator, and check Focus modes.');
  if(ringerSuspect())
    out.push('If it arrived without a sound: the ring switch on the side of the phone silences notification sounds too, and nothing in the app can override that. The audio channel here was taken away the moment it opened, which is what that switch being off looks like from inside a web page.');
  if(!pushLast) out.push('No rest has scheduled an alert on this build yet \u2014 only the test button has run. Start a rest, let it finish, then send this again.');
  if(S&&!S.busy&&!S.err&&S.devices>0&&S.queued===0&&rest&&!rest.done) out.push('A rest is running but the server has nothing queued for it. That is the bug \u2014 copy this and send it.');
  if(/FAILING/.test(storageNote())) out.push('This phone can no longer write to its own storage, which is enough on its own to stop alerts: the subscription lives there. Setup \u2192 About this app \u2192 clear the cache, or reinstall the home-screen app.');
  if(!out.length) out.push('Nothing here looks wrong. If an alert still did not arrive, it is iOS deciding not to show it: check Settings \u2192 Notifications \u2192 Operator, and that a Focus mode is not filtering it.');
  return out;
}
/* ---------- sending a report without the clipboard ----------
Two goes at a copy button, and both times the answer was "nothing I can send you". The
clipboard is a bad channel on a phone: it can be missing, it can refuse, and on iOS it
can resolve and still leave you with nothing to paste. So the app posts the thing to
the server, where it can be read directly, and the button says whether that worked. */
let sendState=null;
function sendReport(kind,text){
  sendState={busy:true}; render();
  return api('POST','/report',{kind,body:text,version:typeof APP_VERSION==='string'?APP_VERSION:'',
    ua:typeof navigator!=='undefined'?String(navigator.userAgent).slice(0,200):''}).then(
    ()=>{ sendState={ok:true,at:Date.now()}; render() },
    e=>{ sendState={ok:false,err:e&&e.status?'HTTP '+e.status:(e&&e.message)||'no answer'}; render() });
}
/* One tap for the whole thing: ask the server what it is holding, then post that and
   the timer log. The two were separate buttons behind a closed disclosure, which is
   three taps and a discovery problem for the one action that unblocks a diagnosis. */
function pushDiag(){
  return checkAlerts().then(()=>sendReport('alerts',pushReport()+'\n\n--- timer log ---\n'+tlogText()));
}
function sendNote(){
  if(!sendState) return '';
  if(sendState.busy) return '<div class="small muted">Sending\u2026</div>';
  return sendState.ok
    ? '<div class="small" style="color:var(--green)">Sent. Nothing else needed \u2014 it can be read from here.</div>'
    : `<div class="small" style="color:var(--red)">Could not send it (${esc(sendState.err)}). The text is below; a screenshot works too.</div>`;
}
function pushReport(){
  return 'Operator + Black '+(typeof APP_VERSION==='string'?APP_VERSION:'')+' \u00b7 alerts\n'+
    (typeof navigator!=='undefined'?String(navigator.userAgent).slice(0,160):'')+'\n\n'+pushStatusText()+'\n\n'+pushAdvice().join('\n');
}
async function testAlert(){
  try{ await api('POST','/push/set',{kind:'test',rev:alarmNextRev(),endpoint:LS.get('ob.push')||'',alerts:[{at:Date.now()+8000,title:'Test alert',body:'Rest alerts work. This is what the end of a rest looks like.'}]},{keepalive:true}); alerts.msg='Test alert coming in 8 seconds. Lock your phone now to see it on the lock screen.' }
  catch(e){ alerts.msg='Couldn’t send the test. Check your connection.' }
  render();
}
/* ---------- what the server was last asked for, and what it said ----------
Every one of these calls ended in `.catch(()=>{})`. The intent was right -- a rest must
not fail because the network did -- but it meant a push that was never scheduled looked
exactly like one that was, and "the alerts don't work" had nothing behind it. The
outcome is recorded now and shown on the Rest alerts card.

The failure that bites in silence: the server refuses an alert whose time is already
past or more than two hours out, so a phone clock a few minutes slow earns a 400 on
every rest it ever schedules and never makes a sound. */
let pushLast=LS.get('ob.pushlast')||null;
function pushNote(what,ok,detail){
  pushLast={t:Date.now(),what,ok:!!ok,d:detail==null?'':String(detail)};
  LS.set('ob.pushlast',pushLast);
  tlog('push',what+' · '+(ok?'accepted':'refused'),detail);
}
// Not `hhmm`: 21a-calendar.js already has one, it parses rather than formats, and it
// wins the concatenation -- so every time in this report printed as "null".
function clockTime(t){ const d=new Date(+t); return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()) }
/* ---------- the lock-screen alarm ----------
With the phone locked or the app away, the page is frozen and nothing in it can make a
sound, so this is the only alarm that works then. It is built to be sure, not hopeful.

One function decides which alerts should exist -- the rest, the interval session, the
generic timer -- and sends a timer's whole list only when it differs from what the
server last confirmed. There used to be three schedulers sharing one server queue,
each replacing all of it: that is how a rest wiped the generic timer's alert, and how
starting intervals out of a running rest, a cancel and a schedule racing each other,
could erase every interval alert. Each timer now has its own slot on the server, for
this device only, and every write carries a revision so one that arrives late cannot
undo a newer one.

Sent at once, never behind a timer: iOS freezes a pocketed page well inside the 300 ms
a debounce used to wait (3.55). With keepalive, so the request outlives the page being
frozen around it. Retried when it fails -- gyms are where the signal is worst -- and
again when the connection or the app comes back. Counted as set only once the server
says so, which is what the tick on the rest bar means. */
let alarmState=LS.get('ob.alarm')||{}, alarmRev=+LS.get('ob.alarmrev')||0, alarmRetryT=null;
// Only confirmed ones are kept: after a restart they are what a cancel has to undo.
function alarmSave(){ const o={}; for(const [k,v] of Object.entries(alarmState)) if(v.ok) o[k]={sig:v.sig,ok:true}; LS.set('ob.alarm',o) }
// Always increasing on this device, whatever its clock does, so a later write outranks an earlier one.
function alarmNextRev(){ alarmRev=Math.max(alarmRev+1,Date.now()); LS.set('ob.alarmrev',alarmRev); return alarmRev }
function restAlert(){
  const body=rest.next?'Next: '+rest.next.replace(/ · /g,', ')+'.':rest.lbl.replace(/^Rest · /,'')+' rest is over.';
  return {at:rest.end,title:rest.lbl.startsWith('Rest before')?'Time for HIC':'Rest done',body};
}
function alarmWant(){
  return {
    rest:rest&&!rest.done?[restAlert()]:[],
    iv:iv&&!iv.done&&!iv.paused?ivAlerts():[],
    gt:gt&&gt.mode==='down'&&!gt.paused&&!gt.done?[{at:gt.end,title:'Timer done',body:'The timer you set has finished.'}]:[],
  };
}
const ALARM_WHAT={rest:'rest alert',iv:'interval alerts',gt:'timer alert'};
const ALARM_WAIT=10000;            // an answer slower than this is treated as none
function alarmSync(){
  if(!alertsOn()) return;
  const want=alarmWant(), ep=LS.get('ob.push')||'';
  for(const [kind,all] of Object.entries(want)){
    const list=all.slice(0,80);
    // The device is part of it: a fresh subscription is a fresh slot to fill.
    const sig=ep+'#'+list.map(x=>x.at+':'+x.title).join('|'), st=alarmState[kind];
    if(!st&&!list.length) continue;                       // never set, nothing to clear
    if(st&&st.sig===sig&&(st.ok||st.busy)) continue;      // confirmed, or on its way
    alarmSend(kind,list,sig,ep);
  }
}
function alarmSend(kind,list,sig,ep){
  const prev=alarmState[kind];
  const st=alarmState[kind]={sig,busy:true,ok:false,err:null,t:Date.now(),tries:prev&&prev.sig===sig?prev.tries||0:0};
  const what=list.length?ALARM_WHAT[kind]||kind:'cancel '+(ALARM_WHAT[kind]||kind);
  const fail=why=>{ st.busy=false; st.tries++; st.err=why; alarmRetry(); showCover() };
  // A request that never answers would otherwise hold the slot "on its way" for ever.
  unref(setTimeout(()=>{ if(alarmState[kind]===st&&st.busy){ pushNote(what,false,'no answer in 10 s'); fail('no answer') } },ALARM_WAIT));
  return api('POST','/push/set',{kind,rev:alarmNextRev(),alerts:list,endpoint:ep},{keepalive:true}).then(
    r=>{ if(alarmState[kind]!==st) return;                // overtaken by a newer write
      st.busy=false; st.ok=true; st.err=null; alarmSave();
      pushNote(what,true,r&&r.stale?'a newer one was already there':r&&r.next?'fires '+clockTime(r.next):'');
      showCover(); },
    e=>{ if(alarmState[kind]!==st) return;
      pushNote(what,false,e&&e.status?'HTTP '+e.status:(e&&e.message)||'no answer');
      fail(e&&e.status?'HTTP '+e.status:'offline'); });
}
// 2, 5 and 15 seconds, then every 30, for as long as anything is still unconfirmed.
function alarmRetry(){
  if(alarmRetryT) return;
  const n=Math.max(1,...Object.values(alarmState).map(x=>x.tries||0));
  alarmRetryT=unref(setTimeout(()=>{ alarmRetryT=null; alarmSync() },[2000,5000,15000][n-1]||30000));
}
// These timers keep going as long as something is unconfirmed. In Node, where the tests
// run, an unref'd timer does not hold the process open; in a browser a timer is a number
// and this does nothing.
function unref(t){ if(t&&typeof t.unref==='function') t.unref(); return t }
// Tapping the rest bar's "not set": whatever is stuck goes again now.
function alarmForce(){ for(const x of Object.values(alarmState)) if(!x.ok) x.busy=false; alarmSync() }
if(typeof window!=='undefined'&&window.addEventListener) window.addEventListener('online',()=>alarmSync());
function startHold(name,secs,sides,side){
  unlockAudio();
  rest={k:null,lbl:name,next:sides>1?(side<sides?'Switch sides':'Hold done'):'',end:Date.now()+secs*1000,dur:secs,done:false,hold:1,baseLbl:name,sides,side};
  LS.set('ob.rest',rest); syncScreen(); showRest(); alarmSync();
}
function startRest(k,next,secs,lbl){
  secs=secs||restMins(k)*60;
  rest={k,lbl:lbl||'Rest · '+liftName(k),next,end:Date.now()+secs*1000,dur:secs,done:false};
  tlog('rest','started',secs+' s');
  LS.set('ob.rest',rest); syncScreen(); showRest(); alarmSync();
}
function stopRest(){rest=null;LS.set('ob.rest',null);clearInterval(restTick);restTick=null;syncScreen();showRest();alarmSync()}
function showRest(){
  const el=document.getElementById('rest');
  showCover();
  if(!rest){el.hidden=true;document.body.classList.remove('timing');return}
  el.hidden=false;document.body.classList.add('timing');
  document.getElementById('rest-lbl').textContent=rest.lbl+(rest.sides>1?' · side '+rest.side+' of '+rest.sides:'');
  // A timer that cannot make a sound should say so, or it reads as broken.
  const q=document.getElementById('rest-quiet'); if(q) q.hidden=!quiet();
  showWake();
  if(!restTick) restTick=setInterval(tickRest,250);
  tickRest();
}
// Turning the sound back on from the timer itself, where you noticed it was off.
// A named function because the click handler cannot be reached from a test.
function unquiet(){
  // Back to sharing the speaker rather than seizing it: the tap means "let me hear it",
  // not "stop my music".
  setPlan('soundMode','duck');
  unlockAudio();
  showRest(); render();
}
function tickRest(){
  if(!rest) return;
  const el=document.getElementById('rest'), leftMs=rest.end-Date.now(), left=Math.max(0,Math.ceil(leftMs/1000));
  document.getElementById('rest-time').textContent=Math.floor(left/60)+':'+pad(left%60);
  document.getElementById('rest-fill').style.width=Math.min(100,Math.max(0,100*(1-leftMs/(rest.dur*1000))))+'%';
  document.getElementById('rest-next').textContent=left>0?(rest.next?'Next: '+rest.next:''):(rest.next?'Go: '+rest.next:'Rest done');
  document.getElementById('rest-stop').textContent=left>0?'Skip':'Done';
  el.classList.toggle('done',left===0);
  // The warning: a tone, and deliberately nothing spoken. Speech can interrupt the audio
  // channel on iOS, and a spoken "ten seconds" was the one sound between the tap that
  // started the rest and the beep that ends it -- so the end beep landed on a channel
  // speech had just parked, with no tap to wake it. Only on a rest at least twice the
  // warning, or a short one would announce itself the moment it began.
  // Three seconds' notice for the audio channel, so the end beep is not waiting on a
  // resume() when it should be sounding.
  if(left<=3&&left>0) sfxArm();
  // Is the channel really alive? Checked every tick so a dead one is found mid-rest,
  // while there is still time to tap, rather than at the end.
  if(left>0){ audioClockSample(); showArm(); showCover() }
  if(restWarnDue(rest,left)){
    rest.warned=true; LS.set('ob.rest',rest); beepWarn(); tlog('rest','warning',left+' s left');
  }
  if(left===0&&!rest.done){
    // How late the tick noticed. Under a second is the timer working; a big number is
    // the screen having been asleep, which no in-app sound can beat.
    tlog('rest','over',Math.max(0,Math.round(-leftMs/100)/10)+' s late');
    rest.done=true;LS.set('ob.rest',rest);beep();syncScreen();
    if(rest.hold&&rest.sides>rest.side){ const r=rest; say('Switch sides'); setTimeout(()=>{ if(rest===r) startHold(r.baseLbl,r.dur,r.sides,r.side+1) },1200); }
    else setTimeout(()=>say(rest&&rest.hold?(rest.baseLbl+' done'):rest&&rest.next?'Rest over. '+rest.next.replace(' · ',', '):'Rest over.'),700);
  }
  // The same re-check the interval timer does: iOS lets the screen lock go mid-rest and
  // nothing used to take it back until the page was hidden and shown again.
  if(left>0) syncScreen();
  // clear a finished timer after two minutes if nobody dismisses it
  if(left===0&&leftMs<-120000) stopRest();
}
document.getElementById('rest').addEventListener('click',e=>{
  const b=e.target.closest('[data-rest]'); if(!b||!rest) return; const v=b.dataset.rest;
  if(v==='cover'){ coverTap(); return }
  if(v==='stop') return stopRest();
  if(v==='unquiet'){ unquiet(); return }
  // The tap itself is the repair (gestureWake, on the way in). Named here so it never
  // falls through to the +/-30 s branch below, which would read 'arm' as a number.
  if(v==='arm'){ showRest(); return }
  unlockAudio();
  rest.end=Math.max(Date.now()+1000,rest.end+(+v)*1000); if(rest.end>Date.now()) rest.done=false;
  rest.dur=Math.max(rest.dur,Math.round((rest.end-Date.now())/1000));
  LS.set('ob.rest',rest); syncScreen(); tickRest(); alarmSync();
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible') return;
  if(rest){ syncScreen(); tickRest() }
  alarmSync();     // anything that failed while away goes again
});
function nextAfterSet(k,sets){
  const wk=weekOf(sel), dp=dayPlan(sel); if(!wk||dp.t!=='lift') return null;
  const r=rx(wk,k), nSets=r.sMax;
  for(let i=0;i<nSets;i++) if(!sets[i]) return liftName(k)+' · set '+(i+1)+(i>=r.s?' (optional)':'');
  const li=dp.lifts.indexOf(k);
  for(let j=li+1;j<dp.lifts.length;j++){const s2=((lg(sel).lifts||{})[dp.lifts[j]]||{}).sets||[];if(!s2[0])return liftName(dp.lifts[j])+' · set 1'}
  return undefined; // nothing left: no rest needed
}
