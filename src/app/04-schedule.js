/* ---------------- schedule engine ---------------- */
// The rule sequence (bridge, 6-week cycles, rule deloads/retests). `from` resumes it
// after the locked weeks: {c, w} continues cycle c at week w; phase 'rule' means
// cycle c just finished and its deload/retest check comes next.
function* ruleSeq(p,from){
  let c=1,w=1,ruleFirst=false;
  if(from){c=from.c;w=from.w||1;ruleFirst=from.phase==='rule'} else if(p.bridge) yield {kind:'bridge'};
  // Ageless Athlete's 3-1-3-1: a recovery week after every third training week, so a
  // six-week block takes eight. "Notice that it now takes eight weeks to complete what
  // was normally a six-week Operator/Zulu block. That's not a worry because we are in
  // no hurry on the journey to lifelong excellence."
  const r313=!!p.recovery313;
  for(;;c++,w=1){
    if(!ruleFirst) for(const n=cycleWeeks();w<=n;w++){
      yield {kind:'cycle',cycle:c,w};
      // No `after` on a recovery week: it sits inside the cycle, so replaying a frozen
      // one must not advance the resume point to the next cycle.
      if(r313&&w%3===0) yield {kind:'recovery',cycle:c,afterW:w};
    }
    ruleFirst=false;
    const t=+p.testEvery>0&&c%+p.testEvery===0, d=+p.deloadEvery>0&&c%+p.deloadEvery===0;
    if(t&&!p.skips['test@'+c]) yield {kind:'test',after:c,rule:'test@'+c};
    // The recovery weeks are the back-off, so a rule deload on top of them is the one
    // thing the book is arguing against.
    else if(d&&!r313&&!p.skips['deload@'+c]) yield {kind:'deload',after:c,rule:'deload@'+c};
  }
}
let wcache={v:-1,list:[]};
function weeks(minIdx){
  const need=Math.max(minIdx||0, idxOf(todayStr())+160, 60);
  if(wcache.v===planV&&wcache.list.length>need) return wcache.list;
  // Past weeks are locked in plan.frozen (see freezePast), so settings changes only
  // re-plan from the current week on. Locked weeks form a prefix from the start date.
  const out=[], fz=plan.frozen||{}; let g=null, m=plan.startMonday, cw=0, lastC=0, resume=null, bbLeft=0, bbVer='standard';
  for(let i=0;i<=need+10;i++){
    let wk;
    if(!g&&fz[m]){
      wk=Object.assign({},fz[m],{locked:true});
      if(wk.kind==='bb'&&wk.w<bbLen(wk.ver)){bbVer=wk.ver||'standard';bbLeft=bbLen(bbVer)-wk.w}
      if(!wk.inserted) resume=wk.kind==='bridge'?{c:1,w:1}:wk.kind==='cycle'?(wk.w<cycleWeeks()?{c:wk.cycle,w:wk.w+1}:{c:wk.cycle,phase:'rule'}):wk.after?{c:wk.after+1,w:1}:resume;
    } else {
      if(!g) g=ruleSeq(plan,resume);
      const ins=plan.inserts[m];
      if(bbLeft>0){ wk={kind:'bb',w:bbLen(bbVer)-bbLeft+1,ver:bbVer,inserted:true}; bbLeft--; }
      else if(ins==='bb'){ bbVer=((plan.bbVer||{})[m])||'standard'; wk={kind:'bb',w:1,ver:bbVer,inserted:true}; bbLeft=bbLen(bbVer)-1; }
      else if(ins) wk={kind:ins,inserted:true}; else wk=g.next().value;
    }
    wk=Object.assign({},wk,{monday:m,idx:i});
    if(wk.kind==='cycle'){if(wk.plyoIdx==null)wk.plyoIdx=cw;cw=wk.plyoIdx+1;lastC=wk.cycle}
    if(wk.kind==='bb'&&wk.rx==null){
      const i=wk.ver==='mass'?-1:(wk.ver==='strength')?wk.w-1:wk.w-6;   // which lifting week of the block, or none
      if(i>=0){const W=waveOf(); wk.rx=clone(W[Math.min(i,W.length-1)])}
    }
    if(wk.refCycle==null) wk.refCycle=wk.after||lastC||1;
    out.push(wk); m=addDays(m,7);
  }
  // for tests/inserts, find the cycle that follows
  for(let i=out.length-1,next=null;i>=0;i--){ if(out[i].kind==='cycle'&&out[i].w===1) next=out[i].cycle; out[i].nextCycle=next; }
  wcache={v:planV,list:out}; return out;
}
function idxOf(date){return Math.floor((D(mondayOf(date))-D(plan.startMonday))/(7*864e5))}
function weekOf(date){const i=idxOf(date);if(i<0)return null;return weeks(i+10)[i]}
function wkRx(wk){return wk.rx||(wk.kind==='cycle'?waveOf()[wk.w-1]:plan.deload)}
// TB2's Easy Week Principle: every third week the conditioning load comes down, and it is
// meant to land on the strength wave's 90-95% weeks so the heavy lifting gets the energy.
// In a six-week wave those are weeks 3 and 6, which is exactly `tier()==='heavy'`.
function easyCondWeek(date){const wk=date?weekOf(date):null;return !!(wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy')}
// Lock every week that has fully passed: its type, cycle/week, prescription and Lift 3
// picks. A cycle whose last week is locked also gets its maxes locked.
function freezePast(){
  const cur=idxOf(todayStr()); if(cur<0) return false;
  const list=weeks(cur+2), fz=plan.frozen||(plan.frozen={}), lm=plan.lockedMax||(plan.lockedMax={});
  let changed=false;
  // Up to and including the week you are in. A week already under way has told you what
  // it is, and changing the deload or retest spacing should not turn it into something
  // else on the Wednesday. Its *prescription* is deliberately not frozen while it is
  // current: Setup promises the wave and your maxes apply from this week on, and they do.
  for(let i=0;i<=cur&&i<list.length;i++){
    const wk=list[i], now=i===cur, f0=fz[wk.monday];
    if(f0&&!f0.soft) continue;                 // already history, and stays as it was
    if(f0&&now) continue;                      // soft and still current: leave it loose
    // Everything else gets written: a week not frozen at all, and — the case this used
    // to miss — a week that was held loosely while it was current and has now passed.
    // That one only ever had `soft` cleared, so it never gained the prescription stamp
    // a hard freeze adds, and went on following today's plan instead of what was done.
    const f={kind:wk.kind};
    for(const key of ['cycle','w','after','rule','inserted','plyoIdx','refCycle','ver']) if(wk[key]!=null) f[key]=wk[key];
    if(now) f.soft=true;                       // identity only; the numbers still follow
    else if(wk.kind==='cycle'||wk.kind==='deload'||(wk.kind==='bb'&&wk.rx)){f.rx=clone(wkRx(wk));f.tpl=stemplKey();f.cpr=cprotoKey();const ord=dayOrder(wk.monday);f.l3={};for(let j=0;j<7;j++){const sl=ord[j];if(sl===0||sl===2)f.l3[sl]=l3Auto(addDays(wk.monday,j))}}
    fz[wk.monday]=f; changed=true; planV++;
  }
  const curMon=list[cur]&&list[cur].monday;
  // A cycle's maxes lock once its last week is done. Which week is last comes from the
  // wave that week ran, not from a hardcoded six: a template can have a shorter one.
  for(const [mon,f] of Object.entries(fz)) if(f.kind==='cycle'&&f.w===waveOf(f.tpl).length&&!lm[f.cycle]&&mon<curMon){
    const mx=maxFor(f.cycle), o={}; for(const k of LK) if(mx[k]) o[k]=mx[k].v; lm[f.cycle]=o; changed=true; planV++;
  }
  if(changed) queueWrite('plan/main',()=>plan);
  return changed;
}
let mcache={v:-1,m:{}};
// How many sets the + button will go to: the book's ten, or higher if the wave says so.
function SETCAP(r){return Math.max(10,r.sMax)}
// Add or drop one set for a lift on a single day. The lift card and the full-screen stepper
// both come through here, so the ceiling and the don't-strand-a-ticked-set guard live once.
function addSet(k,delta,date){
  const d=date||sel, wk=weekOf(d); if(!wk) return false;
  const r=rx(wk,k,d), L=lg(d), cur=Math.max(0,+(((L.lifts||{})[k]||{}).extra)||0);
  if(delta>0){ if(r.sMax>=SETCAP(r)) return false }
  else if(!cur||(((L.lifts||{})[k]||{}).sets||[])[r.sMax-1]) return false;
  setLog(d,'lifts.'+k+'.extra',Math.max(0,cur+delta));
  return true;
}
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
/* What a lift is prescribed on a given day.

   Operator, Fighter and Zulu run one prescription for the whole week, which is what the
   wave is. Tactical Barbell III does not: its tables are per day and sometimes per lift
   — Fighter HT's deadlift day diverges from week 2 on, and Specificity alternates
   max-strength days against hypertrophy days inside one week. So the template gets first
   refusal, and the wave is the answer when it declines.

   A frozen week pins the wave entry it ran (`wk.rx`) and the template it ran under
   (`wk.tpl`), and a template's own table is a pure function of the week number, so
   history stays reproducible without storing a prescription per day. */
function dayRx(wk,k,date){
  const T=STEMPL[wk.tpl]||stemplOf();
  // `day` is set only by composeSlot, so only a composed week can reach the table. A
  // deload, a retest or a Base Building week writes its own layout and keeps its own
  // numbers without needing to be named here.
  if(typeof T.rx==='function'){
    const dp=dayPlan(date);
    // `own` says the template set this deliberately, so the generic deadlift rule below
    // leaves it alone: on Fighter HT the deadlift day *is* five sets of eight.
    if(dp&&dp.day){ const v=T.rx(wk,dp.day,k); if(v) return Object.assign({},v,{own:true}) }
  }
  return wkRx(wk);
}
function rx(wk,k,date){
  let s,r,p,c;
  const d=date||sel;
  const v=dayRx(wk,k,d);s=+v.s;r=+v.r;p=+v.p;c=wk.kind==='cycle'?wk.cycle:wk.refCycle;
  // Operator I/A lets the lifter choose the volume: a wave entry can carry `sMax`, a
  // ceiling above the prescribed sets. `s` stays what the program asks for; the sets from
  // s+1 to sMax are yours to take or leave on the day. Deadlift is the standard template's
  // own version of the same idea -- one set required, up to three -- so it goes through
  // here too rather than being special-cased by every caller.
  let sx=v.sMax!=null&&+v.sMax>s?+v.sMax:s;
  if(k==='dead'&&!v.own){ s=1; sx=wk.kind==='cycle'?3:1 }
  // ...and a set added on the day widens it further, for this session only. Setup declares
  // the program's intent; this is the lifter deciding in the gym, which is the half of
  // Operator I/A that actually matters.
  sx+=Math.max(0,+(((lg(d).lifts||{})[k]||{}).extra)||0);
  const m=VARS[k]?varMax(k,c,d):maxFor(c)[k];
  return {s,sMax:sx,r,p,c,m,w:m?loadFor(k,m.v,p,d):null,t:wk.kind==='cycle'?tier(p):'light',vr:VARS[k]?varOf(k,d):null,
    amrap:!!v.amrap,note:v.note||null,
    // Back "Break" works up to a best set for the day rather than off a percentage,
    // and its down sets are a percentage of that set, not of a 1RM.
    top:!!v.top,down:v.down||null,downPct:v.downPct||null};
}
// A week's seven sessions can be reordered: plan.order[monday] maps weekday -> slot.
// The slot is what the program prescribes; the weekday is just when you do it.
function dayOrder(monday){const o=(plan.order||{})[monday];return Array.isArray(o)&&o.length===7&&o.slice().sort().join()==='0,1,2,3,4,5,6'?o:[0,1,2,3,4,5,6]}
function slotOf(date){return dayOrder(mondayOf(date))[dow(date)]}
function isReordered(monday){return dayOrder(monday).some((v,i)=>v!==i)}
// For adjacency: two strength days or two hard conditioning days must not touch.
function sessKind(dp){
  if(!dp) return 'other';
  if(dp.t==='lift'&&dp.half) return 'strength'+dp.half.toUpperCase();
  if(dp.t==='lift'||dp.t==='rm5'||dp.t==='test'||dp.t==='travel') return 'strength';
  if(dp.t==='hic') return dp.fmt==='liss'?'easy':'hic';
  // Base Building's week is two circuits with three days between them. Classed as
  // 'other' they were invisible to the adjacency rules and the Move tool would happily
  // put them back to back, which is the one arrangement Block I is built to avoid.
  if(dp.t==='se') return 'se';
  return 'other';
}
function kindName(k){return /^strength[AB]?$/.test(k)?'strength':k==='se'?'strength-endurance':'hard conditioning'}
// Kinds that must not land on consecutive days. One list, used by the arranger and by
// the warning it shows, because when those two disagree the arranger silently wins.
/* What must not land on consecutive days.

   Only strength, and only the same session twice. That is the book's own principle
   for moving things around, stated as a principle: "It's not set in stone. As long as
   you adhere to the principles - one rest day. No back to back same sessions.
   Completed within 7 days." (TB1). Zulu's A and B are different sessions, which is why
   they carry their own kinds and are allowed to touch.

   Conditioning used to be in here and should never have been. TB II could not be
   plainer: "Your HIC and E can be done on any day, not just days 2, 4, and 6. You can
   do two days in a row, or whatever. As long as you're hitting your weekly minimums."
   Spreading them out is still the better default, so `weekShape` and `bestOrder` go on
   preferring it -- but preferring is not refusing, and the app was refusing. */
const ADJACENT_BAN=['strength','strengthA','strengthB'];
function clashes(a,b){return !!a&&a===b&&ADJACENT_BAN.includes(a)}
// Worth avoiding when there is a choice, without being a reason to refuse an
// arrangement the books allow.
const ADJACENT_SOFT=['hic','se'];
function crowds(a,b){return !!a&&a===b&&ADJACENT_SOFT.includes(a)}
// Conflicts a proposed order would create, including the days either side of the week.
function orderIssues(monday,ord){
  const K=[],N=[], prev=addDays(monday,-1), next=addDays(monday,7);
  K.push(idxOf(prev)>=0?sessKind(dayPlan(prev)):'other'); N.push(DAYN[6]+' before');
  for(let i=0;i<7;i++){K.push(sessKind(dayPlanSlot(addDays(monday,i),ord[i])));N.push(DAYN[i])}
  K.push(weekOf(next)?sessKind(dayPlan(next)):'other'); N.push('next '+DAYN[0]);
  const out=[];
  for(let i=1;i<K.length;i++) if(clashes(K[i],K[i-1])) out.push({a:N[i-1],b:N[i],kind:K[i]});
  return out;
}
/* The same walk, for the arrangements that are allowed but not ideal. Kept separate
   from `orderIssues` on purpose: one is a refusal and the other is a remark, and
   collapsing them is how the app ended up refusing what the book permits. */
function orderCrowding(monday,ord){
  const K=[],N=[], prev=addDays(monday,-1), next=addDays(monday,7);
  K.push(idxOf(prev)>=0?sessKind(dayPlan(prev)):'other'); N.push(DAYN[6]+' before');
  for(let i=0;i<7;i++){K.push(sessKind(dayPlanSlot(addDays(monday,i),ord[i])));N.push(DAYN[i])}
  K.push(weekOf(next)?sessKind(dayPlan(next)):'other'); N.push('next '+DAYN[0]);
  const out=[];
  for(let i=1;i<K.length;i++) if(crowds(K[i],K[i-1])) out.push({a:N[i-1],b:N[i],kind:K[i]});
  return out;
}
// Which weeks run plyos at all, and on which weekday. Attached in dayPlan rather than
// baked into a slot: a slot belongs to the arrangement of the week and gets shuffled by
// the Move tool, and plyos should not be shuffled with it. 0 = Monday.
function weekHasPlyo(wk){ return plan.plyoOn!==false&&!!wk&&['cycle','deload','travel'].includes(wk.kind) }
function plyoDow(monday){
  const o=(plan.plyoMove||{})[monday];
  const v=o!=null?+o:+plan.plyoDow;
  return (v>=0&&v<=6)?v:3;
}
function plyoMoved(monday){ return (plan.plyoMove||{})[monday]!=null }
/* One session a week or two.

   The plyo program this app follows says once a week, so two is the app's own addition
   and labelled as such wherever it appears. The case for it: the governing rule of the
   whole thing is that every rep is near-maximal, and fatigue builds inside a session
   long before it builds across a week. Half the contacts twice over is the same weekly
   work with fresher reps in it.

   The case against is tendon load, which is what the pull-back list is really about, and
   two landing days a week is two days of it. So the split halves the volume rather than
   doubling it — the week's contact target is unchanged and each session carries half. */
function plyoPerWeek(){ return +plan.plyoPerWeek===2?2:1 }
function plyoShare(){ return plyoPerWeek()===2?0.5:1 }
function plyoDow2(){
  const raw=plan.plyoDow2;
  if(raw==null||raw==='') return (plyoDowDefault()+3)%7;   // 72 hours on from the first
  const v=+raw; return (v>=0&&v<=6)?v:(plyoDowDefault()+3)%7;
}
// How far apart two days are on a seven-day loop, which is what decides whether the
// second session has had time to recover from the first.
function plyoGap(a,b){ const d=Math.abs(a-b); return Math.min(d,7-d) }
function plyoDowDefault(){ const v=+plan.plyoDow; return (v>=0&&v<=6)?v:3 }
// Every weekday this week has plyos on, first session first.
function plyoDows(monday){
  const a=[plyoDow(monday)];
  if(plyoPerWeek()===2&&plyoDow2()!==a[0]) a.push(plyoDow2());
  return a.sort((x,y)=>x-y);
}
/* Picking plyo days from one row of seven.

   Both chosen days stay lit, numbered in the order the week runs them. Tapping a day
   that is already chosen does nothing — you cannot have fewer sessions than you asked
   for — and tapping a new one replaces whichever you picked longer ago, so the pair
   slides along rather than needing a "which one am I setting" control. */
function plyoPick(days,per,d){
  const cur=days.filter(v=>v>=0&&v<=6);
  if(cur.includes(d)) return cur.slice();
  if(per!==2) return [d];
  return cur.length<2?[...cur,d]:[cur[1],d];
}
// Plyos are not part of a session, so they move on their own. Picking a day for one week
// overrides the usual day for that week only; picking the usual day again clears it.
// Weeks that have gone by are left alone, and so are days already past in this week.
function plyoDayOpen(monday,d){
  const t=realToday(), curMon=mondayOf(t);
  if(monday<curMon) return false;
  if(monday===curMon&&d<dow(t)) return false;
  return true;
}
function setPlyoDay(monday,d){
  d=+d; if(!(d>=0&&d<=6)) return false;
  if(!weekHasPlyo(weekOf(monday))) return false;
  if(!plyoDayOpen(monday,d)) return false;
  mutatePlan(p=>{
    const m=Object.assign({},p.plyoMove||{});
    if(d===(+p.plyoDow>=0&&+p.plyoDow<=6?+p.plyoDow:3)) delete m[monday]; else m[monday]=d;
    p.plyoMove=m;
  });
  return true;
}
/* ---------------- doing two sessions on one day ----------------
The week arranges one session per day and the Move sheet swaps them around, which cannot
express "I missed Thursday, so I will do it after Friday's lift". Tactical Barbell II is
explicit that you may: "You can also do your conditioning sessions on the same days as
your strength work. If you're doing them during the same session, do your strength work
first, and conditioning afterward."

So: `plan.stack[from] = to` moves one day's session onto another in the same week. The
day it came from reads as moved rather than missed, and the day it lands on runs the
lifting first with the conditioning after it — the order the book asks for, and the one
the ride-along already draws for Zulu + Black.

Same week only. Crossing a Monday would mean reaching into a week that may be frozen,
and the thing this is for is rescuing a session a day or two late. */
function stackMap(){ const m=plan.stack; return m&&typeof m==='object'?m:{} }
function stackTo(date){ const v=stackMap()[date]; return typeof v==='string'?v:null }
function stackFrom(date){ for(const [f,t] of Object.entries(stackMap())) if(t===date&&f!==date) return f; return null }
// What a day holds before any stacking, which is what gets moved.
function bareDay(date){ return dayPlanSlot(date,slotOf(date)) }
function stackKindOf(dp){
  const k=sessKind(dp);
  if(/^strength/.test(k)) return 'lift';
  if(k==='hic'||k==='easy'||dp.t==='se') return 'cond';
  return 'rest';
}
/* Whether these two can share a day. Returns null when they can, which is now nearly
   always: what is left here is what cannot be done rather than what is unadvisable.
   Two lifting sessions in one day used to be refused as "a different program". It is
   a warning now — see `stackWarn`. Somebody catching up a session they missed on
   Tuesday is not redesigning their programme, and telling them so was not useful. */
function stackWhyNot(from,to){
  if(!from||!to||from===to) return 'A day cannot be moved onto itself.';
  if(mondayOf(from)!==mondayOf(to)) return 'Both days have to be in the same week.';
  if(idxOf(from)<0||idxOf(to)<0) return 'That week is not part of the program.';
  if(stackTo(to)||stackFrom(to)) return `${DAYN[dow(to)]} already has a session moved onto it.`;
  if(stackFrom(from)) return `${DAYN[dow(from)]} already has another session on it.`;
  if(stackKindOf(bareDay(from))==='rest') return `${DAYN[dow(from)]} has nothing on it to move.`;
  return null;
}
/* Allowed, and worth a word. Two lifting sessions on one day is a lot of barbell work
   in one go, and the book's order — heavy first — is the thing worth saying. */
function stackWarn(from,to){
  if(stackWhyNot(from,to)) return null;
  const a=stackKindOf(bareDay(from)), b=stackKindOf(bareDay(to));
  if(a==='lift'&&b==='lift') return 'Two lifting sessions in one day is a lot of barbell work at once. Do the heavier one first and cut the accessories on the second.';
  if(a==='lift'||b==='lift') return 'Lifting goes first, then the conditioning.';
  return null;
}
function canStack(from,to){ return stackWhyNot(from,to)===null }
function setStack(from,to){
  if(!canStack(from,to)) return false;
  mutatePlan(p=>{ p.stack=Object.assign({},stackMap(),{[from]:to}) });
  return true;
}
function clearStack(from){
  if(!stackMap()[from]) return false;
  mutatePlan(p=>{ const m=Object.assign({},stackMap()); delete m[from]; p.stack=m });
  return true;
}
// The two merged, strength first. Whichever of them lifts is the base and the
// conditioning rides along on it, which is both the book's order and the shape the
// day view already knows how to draw.
function stackMerge(base,moved,from){
  const bk=stackKindOf(base), mk=stackKindOf(moved);
  const lift=bk==='lift'?base:mk==='lift'?moved:null;
  const cond=bk==='cond'?base:mk==='cond'?moved:null;
  const tag=` + ${DAYN[dow(from)]}’s`;
  if(lift&&cond){
    const o=Object.assign({},lift,{stacked:from,short:(lift.short||'Lift')+tag});
    if(cond.t==='se'){ o.ride='se'; o.circuits=cond.circuits; o.reps=cond.reps }
    else { o.ride='hic'; o.cardio=true; o.fmt=cond.fmt; if(cond.note) o.condNote=cond.note }
    return o;
  }
  // One of them was a rest day, so the other simply happens here.
  const only=bk==='rest'?moved:base;
  return Object.assign({},only,{stacked:from,short:(only.short||'Session')+(bk==='rest'?'':tag)});
}

function dayPlan(date){
  const wk=weekOf(date); if(!wk) return {t:'pre'};
  const away=stackTo(date);
  if(away) return {t:'off',movedTo:away,short:'Moved',
    note:`This session is being done on ${DAYN[dow(away)]} instead.`};
  let dp=dayPlanSlot(date,slotOf(date));
  const came=stackFrom(date);
  if(came) dp=stackMerge(dp,bareDay(came),came);
  const pn=weekHasPlyo(wk)?plyoDows(mondayOf(date)).indexOf(dow(date)):-1;
  if(pn>=0){
    // A deload halves the contacts, as the week it sits in does to everything else.
    // The label carries them too, so the week strip, the calendar feed and the CSV all
    // say which day has plyos without anyone having to open it.
    const bare=['off','pre'].includes(dp.t);
    const two=plyoDows(mondayOf(date)).length>1, nm=two?'Plyo '+(pn+1):'Plyo';
    return Object.assign({},dp,{plyo:true,plyoN:pn+1,plyoCut:dp.plyoCut||wk.kind==='deload',
      short:bare?nm:nm+'+'+(dp.short||'Session')});
  }
  return dp;
}
/* ---------- the retest planner ----------
Which lifts to test on which of a week's test days. Ours, not the book's: TB1 tests the
whole cluster in one session. Split because tired singles measure fatigue rather than
strength, and the days were sitting empty.

  - at most two lifts a day while the days allow it; three only when they do not
  - squat and deadlift never on the same day
  - the pairing the bridge week uses: squat with bench, deadlift with Lift 3
  - spare days fall between test days rather than after them, so each test day comes
    off a rest -- which is why the usual four lifts test Thursday and Saturday

Returns one list per available day, empty where nothing is tested. */
function testSplit(slots){
  const n=3+l3On().length;
  const cap=Math.max(2,Math.ceil(n/slots)), need=Math.min(slots,Math.ceil(n/cap));
  const buckets=Array.from({length:need},()=>[]);
  // Each lift looks first where it pairs, then forward, then back: so Lift 3 joins the
  // deadlift and overflows onto a later day before it crowds squat and bench.
  const at=k=>buckets.findIndex(b=>b.includes(k));
  const put=(k,from)=>{
    const idx=[...Array(need).keys()], tryOrder=idx.slice(from).concat(idx.slice(0,from));
    (tryOrder.map(i=>buckets[i]).find(x=>x.length<cap)||buckets[need-1]).push(k);
  };
  // Squat and deadlift apart by construction: squat opens the first test day, and the
  // deadlift opens the next. There are always at least two -- the cluster is never
  // under four lifts -- and a test checks it for every Lift 3 combination.
  put('squat',0); put('bench',at('squat'));
  put('dead',at('squat')+1);
  for(const k of l3On()) put(k,at('dead'));
  const out=Array.from({length:slots},()=>[]);
  buckets.forEach((b,i)=>{ out[need===1?0:Math.round(i*(slots-1)/(need-1))]=b });
  return out;
}
function dayPlanSlot(date,d){
  const wk=weekOf(date); if(!wk) return {t:'pre'};
  const SBP=['squat','bench',l3For(date)], SBD=['squat','bench','dead'];
  if(wk.kind==='cycle') return composeSlot(date,wk,d);
  if(wk.kind==='deload') return [
    {t:'lift',deload:true,lifts:SBP,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS'},
    {t:'lift',deload:true,lifts:SBP,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS'},
    {t:'lift',deload:true,lifts:SBD,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS',note:'Optional. Take it off if you feel flat.'},
    {t:'off',short:'Off'}][d];
  if(wk.kind==='test') return [
    {t:'hic',fmt:'liss',short:'Easy',note:'Easy day. 20–30 min of conversational cardio.'},
    {t:'off',short:'Mobility',note:'Easy day. Mobility only: the warm-up hip and t-spine work. No cardio — the two heavy test days are what this week is for.'},
    {t:'hic',fmt:'liss',short:'Easy',note:'Easy day. 20–30 min of conversational cardio.'},
    // Thursday to Saturday, split by testSplit: jumps on the first test day, the pull-up
    // test and the button that applies the results on the last.
    ...(()=>{const sp=testSplit(3);return sp.map((L,i)=>L.length?Object.assign({t:'test',lifts:L,short:'Test'},i===0?{jumps:true}:{},i===2?{pullups:true,apply:true}:{}):{t:'off',short:'Off'})})(),
    {t:'off',short:'Off'}][d];
  if(wk.kind==='bb'){
    const row=bbRow(wk)[d]||['rest'], k=row[0];
    if(k==='se') return {t:'se',circuits:row[1],reps:row[2],pct:row[3]||null,short:'SE '+row[1]+'×'+row[2]};
    if(k==='e') return {t:'hic',fmt:'liss',eMin:row[1],eMax:row[2]||row[1],short:'E '+row[1]+(row[2]?'–'+row[2]:'')+'m',
      note:wk.ver==='mass'?'Thirty minutes, and the book means it — no more, no less. Low intensity throughout: the talk test, or 120 to 150 bpm. No intervals, no sprints, no going fast. Anything continuous counts, so walk or ride if thirty minutes of running is a lot.':d===5?'The long one. You have a recovery day behind you and a rest day ahead, so push the duration — a long ruck, a longer run than you have done, or one of the fun-runs.':'Minimum 30 minutes, conversational. Run-walk-run is fine and still aerobic.'};
    if(k==='hic') return {t:'hic',fmt:(plan.bbHic||{})[monAdd(wk.monday,d)]||'map',bbHic:true,short:'HIC',
      note:'Weeks 6–8 use the aerobic-leaning HIC sessions only. Keep off the purely lactic ones: you cannot build the aerobic and lactic systems at once.'};
    if(k==='ms') return {t:'lift',lifts:d===0?['squat','bench',l3For(date)]:['squat','bench','dead'],bbLift:true,short:'Strength',
      note:'Two strength days a week this block, kept spartan. Two or three compounds, no assistance work.'};
    if(k==='rec') return {t:'off',recovery:true,short:'Recovery',
      note:'Movement drills, mobility, an easy swim or bike, a walk, yoga, a massage. Or nothing. If you are still raring to go, one easy E session or half an SE circuit is allowed.'};
    return {t:'off',short:'Rest',note:'Complete rest. No structured training. Walking, a casual swim or pick-up sport is fine.'};
  }
  /* Tactical Barbell III's Bridge Week: a week off between blocks, which the book also
     calls deloading. Light activity only -- walking, hiking, an easy swim, yoga,
     stretching, easy bodyweight circuits -- and no weights, HIC or E. Testing is
     optional and goes on day 4, day 5 or both; "if no 1RM testing is required then Test
     Days become Rest Days", so the app offers those days rather than imposing them. The
     book asks for one every two to three months whether you feel like it or not.

     Not to be confused with the app's own bridge week above, which is a calibration
     week at the very start and is ours, not the book's. */
  /* Ageless Athlete's recovery week, the "1" in 3-1-3-1. The book is specific about
     what it is: "I do stay entirely away from barbells and HIC during recovery weeks.
     That is the key to recharging the CNS, joints, hormones, etc." Not an off week
     though -- "no more than two workouts that week, plus any other activities you
     might have, and remember to keep the workouts easy", plus as much mobility as you
     like. Two easy sessions, spread out, and nothing else scheduled. */
  if(wk.kind==='recovery'){
    const easy=n0=>({t:'hic',fmt:'liss',recovery:true,short:'Easy',note:n0});
    const a='One of your two sessions this week, and it is meant to be easy. An LSS session, a grip circuit, core work, strength-endurance, general conditioning — something you do not normally get to. No barbells and no HIC: staying off those is the whole point of the week.';
    const b='The second and last session. Easy again. Anything you already do — a class, a roll, a game — counts on top of these two and does not need to come out.';
    const off=n0=>({t:'off',recovery:true,short:'Recovery',note:n0});
    const rest='Nothing scheduled. Mobility and stretching as much as you like, and that is the best use of this week beyond the two easy sessions.';
    return [easy(a),off(rest),off(rest),easy(b),off(rest),off(rest),
      {t:'off',recovery:true,short:'Off',note:'Complete rest. Next week the barbells come back.'}][d];
  }
  if(wk.kind==='bridge3'){
    const ease='Light activity only. Walking, hiking, an easy swim, yoga, stretching, an easy bodyweight circuit. No weights, no HIC, no E — this week is for recovering, which is when the work you have already done actually lands.';
    const light=()=>({t:'off',bridge3:true,short:'Light',note:ease});
    // Two optional test days, split the same way as a retest week.
    const sp=testSplit(2);
    return [
      light(), light(), light(),
      {t:'test',lifts:sp[0],bridge3:true,short:'Test',
        note:'Optional. Test here if the next block needs new numbers — otherwise this is another rest day. The book only asks you to test once before you start, and maybe again before your first Specificity block.'},
      {t:'test',lifts:sp[1],apply:true,bridge3:true,short:'Test',
        note:'Optional, the same as day 4. Testing both days is fine, and so is testing neither.'},
      light(),
      {t:'off',bridge3:true,short:'Rest',note:'Complete rest.'},
    ][d];
  }
  if(wk.kind==='bridge') return [
    {t:'off',short:'—',note:'Bridge week starts Tuesday.'},
    {t:'rm5',lifts:['squat','bench'],short:'5RM'},
    {t:'hic',fmt:'map',baseline:true,short:'HIC',note:'Baseline: 8 × 1 min. Record total calories.'},
    {t:'plyobase',short:'Jumps'},
    {t:'rm5',lifts:['dead',l3On()[0]],short:'5RM'},
    l3On().length>1?(()=>{const rest=l3On().slice(1);return {t:'rm5',lifts:rest,cardio:true,fmt:'liss',short:'5RM+Spin',note:rest.length>1?'Test these first — two lifts per day keeps the numbers honest — then ride easy for 30–40 min.':'Test the '+liftName(rest[0]).toLowerCase()+' first — it is on its own day so the number is honest — then ride easy for 30–40 min.'}})():{t:'hic',fmt:'liss',short:'Easy',note:'30–40 min easy cardio.'},
    {t:'convert',short:'Maxes'}][d];
  if(wk.kind==='travel') return [
    {t:'travel',slot:'day1',short:'Travel 1'},
    {t:'hic',fmt:'map',short:'HIC'},
    {t:'travel',slot:'day2',short:'Travel 2'},
    {t:'hic',fmt:'anaerobic',short:'HIC'},
    {t:'travel',slot:'day3',short:'Travel 3'},
    {t:'hic',fmt:'threshold',short:'HIC',note:'Swap to LISS or a walk if the week has been long.'},
    {t:'off',short:'Off'}][d];
  return {t:'off',short:'Off',note:'Off week. Walk, sleep, eat. The plan resumes next Monday.'};
}
// The block's row for a week, after the strength-first swap if that version is running.
function bbLen(ver){ return BB_LEN[ver||'standard']||8 }
function bbRow(wk){
  const ver=wk.ver||'standard', clamp=t=>t[Math.min(Math.max((wk.w||1)-1,0),t.length-1)];
  if(ver==='mass') return clamp(BB_MASS);
  const base=clamp(BB_WEEKS);
  if(ver!=='strength') return base;
  const r=BB_SF_SE[Math.min(Math.max((wk.w||6)-6,0),BB_SF_SE.length-1)];
  return base.map((x,i)=>x[0]==='se'?['ms']:x[0]==='ms'?['se',i===0?r[0]:2,r[1]]:x);
}
/* Ageless Athlete's alternative to a test week: "Consider testing within the block by
   doing either a heavy-ish single > 95% or a rep max on the last day of your strength
   block before a recovery week." True only on the last lifting day of a training week
   that a recovery week follows. */
function inBlockCheck(date){
  if(!plan.recovery313) return false;
  const wk=weekOf(date);
  if(!wk||wk.kind!=='cycle') return false;
  const next=weekOf(addDays(wk.monday,7));
  if(!next||next.kind!=='recovery') return false;
  let last=-1;
  for(let i=0;i<7;i++){ const p=dayPlanSlot(addDays(wk.monday,i),i); if(p.t==='lift'&&(p.lifts||[]).length) last=i }
  return last>=0&&addDays(wk.monday,last)===date;
}
function weekTitle(wk){
  if(!wk) return 'Before start';
  if(wk.kind==='cycle'){const v=wkRx(wk);return {t:'Cycle '+wk.cycle+' · Week '+wk.w,chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:tier(+v.p)}}
  if(wk.kind==='deload'){const v=wkRx(wk);return {t:'Deload week',chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:'light'}}
  if(wk.kind==='test') return {t:'Retest week',chip:'Heavy singles',cls:'heavy'};
  if(wk.kind==='bb'){
    const r=bbRow(wk), se=r.filter(x=>x[0]==='se').length, ms=r.filter(x=>x[0]==='ms').length;
    return {t:'Base Building · Week '+wk.w+' of '+bbLen(wk.ver),chip:ms?'Strength + HIC':'SE + endurance',cls:ms?'mid':'light'};
  }
  if(wk.kind==='bridge') return {t:'Bridge week',chip:'Calibration',cls:'blue'};
  if(wk.kind==='bridge3') return {t:'Bridge week · TB III',chip:'A week off',cls:'light'};
  if(wk.kind==='recovery') return {t:'Recovery week',chip:'No barbells, no HIC',cls:'light'};
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
function metricFor(mod,fmt){
  if(HIC[fmt]&&HIC[fmt].noMetric)return null;
  const M=MOD[mod], m=M&&M[fmt==='liss'?'liss':'hic'];
  if(!m)return null;
  let un=m[1];
  // Symmetric, so a distance can be declared in either system and still follow the
  // setting. Without the imperial half, anything written in meters was simply stuck
  // there and `fixedUnit` protected nothing.
  if(!M.fixedUnit){
    if(u()==='kg'){ if(un==='mi')un='km'; if(un==='yd')un='m' }
    else { if(un==='km')un='mi'; if(un==='m')un='yd' }
  }
  return [m[0],un];
}
function metricLabel(met){return met[0]==='cal'?'Total calories':met[0]==='watts'?'Average watts':met[0]==='floors'?'Floors':'Distance ('+met[1]+')'}
// Conditioning results. `all` spans every program (for "last/best" comparisons);
// otherwise only the program on screen.
// Distance plus what the climbing was worth, for sessions logged in miles or km.
function flatEquiv(x){
  if(!x||x.elev==null||x.elev===''||!(+x.v>0)) return null;
  if(x.u!=='mi'&&x.u!=='km') return null;
  const per=elevPerDist(); if(!(per>0)) return null;
  const v=+x.v+(+x.elev)/per;
  return Math.abs(v-+x.v)<0.05?null:Math.round(v*10)/10;
}
/** What to rank a session by: flat-equivalent where climbing applies, else the raw result. */
function hicValue(x){const fe=flatEquiv(x);return fe!=null?fe:(x?+x.v:null)}
function hicSessions(all){
  const out=[];
  for(const [d,L] of Object.entries(logs)){
    if(!L.hic||(!all&&!inProgram(d))) continue; const f=effFmt(d); if(!f) continue;
    const mod=modOf(d), met=metricFor(mod,f), v=met?L.hic[met[0]]:null;
    if((v!=null&&v!=='')||(f==='liss'&&L.hic.min)||((HIC[f]||{}).noMetric&&(L.hic.min||L.hic.rounds))||(mod==='other'&&L.hic.what)) out.push({d,f,mod,v:v!=null&&v!==''?+v:null,u:met?met[1]:'',min:L.hic.min,what:L.hic.what,load:L.hic.load,elev:L.hic.elev});
  }
  return out.sort((a,b)=>a.d<b.d?-1:1);
}
