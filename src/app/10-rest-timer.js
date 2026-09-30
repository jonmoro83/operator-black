/* ---------- rest timer ---------- */
// State lives in localStorage with an absolute end time, so it survives the phone
// locking, the app being backgrounded, or a reload.
let rest=LS.get('ob.rest'), restTick=null, audioCtx=null, wakeLock=null;
function restMins(k){const m=+((plan.rest||{})[k]);return m>=2&&m<=5?m:3}
// Spoken cues (Setup / timer card). iOS only speaks after a first utterance inside a
// tap, so unlockAudio primes it with a silent one.
let voicePrimed=false;
function say(text){
  if(!plan.voice||!('speechSynthesis' in window)) return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=1.05; u.pitch=1; speechSynthesis.speak(u) }catch(e){}
}
function unlockAudio(){
  try{ if(plan.voice&&!voicePrimed&&'speechSynthesis' in window){ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); voicePrimed=true } }catch(e){}
  try{
    if(navigator.audioSession) navigator.audioSession.type='transient';
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const b=audioCtx.createBuffer(1,1,22050), s=audioCtx.createBufferSource(); s.buffer=b; s.connect(audioCtx.destination); s.start(0);
  }catch(e){}
}
function beep(){
  try{
    if(!audioCtx) return; if(audioCtx.state==='suspended') audioCtx.resume();
    const t0=audioCtx.currentTime;
    [0,.28,.56].forEach((dt,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=i===2?1320:880;g.gain.setValueAtTime(0.0001,t0+dt);g.gain.exponentialRampToValueAtTime(0.5,t0+dt+.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+dt+.22);o.connect(g);g.connect(audioCtx.destination);o.start(t0+dt);o.stop(t0+dt+.25)});
  }catch(e){}
  try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}
}
async function holdScreen(on){
  try{
    if(on&&!wakeLock&&navigator.wakeLock){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}
    else if(!on&&wakeLock){await wakeLock.release();wakeLock=null}
  }catch(e){wakeLock=null}
}
