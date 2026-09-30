/* ---------------- events ---------------- */
function val(t){ if(t.type==='checkbox') return t.checked; if(t.dataset.type==='num'||t.type==='number') return t.value===''?null:+t.value; return t.value; }
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.wz&&wz){ const k=t.dataset.wz; if(k.startsWith('maxes.')) wz.maxes[k.slice(6)]=t.value; else wz[k]=k==='start'?(t.value||wz.start):t.value; return; }
  if(t.dataset.np&&newProg){ const k=t.dataset.np; newProg[k]=k==='start'?(t.value?mondayOf(t.value):newProg.start):t.value; newProg.arm=false; newProg.err=null; if(k==='mode') render(); return; }
  if(viewing&&(t.dataset.bind||t.dataset.pbind||t.dataset.cmax||t.dataset.accday)){ readOnly(); return; }
  if(t.dataset.bind){ if(t.dataset.bind.startsWith('hic.')&&!(lg(sel).hic||{}).mod) setPath(logs[sel]||(logs[sel]={date:sel}),'hic.mod',modOf(sel)); setLog(sel,t.dataset.bind,val(t)); }
  else if(t.dataset.pbind){
    let v=val(t);
    if(t.dataset.pbind==='startMonday'){ if(!v) return; v=mondayOf(v); }
    if(t.dataset.pbind==='startMonday'||t.dataset.pbind==='bridge'){ plan.frozen={}; plan.lockedMax={}; plan.order={}; }
    setPlan(t.dataset.pbind,v);
  }
  else if(t.dataset.cmax){ const [c,k]=t.dataset.cmax.split('.'); const v=val(t); plan.cycleMaxes[c]=plan.cycleMaxes[c]||{}; if(v==null) delete plan.cycleMaxes[c][k]; else plan.cycleMaxes[c][k]=v; if(!Object.keys(plan.cycleMaxes[c]).length) delete plan.cycleMaxes[c]; planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.calc){ calc5[t.dataset.calc]=val(t); }
  else if(t.dataset.mobday){ const d=t.dataset.mobday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.lastIndexOf(', ');return i>0?[x.slice(0,i),x.slice(i+2)]:[x,'']}); plan.mob=Object.assign({},plan.mob||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.accday){ const d=t.dataset.accday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean); plan.acc=Object.assign({},plan.acc||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
});
(function(){
  const tip=document.getElementById('tip');
  const show=el=>{const r=el.getBoundingClientRect();tip.textContent=el.dataset.tip;tip.style.left=(r.left+r.width/2)+'px';tip.style.top=(r.top)+'px';tip.hidden=false};
  const hide=()=>{tip.hidden=true};
  document.addEventListener('pointerover',e=>{const el=e.target.closest&&e.target.closest('.ch-hit');el?show(el):hide()});
  document.addEventListener('focusin',e=>{const el=e.target.closest&&e.target.closest('.ch-hit');el?show(el):hide()});
  window.addEventListener('scroll',hide,{passive:true});
})();
document.addEventListener('toggle',e=>{const d=e.target;if(!d.matches)return;if(d.dataset&&d.dataset.px){d.open?openPx.add(d.dataset.px):openPx.delete(d.dataset.px);return}if(d.matches('details.wu')){d.open?openWarm.add(d.dataset.lift):openWarm.delete(d.dataset.lift)}else if(d.id&&d.id.startsWith('ci-')){const k=d.id.slice(3);d.open?openCI.add(k):openCI.delete(k)}},true);
document.addEventListener('change',e=>{ const t0=e.target; if(t0.dataset&&t0.dataset.actChange){ setLog(sel,'hic.iv.'+(t0.dataset.actChange==='ivwarm'?'warm':'cool'),t0.checked); render(); return; } });
document.addEventListener('change',e=>{ const t=e.target; if(t.dataset.bind||t.dataset.pbind||t.dataset.cmax||t.dataset.calc||t.dataset.accday||t.dataset.mobday||t.dataset.np) render(); });
document.getElementById('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(!b)return;view=b.dataset.view;try{localStorage.setItem('ob.view',view)}catch(err){}render();window.scrollTo(0,0)});
document.getElementById('main').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act;
  if(a==='progview'){enterArchive(b.dataset.id);return}
  if(a==='progexit'){exitArchive();return}
  // an archived program is read-only: only navigation works
  if(a==='csv'){exportCsv(b.dataset.v);return}
  if(a==='dlcheck'){const wk=weekOf(sel),c=wk&&wk.cycle,v=b.dataset.v;if(!c)return;mutatePlan(p=>{if(v!=='keep')p.deloadEvery=+v;p.deloadChecks=Object.assign({},p.deloadChecks||{},{[c]:{at:realToday(),choice:v==='keep'?+p.deloadEvery||0:+v}})});return}
  if(a==='platetoggle'){const v=+b.dataset.v,cur=plateSet();const next=cur.includes(v)?cur.filter(x=>x!==v):[...cur,v];if(!next.length)return;mutatePlan(p=>{p.plates=Object.assign({},p.plates||{},{[u()]:next.sort((a,b)=>b-a)})});return}
  if(a==='deloadevery'&&!viewing){const v=+b.dataset.v;if((+plan.deloadEvery||0)===v)return;mutatePlan(p=>{p.deloadEvery=v});return}
  if(viewing&&!['go','open','view','more','updcheck','updnow','rvsel'].includes(a)){readOnly();return}
  if(a==='prognew'){newProg={name:'Block '+((plan.programSeq||1)+1),start:addDays(mondayOf(realToday()),7),mode:'carry'};render();return}
  if(a==='progcancel'){newProg=null;render();return}
  if(a==='progstart'){if(!newProg.arm){newProg.arm=true;newProg.err=null;render();setTimeout(()=>{if(newProg&&newProg.arm){newProg.arm=false;render()}},4000);return} startProgram();return}
  if(a==='go'){sel=b.dataset.date;openWarm.clear();openPx.clear();render();return}
  if(a==='open'){sel=b.dataset.date;view='today';render();window.scrollTo(0,0);return}
  if(a==='view'){view=b.dataset.view;render();window.scrollTo(0,0);return}
  if(a==='ci'){const f=b.dataset.f,raw=b.dataset.v,v=/^\d+(\.\d+)?$/.test(raw)?+raw:raw;setLog(sel,'checkin.'+f,ci(sel)[f]==v?null:v);render();return}
  if(a==='wu'||a==='wurm'||a==='wuadd'){
    const k=b.dataset.lift,i=+b.dataset.i,W=wuList(k).map(x=>x?Object.assign({},x):{});
    if(a==='wuadd') W.push({});
    else if(a==='wurm') W.splice(i,1);
    else {
      const x=W[i]||(W[i]={}); x.done=!x.done;
      // logging a set as suggested stores the suggested numbers, so history shows real weights
      if(x.done){const ins=b.parentNode.querySelectorAll('input');if(x.w==null||x.w==='')x.w=ins[0].placeholder!==u()&&ins[0].placeholder!==''?+ins[0].placeholder:null;if(x.r==null||x.r==='')x.r=ins[1].placeholder!=='reps'?+ins[1].placeholder:null}
    }
    for(let j=0;j<W.length;j++) if(!W[j]) W[j]={};
    openWarm.add(k); setLog(sel,'lifts.'+k+'.warmup',W); render(); return}
  if(a==='set'){const k=b.dataset.lift,i=+b.dataset.i;const L=lg(sel);const arr=((L.lifts||{})[k]||{}).sets?[...L.lifts[k].sets]:[];
    offerUndo((arr[i]?'Set unticked':'Set ticked')+' · '+liftName(k),snapLog(sel));
    arr[i]=!arr[i];for(let j=0;j<arr.length;j++)if(arr[j]==null)arr[j]=false;setLog(sel,'lifts.'+k+'.sets',arr);
    if(arr[i]){popKey=k+':'+i;setTimeout(()=>{popKey=null},400)}
    if(arr[i]&&sel===todayStr()){unlockAudio();const nx=nextAfterSet(k,arr);if(nx!==undefined)startRest(k,nx);else stopRest()}
    render();return}
  if(a==='rvsel'){reviewSel[b.dataset.lift]=b.dataset.v;render();return}
  if(a==='rvapply'||a==='rvdismiss'){
    const c=+b.dataset.c;
    if(a==='rvapply'){
      const {stats,readiness:rdAvg}=cycleStats(c), mx=maxFor(c), chosen={};
      offerUndo('Cycle review applied',snapPlan());
      for(const k of activeLifts()){ if(!mx[k]) continue; const ch=reviewSel[k]||((((plan.cycleMaxes||{})[c+1]||{})[k]!=null)?'keep':recommend(stats[k],rdAvg)[0]); if(ch!=='keep') chosen[k]=reviewOptions(k,mx[k].v)[ch]; }
      mutatePlan(p=>{p.cycleMaxes[c+1]=Object.assign({},p.cycleMaxes[c+1]||{},chosen);p.reviews=Object.assign({},p.reviews||{},{[c]:{at:todayStr(),set:chosen}})});
    } else mutatePlan(p=>{p.reviews=Object.assign({},p.reviews||{},{[c]:{at:todayStr(),dismissed:true}})});
    reviewSel={}; return}
  if(a==='updcheck'){checkUpdate(true);return}
  if(a==='updnow'){applyUpdate();return}
  if(a==='alerton'){enableAlerts();return}
  if(a==='alertoff'){disableAlerts();return}
  if(a==='alerttest'){testAlert();return}
  if(a==='voicetest'){unlockAudio();setTimeout(()=>say('Rest over. Next: squat, set two.'),120);return}
  if(a==='restore'){const nm=b.dataset.name;if(restoreState.arm!==nm){restoreState.arm=nm;restoreState.msg=null;render();setTimeout(()=>{if(restoreState.arm===nm){restoreState.arm=null;render()}},4000);return}doRestore('/backups/'+encodeURIComponent(nm)+'/restore');return}
  if(a==='restorefile'){if(restoreState.file) doRestore('/restore',restoreState.file.data);return}
  if(a==='restorecancel'){restoreState.file=null;render();return}
  if(a==='backupnow'){backups.busy=true;render();api('POST','/backups').then(()=>{backups.busy=false;backups.list=null;loadBackups()}).catch(()=>{backups.busy=false;backups.err='Backup failed. Check your connection and try again.';render()});return}
  if(a==='lsstart'){lsStart();return}
  if(a==='wzset'){const k=b.dataset.k,v=b.dataset.v;wz[k]=(k==='deload'||k==='test')?+v:v;render();return}
  if(a==='wzl3'){const k=b.dataset.v;wz.l3[k]=!wz.l3[k];if(!L3K.some(x=>wz.l3[x]))wz.l3.pull=true;render();return}
  if(a==='wznext'){wz.step=Math.min(WZ_STEPS.length-1,wz.step+1);render();window.scrollTo(0,0);return}
  if(a==='wzback'){wz.step=Math.max(0,wz.step-1);render();return}
  if(a==='wzdone'){wzFinish();return}
  if(a==='wzcancel'){wz=null;render();return}
  if(a==='wzskip'){mutatePlan(p=>{p.onboarded=true;if(!st0Saved())p.startMonday=nextMonday()});wz=null;render();return}
  if(a==='wzrerun'){wz=wzNew(true);render();window.scrollTo(0,0);return}
  if(a==='ivopt'){if(ivOpts(sel,effFmt(sel))[b.dataset.k]===+b.dataset.v)return;setLog(sel,'hic.iv.'+b.dataset.k,+b.dataset.v);render();return}
  if(a==='ivstart'){ivStart(b.dataset.f);render();return}
  if(a==='mod'){if(modOf(sel)===b.dataset.v)return;setLog(sel,'hic.mod',b.dataset.v);render();return}
  // choices that are already selected save nothing (no empty log entries)
  if(a==='l3swap'){const v=b.dataset.v;if(v===l3For(sel))return;setLog(sel,'l3',v===l3Auto(sel)?null:v);openWarm.clear();render();return}
  if(a==='planmode'){planMode=b.dataset.v;try{localStorage.setItem('ob.planmode',planMode)}catch(e){}render();window.scrollTo(0,0);return}
  if(a==='calre'){calRe=!calRe;calMove=null;render();return}
  if(a==='calcancel'){calMove=null;render();return}
  if(a==='calpick'){
    const d=b.dataset.date, mon=mondayOf(d);
    if(!calMove||calMove.ord){calMove={from:d};render();return}
    if(calMove.from===d){calMove=null;render();return}
    if(mondayOf(calMove.from)!==mon) return;
    const r=bestOrder(mon,dow(d),slotOf(calMove.from));
    if(!r) return;
    calMove={from:calMove.from,to:d,ord:r.ord,moved:r.moved};
    render(); return;
  }
  if(a==='calapply'){
    if(!calMove||!calMove.ord) return;
    const mon=mondayOf(calMove.from), ord=calMove.ord;
    offerUndo('Days moved',snapPlan());
    mutatePlan(p=>{p.order=Object.assign({},p.order||{},{[mon]:ord})});
    calMove=null; openWarm.clear(); openPx.clear(); render(); return;
  }
  if(a==='calm'){const v=+b.dataset.v;if(!v)calMonth=realToday().slice(0,7);else{const y=+calMonth.slice(0,4),m=+calMonth.slice(5,7)+v;calMonth=S(Date.UTC(y,m-1,1)).slice(0,7)}render();return}
  if(a==='move'){moveOpen=!moveOpen;render();return}
  if(a==='movex'){moveOpen=false;render();return}
  if(a==='swap'){
    const mon=mondayOf(sel), r=bestOrder(mon,dow(sel),+b.dataset.sl); if(!r) return;
    offerUndo('Days moved',snapPlan());
    mutatePlan(p=>{p.order=Object.assign({},p.order||{},{[mon]:r.ord})});
    moveOpen=false; openWarm.clear(); openPx.clear(); render(); return;
  }
  if(a==='ordreset'){const mon=mondayOf(sel);offerUndo('Week order reset',snapPlan());mutatePlan(p=>{const o=Object.assign({},p.order||{});delete o[mon];p.order=o});moveOpen=false;render();return}
  if(a==='guide'){gdStart(b.dataset.k);return}
  if(a==='theme'){LS.set('ob.theme',b.dataset.v);applyTheme();render();return}
  if(a==='gym'){LS.set('ob.gym',!gymOn());applyTheme();render();return}
  if(a==='weekseen'){mutatePlan(p=>{p.weekSeen=mondayOf(todayStr())});return}
  if(a==='hold'){startHold(b.dataset.n,+b.dataset.s,+b.dataset.sides||1,1);render();return}
  if(a==='wshort'){const v=b.dataset.v==='1';if(!!lg(sel).warmShort===v)return;setLog(sel,'warmShort',v);render();return}
  if(a==='wclear'){offerUndo('Warm-up cleared',snapLog(sel));setLog(sel,'warmup',[]);render();return}
  if(a==='mclear'){offerUndo('Mobility cleared',snapLog(sel));setLog(sel,'mobility',[]);render();return}
  if(a==='pwu'){const i=+b.dataset.i,arr=[...((lg(sel).plyo||{}).warm||[])];arr[i]=!arr[i];for(let j=0;j<arr.length;j++)if(arr[j]==null)arr[j]=false;setLog(sel,'plyo.warm',arr);render();return}
  if(a==='pset'){
    const i=+b.dataset.i,j=+b.dataset.j, wk=weekOf(sel), dp=dayPlan(sel), ph=plyoPhase(wk), L=lg(sel).plyo||{}, cut=!!(dp.plyoCut||L.cut);
    const arr=[...(((L.sets||[])[i])||[])]; arr[j]=!arr[j]; for(let x=0;x<arr.length;x++) if(arr[x]==null) arr[x]=false;
    setLog(sel,'plyo.sets.'+i,arr);
    if(arr[j]&&sel===todayStr()){
      unlockAudio(); const e=ph.ex[i]; let next=null;
      const firstOpen=a=>{for(let x=0;x<plyoSets(ph.ex[a],cut);x++) if(!(((lg(sel).plyo||{}).sets||[])[a]||[])[x]) return x; return -1};
      const fo=firstOpen(i); if(fo>=0) next=e.label+' · set '+(fo+1);
      else for(let a2=i+1;a2<ph.ex.length;a2++){const f2=firstOpen(a2);if(f2>=0){next=ph.ex[a2].label+' · set '+(f2+1);break}}
      if(next) startRest(null,next,e.rest,'Rest · '+e.label);
      else startRest(null,'HIC: '+HIC[effFmt(sel)].name,600,'Rest before HIC');
    }
    render();return}
  if(a==='restmin'){const k=b.dataset.lift,m=+b.dataset.v;if(restMins(k)===m)return;mutatePlan(p=>{p.rest=Object.assign({},p.rest,{[k]:m})});
    if(rest&&rest.k===k&&!rest.done){const el=Date.now()-(rest.end-rest.dur*1000);rest.dur=m*60;rest.end=Date.now()-el+rest.dur*1000;LS.set('ob.rest',rest);tickRest();syncPush()}
    return}
  if(a==='done'){offerUndo(lg(sel).done?'Session reopened':'Session marked done',snapLog(sel));setLog(sel,'done',!lg(sel).done);render();return}
  if(a==='lower'){const k=b.dataset.lift,c=b.dataset.c;const m=maxFor(+c)[k];if(!m)return;offerUndo('Lowered the '+liftName(k)+' max',snapPlan());mutatePlan(p=>{p.cycleMaxes[c]=p.cycleMaxes[c]||{};p.cycleMaxes[c][k]=floorTo(m.v*.95,p.round[k])});return}
  if(a==='insert'){offerUndo('Week added',snapPlan());mutatePlan(p=>{p.inserts[b.dataset.monday]=b.dataset.kind});return}
  if(a==='uninsert'){offerUndo('Week removed',snapPlan());mutatePlan(p=>{delete p.inserts[b.dataset.monday]});return}
  if(a==='skip'){offerUndo('Week skipped',snapPlan());mutatePlan(p=>{p.skips[b.dataset.rule]=true});return}
  if(a==='unskip'){offerUndo('Week restored',snapPlan());mutatePlan(p=>{delete p.skips[b.dataset.rule]});return}
  if(a==='more'){planShow+=26;render();return}
  if(a==='applytest'){const wk=weekOf(b.dataset.monday),res=weekResults(wk,'test'),nc=wk.nextCycle;if(!nc)return;offerUndo('Results applied to Cycle '+nc,snapPlan());mutatePlan(p=>{p.cycleMaxes[nc]=Object.assign({},p.cycleMaxes[nc]||{},res)});return}
  if(a==='savemaxes'){const wk=weekOf(b.dataset.monday),res=weekResults(wk,'test');offerUndo('Maxes saved',snapPlan());mutatePlan(p=>{Object.assign(p.maxes,res)});return}
  if(a==='calc5'){mutatePlan(p=>{for(const k of LK) if(calc5[k]) p.maxes[k]=floorTo(calc5[k]/.87,p.round[k])});calc5={};return}
});

applyTheme();
loadLocal();
render();
if(rest) showRest();
if(iv&&Date.now()-iv.start>3*3600*1000){iv=null;LS.set('ob.iv',null)}
if(iv) ivShow();
if(ls&&ls.date!==realToday()){ls=null;LS.set('ob.ls',null)}
if(ls) lsShow();
if(guide&&guide.date!==realToday()){guide=null;LS.set('ob.guide',null)}
if(guide) gdShow();
connect();
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
setTimeout(()=>checkUpdate(false),2000);
