/* ---------- lifting session mode ---------- */
// One set at a time on lifting days. Steps are rebuilt from the plan and the day's log
// on every render, so edits (working weight, warm-ups) flow straight through.
let ls=LS.get('ob.ls'), lsTick=null;
// Test-day target, same rules as the test card: typed target, else the result, else
// the current max (87% of it for a 5RM; last program's max during a bridge week).
function testTargetOn(date,k,isRm5){
  const T=((lg(date).test||{})[k])||{}, wk=weekOf(date);
  const c=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):1, m=maxFor(c)[k];
  const cur=m?m.v:((plan.prevMaxes||{})[k]??null), bw=bwFor(date);
  const est=cur==null?null:isBW(k)?(bw?floorTo((bw+cur)*(isRm5?.87:1)-bw,plan.round[k]):null):(isRm5?floorTo(cur*.87,plan.round[k]):cur);
  const tgt=T.target!=null&&T.target!==''?+T.target:(T.w!=null&&T.w!==''?+T.w:est);
  return {T,tgt,est};
}
function lsSteps(date){
  const wk=weekOf(date), dp=dayPlan(date); if(!wk) return [];
  if(dp.t==='rm5'||dp.t==='test'){
    const isRm5=dp.t==='rm5', steps=[];
    for(const k of dp.lifts){
      const {tgt}=testTargetOn(date,k,isRm5);
      if(ls&&ls.warm!==false&&tgt!=null) testRamp(k,tgt,isRm5).forEach((x,j,a)=>steps.push({k,type:'warm',j,n:a.length,w:x.w,r:x.r,lbl:x.lbl}));
      steps.push({k,type:'test',isRm5,w:tgt,r:isRm5?5:1});
    }
    if(dp.pullups) steps.push({type:'pullups'});
    steps.unshift({type:'gwarm'}); steps.push({type:'mob'});
    steps.push({type:'finish',test:true});
    return steps;
  }
  if(dp.t!=='lift') return [];
  const steps=[];
  for(const k of dp.lifts){
    const r=rx(wk,k), L=(lg(date).lifts||{})[k]||{}, T=L.used!=null&&L.used!==''?+L.used:r.w;
    if(T==null) continue;
    if(ls&&ls.warm!==false){ ramp(k,T,r.t,dp.deload).forEach((x,j,a)=>steps.push({k,type:'warm',j,n:a.length,w:x.w,r:x.r,lbl:x.lbl})) }
    const nS=r.sMax;
    for(let j=0;j<nS;j++) steps.push({k,type:'work',j,n:nS,w:T,r:r.r,opt:j>=r.s,pct:r.p});
  }
  const heavy=wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
  if(!dp.deload&&!heavy&&dp.acc) for(const sl of accSlots(dp.acc)) steps.push({type:'acc',slot:sl});
  steps.unshift({type:'gwarm'}); steps.push({type:'mob'});
  steps.push({type:'finish'});
  return steps;
}
function lsStepDone(st){
  const L=(lg(ls.date).lifts||{})[st.k]||{};
  if(st.type==='warm') return !!((wuListFor(ls.date,st.k)[st.j]||{}).done);
  if(st.type==='work') return !!((L.sets||[])[st.j]);
  if(st.type==='acc') return accDone(ls.date,st.slot);
  if(st.type==='test'){const t=((lg(ls.date).test||{})[st.k])||{};return t.w!=null&&t.w!==''}
  if(st.type==='pullups') return lg(ls.date).pullups!=null&&lg(ls.date).pullups!=='';
  return false;
}
function wuListFor(date,k){const W=((lg(date).lifts||{})[k]||{}).warmup;return Array.isArray(W)?W:W?Object.keys(W).reduce((a,i)=>(a[+i]=W[i],a),[]):[]}
function lsFirstOpen(){const st=lsSteps(ls.date);
  if(!st.some(x=>['warm','work','test','pullups','acc'].includes(x.type)&&lsStepDone(x))) return 0;
  const i=st.findIndex(x=>['warm','work','test','pullups','acc'].includes(x.type)&&!x.opt&&!lsStepDone(x));return i<0?st.length-1:i}
