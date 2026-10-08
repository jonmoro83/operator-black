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
function b64uBytes(str){const b=str.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(str.length/4)*4,'=');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))}
// If this device thinks alerts are on but the server has no subscription for this
// person (e.g. after the move to per-user alert stores), quietly register it again.
async function healAlerts(){
  if(!alertsOn()) return;
  try{
    const st=await api('GET','/push/status'); if(st.devices) return;
    const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription();
    if(sub) await api('POST','/push/subscribe',{subscription:sub.toJSON()}); else LS.set('ob.push',null);
  }catch(e){}
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
    LS.set('ob.push',sub.endpoint); alerts.msg='Rest alerts are on for this device.';
  }catch(e){ alerts.msg=e&&e.status?'The server refused the subscription ('+e.status+'). Try again.':'Couldn’t turn on alerts. Check your connection and try again.' }
  finally{ alerts.busy=false; render() }
}
async function disableAlerts(){
  alerts.busy=true; render();
  try{ const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription(); if(sub){ await api('POST','/push/unsubscribe',{endpoint:sub.endpoint}).catch(()=>{}); await sub.unsubscribe() } }catch(e){}
  LS.set('ob.push',null); alerts.msg='Rest alerts are off for this device.'; alerts.busy=false; render();
}
async function testAlert(){
  try{ await api('POST','/push/schedule',{at:Date.now()+8000,title:'Test alert',body:'Rest alerts work. This is what the end of a rest looks like.'}); alerts.msg='Test alert coming in 8 seconds. Lock your phone now to see it on the lock screen.' }
  catch(e){ alerts.msg='Couldn’t send the test. Check your connection.' }
  render();
}
let pushTimer=null;
function syncPush(){
  if(!alertsOn()) return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(()=>{
    if(rest&&!rest.done){
      const body=rest.next?'Next: '+rest.next.replace(/ · /g,', ')+'.':rest.lbl.replace(/^Rest · /,'')+' rest is over.';
      api('POST','/push/schedule',{at:rest.end,title:rest.lbl.startsWith('Rest before')?'Time for HIC':'Rest done',body}).catch(()=>{});
    } else api('POST','/push/cancel').catch(()=>{});
  },300);
}
function startHold(name,secs,sides,side){
  unlockAudio();
  rest={k:null,lbl:name,next:sides>1?(side<sides?'Switch sides':'Hold done'):'',end:Date.now()+secs*1000,dur:secs,done:false,hold:1,baseLbl:name,sides,side};
  LS.set('ob.rest',rest); syncScreen(); showRest(); syncPush();
}
function startRest(k,next,secs,lbl){
  secs=secs||restMins(k)*60;
  rest={k,lbl:lbl||'Rest · '+liftName(k),next,end:Date.now()+secs*1000,dur:secs,done:false};
  LS.set('ob.rest',rest); syncScreen(); showRest(); syncPush();
}
function stopRest(){const was=rest&&!rest.done;rest=null;LS.set('ob.rest',null);clearInterval(restTick);restTick=null;syncScreen();showRest();if(was)syncPush()}
function showRest(){
  const el=document.getElementById('rest');
  if(!rest){el.hidden=true;document.body.classList.remove('timing');return}
  el.hidden=false;document.body.classList.add('timing');
  document.getElementById('rest-lbl').textContent=rest.lbl+(rest.sides>1?' · side '+rest.side+' of '+rest.sides:'');
  // A timer that cannot make a sound should say so, or it reads as broken.
  const q=document.getElementById('rest-quiet'); if(q) q.hidden=!quiet();
  if(!restTick) restTick=setInterval(tickRest,250);
  tickRest();
}
// Turning the sound back on from the timer itself, where you noticed it was off.
// A named function because the click handler cannot be reached from a test.
function unquiet(){
  setPlan('quietTimer',false);
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
  if(left===10&&rest.dur>20&&!rest.said10){rest.said10=true;say('Ten seconds')}
  if(left===0&&!rest.done){
    rest.done=true;LS.set('ob.rest',rest);beep();syncScreen();
    if(rest.hold&&rest.sides>rest.side){ const r=rest; say('Switch sides'); setTimeout(()=>{ if(rest===r) startHold(r.baseLbl,r.dur,r.sides,r.side+1) },1200); }
    else setTimeout(()=>say(rest&&rest.hold?(rest.baseLbl+' done'):rest&&rest.next?'Rest over. '+rest.next.replace(' · ',', '):'Rest over.'),700);
  }
  // clear a finished timer after two minutes if nobody dismisses it
  if(left===0&&leftMs<-120000) stopRest();
}
document.getElementById('rest').addEventListener('click',e=>{
  const b=e.target.closest('[data-rest]'); if(!b||!rest) return; const v=b.dataset.rest;
  if(v==='stop') return stopRest();
  if(v==='unquiet'){ unquiet(); return }
  unlockAudio();
  rest.end=Math.max(Date.now()+1000,rest.end+(+v)*1000); if(rest.end>Date.now()) rest.done=false;
  rest.dur=Math.max(rest.dur,Math.round((rest.end-Date.now())/1000));
  LS.set('ob.rest',rest); syncScreen(); tickRest(); syncPush();
});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&rest){ syncScreen(); tickRest() } });
function nextAfterSet(k,sets){
  const wk=weekOf(sel), dp=dayPlan(sel); if(!wk||dp.t!=='lift') return null;
  const r=rx(wk,k), nSets=r.sMax;
  for(let i=0;i<nSets;i++) if(!sets[i]) return liftName(k)+' · set '+(i+1)+(i>=r.s?' (optional)':'');
  const li=dp.lifts.indexOf(k);
  for(let j=li+1;j<dp.lifts.length;j++){const s2=((lg(sel).lifts||{})[dp.lifts[j]]||{}).sets||[];if(!s2[0])return liftName(dp.lifts[j])+' · set 1'}
  return undefined; // nothing left: no rest needed
}
