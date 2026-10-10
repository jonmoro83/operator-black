/* ---------- rest timer ---------- */
// State lives in localStorage with an absolute end time, so it survives the phone
// locking, the app being backgrounded, or a reload.
let rest=LS.get('ob.rest'), restTick=null, audioCtx=null, wakeLock=null;
function restMins(k){const m=+((plan.rest||{})[k]);return m>=2&&m<=5?m:3}
// Seconds between ramp sets. Long enough that the last ramp single doesn't eat into the
// first working set — a minute was the old floor and it was not enough once the bar is
// heavy. 90 s is the default, and the running timer takes +30 s as many times as you like.
const WARM_RESTS=[60,90,120,150];
function warmRestSecs(k){const v=+((plan.warmRest||{})[k]);return v>=60&&v<=600?v:90}
function warmRestLabel(v){return v<120?v+'s':(v/60)+' min'}
// Spoken cues (Setup / timer card). iOS only speaks after a first utterance inside a
// tap, so unlockAudio primes it with a silent one.
let voicePrimed=false;
function say(text){
  if(quiet()||!plan.voice||!('speechSynthesis' in window)) return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=1.05; u.pitch=1; speechSynthesis.speak(u) }catch(e){}
}
function quiet(){return !!plan.quietTimer}
function unlockAudio(){
  if(quiet()) return;
  try{ if(plan.voice&&!voicePrimed&&'speechSynthesis' in window){ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); voicePrimed=true } }catch(e){}
  try{
    // 'transient' ducks other audio and is silenced by the iPhone ringer switch.
    // A rest alert you cannot hear is the bug, so this asks for playback instead.
    if(navigator.audioSession) navigator.audioSession.type='playback';
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const b=audioCtx.createBuffer(1,1,22050), s=audioCtx.createBufferSource(); s.buffer=b; s.connect(audioCtx.destination); s.start(0);
  }catch(e){}
}
/* ---------- making a noise that actually arrives ----------
Third report of "the rest beep doesn't work", so this stopped being a one-line fix and
got taken apart. Three separate things can swallow it, and the beep now goes around all
three rather than assuming which one it was:

1. On iPhone the ringer switch silences Web Audio, because a bare AudioContext plays in
   the ambient category. An HTML media element does not get silenced that way, so the
   beep goes out as a media element too. That is the one a gym timer cares about: the
   phone is on silent and nothing is wrong with the app.
2. `resume()` is async. The old code called it and read `currentTime` on the next line,
   off a context that was still suspended, then scheduled three oscillators against that
   stale clock. Now the tones are scheduled after the resume settles.
3. iPhone Safari has no Vibration API at all, so the buzz half can never work there. It
   fires unconditionally anyway, for Android and for Silent mode.

`beepDiag()` reports which of these is in play on the device in hand, because guessing
at this from a laptop is what produced the first two fixes. */
let beepEl=null, beepSrc=null, lastBeep=null;
// A three-note WAV built in memory: no asset to fetch, no decode, and nothing to go
// stale in a cache. 8 kHz 8-bit mono is plenty for a beep and keeps it a few KB.
function beepWav(){
  if(beepSrc) return beepSrc;
  try{
    const sr=8000, segs=[[880,.22],[0,.06],[880,.22],[0,.06],[1320,.26]];
    const n=segs.reduce((a,x)=>a+Math.round(x[1]*sr),0);
    const b=new Uint8Array(44+n), dv=new DataView(b.buffer);
    const str=(o,t)=>{for(let i=0;i<t.length;i++)b[o+i]=t.charCodeAt(i)};
    str(0,'RIFF'); dv.setUint32(4,36+n,true); str(8,'WAVEfmt ');
    dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
    dv.setUint32(24,sr,true); dv.setUint32(28,sr,true); dv.setUint16(32,1,true); dv.setUint16(34,8,true);
    str(36,'data'); dv.setUint32(40,n,true);
    let p=44;
    for(const seg of segs){ const hz=seg[0], len=Math.round(seg[1]*sr);
      for(let i=0;i<len;i++){
        // a short fade each end, or the square edges click
        const env=Math.min(1,Math.min(i,len-i)/(sr*.012));
        b[p++]=hz?128+Math.round(100*env*Math.sin(2*Math.PI*hz*i/sr)):128;
      } }
    let t=''; for(let i=0;i<b.length;i++) t+=String.fromCharCode(b[i]);
    beepSrc='data:audio/wav;base64,'+btoa(t);
  }catch(e){ beepSrc=null }
  return beepSrc;
}
function beepMedia(){
  try{
    if(!beepEl){
      const src=beepWav(); if(!src) return 'no-wav';
      beepEl=document.createElement('audio');
      beepEl.src=src; beepEl.preload='auto';
    }
    beepEl.currentTime=0;
    const p=beepEl.play();
    if(p&&p.then){ p.then(()=>{lastBeep='media'},e=>{lastBeep='media-blocked:'+((e&&e.name)||'?')}) ; return 'pending' }
    return 'played';
  }catch(e){ return 'threw:'+((e&&e.name)||'?') }
}
function beepTones(){
  if(!audioCtx) unlockAudio();
  if(!audioCtx) return 'no-context';
  const go=()=>{ try{
    const t0=audioCtx.currentTime;
    [0,.28,.56].forEach((dt,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=i===2?1320:880;g.gain.setValueAtTime(0.0001,t0+dt);g.gain.exponentialRampToValueAtTime(0.5,t0+dt+.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+dt+.22);o.connect(g);g.connect(audioCtx.destination);o.start(t0+dt);o.stop(t0+dt+.25)});
  }catch(e){} };
  // Scheduling against a suspended context's clock was bug 2: resume first, then read it.
  if(audioCtx.state==='suspended'){
    try{ const p=audioCtx.resume(); if(p&&p.then) p.then(go,()=>{}); else go(); }catch(e){ return 'resume-threw' }
    return 'resuming';
  }
  go(); return 'running';
}
function beep(){
  // Buzz first and unconditionally. Silent mode exists so iOS does not take the audio
  // session off your music; vibration never touches audio, so suppressing it as well
  // left Silent with no way at all to tell you a rest had ended. (Moot on iPhone, which
  // has no Vibration API, but right on Android and right in principle.)
  let vib=false;
  try{ vib=!!(navigator.vibrate&&navigator.vibrate([200,100,200])) }catch(e){}
  if(quiet()){ lastBeep='silent'; return {vib,media:'silent',tones:'silent'} }
  const media=beepMedia(), tones=beepTones();
  lastBeep=lastBeep==='media'?lastBeep:(media+'/'+tones);
  return {vib,media,tones};
}
// What the Sound card shows after a test, so a report comes with facts attached.
let beepSeen=null;
// What the device can do, read without touching anything. Separate from beepDiag
// because that one makes a noise, and an inspector with a side effect is a trap.
function audioState(){
  return {
    silent:quiet(),
    canVibrate:typeof navigator!=='undefined'&&!!navigator.vibrate,
    ctx:audioCtx?audioCtx.state:'none',
    session:(typeof navigator!=='undefined'&&navigator.audioSession)?String(navigator.audioSession.type):'unsupported',
    ua:typeof navigator!=='undefined'?String(navigator.userAgent).slice(0,160):'',
  };
}
// What to tell me when it still doesn't work: facts off the device, not a diagnosis.
// This beeps, on purpose — the point is to hear it and report what happened.
function beepDiag(){
  const r=beep();
  return Object.assign(audioState(),{vibrated:r.vib,media:r.media,tones:r.tones});
}
// Plain English for each thing that can swallow a beep, so the card says what to try
// rather than printing a status code at someone standing in a gym.
function beepAdvice(d){
  const out=[];
  if(d.silent) out.push('Silent timers are on below, so the beep is turned off on purpose. The buzz and the notification still fire.');
  if(/iPhone|iPad/i.test(d.ua)){
    if(!d.canVibrate) out.push('This is an iPhone or iPad, and Safari gives a web app no way to vibrate at all. There will never be a buzz here \u2014 sound, screen and notifications are what you get.');
    out.push('If you heard nothing: check the ringer switch on the side, and that the volume is up. The beep now also plays as a media clip, which the ringer switch does not silence, so this is the case that should have been fixed.');
  } else if(!d.canVibrate) out.push('This browser has no Vibration API, so there will be no buzz.');
  if(d.ctx==='none') out.push('No audio channel was opened. That usually means nothing has been tapped yet on this page \u2014 tap the button again.');
  if(d.ctx==='suspended') out.push('The audio channel is suspended, which is what happens after the phone locks. Tap the button again with the app on screen.');
  if(String(d.media).indexOf('blocked')===0||String(d.media).indexOf('media-blocked')===0) out.push('The media clip was blocked by the browser. Tap the button again \u2014 the first play has to come from a tap.');
  if(!out.length) out.push('Everything the app can check came back fine. If you still heard nothing, it is the device volume or a Focus mode rather than the app.');
  return out;
}
function beepTest(){ beepSeen=beepDiag(); render(); }
// Paste-able, same shape as the crash report, so a "still broken" comes with the facts.
function beepReport(){
  const d=beepSeen; if(!d) return 'No beep test run yet.';
  const head='Operator + Black '+(typeof APP_VERSION==='string'?APP_VERSION:'')+' \u00b7 beep test';
  const rows=[['silent',d.silent],['can vibrate',d.canVibrate],['vibrated',d.vibrated],
    ['media clip',d.media],['web audio',d.tones],['audio channel',d.ctx],['audio session',d.session]];
  return head+'\n'+rows.map(r=>r[0]+': '+r[1]).join('\n')+'\n'+d.ua+'\n\n'+beepAdvice(d).join('\n');
}
// iOS drops the lock whenever the page is hidden, and a dropped lock still reads as an
// object, so re-check `released` rather than trusting we still hold it.
async function holdScreen(on){
  try{
    if(on){
      if(!navigator.wakeLock) return;
      if(wakeLock&&!wakeLock.released) return;
      wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null});
    } else if(wakeLock){ const w=wakeLock; wakeLock=null; await w.release() }
  }catch(e){wakeLock=null}
}
// The screen stays on for as long as anything is actually going on, not just while a
// rest happens to be counting: a session is open, or any timer is running.
function wantScreen(){
  if(ls||guide) return true;                      // session mode, or the guided runner
  if(rest&&!rest.done) return true;
  if(iv&&!iv.done) return true;
  if(gt&&!gt.paused&&!gt.done) return true;
  return false;
}
function syncScreen(){ holdScreen(wantScreen()) }
// Coming back to the app: take the lock again if we still need it, and wake the audio
// context, which iOS suspends while the page is hidden and a silent beep never recovers.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible') return;
  syncScreen();
  try{ if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume() }catch(e){}
});
