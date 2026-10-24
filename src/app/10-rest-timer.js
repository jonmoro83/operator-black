/* ---------- rest timer ---------- */
// State lives in localStorage with an absolute end time, so it survives the phone
// locking, the app being backgrounded, or a reload.
let rest=LS.get('ob.rest'), restTick=null, audioCtx=null, wakeLock=null;
// 'held', 'refused', 'unsupported' or 'off'. Refused is the one that matters: iOS can
// decline the screen lock -- Low Power Mode does -- and then the screen sleeps, the page
// stops, and a beep can only sound when you next wake the phone.
let wakeState='off';
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
  // Never over a tone: speech starting mid-note can cut it off on iOS. Wait it out.
  const wait=sfxUntil-Date.now();
  if(wait>0){ setTimeout(()=>say(text),wait); return }
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=1.05; u.pitch=1; speechSynthesis.speak(u) }catch(e){}
}
/* ---------- sharing the phone's speaker ----------
iOS gives a web page one audio session, and the only lever is its category. The spec
splits them in two: `playback`, `play-and-record` and `transient-solo` are *exclusive* —
they take the speaker and stop whatever was playing — while `transient` and `ambient`
*mix* with other audio but are silenced by the ring/silent switch.

A native app gets both at once by asking for the playback category with a mixWithOthers
option. The web API has no equivalent, so this is a real choice and not a missing
feature on our side:

  duck      transient. Your music keeps playing and the beep goes over it. Audible
            whenever the ring switch is on. The default, because a gym timer that
            silences your music every two minutes is worse than one you can't hear
            with the switch off.
  takeover  playback. Heard even on silent, at the price of pausing your music for
            about a second. This is the only mode where the WAV clip is used too:
            a media element is for beating the switch, which is the takeover case.
  silent    no sound at all. Vibration still fires where the platform has it.

1.79 set `playback` for everyone, which is how the music started stopping. */
function soundMode(){
  const m=plan.soundMode;
  if(m==='duck'||m==='takeover'||m==='silent') return m;
  return plan.quietTimer?'silent':'duck';          // pre-1.84 plans
}
function quiet(){return soundMode()==='silent'}
// Changing it takes effect on the next beep, so the channel is re-asked for now rather
// than at the end of a rest when it is too late to find out it was refused.
function setSoundMode(v){
  if(!['duck','takeover','silent'].includes(v)) return false;
  mutatePlan(p=>{p.soundMode=v; delete p.quietTimer});
  if(v!=='silent') unlockAudio();
  return true;
}
// WebKit adds an 'interrupted' state of its own when another app takes the audio, so
// "not running" is the question rather than "suspended" — checking only for suspended
// left the context asleep whenever music had started since the last beep.
function audioAwake(){
  if(!audioCtx) return false;
  if(audioCtx.state==='running') return true;
  try{ audioCtx.resume(); return true }catch(e){ return false }
}
/* `voice:false` leaves the speech priming alone, for a caller that is about to make a
   tone. iOS wants the first utterance inside a tap, so this primes within the gesture
   -- but speaking parks the AudioContext, so doing it immediately before a beep hands
   that beep a channel that has just been interrupted. The one place it mattered most
   was the Test the beep button, where the first tap primes and beeps together. */
