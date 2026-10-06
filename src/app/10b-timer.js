/* ---------- a timer for anything ---------- */
// Deliberately not tied to a session: open it from the header on any tab, any day, with
// nothing started. Countdown or stopwatch. Like the other timers it runs off absolute
// times, so locking the phone or reloading the app doesn't make it drift, and it sits
// above the rest bar rather than replacing it, so a rest keeps counting underneath.
const GT_PRESETS = [30, 60, 120, 180, 300, 600];
const GT_STALE_MS = 12 * 3600 * 1000;
let gt = LS.get('ob.gt'), gtTick = null, gtPushT = null;

function gtSave(){ LS.set('ob.gt', gt) }
function gtFmt(s){
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s % 60);
}
/** Seconds left on a countdown, or elapsed on a stopwatch. */
function gtSecs(){
  if(!gt) return 0;
  const now = gt.paused || Date.now();
  return gt.mode === 'up' ? Math.max(0, Math.floor((now - gt.start - gt.pausedMs) / 1000))
                          : Math.max(0, Math.ceil((gt.end - now) / 1000));
}
function gtStart(mode, secs){
  unlockAudio();
  const now = Date.now();
  gt = mode === 'up' ? { mode:'up', start:now, pausedMs:0, paused:null }
                     : { mode:'down', dur:secs, end:now + secs * 1000, pausedMs:0, paused:null, done:false };
  gtSave(); syncScreen(); gtShow(); gtPush();
}
function gtPause(){
  if(!gt) return;
  if(gt.paused){ const d = Date.now() - gt.paused; gt.pausedMs += d; if(gt.mode === 'down') gt.end += d; gt.paused = null }
  else gt.paused = Date.now();
  gtSave(); syncScreen(); gtRender(); gtPanelDraw(); gtPush();
}
function gtAdd(s){
  if(!gt || gt.mode !== 'down') return;
  const base = gt.paused || Date.now();
  gt.end = Math.max(base + 1000, gt.end + s * 1000);
  gt.dur = Math.max(gt.dur, Math.round((gt.end - base) / 1000));
  if(gt.end > base) gt.done = false;
  gtSave(); gtRender(); gtPanelDraw(); gtPush();
}
function gtStop(){
  gt = null; gtSave();
  clearInterval(gtTick); gtTick = null;
  syncScreen();
  gtShow(); gtPanelDraw(); gtPush();
}
function gtShow(){
  const el = document.getElementById('gt'); if(!el) return;
  const btn = document.getElementById('tmr-b');
  if(!gt){ el.hidden = true; document.body.classList.remove('gt-on'); if(btn) btn.classList.remove('on'); clearInterval(gtTick); gtTick = null; return }
  el.hidden = false; document.body.classList.add('gt-on');
  const b = document.getElementById('tmr-b'); if(b) b.classList.add('on');
  if(!gtTick) gtTick = setInterval(gtRender, 250);
  gtRender();
}
function gtRender(){
  if(!gt) return;
  const el = document.getElementById('gt'); if(!el) return;
  const s = gtSecs(), down = gt.mode === 'down', over = down && s === 0;
  document.getElementById('gt-t').textContent = gtFmt(s);
  document.getElementById('gt-l').textContent = gt.paused ? 'Paused' : over ? 'Time’s up' : down ? 'Timer' : 'Stopwatch';
  document.getElementById('gt-p').textContent = gt.paused ? 'Resume' : 'Pause';
  el.classList.toggle('done', over);
  if(over && !gt.done){
    gt.done = true; gtSave(); beep(); syncScreen();
    setTimeout(() => say('Timer done'), 700);
  }
  if(over && Date.now() - gt.end > 5 * 60000) gtStop();   // nobody dismissed it
}
// Only touch the alert queue when nothing in a session owns it.
function gtPush(){
  if(!alertsOn()) return;
  if((rest && !rest.done) || (iv && !iv.done)) return;
  clearTimeout(gtPushT);
  gtPushT = setTimeout(() => {
    if(gt && gt.mode === 'down' && !gt.paused && !gt.done) api('POST', '/push/schedule', { at: gt.end, title: 'Timer done', body: 'The timer you set has finished.' }).catch(() => {});
    else api('POST', '/push/cancel').catch(() => {});
  }, 300);
}

/* the header panel */
function gtPanel(){
  if(gt){
    const down = gt.mode === 'down';
    return `<div class="gt-m-h">${down ? 'Countdown' : 'Stopwatch'}${gt.paused ? ' · paused' : ''}</div>
    <div class="row"><button class="btn" data-act="gtpause">${gt.paused ? 'Resume' : 'Pause'}</button>${down ? `<button class="btn" data-act="gtadd" data-v="-30">−30s</button><button class="btn" data-act="gtadd" data-v="30">+30s</button>` : ''}</div>
    <div class="row"><button class="btn ghost" data-act="gtstop">Stop and clear</button></div>`;
  }
  return `<div class="gt-m-h">Time anything</div>
  <div class="seg">${GT_PRESETS.map(v => `<button class="segb" data-act="gtdown" data-v="${v}">${gtFmt(v)}</button>`).join('')}</div>
  <div class="row" style="align-items:flex-end"><label class="f" style="flex:1">Minutes<input type="number" inputmode="decimal" step="any" min="0" id="gt-c" placeholder="e.g. 4.5"></label><button class="btn" data-act="gtcustom">Start</button></div>
  <div class="row"><button class="btn" data-act="gtup">Start a stopwatch</button></div>
  <div class="small muted">Runs on its own, so a rest or an interval keeps counting underneath.</div>`;
}
function gtPanelDraw(){
  const m = document.getElementById('tmr-m');
  if(m && !m.hidden) m.innerHTML = gtPanel();
}

/* wiring: the header button, the panel, and the bar's own buttons */
function gtAct(a, b){
  if(a === 'gtdown'){ gtStart('down', +b.dataset.v); gtPanelDraw(); return true }
  if(a === 'gtup'){ gtStart('up'); gtPanelDraw(); return true }
  if(a === 'gtcustom'){
    const el = document.getElementById('gt-c'), m = parseFloat(el && el.value);
    if(!(m > 0)){ if(el) el.focus(); return true }
    gtStart('down', Math.max(1, Math.round(m * 60))); gtPanelDraw(); return true;
  }
  if(a === 'gtpause'){ gtPause(); return true }
  if(a === 'gtadd'){ gtAdd(+b.dataset.v); return true }
  if(a === 'gtstop'){ gtStop(); return true }
  return false;
}
(function(){
  const btn = document.getElementById('tmr-b'), menu = document.getElementById('tmr-m');
  if(!btn || !menu) return;
  const open = (on) => { menu.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false'); if(on) menu.innerHTML = gtPanel() };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(menu.hidden) });
  for(const el of [menu, document.getElementById('gt')]){
    if(el) el.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if(b) gtAct(b.dataset.act, b) });
  }
  document.addEventListener('click', (e) => { if(!menu.hidden && !e.target.closest('#tmr-m,#tmr-b')) open(false) });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && !menu.hidden){ open(false); btn.focus() } });
})();
