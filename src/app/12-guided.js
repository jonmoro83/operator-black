/* ---------- guided warm-up / mobility ---------- */
// A hands-free run through a checklist: timed items count down and advance themselves,
// per-side items run both sides, rep items wait for a tap. Timed from absolute end times
// so locking the phone or reloading doesn't lose the place.
let guide=LS.get('ob.guide'), gdTick=null;
function gdItems(kind,date){
  if(kind==='warmup'){
    const short=!!lg(date).warmShort;
    return WARMUP.map((x,i)=>({i,name:x.n,dose:x.d,grp:x.g})).filter(x=>!short||WARMUP[x.i].s);
  }
  return mobList(mobKind(dayPlan(date))).map(([nm,d],i)=>({i,name:nm,dose:d,grp:MOB[mobKind(dayPlan(date))].name}));
}
function gdField(){return guide.kind==='warmup'?'warmup':'mobility'}
function gdTickOff(idx){
  const f=gdField(), A=[...(lg(guide.date)[f]||[])];
  A[idx]=true; for(let j=0;j<A.length;j++) if(A[j]==null) A[j]=false;
  setLog(guide.date,f,A);
}
function gdBegin(){
  const items=gdItems(guide.kind,guide.date), it=items[guide.pos];
  if(!it){gdFinish();return}
  const h=holdSecs(it.dose);
  guide.sides=h?h.sides:0; guide.dur=h?h.s:0; guide.side=1;
  guide.end=h?Date.now()+h.s*1000:null; guide.paused=null; guide.wait=null;
  LS.set('ob.guide',guide);
  say(it.name+(h?'. '+durText(h.s)+(h.sides>1?' each side':''):(it.dose?'. '+it.dose:'')));
}
function gdStart(kind){
  if(!gdItems(kind,sel).length) return;
  unlockAudio(); stopRest();
  guide={kind,date:sel,pos:0};
  gdBegin(); syncScreen(); gdShow();
}
function gdGo(pos){
  const items=gdItems(guide.kind,guide.date);
  if(pos<0) return;
  if(pos>=items.length){gdFinish();return}
  guide.pos=pos; gdBegin(); gdRender();
}
function gdFinish(){
  say(guide.kind==='warmup'?'Warm-up done.':'Mobility done.');
  tone(880,.18); tone(1320,.35,.22); vib([160,90,220]);
  gdClose();
}
function gdClose(){ guide=null; LS.set('ob.guide',null); syncScreen(); gdShow(); render(); }
function gdShow(){
  const el=document.getElementById('gd');
  if(!guide||viewing){el.hidden=true;clearInterval(gdTick);gdTick=null;document.body.style.overflow='';return}
  el.hidden=false; document.body.style.overflow='hidden';
  if(!gdTick) gdTick=setInterval(gdRender,200);
  gdRender();
}
function gdRender(){
  const box=document.getElementById('gd-in'); if(!guide||!box) return;
  const items=gdItems(guide.kind,guide.date), it=items[guide.pos];
  if(!it){gdFinish();return}
  const timed=guide.dur>0, paused=!!guide.paused, auto=plan.guideAuto!==false;
  let left=0;
  if(timed){
    left=Math.max(0,Math.ceil((guide.end-(paused?guide.paused:Date.now()))/1000));
    if(!paused&&!guide.wait&&Date.now()>=guide.end){
      const more=guide.sides>guide.side;
      if(more){ tone(660,.3); vib([140,70,140]); say('Switch sides') }
      else { tone(1320,.3); vib([200]); gdTickOff(it.i) }
      if(auto){
        if(more){ guide.side++; guide.end=Date.now()+guide.dur*1000; left=guide.dur; }
        else { LS.set('ob.guide',guide); return gdGo(guide.pos+1) }
      } else { guide.wait=more?'side':'next'; if(!more) say('Done'); }
      LS.set('ob.guide',guide);
    }
    if(guide.wait) left=0;
  }
  const el=document.getElementById('gd');
  el.className=guide.wait?'rest':timed?(paused?'':'hold'):'';
  const next=items[guide.pos+1];
  box.innerHTML=`<div class="gd-top"><span>${guide.kind==='warmup'?'Warm-up':'Mobility'} · ${guide.pos+1} of ${items.length}</span><button class="btn sm ghost" data-gd="close">Close</button></div>
  <div class="gd-bar"><i style="width:${Math.round(100*guide.pos/items.length)}%"></i></div>
  ${it.grp?`<div class="gd-grp">${esc(it.grp)}</div>`:''}
  <div class="gd-name">${esc(it.name)}</div>
  ${timed?`<div class="gd-time">${Math.floor(left/60)}:${pad(left%60)}</div>${guide.sides>1?`<div class="gd-side">Side ${guide.side} of ${guide.sides}</div>`:''}`:`<div class="gd-dose">${esc(it.dose||'')}</div>`}
  ${guide.wait?`<button class="btn primary" style="padding:16px;font-size:18px;width:min(100%,460px);margin:0 auto" data-gd="go">${guide.wait==='side'?'Start side '+(guide.side+1)+' ›':(next?'Next: '+esc(next.name)+' ›':'Finish ›')}</button>`:timed?'':`<button class="btn primary" style="padding:16px;font-size:18px;width:min(100%,460px);margin:0 auto" data-gd="done">Done</button>`}
  ${guide.wait?'':`<div class="gd-next">${next?'Next: '+esc(next.name):'Last one'}</div>`}
  <div class="gd-btns"><button class="btn" data-gd="back" ${guide.pos===0?'disabled':''}>‹ Back</button>${timed&&!guide.wait?`<button class="btn" data-gd="pause">${paused?'Resume':'Pause'}</button>`:''}<button class="btn" data-gd="skip">Skip ›</button></div>
  <button class="btn sm ghost" style="margin:0 auto" data-gd="auto">Auto-advance: ${auto?'on':'off'}</button>`;
}
document.getElementById('gd').addEventListener('click',e=>{
  const b=e.target.closest('[data-gd]'); if(!b||!guide) return; const a=b.dataset.gd; unlockAudio();
  if(a==='close') return gdClose();
  if(a==='back') return gdGo(guide.pos-1);
  if(a==='skip') return gdGo(guide.pos+1);
  if(a==='done'){ gdTickOff(gdItems(guide.kind,guide.date)[guide.pos].i); return gdGo(guide.pos+1) }
  if(a==='go'){
    if(guide.wait==='side'){ guide.side++; guide.end=Date.now()+guide.dur*1000; guide.wait=null; LS.set('ob.guide',guide); return gdRender() }
    guide.wait=null; return gdGo(guide.pos+1);
  }
  if(a==='auto'){ mutatePlan(p=>{p.guideAuto=p.guideAuto===false}); return gdRender() }
  if(a==='pause'){
    if(guide.paused){ guide.end+=Date.now()-guide.paused; guide.paused=null }
    else guide.paused=Date.now();
    LS.set('ob.guide',guide); gdRender();
  }
});