function unlockAudio(opt){
  if(quiet()) return;
  const wantVoice=!(opt&&opt.voice===false);
  try{ if(wantVoice&&plan.voice&&!voicePrimed&&'speechSynthesis' in window){ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); voicePrimed=true } }catch(e){}
  try{
    if(navigator.audioSession) navigator.audioSession.type=soundMode()==='takeover'?'playback':'transient';
    if(!audioCtx){ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); ctxWatch(audioCtx); tlog('audio','channel opened') }
    if(audioCtx.state!=='running') audioCtx.resume();
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
        b[p++]=hz?128+Math.round(124*env*Math.sin(2*Math.PI*hz*i/sr)):128;
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
/* ---------- one way to make a sound ----------
Every timer sound goes through `sfx`: the end of a rest, its warning, every interval
change and its 3-2-1, the guided holds, the generic timer. Until 3.25 there were two
paths. `beep()` had been fixed four times; `tone()`, which the interval timer and the
guided walkthrough used, had none of those fixes -- it never woke an 'interrupted'
context, and it scheduled against the clock of one that was still waking. The Test
button only ever exercised the first, so "confirmed working" was true and said nothing
about the second. One function now, so a fix lands everywhere at once, and a test fails
if a second place ever starts making tones.

Loudness, measured rather than guessed (3.25). Each note used to rise in 20 ms and then
decay exponentially by 74 dB over its length, which is about 12 ms at full volume: a
blip. Held at full volume and released in 40 ms, the same note at the same pitch
carries sixteen times the energy, and below ~200 ms the ear hears energy -- that alone
is +12 dB. The peak goes from 0.5 to 1.0, another +6. And the tones below 1 kHz get
their 2nd and 3rd harmonics, because a phone speaker loses about 12 dB per octave below
its ~1 kHz resonance: a 587 Hz sine was mostly lost in the speaker, while its
harmonics land where the speaker works and the ear still hears the low note. Modelled
against a speaker-plus-ear curve: +15 to +27 dB per sound, every pitch unchanged. */
const SFX={
  done:  [{f:880,d:.20},{f:880,d:.20,at:.28},{f:1320,d:.26,at:.56}],      // rest or timer over
  warn:  [{f:587,d:.20,h:[1,.5,.3]}],                                      // heads-up: one low note
  go:    [{f:1320,d:.45}],                                                 // interval: work starts
  easy:  [{f:660,d:.45,h:[1,.8,.6]}],                                      // interval: easy starts
  tick:  [{f:880,d:.12,peak:.8}],                                          // interval: 3, 2, 1
  ivdone:[{f:880,d:.20},{f:880,d:.20,at:.28},{f:1320,d:.50,at:.56}],      // intervals finished
  hold:  [{f:1320,d:.30}],                                                 // guided: hold done
  side:  [{f:660,d:.30,h:[1,.8,.6]}],                                      // guided: switch sides
  gdone: [{f:880,d:.18},{f:1320,d:.35,at:.22}],                            // guided: block done
};
// How long a sound lasts, so speech can wait for it rather than talk over it.
function sfxLen(name){ return Math.max(0,...(SFX[name]||[]).map(n=>(n.at||0)+n.d)) }
let sfxWaves=new WeakMap(), sfxUntil=0;
// A periodic wave per harmonic recipe, per context. createPeriodicWave normalises to a
// peak of 1 by default, so adding harmonics can never push a note past full scale.
function sfxWave(ctx,h){
  let m=sfxWaves.get(ctx); if(!m){ m={}; sfxWaves.set(ctx,m) }
  const k=h.join(',');
  if(!m[k]){ const re=new Float32Array(h.length+1), im=new Float32Array(h.length+1); h.forEach((a,i)=>{im[i+1]=a}); m[k]=ctx.createPeriodicWave(re,im) }
  return m[k];
}
// One held note: up in 8 ms, held, down in 40. The only createOscillator in the app.
function sfxNote(ctx,t,n){
  const o=ctx.createOscillator(), g=ctx.createGain(), peak=n.peak==null?1:n.peak;
  if(n.h&&n.h.length>1&&ctx.createPeriodicWave) o.setPeriodicWave(sfxWave(ctx,n.h)); else o.type='sine';
  o.frequency.value=n.f;
  const att=.008, rel=Math.min(.04,n.d/3);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(peak,t+att);
  g.gain.setValueAtTime(peak,t+n.d-rel);
  g.gain.linearRampToValueAtTime(0,t+n.d);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+n.d+.02);
}
function sfx(name){
  const notes=SFX[name]; if(!notes) return 'unknown';
  if(quiet()){ tlog('sound',name+' \u00b7 silent'); return 'silent' }
  if(!audioCtx) unlockAudio();
  if(!audioCtx){ tlog('sound',name+' \u00b7 no-context'); return 'no-context' }
  // Speech that starts while a tone is sounding can cut it off on iOS, so say() holds
  // off until this has passed. Set before the play, because a wake may delay it.
  sfxUntil=Date.now()+sfxLen(name)*1000+120;
  const play=()=>{ try{ const t0=audioCtx.currentTime+.005; for(const n of notes) sfxNote(audioCtx,t0+(n.at||0),n) }catch(e){} };
  const was=audioCtx.state;
  if(was==='running'){ play(); tlog('sound',name+' \u00b7 played'); return 'running' }
  // The line goes in now, pending, and the outcome amends it. Before, a wake that never
  // answered wrote nothing at all, so a beep lost that way and a beep never asked for
  // looked identical in the log -- which is the one distinction a report needs.
  const id=tlog('sound',name+' \u00b7 waking',was,true);
  let settled=false;
  // Not running -- 'suspended' after a lock, 'interrupted' after speech, a call or
  // another app. Wake it and play once it is awake. Reading the clock first was the old
  // bug: a parked context's clock is stale, and notes scheduled on it never sound. If
  // the wake does not take, there is no tap to retry with, so the log says so rather
  // than the beep going missing in silence.
  try{
    const p=audioCtx.resume();
    if(p&&p.then){
      p.then(()=>{
        settled=true;
        if(audioCtx.state==='running'){ sfxUntil=Date.now()+sfxLen(name)*1000+120; play(); tlogAmend(id,name+' \u00b7 played after waking',was) }
        else tlogAmend(id,name+' \u00b7 wake did not take',was+' → '+audioCtx.state);
      },e=>{ settled=true; tlogAmend(id,name+' \u00b7 wake refused',was+' '+((e&&e.name)||'')) });
      // WebKit leaves resume() pending for as long as an interruption lasts, so a promise
      // that has not settled in two seconds is a sound going missing, not one running late.
      setTimeout(()=>{ if(!settled) tlogAmend(id,name+' \u00b7 wake never answered',was+', still waiting after 2 s') },2000);
      return 'resuming';
    }
    play(); tlogAmend(id,name+' \u00b7 played',was); return 'resumed';
  }catch(e){ tlogAmend(id,name+' \u00b7 wake threw',was); return 'resume-threw' }
}
/* Keeping the channel awake between sounds.

   While the page is on screen, a context that leaves 'running' is woken straight away
   -- three tries in ten seconds, then it waits for a tap -- so the next beep finds it
   ready rather than finding out at the end of a rest. And every tap anywhere wakes it,
   because a tap is the one moment iOS is sure to honour a wake: in a session, that is
   every Done. */