function lsStart(){ ls={date:sel,i:0,warm:true}; ls.i=lsFirstOpen(); LS.set('ob.ls',ls); unlockAudio(); syncScreen(); lsShow(); }
function lsClose(){ ls=null; LS.set('ob.ls',null); syncScreen(); lsShow(); render(); }
function lsShow(){
  const el=document.getElementById('ls');
  if(!ls||viewing){el.hidden=true;clearInterval(lsTick);lsTick=null;document.body.style.overflow='';return}
  el.hidden=false; document.body.style.overflow='hidden';
  if(!lsTick) lsTick=setInterval(lsRestTick,250);
  lsRender();
}
function lsRestHtml(){
  if(!rest) return '';
  const left=Math.max(0,Math.ceil((rest.end-Date.now())/1000));
  return `<div class="ls-rest${left===0?' done':''}" id="ls-rest"><div><div class="small" style="font-weight:700">${esc(rest.lbl)}</div><b id="ls-rest-t">${Math.floor(left/60)}:${pad(left%60)}</b></div><div class="ls-row" style="flex:0 0 auto"><button class="btn sm" data-ls="r-30">−30s</button><button class="btn sm" data-ls="r+30">+30s</button><button class="btn sm" data-ls="rskip">${left===0?'Clear':'Skip'}</button></div></div>`;
}
function lsRestTick(){
  if(!ls) return; const box=document.getElementById('ls-rest');
  if(!rest){ if(box) lsRender(); return } if(!box){ lsRender(); return }
  const left=Math.max(0,Math.ceil((rest.end-Date.now())/1000));
  document.getElementById('ls-rest-t').textContent=Math.floor(left/60)+':'+pad(left%60);
  box.classList.toggle('done',left===0);
}
// how it moved and whether anything hurt, asked on the finish screen too
function lsAfter(L){
  return `<label class="f">How did it move?<div class="seg">${FEELS.map(([v,l])=>`<button class="segb${L.feel===v?' on':''}" data-ls="sfeel" data-v="${v}">${l}</button>`).join('')}</div></label>
  <label class="f">Anything hurt?<div class="seg">${PAINS.map(([v,l])=>`<button class="segb${L.pain===v?' on':''}" data-ls="spain" data-v="${v}">${l}</button>`).join('')}</div></label>
  ${L.pain&&L.pain!=='none'?`<label class="f">Where<div class="seg">${Object.entries(PAIN_AT).map(([k,x])=>`<button class="segb${painAt(L).includes(k)?' on':''}" data-ls="spainat" data-v="${k}">${x.name}</button>`).join('')}</div></label>`:''}`;
}
function lsRender(){
  const box=document.getElementById('ls-in'); if(!ls||!box) return;
  const steps=lsSteps(ls.date); if(!steps.length){lsClose();return}
  ls.i=Math.min(Math.max(0,ls.i),steps.length-1);
  const st=steps[ls.i], wk=weekOf(ls.date), dp=dayPlan(ls.date), done=steps.filter(x=>['warm','work','test','pullups','acc'].includes(x.type)&&lsStepDone(x)).length, total=steps.filter(x=>['warm','work','test','pullups','acc'].includes(x.type)).length;
  let h=`<div class="ls-top"><span>${esc(dp.short||'')} · ${esc(weekTitle(wk).t)}</span><button class="btn sm ghost" data-ls="close">Close</button></div><div class="ls-prog"><i style="width:${total?100*done/total:0}%"></i></div>`;
  h+=lsRestHtml();
  if(st.type==='warm'||st.type==='work'){
    const k=st.k, L=(lg(ls.date).lifts||{})[k]||{}, isDone=lsStepDone(st), bar=isBarbell(k);
    const next=steps[ls.i+1];
    h+=`<div class="ls-card"><div class="ls-lift">${esc(liftName(k))}</div>
      <div class="ls-kind${st.type==='work'?' work':''}">${st.type==='warm'?`Warm-up ${st.j+1} of ${st.n} · ${esc(st.lbl)}`:`Working set ${st.j+1} of ${st.n}${st.opt?' · optional':''} · ${st.pct}%`}${isDone?' · ✓ done':''}</div>
      <div><span class="ls-w">${isBW(k)?fmtLoad(k,st.w):n(st.w)}<small>${isBW(k)?(st.w>0?u()+' added':'bodyweight'):u()}</small></span> <span class="ls-reps">× ${st.r}</span></div>
      ${bar?plateSvg(st.w,true)+`<div class="plates">${esc(plates(st.w))}</div>`:''}
      ${st.type==='work'?`<div class="ls-row"><button class="btn sm" data-ls="w-">−${n(plan.round[k]||5)}</button><button class="btn sm" data-ls="w+">+${n(plan.round[k]||5)}</button><button class="btn sm${L.grinder?' primary':''}" data-ls="grind">${L.grinder?'✓ Grinder':'Felt like a grinder'}</button></div>
      ${st.j===st.n-1&&st.n<SETCAP(rx(wk,k,ls.date))?`<div class="ls-row"><button class="btn sm ghost" data-ls="addset">+ One more set</button></div>`:''}`:''}
    </div>`;
    h+=`<button class="btn primary ls-done" data-ls="done">${isDone?'Done ✓ · next':'Done'}</button>`;
    if(next&&(next.type==='warm'||next.type==='work')) h+=`<div class="small muted" style="text-align:center">Next: ${esc(liftName(next.k))} · ${next.type==='warm'?'warm-up':'set '+(next.j+1)} · ${isBW(next.k)?fmtLoad(next.k,next.w):n(next.w)} × ${next.r}</div>`;
  } else if(st.type==='test'){
    const k=st.k, t=((lg(ls.date).test||{})[k])||{}, bar=isBarbell(k), reps=t.r||st.r, e=estMax(k,t.w,reps,ls.date), next=steps[ls.i+1];
    h+=`<div class="ls-card"><div class="ls-lift">${esc(liftName(k))}</div>
      <div class="ls-kind work">${st.isRm5?'5-rep max · leave 2 reps in reserve':'Heavy single · stop when the bar slows'}${lsStepDone(st)?' · ✓ saved':''}</div>
      ${st.w!=null?`<div><span class="ls-w">${isBW(k)?fmtLoad(k,st.w):n(st.w)}<small>${isBW(k)?(st.w>0?u()+' added':'bodyweight'):u()} target</small></span></div>
      ${bar?plateSvg(st.w,true)+`<div class="plates">${esc(plates(st.w))}</div>`:''}
      <div class="ls-row"><button class="btn sm" data-ls="t-">Target −${n(plan.round[k]||5)}</button><button class="btn sm" data-ls="t+">Target +${n(plan.round[k]||5)}</button></div>`:`<label class="f">Your target ${st.isRm5?'for 5 reps':'single'} (${u()})<input type="number" inputmode="decimal" step="any" id="ls-tt" data-lsin="target" data-k="${k}" placeholder="e.g. what you think you can do with 2 reps left"></label><div class="small muted">No max to aim from yet. Enter a target and the warm-up ramp is calculated from it, or just work up and log what you get.</div>`}
      <div class="grid3"><label class="f">Weight lifted<input type="number" inputmode="decimal" step="any" id="ls-tw" data-lsin="w" data-k="${k}" value="${t.w??''}" placeholder="${st.w!=null?n(st.w):''}"></label><label class="f">Reps<input type="number" inputmode="numeric" step="1" id="ls-tr" data-lsin="r" data-k="${k}" value="${t.r??''}" placeholder="${st.r}"></label><label class="f">Est. 1RM<div class="big" style="font-size:34px">${e!=null?(isBW(k)?'+':'')+n(floorTo(e,plan.round[k])):'—'}</div></label></div>
      ${isBW(k)?'<div class="small muted">Enter the weight you added (0 for bodyweight).</div>':''}
    </div><button class="btn primary ls-done" data-ls="tsave">${lsStepDone(st)?'Saved ✓ · next':'Save result'}</button>`;
    if(next&&next.type==='warm') h+=`<div class="small muted" style="text-align:center">Next: ${esc(liftName(next.k))} warm-ups</div>`;
  } else if(st.type==='pullups'){
    h+=`<div class="ls-card"><div class="ls-lift">Max pull-ups</div><div class="small muted">One all-out set, full hang to chin over bar.</div><label class="f">Reps<input type="number" inputmode="numeric" step="1" id="ls-pu" data-lsin="pullups" value="${lg(ls.date).pullups??''}"></label></div><button class="btn primary ls-done" data-ls="next">Next</button>`;
  } else if(st.type==='gwarm'||st.type==='mob'){
    const isW=st.type==='gwarm', short=!!lg(ls.date).warmShort;
    const items=isW?WARMUP.map((x,i)=>[i,x.n,x.d,x.g]).filter(([i])=>!short||WARMUP[i].s):mobList(mobKind(dp)).map(([n,d],i)=>[i,n,d,'']);
    const flags=(isW?lg(ls.date).warmup:lg(ls.date).mobility)||[], done=items.filter(([i])=>flags[i]).length;
    h+=`<div class="ls-card"><div class="ls-lift">${isW?'Warm-up':'Mobility'}</div>
      <div class="ls-kind">${done} of ${items.length} done · ${isW?(short?'7 min':'12–15 min'):esc(MOB[mobKind(dp)].name)}</div>
      ${isW?`<div class="seg"><button class="segb${short?'':' on'}" data-ls="wfull">Full</button><button class="segb${short?' on':''}" data-ls="wshort">Short</button></div>`:`<div class="small muted">${esc(MOB[mobKind(dp)].why)}</div>`}
      <div class="stack">${items.map(([i,n,d])=>{const hs=holdSecs(d);
        return `<div class="ls-wrow"><button class="btn${flags[i]?' primary':''}" style="justify-content:flex-start;text-align:left;flex:1" data-ls="${isW?'gw':'mb'}" data-i="${i}">${flags[i]?'✓ ':''}${esc(n)}${d?` <span class="small">· ${esc(d)}</span>`:''}</button>${hs?`<button class="btn sm hold" data-ls="hold" data-i="${i}" aria-label="Time ${esc(n)}">⏱</button>`:''}</div>`}).join('')}</div></div>
      <div class="ls-row"><button class="btn" data-ls="guide">Guide me ›</button><button class="btn primary" style="flex:2" data-ls="next">${done>=items.length?'Done ✓ · next':isW?'Skip to lifting ›':'Next'}</button></div>`;
  } else if(st.type==='acc'){
    const sl=st.slot, id=accOn(ls.date,sl), e=accEx(id), sets=accSets(ls.date,sl);
    const list=accFor(sl,id), all=accAll(), rest=+plan.accRest||90;
    h+=`<div class="ls-card"><div class="ls-lift">${esc((ASLOT[sl]||{}).name||sl)}</div>
      <div class="ls-kind">Accessory${accSwapped(ls.date,sl)?' \u00b7 swapped for today':''}${accDone(ls.date,sl)?' \u00b7 \u2713 done':''}</div>
      <select id="ls-accex-${esc(sl)}" data-lsaccex="${esc(sl)}" aria-label="What is doing ${esc((ASLOT[sl]||{}).name||sl)} today">${list.map(k=>`<option value="${esc(k)}"${k===id?' selected':''}>${esc(all[k].name)}${all[k].gear?' \u00b7 '+esc(all[k].gear):''}</option>`).join('')}</select>
      ${sl==='pullup'?`<div class="small muted">${esc(pullupState(ls.date).st.work)}</div>`:''}
      <div class="stack" style="gap:6px">${sets.map((x,i2)=>`<div class="wu-row"><span class="wu-lbl">${i2+1}</span>
        <input type="number" inputmode="decimal" step="any" id="ls-accw-${esc(sl)}-${i2}" data-lsacc="${esc(sl)}|${i2}|w" value="${x&&x.w!=null?esc(String(x.w)):''}" placeholder="${isBWAcc(id)?'bw':esc(u())}" aria-label="Set ${i2+1} weight">
        <span class="wu-x">\u00d7</span>
        <input type="number" inputmode="numeric" step="1" id="ls-accr-${esc(sl)}-${i2}" data-lsacc="${esc(sl)}|${i2}|r" value="${x&&x.r!=null?esc(String(x.r)):''}" placeholder="reps" aria-label="Set ${i2+1} reps">
        <span></span><button class="wu-rm" data-ls="accrm" data-slot="${esc(sl)}" data-i="${i2}" aria-label="Remove set ${i2+1}">\u00d7</button></div>`).join('')}</div>
      <div class="ls-row"><button class="btn sm" data-ls="accadd" data-slot="${esc(sl)}">+ Add set</button>
      <button class="btn sm" data-ls="accrest" data-slot="${esc(sl)}">Rest ${rest}s</button></div>
    </div>
    <button class="btn primary ls-done" data-ls="done">${accDone(ls.date,sl)?'Done \u2713 \u00b7 next':'Done'}</button>`;
  } else if(st.test){
    const L=lg(ls.date), isRm5=dp.t==='rm5';
    const rows=dp.lifts.map(k=>{const t=((L.test||{})[k])||{},e=estMax(k,t.w,t.r||(isRm5?5:1),ls.date);return `<tr><td>${esc(liftName(k))}</td><td class="n">${t.w!=null&&t.w!==''?(isBW(k)?fmtLoad(k,+t.w):n(t.w))+' × '+(t.r||(isRm5?5:1)):'—'}</td><td class="n">${e!=null?'≈ '+(isBW(k)?'+':'')+n(floorTo(e,plan.round[k])):''}</td></tr>`}).join('')+(dp.pullups?`<tr><td>Pull-ups</td><td class="n">${L.pullups??'—'}</td><td></td></tr>`:'');
    h+=`<div class="ls-card"><div class="ls-lift">Test results</div><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Result</th><th class="n">Est. 1RM</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="small muted">${isRm5?'Sunday turns these into your maxes (Today → Sunday → Save as my maxes).':'Use “Feed results forward” on Saturday’s card to set next cycle’s maxes.'}</div>
      <label class="f">Session RPE<div class="seg">${[6,7,8,9,10].map(v=>`<button class="segb${+L.rpe===v?' on':''}" data-ls="rpe" data-v="${v}">${v}</button>`).join('')}</div></label>${lsAfter(L)}</div>
      <button class="btn primary ls-done" data-ls="finish">${L.done?'Finished ✓ · close':'Finish session'}</button>`;
  } else {
    const L=lg(ls.date);
    const rows=dp.lifts.map(k=>{const x=(L.lifts||{})[k]||{},r=rx(wk,k),nS=r.s,dn=(x.sets||[]).filter(Boolean).length;return `<tr><td>${esc(liftName(k))}</td><td class="n">${dn}/${nS}${r.sMax>nS?'+':''}</td><td>${x.grinder?'<span class="chip mid">grinder</span>':''}</td></tr>`}).join('');
    h+=`<div class="ls-card"><div class="ls-lift">Session summary</div><div class="tbl-wrap"><table><tbody>${rows}</tbody></table></div>
      <label class="f">Session RPE<div class="seg">${[6,7,8,9,10].map(v=>`<button class="segb${+L.rpe===v?' on':''}" data-ls="rpe" data-v="${v}">${v}</button>`).join('')}</div></label>${lsAfter(L)}</div>
      <button class="btn primary ls-done" data-ls="finish">${L.done?'Finished ✓ · close':'Finish session'}</button>`;
  }
  h+=`<div class="ls-row"><button class="btn" data-ls="back" ${ls.i===0?'disabled':''}>‹ Back</button><button class="btn" data-ls="skip" ${ls.i>=steps.length-1?'disabled':''}>Skip ›</button></div>`;
  if(ls.i===0) h+=`<label class="check small" style="justify-content:center"><input type="checkbox" id="ls-warm" ${ls.warm!==false?'checked':''}> Include warm-up sets</label>`;
  box.innerHTML=h;
}
// The dose on a warm-up or mobility item is the timer. Resolving it from the item's
// index keeps one source of truth, so the clock on the checklist and the guided run
// cannot drift apart.
function lsHold(kind,i){
  const it=gdItems(kind,ls.date).find(x=>x.i===i); if(!it) return false;
  const h=holdSecs(it.dose); if(!h) return false;
  startHold(it.name,h.s,h.sides,1);
  return true;
}
function lsMarkWarm(st){
  const W=wuListFor(ls.date,st.k).map(x=>x?Object.assign({},x):{});
  const x=W[st.j]||(W[st.j]={}); x.done=true; if(x.w==null||x.w==='')x.w=st.w; if(x.r==null||x.r==='')x.r=st.r;
  for(let j=0;j<W.length;j++) if(!W[j]) W[j]={};
  setLog(ls.date,'lifts.'+st.k+'.warmup',W);
}
document.getElementById('ls').addEventListener('click',e=>{
  const b=e.target.closest('[data-ls]'); if(!b||!ls) return; const a=b.dataset.ls;
  const steps=lsSteps(ls.date), st=steps[ls.i]; unlockAudio();
  const go=i=>{ls.i=i;LS.set('ob.ls',ls);lsRender();document.getElementById('ls').scrollTo(0,0)};
  if(a==='close') return lsClose();
  if(a==='back') return go(ls.i-1);
  if(a==='skip'||a==='next') return go(ls.i+1);
  if(a==='r-30'||a==='r+30'){ if(rest){rest.end=Math.max(Date.now()+1000,rest.end+(a==='r+30'?30000:-30000));rest.done=false;rest.dur=Math.max(rest.dur,Math.round((rest.end-Date.now())/1000));LS.set('ob.rest',rest);syncPush()} return lsRender() }
  if(a==='rskip'){ stopRest(); return lsRender() }
  if(a==='addset'){ addSet(st.k,1,ls.date); return lsRender() }
  if(a==='grind'){ const L=(lg(ls.date).lifts||{})[st.k]||{}; setLog(ls.date,'lifts.'+st.k+'.grinder',!L.grinder); return lsRender() }
  if(a==='w-'||a==='w+'){ const inc=+plan.round[st.k]||5; setLog(ls.date,'lifts.'+st.k+'.used',Math.max(isBW(st.k)?-500:+plan.bar||0,st.w+(a==='w+'?inc:-inc))); return lsRender() }
  if(a==='acc'){ const sl=b.dataset.slot; setLog(ls.date,'acc.done.'+sl,accDone(ls.date,sl)?null:true); return lsRender() }
  if(a==='accadd'||a==='accrm'){
    const sl=b.dataset.slot, cur=accSets(ls.date,sl).slice();
    if(a==='accadd') cur.push({}); else cur.splice(+b.dataset.i,1);
    setLog(ls.date,'acc.sets.'+sl,cur);
    if(cur.length) setLog(ls.date,'acc.done.'+sl,null);
    return lsRender();
  }
  if(a==='accrest'){
    const sl=b.dataset.slot, next=lsSteps(ls.date)[ls.i+1];
    startRest(null,next&&next.type==='acc'?(ASLOT[next.slot]||{}).name:accName(accOn(ls.date,sl)),+plan.accRest||90,'Rest \u00b7 '+((ASLOT[sl]||{}).name||sl));
    return lsRender();
  }
  if(a==='guide'){gdStart(st.type==='gwarm'?'warmup':'mobility');return}
  if(a==='hold'){lsHold(st.type==='gwarm'?'warmup':'mobility',+b.dataset.i);return lsRender()}
  if(a==='gw'||a==='mb'){ const f=a==='gw'?'warmup':'mobility', A=[...(lg(ls.date)[f]||[])], i=+b.dataset.i; A[i]=!A[i]; for(let j=0;j<A.length;j++) if(A[j]==null) A[j]=false; setLog(ls.date,f,A); return lsRender() }
  if(a==='wfull'||a==='wshort'){ setLog(ls.date,'warmShort',a==='wshort'); return lsRender() }
  if(a==='rpe'){ setLog(ls.date,'rpe',+b.dataset.v); return lsRender() }
  if(a==='sfeel'){ const v=b.dataset.v; setLog(ls.date,'feel',lg(ls.date).feel===v?null:v); return lsRender() }
  if(a==='spain'){ const v=b.dataset.v, same=lg(ls.date).pain===v; setLog(ls.date,'pain',same?null:v); if(!same&&v==='none') setLog(ls.date,'painAt',[]); return lsRender() }
  if(a==='spainat'){ const k=b.dataset.v, cur=painAt(lg(ls.date)); setLog(ls.date,'painAt',cur.includes(k)?cur.filter(y=>y!==k):[...cur,k]); return lsRender() }
  if(a==='finish'){ if(!lg(ls.date).done) setLog(ls.date,'done',true); stopRest(); say('Session done. Nice work.'); return lsClose() }
  if(a==='t-'||a==='t+'){ const inc=+plan.round[st.k]||5, base=st.w!=null?st.w:0; setLog(ls.date,'test.'+st.k+'.target',Math.max(isBW(st.k)?-500:+plan.bar||0,base+(a==='t+'?inc:-inc))); return lsRender() }
  if(a==='tsave'){
    if(lsStepDone(st)) return go(ls.i+1);
    const t=((lg(ls.date).test||{})[st.k])||{};
    if((t.w==null||t.w==='')&&st.w!=null) setLog(ls.date,'test.'+st.k+'.w',st.w);
    if(t.r==null||t.r==='') setLog(ls.date,'test.'+st.k+'.r',st.r);
    if(!lsStepDone(st)){ const inp=document.getElementById('ls-tw'); if(inp) inp.focus(); return }
    const next=lsSteps(ls.date)[ls.i+1];
    if(next&&(next.type==='warm'||next.type==='test')) startRest(st.k,liftName(next.k)+' · '+(next.type==='warm'?'warm-up 1':'test'),Math.max(restMins(st.k),3)*60,'Rest · after '+liftName(st.k)+' test');
    return go(ls.i+1);
  }
  if(a==='done'){
    if(lsStepDone(st)) return go(ls.i+1);
    if(st.type==='warm'){ lsMarkWarm(st); }
    else { const L=(lg(ls.date).lifts||{})[st.k]||{}, arr=[...(L.sets||[])]; arr[st.j]=true; for(let j=0;j<arr.length;j++) if(arr[j]==null) arr[j]=false; setLog(ls.date,'lifts.'+st.k+'.sets',arr); }
    const next=lsSteps(ls.date)[ls.i+1];
    if(next&&(next.type==='warm'||next.type==='work'||next.type==='test')){
      const label=liftName(next.k)+' · '+(next.type==='warm'?'warm-up '+(next.j+1):next.type==='test'?(next.isRm5?'5-rep max':'heavy single'):'set '+(next.j+1));
      // the lift's warm-up rest between ramp sets, its full rest before the first working set
      const intoWork=st.type==='warm'&&next.type!=='warm';
      if(st.type==='warm'){
        startRest(st.k,label,intoWork?restMins(st.k)*60:warmRestSecs(st.k),(intoWork?'Rest before working sets · ':'Warm-up rest · ')+liftName(st.k));
        if(!intoWork&&rest){rest.ramp=1;LS.set('ob.rest',rest)}
      }
      else startRest(st.k,label);
    } else if(st.type==='work') stopRest();
    return go(ls.i+1);
  }
});
document.getElementById('ls').addEventListener('input',e=>{
  const t=e.target; if(!ls||!t.dataset||!t.dataset.lsacc) return;
  const [sl,i,f]=t.dataset.lsacc.split('|'), cur=accSets(ls.date,sl).slice();
  while(cur.length<=+i) cur.push({});
  cur[+i]=Object.assign({},cur[+i],{[f]:t.value===''?null:+t.value});
  setLog(ls.date,'acc.sets.'+sl,cur);
});
document.getElementById('ls').addEventListener('change',e=>{
  const t=e.target; if(!ls||!t.dataset) return;
  if(t.dataset.lsaccex){ const sl=t.dataset.lsaccex;
    setLog(ls.date,'acc.ex.'+sl, t.value===accPickFor(accDayOf(ls.date),sl,accCycleOf(ls.date))?null:t.value);
    return lsRender();
  }
  if(t.dataset.lsacc) return lsRender();   // on blur only: the caret survives
});
document.getElementById('ls').addEventListener('change',e=>{ const t=e.target; if(t.dataset.lsin&&ls){ const v=t.value===''?null:+t.value; if(t.dataset.lsin==='pullups') setLog(ls.date,'pullups',v); else setLog(ls.date,'test.'+t.dataset.k+'.'+t.dataset.lsin,v); lsRender(); return }
  if(e.target.id==='ls-warm'&&ls){ ls.warm=e.target.checked; ls.i=0; LS.set('ob.ls',ls); lsRender(); } });
