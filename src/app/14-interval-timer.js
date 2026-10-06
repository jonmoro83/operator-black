/* ---------- interval timer ---------- */
// Black's HIC formats as guided intervals. The session is a list of segments timed from
// an absolute start, so it stays right through screen locks and reloads. Each change of
// interval beeps (3-2-1 then a tone) and, with alerts on, is queued as a push.
const IV={map:{work:60,rest:60,rounds:[8,10]},anaerobic:{work:30,rest:120,rounds:[6,8]},threshold:{work:240,rest:180,rounds:[4,4]},long:{work:180,rest:90,rounds:[5,5]},fobbit:{work:15,rest:120,rounds:[7,15],def:10,lead:true,hold:true,
    roundOpts:[[7,'15 min'],[10,'20 min'],[15,'30 min']],
    reps:[['Swings','20'],['Snatches','10 per arm']], repsEasy:[['Swings','10'],['Snatches','5 per arm']]}};
let iv=LS.get('ob.iv'), ivTick=null, ivLast={idx:-1,left:-1}, ivStopArm=0;
function mmss(t){t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+pad(t%60)}
function ivOpts(date,fmt){
  const o=((lg(date).hic||{}).iv)||{}, r=IV[fmt];
  const ease=(lv0=>!!(lv0&&lv0.k!=='go'))(rLevel(readiness(ci(date))))||easyCondWeek(date);
  const def=r?(ease?r.rounds[0]:(((plan.ivRounds||{})[fmt])||r.def||r.rounds[0])):null;
  return {rounds:o.rounds||def, warm:o.warm!=null?o.warm:(fmt!=='liss'&&!(IV[fmt]||{}).lead), cool:!!o.cool, lissMin:o.lissMin||(ease?25:35), ease,
    reps:(r&&r.reps)?(ease?r.repsEasy:r.reps):null};
}
function ivSegments(fmt,o){
  const seg=[];
  if(o.warm&&fmt!=='liss'){seg.push({k:'easy',l:'Warm-up',s:300});for(let i=1;i<=3;i++){seg.push({k:'work',l:'Pickup',sub:'Pickup '+i+' of 3',s:15});seg.push({k:'easy',l:'Easy',sub:i<3?'Then pickup '+(i+1):'Intervals next',s:i<3?45:60})}}
  if(fmt==='liss') seg.push({k:'easy',l:'Steady',sub:'Conversational pace',s:o.lissMin*60});
  else {const r=IV[fmt], wk=o.burst||r.work;
    // A base-first format (FOBBIT) counts only the base: two easy minutes before every
    // burst, until the base adds up. The bursts sit on top, so the session runs longer
    // than its nominal length. The book alternates two movements, hence A and B.
    if(r.lead) for(let i=1;i<=o.rounds;i++){
      const rp=(o.reps||r.reps)[(i-1)%2];
      seg.push({k:'easy',l:'Base',sub:'Before burst '+i+' of '+o.rounds,s:r.rest,round:i,lead:i===1});
      seg.push({k:'work',l:rp[0],sub:rp[1],s:wk,round:i,hold:!!r.hold,reps:rp[1]});
    }
    else for(let i=1;i<=o.rounds;i++){seg.push({k:'work',l:'Hard',sub:'Round '+i+' of '+o.rounds,s:wk,round:i});if(i<o.rounds)seg.push({k:'easy',l:'Easy',sub:'Round '+i+' of '+o.rounds+' done',s:r.rest,round:i})}}
  if(o.cool) seg.push({k:'easy',l:'Cool-down',sub:'Easy spin-down',s:300});
  return seg;
}
function ivTotal(segs){return segs.reduce((a,x)=>a+x.s,0)}
// Where the minutes go: everything before the first round is the warm-up, a trailing
// Cool-down segment is the cool-down, the rest is the work. The work total has one fewer
// easy period than hard ones — the timer does not make you stand there resting after the
// last round — so 8 × 1:00/1:00 is 15 minutes of intervals, not 16.
function ivParts(segs){
  const i=segs.findIndex(x=>x.round||x.lead);
  const hasCool=segs.length&&segs[segs.length-1].l==='Cool-down';
  const cool=hasCool?segs[segs.length-1].s:0;
  const warm=i<0?0:segs.slice(0,i).reduce((a,x)=>a+x.s,0);
  const held=segs.reduce((a0,x)=>a0+(x.hold?x.s:0),0);   // rep bursts are not on the clock
  return {warm,work:ivTotal(segs)-warm-cool-held,cool,rounds:segs.filter(x=>x.round&&x.k==='work').length};
}
function ivPartsLabel(f,o){
  const segs=ivSegments(f,o), p=ivParts(segs), m=s0=>Math.round(s0/60), bits=[];
  if(p.warm) bits.push(m(p.warm)+' min warm-up');
  bits.push(m(p.work)+(f==='liss'?' min steady':(IV[f]||{}).lead?' min of base':' min of intervals'));
  if(p.cool) bits.push(m(p.cool)+' min cool-down');
  return {text:bits.join(' + '),rounds:p.rounds,total:m(p.warm+p.work+p.cool)};
}
function ivElapsed(){if(!iv)return 0;return ((iv.paused||Date.now())-iv.start-iv.pausedMs)/1000}
// A held burst is not part of the session's length, so the countdown reports base only.
function ivBaseLeft(p,t){let acc=0;for(let i=p.i;i<iv.segs.length;i++){const g=iv.segs[i];if(g.hold)continue;acc+=i===p.i?p.left:g.s}return Math.max(0,Math.round(acc))}
function ivPos(el){let acc=0;for(let i=0;i<iv.segs.length;i++){if(el<acc+iv.segs[i].s)return {i,left:acc+iv.segs[i].s-el,into:el-acc};acc+=iv.segs[i].s}return {i:iv.segs.length,left:0,into:0}}
function tone(freq,dur,delay){try{if(quiet()||!audioCtx)return;if(audioCtx.state==='suspended')audioCtx.resume();const t0=audioCtx.currentTime+(delay||0),o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(0.5,t0+.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g);g.connect(audioCtx.destination);o.start(t0);o.stop(t0+dur+.05)}catch(e){}}
function vib(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
function ivStart(fmt){
  const o=ivOpts(sel,fmt), segs=ivSegments(fmt,o);
  unlockAudio(); stopRest(); clearTimeout(pushTimer); // a pending rest-alert cancel must not wipe the interval queue
  iv={date:sel,fmt,mod:modOf(sel),segs,start:Date.now()+1500,paused:null,pausedMs:0,mini:false,rounds:o.rounds||0,done:false};
  if(IV[fmt]) plan.ivRounds=Object.assign({},plan.ivRounds||{},{[fmt]:o.rounds}),planV++,queueWrite('plan/main',()=>plan);
  ivLast={idx:-1,left:-1}; LS.set('ob.iv',iv); syncScreen(); ivShow(); ivPush();
}
function ivPush(){
  if(!alertsOn()||!iv) return;
  if(iv.paused||iv.done){api('POST','/push/cancel').catch(()=>{});return}
  const now=Date.now(), el=ivElapsed(), list=[]; let acc=0;
  iv.segs.forEach((x,i)=>{acc+=x.s; const at=iv.start+iv.pausedMs+acc*1000; if(at<=now+1000) return;
    const nx=iv.segs[i+1];
    // Worded to be read aloud (Siri Announce Notifications): no symbols or clock times.
    if(nx) list.push({at,title:nx.l==='Pickup'?'Pickup':nx.k==='work'?'Go hard':nx.l,body:nx.l==='Pickup'?durText(nx.s)+'.':nx.k==='work'?(nx.sub?nx.sub+', ':'')+durText(nx.s)+'.':durText(nx.s)+(nx.sub&&nx.l==='Easy'&&/done$/.test(nx.sub)?'. '+nx.sub+'.':'.')});
    else list.push({at,title:'Intervals done',body:'Log your result in the app.'});
  });
  if(list.length) api('POST','/push/schedule',{alerts:list.slice(0,80)}).catch(()=>{});
}
function ivShow(){
  const el=document.getElementById('iv');
  if(!iv){el.hidden=true;document.body.classList.remove('iv-mini');clearInterval(ivTick);ivTick=null;return}
  el.hidden=false; el.classList.toggle('mini',!!iv.mini); document.body.classList.toggle('iv-mini',!!iv.mini);
  document.getElementById('iv-size').textContent=iv.mini?'Expand':'Minimize';
  document.getElementById('iv-title').textContent=MOD[iv.mod].name+' · '+HIC[iv.fmt].name;
  if(!ivTick) ivTick=setInterval(ivRender,200);
  ivRender();
}
function ivRender(){
  if(!iv) return;
  const el=document.getElementById('iv'), total=ivTotal(iv.segs), t=ivElapsed();
  if(t<0){ // 1.5 s lead-in
    el.className=(iv.mini?'mini ':'')+'easy';
    document.getElementById('iv-phase').textContent='Get ready';document.getElementById('iv-time').textContent=Math.ceil(-t);
    document.getElementById('iv-sub').textContent='';document.getElementById('iv-next').textContent='First: '+iv.segs[0].l+' '+mmss(iv.segs[0].s);return;
  }
  const p=ivPos(t);
  if(p.i>=iv.segs.length){ ivFinish(); return; }
  const seg=iv.segs[p.i], nx=iv.segs[p.i+1], left=Math.ceil(p.left);
  el.className=(iv.mini?'mini ':'')+(iv.paused?'paused':seg.k);
  document.getElementById('iv-phase').textContent=iv.paused?'Paused':seg.l;
  if(seg.hold&&!iv.paused&&!iv.done){ iv.paused=Date.now(); LS.set('ob.iv',iv); }
  document.getElementById('iv-time').textContent=seg.hold?seg.reps:mmss(left);
  document.getElementById('iv-sub').textContent=(seg.sub||'')+(iv.paused?'':'');
  document.getElementById('iv-next').textContent=(nx?'Next: '+nx.l+(nx.hold?' '+nx.reps:' '+mmss(nx.s))+' · ':'Last one · ')+mmss(ivBaseLeft(p,t))+' of base left';
  document.getElementById('iv-fill').style.width=(seg.hold?0:100*p.into/seg.s)+'%';
  document.getElementById('iv-pause').textContent=seg.hold?'Done':iv.paused?'Resume':'Pause';
  document.getElementById('iv-done').hidden=true; document.getElementById('iv-btns').hidden=false;
  if(!iv.paused){
    if(p.i!==ivLast.idx){ if(ivLast.idx>=0||p.into<1){ if(seg.k==='work'){tone(1320,.45);vib([300])} else {tone(660,.45);vib([150,80,150])} setTimeout(()=>say(ivSpeech(seg)),450) } ivLast.idx=p.i; }
    if(left!==ivLast.left&&left<=3&&left>=1&&p.left<seg.s-0.5){ tone(880,.12); }
    ivLast.left=left;
  }
}
function durText(t){const m=Math.floor(t/60),sec=t%60,mins=m+(m===1?' minute':' minutes');return t<60?t+' seconds':sec?mins+' '+sec+' seconds':mins}
function ivSpeech(seg){
  const dur=durText(seg.s);
  if(seg.l==='Pickup') return 'Pickup. '+dur+'.';
  if(seg.k==='work') return (seg.sub?seg.sub+'. ':'')+'Go hard. '+dur+'.';
  if(seg.l==='Warm-up') return 'Warm up. Easy for '+dur+'.';
  if(seg.l==='Cool-down') return 'Cool down. '+dur+' easy.';
  if(seg.l==='Steady') return 'Steady pace for '+dur+'.';
  return 'Easy. '+dur+'.';
}
function ivFinish(){
  if(!iv.done){setTimeout(()=>say('Intervals done. Nice work. Log your result.'),900);iv.done=true;LS.set('ob.iv',iv);syncScreen();tone(880,.2);tone(880,.2,.28);tone(1320,.5,.56);vib([200,100,200,100,400]);
    const works=iv.segs.filter(x=>x.round).length; if(IV[iv.fmt]) setLog(iv.date,'hic.rounds',iv.rounds);
    if(!(lg(iv.date).hic||{}).format&&iv.fmt!==dayPlan(iv.date).fmt) setLog(iv.date,'hic.format',iv.fmt);
    // the session you actually did, not the one that was planned
    if((lg(iv.date).hic||{}).min==null||(lg(iv.date).hic||{}).min==='') setLog(iv.date,'hic.min',Math.max(1,Math.round(ivElapsed()/60)));
  }
  const el=document.getElementById('iv'); el.className=(iv.mini?'mini ':'')+'easy';
  document.getElementById('iv-phase').textContent='Done';
  document.getElementById('iv-time').textContent=mmss(ivTotal(iv.segs));
  document.getElementById('iv-sub').textContent=IV[iv.fmt]?iv.rounds+' rounds complete':'Steady session complete';
  document.getElementById('iv-next').textContent=''; document.getElementById('iv-fill').style.width='100%';
  const met=metricFor(iv.mod,iv.fmt), box=document.getElementById('iv-done');
  if(box.hidden){ box.hidden=false; document.getElementById('iv-btns').hidden=true;
    const cur=met?((lg(iv.date).hic||{})[met[0]]):null;
    box.innerHTML=(met?`<label class="f" style="text-align:left">${metricLabel(met)}<input type="number" inputmode="decimal" step="any" id="iv-result" value="${cur??''}" placeholder="Enter your result"></label>`:'')+`<button class="btn primary" data-iv="save">${met?'Save and close':'Close'}</button>`;
  }
}
function ivClose(){iv=null;LS.set('ob.iv',null);syncScreen();ivShow();render()}
document.getElementById('iv').addEventListener('click',e=>{
  if(e.target.id==='iv-size'){iv.mini=!iv.mini;LS.set('ob.iv',iv);ivShow();return}
  const b=e.target.closest('[data-iv]'); if(!b||!iv) return; const a=b.dataset.iv;
  unlockAudio();
  if(a==='pause'){ const held=(()=>{const t=ivElapsed();return t>=0&&(iv.segs[ivPos(t).i]||{}).hold})();
    if(iv.paused){iv.pausedMs+=Date.now()-iv.paused;iv.paused=null;syncScreen();
      if(held){const p=ivPos(ivElapsed()); iv.start-=p.left*1000; ivLast.idx=-1}
    } else iv.paused=Date.now(); LS.set('ob.iv',iv); ivRender(); ivPush(); }
  else if(a==='skip'){ const t=ivElapsed(); if(t<0){iv.start=Date.now()-iv.pausedMs}else{const p=ivPos(t); iv.start-=p.left*1000;} ivLast.idx=-1; LS.set('ob.iv',iv); ivRender(); ivPush(); }
  else if(a==='stop'){ if(Date.now()-ivStopArm<3000){ if(alertsOn()) api('POST','/push/cancel').catch(()=>{}); ivClose(); } else { ivStopArm=Date.now(); const s=document.getElementById('iv-stop'); s.textContent='Tap again to end'; setTimeout(()=>{s.textContent='End'},3000); } }
  else if(a==='save'){ const inp=document.getElementById('iv-result'), met=metricFor(iv.mod,iv.fmt); if(inp&&met&&inp.value!==''){ if(!(lg(iv.date).hic||{}).mod) setLog(iv.date,'hic.mod',iv.mod); setLog(iv.date,'hic.'+met[0],+inp.value); } ivClose(); }
});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') syncScreen() });
