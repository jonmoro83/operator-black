/* ---------------- schedule engine ---------------- */
// The rule sequence (bridge, 6-week cycles, rule deloads/retests). `from` resumes it
// after the locked weeks: {c, w} continues cycle c at week w; phase 'rule' means
// cycle c just finished and its deload/retest check comes next.
function* ruleSeq(p,from){
  let c=1,w=1,ruleFirst=false;
  if(from){c=from.c;w=from.w||1;ruleFirst=from.phase==='rule'} else if(p.bridge) yield {kind:'bridge'};
  for(;;c++,w=1){
    if(!ruleFirst) for(;w<=6;w++) yield {kind:'cycle',cycle:c,w};
    ruleFirst=false;
    const t=+p.testEvery>0&&c%+p.testEvery===0, d=+p.deloadEvery>0&&c%+p.deloadEvery===0;
    if(t&&!p.skips['test@'+c]) yield {kind:'test',after:c,rule:'test@'+c};
    else if(d&&!p.skips['deload@'+c]) yield {kind:'deload',after:c,rule:'deload@'+c};
  }
}
let wcache={v:-1,list:[]};
function weeks(minIdx){
  const need=Math.max(minIdx||0, idxOf(todayStr())+160, 60);
  if(wcache.v===planV&&wcache.list.length>need) return wcache.list;
  // Past weeks are locked in plan.frozen (see freezePast), so settings changes only
  // re-plan from the current week on. Locked weeks form a prefix from the start date.
  const out=[], fz=plan.frozen||{}; let g=null, m=plan.startMonday, cw=0, lastC=0, resume=null;
  for(let i=0;i<=need+10;i++){
    let wk;
    if(!g&&fz[m]){
      wk=Object.assign({},fz[m],{locked:true});
      if(!wk.inserted) resume=wk.kind==='bridge'?{c:1,w:1}:wk.kind==='cycle'?(wk.w<6?{c:wk.cycle,w:wk.w+1}:{c:wk.cycle,phase:'rule'}):wk.after?{c:wk.after+1,w:1}:resume;
    } else {
      if(!g) g=ruleSeq(plan,resume);
      const ins=plan.inserts[m];
      if(ins) wk={kind:ins,inserted:true}; else wk=g.next().value;
    }
    wk=Object.assign({},wk,{monday:m,idx:i});
    if(wk.kind==='cycle'){if(wk.plyoIdx==null)wk.plyoIdx=cw;cw=wk.plyoIdx+1;lastC=wk.cycle}
    if(wk.refCycle==null) wk.refCycle=wk.after||lastC||1;
    out.push(wk); m=addDays(m,7);
  }
  // for tests/inserts, find the cycle that follows
  for(let i=out.length-1,next=null;i>=0;i--){ if(out[i].kind==='cycle'&&out[i].w===1) next=out[i].cycle; out[i].nextCycle=next; }
  wcache={v:planV,list:out}; return out;
}
function idxOf(date){return Math.floor((D(mondayOf(date))-D(plan.startMonday))/(7*864e5))}
function weekOf(date){const i=idxOf(date);if(i<0)return null;return weeks(i+10)[i]}
function wkRx(wk){return wk.rx||(wk.kind==='cycle'?plan.wave[wk.w-1]:plan.deload)}
// Lock every week that has fully passed: its type, cycle/week, prescription and Lift 3
// picks. A cycle whose last week is locked also gets its maxes locked.
function freezePast(){
  const cur=idxOf(todayStr()); if(cur<=0) return false;
  const list=weeks(cur+1), fz=plan.frozen||(plan.frozen={}), lm=plan.lockedMax||(plan.lockedMax={});
  let changed=false;
  for(let i=0;i<cur&&i<list.length;i++){
    const wk=list[i]; if(fz[wk.monday]) continue;
    const f={kind:wk.kind};
    for(const key of ['cycle','w','after','rule','inserted','plyoIdx','refCycle']) if(wk[key]!=null) f[key]=wk[key];
    if(wk.kind==='cycle'||wk.kind==='deload'){f.rx=clone(wkRx(wk));const ord=dayOrder(wk.monday);f.l3={};for(let j=0;j<7;j++){const sl=ord[j];if(sl===0||sl===2)f.l3[sl]=l3Auto(addDays(wk.monday,j))}}
    fz[wk.monday]=f; changed=true;
    if(changed) planV++;
  }
  for(const f of Object.values(fz)) if(f.kind==='cycle'&&f.w===6&&!lm[f.cycle]){
    const mx=maxFor(f.cycle), o={}; for(const k of LK) if(mx[k]) o[k]=mx[k].v; lm[f.cycle]=o; changed=true; planV++;
  }
  if(changed) queueWrite('plan/main',()=>plan);
  return changed;
}
let mcache={v:-1,m:{}};
function maxFor(c){
  if(mcache.v!==planV) mcache={v:planV,m:{}};
  if(mcache.m[c]) return mcache.m[c];
  const o=(plan.cycleMaxes||{})[c]||{}, lk=(plan.lockedMax||{})[c]||{}, prev=c>1?maxFor(c-1):null, r={};
  for(const k of LK){
    if(o[k]!=null&&o[k]!=='') r[k]={v:+o[k],src:'set'};
    else if(lk[k]!=null) r[k]={v:+lk[k],src:'lock'};
    else if(c===1) r[k]=plan.maxes[k]!=null&&plan.maxes[k]!==''?{v:+plan.maxes[k],src:'base'}:null;
    else r[k]=prev[k]?{v:prev[k].v+(+plan.inc[k]||0),src:'proj'}:null;
  }
  return mcache.m[c]=r;
}
function rx(wk,k){
  let s,r,p,c;
  const v=wkRx(wk);s=+v.s;r=+v.r;p=+v.p;c=wk.kind==='cycle'?wk.cycle:wk.refCycle;
  if(k==='dead'&&wk.kind!=='cycle') s=1;
  const m=maxFor(c)[k];
  return {s,r,p,c,m,w:m?loadFor(k,m.v,p,sel):null,t:wk.kind==='cycle'?tier(p):'light'};
}
// A week's seven sessions can be reordered: plan.order[monday] maps weekday -> slot.
// The slot is what the program prescribes; the weekday is just when you do it.
function dayOrder(monday){const o=(plan.order||{})[monday];return Array.isArray(o)&&o.length===7&&o.slice().sort().join()==='0,1,2,3,4,5,6'?o:[0,1,2,3,4,5,6]}
function slotOf(date){return dayOrder(mondayOf(date))[dow(date)]}
function isReordered(monday){return dayOrder(monday).some((v,i)=>v!==i)}
// For adjacency: two strength days or two hard conditioning days must not touch.
function sessKind(dp){
  if(!dp) return 'other';
  if(dp.t==='lift'||dp.t==='rm5'||dp.t==='test'||dp.t==='travel') return 'strength';
  if(dp.t==='plyohic') return 'hic';
  if(dp.t==='hic') return dp.fmt==='liss'?'easy':'hic';
  return 'other';
}
function kindName(k){return k==='strength'?'strength':'hard conditioning'}
// Conflicts a proposed order would create, including the days either side of the week.
function orderIssues(monday,ord){
  const K=[],N=[], prev=addDays(monday,-1), next=addDays(monday,7);
  K.push(idxOf(prev)>=0?sessKind(dayPlan(prev)):'other'); N.push(DAYN[6]+' before');
  for(let i=0;i<7;i++){K.push(sessKind(dayPlanSlot(addDays(monday,i),ord[i])));N.push(DAYN[i])}
  K.push(weekOf(next)?sessKind(dayPlan(next)):'other'); N.push('next '+DAYN[0]);
  const out=[];
  for(let i=1;i<K.length;i++) if((K[i]==='strength'||K[i]==='hic')&&K[i]===K[i-1]) out.push({a:N[i-1],b:N[i],kind:K[i]});
  return out;
}
function dayPlan(date){
  const wk=weekOf(date); if(!wk) return {t:'pre'};
  return dayPlanSlot(date,slotOf(date));
}
function dayPlanSlot(date,d){
  const wk=weekOf(date); if(!wk) return {t:'pre'};
  const SBP=['squat','bench',l3For(date)], SBD=['squat','bench','dead'];
  if(wk.kind==='cycle') return [
    {t:'lift',day:1,lifts:SBP,acc:'mon',short:'Op 1'},
    {t:'hic',fmt:'map',short:'HIC'},
    {t:'lift',day:2,lifts:SBP,acc:'wed',short:'Op 2'},
    {t:'plyohic',fmt:'anaerobic',short:'Plyo+HIC'},
    {t:'lift',day:3,lifts:SBD,acc:'fri',short:'Op 3'},
    {t:'hic',fmt:wk.w%2?'threshold':'long',short:'HIC',note:'Swap to LISS if the week has been heavy.'},
    {t:'off',short:'Off'}][d];
  if(wk.kind==='deload') return [
    {t:'lift',deload:true,lifts:SBP,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS'},
    {t:'lift',deload:true,lifts:SBP,short:'Lift'},
    {t:'plyohic',fmt:'liss',plyoCut:true,short:'Plyo+LISS'},
    {t:'lift',deload:true,lifts:SBD,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS',note:'Optional. Take it off if you feel flat.'},
    {t:'off',short:'Off'}][d];
  if(wk.kind==='test') return [
    {t:'hic',fmt:'liss',short:'Easy',note:'Easy day. 20–30 min of conversational cardio.'},
    {t:'off',short:'Mobility',note:'Easy day. Mobility only: the warm-up hip and t-spine work. No cardio — the two heavy test days are what this week is for.'},
    {t:'hic',fmt:'liss',short:'Easy',note:'Easy day. 20–30 min of conversational cardio.'},
    {t:'test',lifts:['squat','bench'],jumps:true,short:'Test'},
    {t:'off',short:'Off'},
    {t:'test',lifts:['dead',...l3On()],pullups:true,apply:true,short:'Test'},
    {t:'off',short:'Off'}][d];
  if(wk.kind==='bridge') return [
    {t:'off',short:'—',note:'Bridge week starts Tuesday.'},
    {t:'rm5',lifts:['squat','bench'],short:'5RM'},
    {t:'hic',fmt:'map',baseline:true,short:'HIC',note:'Baseline: 8 × 1 min. Record total calories.'},
    {t:'plyobase',short:'Jumps'},
    {t:'rm5',lifts:['dead',l3On()[0]],short:'5RM'},
    l3On().length>1?{t:'rm5',lifts:l3On().slice(1),cardio:true,fmt:'liss',short:'5RM+Spin',note:'Test these first — two lifts per day keeps the numbers honest — then ride easy for 30–40 min.'}:{t:'hic',fmt:'liss',short:'Easy',note:'30–40 min easy cardio.'},
    {t:'convert',short:'Maxes'}][d];
  if(wk.kind==='travel') return [
    {t:'travel',slot:'day1',short:'Travel 1'},
    {t:'hic',fmt:'map',short:'HIC'},
    {t:'travel',slot:'day2',short:'Travel 2'},
    {t:'plyohic',fmt:'anaerobic',short:'Plyo+HIC'},
    {t:'travel',slot:'day3',short:'Travel 3'},
    {t:'hic',fmt:'threshold',short:'HIC',note:'Swap to LISS or a walk if the week has been long.'},
    {t:'off',short:'Off'}][d];
  return {t:'off',short:'Off',note:'Off week. Walk, sleep, eat. The plan resumes next Monday.'};
}
function weekTitle(wk){
  if(!wk) return 'Before start';
  if(wk.kind==='cycle'){const v=wkRx(wk);return {t:'Cycle '+wk.cycle+' · Week '+wk.w,chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:tier(+v.p)}}
  if(wk.kind==='deload'){const v=wkRx(wk);return {t:'Deload week',chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:'light'}}
  if(wk.kind==='test') return {t:'Retest week',chip:'Heavy singles',cls:'heavy'};
  if(wk.kind==='bridge') return {t:'Bridge week',chip:'Calibration',cls:'blue'};
  if(wk.kind==='travel') return {t:'Travel week',chip:'Minimal kit',cls:'mid'};
  return {t:'Off week',chip:'Rest',cls:''};
}
function plyoPhase(wk){ if(wk.kind==='cycle') return PLYO[Math.floor((wk.plyoIdx%9)/3)]; return PLYO[0]; }
function holidays(y){
  const nth=(m,wd,k)=>{const f=new Date(Date.UTC(y,m,1)).getUTCDay();return S(Date.UTC(y,m,1+((wd-f+7)%7)+7*(k-1)))};
  const last=(m,wd)=>{const l=new Date(Date.UTC(y,m+1,0));return S(Date.UTC(y,m,l.getUTCDate()-((l.getUTCDay()-wd+7)%7)))};
  const tg=nth(10,4,4);
  return {[y+'-01-01']:"New Year's Day",[last(4,1)]:'Memorial Day',[y+'-07-04']:'Independence Day',[nth(8,1,1)]:'Labor Day',[tg]:'Thanksgiving',[addDays(tg,1)]:'Day after Thanksgiving',[y+'-12-24']:'Christmas Eve',[y+'-12-25']:'Christmas'};
}
function holidayOn(date){return holidays(+date.slice(0,4))[date]||null}
function effFmt(date){const L=logs[date];const dp=dayPlan(date);return (L&&L.hic&&L.hic.format)||dp.fmt}
function defMod(){const m=(plan.cardio||{}).def;return MOD[m]?m:'echo'}
// Sessions logged before activities existed have calories but no activity: they were on the Echo bike.
function modOf(date){const H=(logs[date]||{}).hic;if(H&&MOD[H.mod])return H.mod;if(H&&H.cal!=null&&H.cal!=='')return 'echo';return defMod()}
function metricFor(mod,fmt){const m=MOD[mod]&&MOD[mod][fmt==='liss'?'liss':'hic'];if(!m)return null;let un=m[1];if(u()==='kg'){if(un==='mi')un='km';if(un==='yd')un='m'}return [m[0],un]}
function metricLabel(met){return met[0]==='cal'?'Total calories':met[0]==='watts'?'Average watts':'Distance ('+met[1]+')'}
// Conditioning results. `all` spans every program (for "last/best" comparisons);
// otherwise only the program on screen.
function hicSessions(all){
  const out=[];
  for(const [d,L] of Object.entries(logs)){
    if(!L.hic||(!all&&!inProgram(d))) continue; const f=effFmt(d); if(!f) continue;
    const mod=modOf(d), met=metricFor(mod,f), v=met?L.hic[met[0]]:null;
    if((v!=null&&v!=='')||(f==='liss'&&L.hic.min)||(mod==='other'&&L.hic.what)) out.push({d,f,mod,v:v!=null&&v!==''?+v:null,u:met?met[1]:'',min:L.hic.min,what:L.hic.what,load:L.hic.load});
  }
  return out.sort((a,b)=>a.d<b.d?-1:1);
}