let ctxWakes=[];
function ctxWatch(ctx){
  ctx.onstatechange=()=>{
    tlog('audio',ctx.state);
    if(ctx.state==='running'||ctx.state==='closed'||quiet()) return;
    if(typeof document!=='undefined'&&document.visibilityState&&document.visibilityState!=='visible') return;
    const now=Date.now(); ctxWakes=ctxWakes.filter(t=>now-t<10000);
    if(ctxWakes.length>=3){ tlog('audio','waiting for a tap'); return }
    ctxWakes.push(now);
    try{ const p=ctx.resume(); if(p&&p.catch) p.catch(e=>tlog('audio','wake refused',(e&&e.name)||'')) }catch(e){}
  };
}
function gestureWake(){
  if(quiet()) return;
  if(audioCtx&&audioCtx.state==='running') return;
  unlockAudio(); tlog('audio','woken by a tap');
}
if(typeof document!=='undefined'&&document.addEventListener)
  ['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev,gestureWake,{capture:true,passive:true}));

/* ---------- the timer log ----------
The last eighty things the timers did, kept on the device: each sound and what the audio
channel was doing when it was asked for, how late each rest's end was noticed, the screen
lock, the page going to the background and back. "Inconsistent" has now been reported
five times and fixed four; the next report should come with what happened, not a
description of it. Copy it from Setup, Sound. */
/* The cap was 80, which one HIC session overruns before it is finished: every segment
   writes its 3-2-1 and its change cue, so a four-round MAP with a warm-up fills the log
   on its own and the earliest line still held is already past the warm-up. Beeps that
   stop in round two were being pushed out by the ticks of the rounds after them, and the
   log then read as working because the part where it broke had scrolled off. Hence both
   changes: a cap that holds a long session, and repeats folded into one line with a
   count, since three identical ticks a segment are what filled it. Folded, a ten-round
   session writes about 50 lines, so 200 holds a whole one with room for the audio and
   page events around it -- and the file is written on every line, so a bigger cap is
   paid for once a second in a session rather than saved up for later. */
const TLOG_MAX=200;
let tlogId=0;
function tlogSame(a,b){ return a&&a.ev===b.ev&&a.what===b.what&&a.d===b.d&&a.ctx===b.ctx&&a.vis===b.vis&&a.wl===b.wl }
/** Append a line. `pend` marks it as awaiting an outcome; returns an id for `tlogAmend`. */
function tlog(ev,what,detail,pend){
  try{
    const a=LS.get('ob.tlog')||[];
    const e={id:++tlogId,t:Date.now(),ev,what:String(what),d:detail==null?'':String(detail),ctx:audioCtx?audioCtx.state:'none',
      vis:typeof document!=='undefined'?(document.visibilityState||''):'',wl:wakeState};
    if(pend) e.p=1;
    const last=a[a.length-1];
    // Never fold into a line still waiting for its outcome: it has an id to amend.
    if(!pend&&last&&!last.p&&tlogSame(last,e)){ last.n=(last.n||1)+1; last.t=e.t }
    else a.push(e);
    while(a.length>TLOG_MAX) a.shift();
    // The log must never be the reason something else cannot be written. 3.37 took the
    // cap from 80 to 200, and localStorage fails by returning false rather than by
    // throwing, so a full store would have eaten the rest timer's own state in silence.
    if(!LS.set('ob.tlog',a)){
      try{ LS.set('ob.tlog',a.slice(-20)) }catch(e2){ try{ localStorage.removeItem('ob.tlog') }catch(e3){} }
    }
    return e.id;
  }catch(e){ return 0 }
}
/* Whether this phone can still write anything at all. A full store is invisible --
   `setItem` throws, `LS.set` turns that into `false`, and every caller ignores it --
   and it would stop alerts dead by losing the subscription. */
function storageNote(){
  try{
    let n=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); n+=(k||'').length+((localStorage.getItem(k)||'').length) }
    const probe='ob.probe', ok=LS.set(probe,'x'); try{ localStorage.removeItem(probe) }catch(e){}
    return Math.round(n/1024)+' KB stored, writes '+(ok?'working':'FAILING');
  }catch(e){ return 'unreadable ('+((e&&e.name)||'?')+')' }
}
/** Replace a pending line's outcome, leaving it where it happened in the sequence. */
function tlogAmend(id,what,detail){
  if(!id) return;
  try{
    const a=LS.get('ob.tlog')||[];
    for(let i=a.length-1;i>=0;i--) if(a[i].id===id){
      a[i].what=String(what); if(detail!=null) a[i].d=String(detail);
      a[i].ctx=audioCtx?audioCtx.state:'none'; delete a[i].p;
      LS.set('ob.tlog',a); return;
    }
  }catch(e){}
}
function tlogText(){
  const a=LS.get('ob.tlog')||[];
  if(!a.length) return 'Nothing logged yet. Run a rest or an interval session and this fills in.';
  const hh=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())};
  return a.map(e=>`${hh(e.t)}  ${e.ev} · ${e.what}${e.n>1?' ×'+e.n:''}${e.d?' ('+e.d+')':''}  [audio ${e.ctx}, page ${e.vis||'?'}, screen ${e.wl}]`).join('\n');
}
function tlogReport(){
  return 'Operator + Black '+(typeof APP_VERSION==='string'?APP_VERSION:'')+' · timer log\n'+
    (typeof navigator!=='undefined'?String(navigator.userAgent).slice(0,160):'')+'\n\n'+tlogText();
}

function beepTones(){ return sfx('done') }
// How long before the end to give a warning, in seconds. 0 is off.
const REST_WARNS=[0,5,10,15,30];
function restWarnSecs(){ const v=+plan.restWarn; return REST_WARNS.includes(v)?v:10 }
/* Is this the tick that warns? Its own function because the tick runs four times a
   second and the two guards are the whole behaviour: once only, and never on a rest
   so short the warning would land on top of its own start. */
function restWarnDue(r,left){
  const warn=restWarnSecs();
  return !!(warn&&r&&left===warn&&r.dur>=warn*2&&!r.warned);
}
/* The heads-up, deliberately not the same sound as the end of the rest.

   One short low tone against the finish's three rising ones, and a single short buzz
   against its long-short-long. If the warning and the finish sounded alike you would
   have to look at the phone to tell which had happened, which is the thing a beep is
   there to save you. No media clip either: that exists to beat the ring switch at the
   cost of pausing music, and paying that twice per rest is not worth a warning. */
function beepWarn(){
  let vib=false;
  try{ vib=!!(navigator.vibrate&&navigator.vibrate(120)) }catch(e){}
  if(quiet()) return {vib,tones:'silent'};
  return {vib,tones:warnTone()};
}
function warnTone(){ return sfx('warn') }
function beep(){
  // Buzz first and unconditionally. Silent mode exists so iOS does not take the audio
  // session off your music; vibration never touches audio, so suppressing it as well
  // left Silent with no way at all to tell you a rest had ended. (Moot on iPhone, which
  // has no Vibration API, but right on Android and right in principle.)
  let vib=false;
  try{ vib=!!(navigator.vibrate&&navigator.vibrate([200,100,200])) }catch(e){}
  if(quiet()){ lastBeep='silent'; return {vib,media:'silent',tones:'silent'} }
  // The clip exists to beat the ring switch, and beating it means taking the speaker.
  // In duck mode that would stop the music, which is the thing duck mode is for.
  const media=soundMode()==='takeover'?beepMedia():'skipped-duck', tones=beepTones();
  lastBeep=lastBeep==='media'?lastBeep:(media+'/'+tones);
  return {vib,media,tones};
}
// What the Sound card shows after a test, so a report comes with facts attached.
let beepSeen=null;
// What the device can do, read without touching anything. Separate from beepDiag
// because that one makes a noise, and an inspector with a side effect is a trap.
function audioState(){
  return {
    mode:soundMode(),
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
  if(d.silent) out.push('Sound is set to off below, on purpose. The buzz and the notification still fire.');
  if(d.mode==='duck'&&/iPhone|iPad/i.test(d.ua)) out.push('Sound is set to share the speaker with your music, which is what you want \u2014 but iOS silences shared audio when the ring switch on the side of the phone is off. Check that switch first. If you need to be heard with it off, the price is your music pausing: choose \u201calways be audible\u201d below.');
  if(/iPhone|iPad/i.test(d.ua)){
    if(!d.canVibrate) out.push('This is an iPhone or iPad, and Safari gives a web app no way to vibrate at all. There will never be a buzz here \u2014 sound, screen and notifications are what you get.');
    out.push('If you heard nothing: check the ring switch on the side of the phone, and that the volume is up.');
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
  const rows=[['mode',d.mode],['silent',d.silent],['can vibrate',d.canVibrate],['vibrated',d.vibrated],
    ['media clip',d.media],['web audio',d.tones],['audio channel',d.ctx],['audio session',d.session]];
  return head+'\n'+rows.map(r=>r[0]+': '+r[1]).join('\n')+'\n'+d.ua+'\n\n'+beepAdvice(d).join('\n');
}
/* iOS drops the lock whenever the page is hidden, and a dropped lock still reads as an
   object, so re-check `released` rather than trusting we still hold it.

   It also lets go mid-session for reasons of its own, and until 3.38 nothing took it
   back: the request happened when a session started, the release handler only wrote the
   state down, and the next attempt was whenever the page was next hidden and shown. One
   release and the screen slept for the rest of the session -- which freezes the page, so
   every beep due while it slept never happened, and the one you hear on unlocking is the
   timer catching up. That is the reported "first couple of rounds beep and then it
   stops", from the other end.

   So: take it back when it goes, and let the running timers ask on every tick. Asking is
   free while it is held (the `released` check returns), and `SCREEN_RETRY` keeps a
   refusal -- Low Power Mode refuses -- from turning a 5 Hz tick into 5 requests a
   second. */
const SCREEN_RETRY=4000;
let screenAsked=0, screenBusy=false;
async function holdScreen(on){
  if(on){
    if(wakeLock&&!wakeLock.released) return;
    const now=Date.now();
    if(screenBusy||now-screenAsked<SCREEN_RETRY) return;
    screenAsked=now; screenBusy=true;
  }
  try{
    if(on){
      if(!navigator.wakeLock){ if(wakeState!=='unsupported'){ wakeState='unsupported'; tlog('screen','no screen lock on this device') } return }
      wakeLock=await navigator.wakeLock.request('screen');
      wakeState='held'; tlog('screen','held');
      wakeLock.addEventListener('release',()=>{
        wakeLock=null;
        if(wakeState==='held'){ wakeState='off'; tlog('screen','released') }
        showWake();
        // Hidden means the phone is already locked or the app is away, and iOS refuses a
        // request from a hidden page anyway. The visibilitychange handler does that one.
        if(wantScreen()&&typeof document!=='undefined'&&document.visibilityState==='visible'){
          screenAsked=0; tlog('screen','taking it back'); syncScreen();
        }
      });
    } else if(wakeLock){ const w=wakeLock; wakeLock=null; wakeState='off'; await w.release() }
  }catch(e){ wakeLock=null; wakeState='refused'; tlog('screen','refused',(e&&e.name)||'') }
  finally{ screenBusy=false }
  showWake();
}
/* Said where you are looking, rather than discovered at the end of a rest. This only
   went on the rest bar, so an interval session -- the one you set down and walk away
   from, and the one Low Power Mode is most likely to be on for -- said nothing at all
   while the screen was about to sleep under it. */
function showWake(){
  if(typeof document==='undefined') return;
  const warn=wakeState==='refused'&&wantScreen();
  const set=(id,on)=>{ const el=document.getElementById(id); if(el) el.hidden=!on };
  set('rest-wake',warn&&!!rest);
  set('iv-wake',warn&&!!iv&&!iv.done);
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
  tlog('page',document.visibilityState);
  if(document.visibilityState!=='visible') return;
  syncScreen();
  try{ audioAwake() }catch(e){}
});
