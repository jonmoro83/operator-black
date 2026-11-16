/* ---------- choosing a program, and a cluster, by the books ----------
The books say who each template and protocol is for, and this turns that into a pick
with its reasons. The rules are the books'; where a case falls between them the call is
ours and the reason says so. Nothing here changes the plan: callers show the pick and
let the person take it, change it, or leave it.

Pages are the library's (`library/*.txt`), the same numbers the coach cites. */

// What you have to train with. `kit` on a session is everything it needs; a session
// with an empty list runs on nothing at all, and the app's own interval shapes and LISS
// run on whatever tool you already use, so they have no entry here and never need one.
const KIT={
  run:'Room to run',hill:'A hill',machine:'Bike, rower or treadmill',kb:'Kettlebell',bag:'Heavy bag',
  sledge:'Sledgehammer and tire',rope:'Jump rope',bar:'Pull-up bar',dip:'Dip station',barbell:'Barbell',
  box:'Box',ruck:'Ruck or vest',sandbag:'Sandbag',backext:'Back extension',climb:'Climbing rope',
};
// From each session's `gear`, the TB II #1–36 and every MTI session that is not power.
// Where the book offers a swap (#6's push press, #19's dumbbell) the tag is the main
// version's. A test holds this to the catalog, so a new session cannot go untagged.
const HIC_KIT={
  connaught:['run'],fast5:['run'],resets600:['run'],bagresets:['bag'],indoorpower:['machine'],
  sledgedrill:['sledge','rope'],boo:['kb','run'],boo2:['run'],shorthills:['hill'],oxygendebt:['run'],
  seladder:['run'],meateater:['kb','run'],meateater2:['kb'],disarmed:['bag'],stdhills:['hill'],
  apex:['kb','hill'],bloodylungs:['hill'],bloodylungs2:['kb','hill'],anaerobiccap:['run'],
  pepperpot:['ruck','run'],buffalo:['kb','run'],meateater3:['kb','run'],trinity:['kb','bag'],
  gc1:[],gc2:['bar'],gc3:['dip'],gc4:['bar','kb','run'],gc5:['dip','bar'],gc6:['sledge'],gc7:['run'],
  gc8:['kb','box','bar','dip'],gc9:['bar','run'],gc10:['run'],gc11:['run','sledge'],gc12:['barbell','backext','bar'],
  m40:['run'],m40d:['run'],msui:['run'],m300:['run'],m150:['run'],mp2s:['run'],mbeep:['run'],mfix:['run'],
  mtjt:['box'],m555:['barbell'],m1010:['run','sandbag'],mamrap:['barbell','run'],mhinge:['barbell','box'],
  mmtn:['ruck','box','run','climb'],mvest:['barbell','ruck','run'],mrr15:['ruck'],
  mz2:['run'],m21:['ruck'],predator:['run'],
};
// Your main conditioning tool says something about what you have, so a person who
// never fills in the kit list still gets sessions they can do.
const MOD_KIT={echo:['machine'],rower:['machine'],ski:['machine'],stair:['machine'],cycle:['machine'],
  run:['run'],trail:['run','hill'],hike:['run','hill'],hill:['run','hill'],ruck:['ruck','run']};
function kitHave(){
  if(Array.isArray(plan.kit)) return plan.kit.filter(k=>KIT[k]);
  return MOD_KIT[defMod()]||[];
}
function kitOk(f,kit){ const k=HIC_KIT[f]; return !!k&&k.every(x=>kit.includes(x)) }

/* A starting cluster for Black. The book's preferred way (TB II p187): two or three
   HICs and an E, each kept until you can do its Advanced version. Mixed, aerobic/
   anaerobic and general conditioning both (p112). Most from #1–36, with power only
   sprinkled in (p164), so power is never one of the three. Ours, and labeled: which
   sessions win when several fit. Ones with an Advanced version come first, because the
   book's swap rule needs one; then the ones that use your goal's kit; then the book's
   own before MTI's, and the book's by number. */
const KIT_TILT={combat:['bag','sledge'],endurance:['run','ruck','hill']};
function recommendCluster(o){
  o=o||{};
  const kit=o.kit||kitHave(), tilt=KIT_TILT[o.goal]||[], n=o.n===2?2:3, why=[];
  const score=f=>{ const b=HIC[f].book||{}, k=HIC_KIT[f];
    return (b.advanced?40:0)+k.filter(x=>tilt.includes(x)).length*20+(b.n?10:0)+k.length };
  const pool=c=>Object.keys(HIC_KIT).filter(f=>HIC[f]&&hicTbCat(f)===c&&kitOk(f,kit))
    .map((f,i)=>[f,score(f),(HIC[f].book||{}).n||99,i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]||a[3]-b[3]).map(x=>x[0]);
  const aa=pool('AA'), gc=pool('GC'), fs=[];
  // #25, Beat Your Face, needs only a floor, so there is always a general conditioning
  // session. There is not always an aerobic/anaerobic one: with no running room and no
  // kit, MAP stands in, because it runs on whatever tool you have.
  fs.push(aa[0]||'map'); if(gc[0]) fs.push(gc[0]);
  if(n===3){ const rest=[...aa.slice(1),...gc.slice(1)].sort((a,b)=>score(b)-score(a)); fs.push(rest[0]||(fs.includes('anaerobic')?'threshold':'anaerobic')) }
  why.push(['Two or three HICs and an E session, each kept in rotation until you can do its Advanced version, then swapped for a new one.','TB II p187']);
  why.push(['Aerobic/anaerobic and general conditioning both. The book asks you to avoid doing only one kind.','TB II p112']);
  why.push(['Nothing from power development (#37–40): the book wants most HICs from #1–36, with power sprinkled in.','TB II p164']);
  if(!aa.length) why.push(['None of the aerobic/anaerobic sessions fit your kit, so MAP stands in. It runs on whatever tool you use.','ours']);
  if(tilt.length) why.push([o.goal==='combat'?'Bag and sledge sessions first, for a fighter.':'Running, rucking and hill sessions first, for an endurance goal.','ours']);
  why.push(['Only sessions you have the kit for. Among those, ones with an Advanced version come first, so the book’s swap rule has something to aim at.','ours']);
  // E: "Repeat one or two E sessions you like" (p85). LISS runs on any tool; a runner
  // or a rucker gets the steady session made for that.
  const e=o.goal==='endurance'&&kit.includes('ruck')?'m21':kit.includes('run')&&!kit.includes('machine')?'mz2':'liss';
  why.push(['One E session you can repeat. Variety matters less there.','TB II p85']);
  return {fs,e,why};
}

/* ---------- the program ----------
The answers, all optional:
  cond     false for no conditioning at all
  goal     'general' | 'endurance' | 'size' | 'minimal'
  days     lifting days a week you can give it, 2 to 4
  other    hard training of another kind (a fight gym, a sport, skills work)
  exp      'new' | 'some' | 'advanced'
  bench, squat   current maxes, in the plan's unit, for TB I's definition of a beginner
  older    40 or past it
  barbell  false when there is no barbell to be had
  bbDone   Base Building already done
  eWeek    E sessions a week you need
Returns {picks, alts, notes}. Usually one pick; two when the books leave a real choice,
each with its own reasons. A pick is {stempl, cproto, bb, path, why}: `bb` is the Base
Building version to start with or '' for none, `path` is a progression to follow
across programs ('tb1beg', TB I's beginner path) or ''. */
const LB_PER_KG=2.2046;
function inLb(v){ v=+v; return v>0?(u()==='kg'?v*LB_PER_KG:v):null }
// TB I p29: a beginner, for this purpose, benches under 200 lb and squats under 300.
function tb1Beginner(a){
  if(a.exp==='new') return true;
  const b=inLb(a.bench), s=inLb(a.squat);
  return a.exp!=='advanced'&&b!=null&&s!=null&&b<200&&s<300;
}
function recommendProgram(a){
  a=a||{};
  const picks=[], alts=[], notes=[], days=+a.days||3;
  const pick=(stempl,cproto,why,o)=>Object.assign({stempl,cproto,bb:'',path:'',why},o||{});
  const bb=ver=>a.bbDone||a.cond===false?'':ver;
  const bbWhy=['Base Building first. Everyone goes through it, whatever the end goal.','TB II p19'];

  if(a.barbell===false){
    picks.push(pick(null,'greense',[['No barbell: Green’s Progressive SE is the book’s variation for when you have no equipment.','TB II p73']],{bb:''}));
    notes.push(['It is a block, not a way of life: the book says not to run it past nine weeks without a break.','TB II p73']);
    return {picks,alts,notes};
  }
  if(a.goal==='run'){
    // Neither book has a running program; MTI's is the one with a published shape, and
    // its entry week is by level. Alongside lifting it starts at week 6 (04f-run.js).
    const why=[['MTI’s Running Improvement Plan: tests at 1.5, 3 and 6 miles, repeats and easy distance runs paced from your own times.',RUN_SRC],
      ['Alongside lifting, MTI starts it at week 6 and drops its own strength days: Fighter’s two take their place.',RUN_SRC]];
    picks.push(pick('fighter','mtirun',why,{runFrom:6}));
    alts.push(pick('fighter','mtirun',[['New to running: from week 1, starting with a 1.5-mile test. Walk-run it if you must.',RUN_SRC],['A walk-run start is fine: TB II says the same of its easy sessions.','TB II p89']],{runFrom:1}));
    alts.push(pick('fighter','mtirun',[['An experienced runner wanting to be pushed: from week 11, the 6-mile test and 2-mile repeats.',RUN_SRC]],{runFrom:11}));
    return {picks,alts,notes};
  }
  if(a.goal==='size'){
    // TB III p129: Base Building, then General Mass with Green, a bridge week, then
    // Specificity with Black. The template follows the days you have (p34–35).
    const why=[['Mass Protocol is for those who put hypertrophy and maximal strength first.','TB III p31'],
      ['General Mass comes first, with Green’s easy sessions alongside it. Specificity and Black come after.','TB III p129']];
    if(a.cond===false) why.push(['You asked for no conditioning. The book keeps a little, chosen not to work against growth.','TB III p16']);
    if(!a.bbDone) why.push(['Six weeks of Base Building before General Mass.','TB III p129']);
    const cp=a.cond===false?'none':'massgreen';
    if(days>=4) picks.push(pick('mass',cp,[...why,['Four days: the Mass Template, built around four lifts and frequency.','TB III p34']],{bb:bb('mass')}));
    else if(days===3){
      picks.push(pick('greyman',cp,[...why,['Three days: Grey Man, a favorite with clients balancing three days of lifting with three of conditioning.','TB III p35']],{bb:bb('mass')}));
      alts.push(pick('fighterht',cp,[['Fighter HT if you like simple approaches and can’t spend all your time in the gym.','TB III p35']]));
    } else picks.push(pick('fighterht',cp,[...why,['Fighter HT is the minimalist mass builder. It runs over three days; no General Mass template runs on two.','TB III p35']],{bb:bb('mass')}));
    alts.push(pick('operator',cp,[['The OMS rotation: Operator, Mass and Specificity blocks in turn, for strength and size long term.','TB III p126']],{oms:true}));
  } else {
    let cp='black';
    const why=[];
    if(a.cond===false){ cp='none' }
    else if(a.goal==='endurance'||(+a.eWeek||0)>2){
      cp='green';
      why.push(a.goal==='endurance'
        ?['Green is for endurance athletes and anyone heading to selection, an adventure race or an expedition.','TB II p69']
        :['More than two E sessions a week is more than Black is built for. The book says consider Green.','TB II p66']);
    } else why.push(['Most people belong on Black: strong, well-rounded and highly conditioned, with endurance kept ticking over.','TB II p19']);
    if(cp!=='none'&&!a.bbDone) why.push(bbWhy);
    const B=bb('standard');
    if(cp==='green'){
      picks.push(pick('fighter',cp,[...why,['Fighter is the book’s recommendation for Green’s strength days. If you want more than two, Green may not suit you.','TB II p71']],{bb:B}));
    } else if(tb1Beginner(a)){
      // Both, by request: the book's own path and ours, each said plainly.
      picks.push(pick('operator',cp,[...why,['TB I’s path for beginners: Operator, retesting every 9 weeks, until your bench reaches 260 lb and your squat 300, or sessions run past an hour. Then Zulu.','TB I p29'],['It works from a tested max, so it starts with a week of testing.','TB I p29']],{bb:B,path:'tb1beg'}));
      picks.push(pick('strong5',cp,[...why,['StrongLifts 5×5 needs no max at all. The weight goes up every session you finish. For someone who has never trained with a barbell.','ours']],{bb:B}));
    } else if(days<=2||a.other||a.goal==='minimal'){
      picks.push(pick('fighter',cp,[...why,[a.other?'Fighter, two days a week, because your other training takes energy too. The book’s own example is a boxer.':'Fighter: two days a week, for when time is short.','TB I p52']],{bb:B}));
    } else if(days>=4){
      picks.push(pick('zulu',cp,[...why,['Zulu is the main template, recommended for everyone not in a specialist category.','TB I p31']],{bb:B}));
    } else {
      const w=[...why,['Three days: Operator, the minimalist way to get strong fast on two or three lifts.','TB I p31']];
      if(a.exp==='advanced') w.push(['Operator is not the best template once you are already very strong. Zulu, if you can find a fourth day.','TB I p31']);
      picks.push(pick('operator',cp,w,{bb:B}));
      alts.push(pick('zulu',cp,[['Zulu, the book’s main template, if you can give it four days.','TB I p31']]));
    }
  }
  if(a.older){
    notes.push(['Past forty, the book does not change the program. It trains off a training max and takes a recovery week after every three: the Ageless Athlete preset in Setup sets both.','Ageless Athlete p28, p140']);
    if(picks[0].stempl&&a.goal!=='size') alts.push(pick('warhorse',picks[0].cproto,[['Old Warhorse: four blocks that start light and build, from the same book.','Ageless Athlete p143']]));
  }
  return {picks,alts,notes};
}

/* What comes after the program you are on. The books' sequences where they give one,
   and otherwise TB I's advice to keep a cluster for at least two blocks (p49), which
   means running the same template again with new maxes. `cur` is the program as it
   stands: {stempl, cproto, path}. `maxes` are the ones the next program would start on. */
function nextProgram(cur,maxes){
  const T=cur.stempl, P=cur.cproto, m=maxes||{};
  if(P==='greense') return {stempl:T,cproto:'green',why:[['Progressive SE is a block. After nine weeks, bring back maximal strength: Green standard or Black, for four to six weeks.','TB II p74']]};
  if(cur.path==='tb1beg'&&T==='operator'){
    const b=inLb(m.bench), s=inLb(m.squat);
    if(b!=null&&s!=null&&b>=260&&s>=300) return {stempl:'zulu',cproto:P,path:'',why:[['Your bench has reached 260 lb and your squat 300: time to move to Zulu, as the beginner path says.','TB I p29']]};
    return {stempl:'operator',cproto:P,path:'tb1beg',why:[['Another block of Operator. The beginner path moves you to Zulu at a 260 lb bench and a 300 lb squat, or when sessions run past an hour.','TB I p29']]};
  }
  if(P==='mtirun') return {stempl:T==='fighter'?'operator':T,cproto:'black',why:[['MTI’s plan is done. Back to Black and three lifting days; your running carries on as its HIC and E sessions.','ours']]};
  if(MASS_TEMPLATES.includes(T)) return {stempl:'specalpha',cproto:'massblack',why:[['After General Mass, a bridge week, then Specificity with Black.','TB III p129'],['Alpha keeps maximal strength in the mix; Bravo is pure hypertrophy.','TB III p35']]};
  if(T==='specalpha'||T==='specbravo') return {stempl:'mass',cproto:'massgreen',why:[['Reassess and plan the next cycle: back to General Mass, the meat and potatoes.','TB III p129']]};
  return {stempl:T,cproto:P,why:[['The same again with new maxes. The book recommends keeping a cluster for at least two blocks.','TB I p49']]};
}

// Setup's kit list. The first tap starts from what your main tool implied, so ticking
// a kettlebell does not quietly drop the bike the app had already assumed.
function kitToggle(k){
  if(!KIT[k]) return false;
  mutatePlan(p=>{ const cur=kitHave(); p.kit=cur.includes(k)?cur.filter(x=>x!==k):[...cur,k] });
  return true;
}
// Taking the suggestion: the cluster and the E, each marked as joining today, which is
// where the Advanced-then-swap rule starts counting from.
function useClusterSuggestion(s){
  s=s||recommendCluster();
  const t=todayStr();
  mutatePlan(p=>{ p.hicCluster=s.fs.map(f=>({f,since:t})); p.hicE=s.e });
}

/* ---------- the chooser ----------
One sheet of questions, each preset to the commonest answer, with the pick following
as you tap: the layout the user chose from the prototype (2026-11-15). `chz` is the
chooser that is open, and `ctx` is where it was opened and so what taking a pick does:
  wz      the welcome setup: fills in its Program step
  next    Programs, what follows this one: lines it up
  warn    Programs, a change asked for with weeks still to run: the books' reasons first
  reason  what has changed, and the program the books have for it
  now     Programs, a change now: opens the new-program form with the pick
`full` shows the whole sheet where a context starts with something shorter. */
const CHZ_Q=[
  {k:'cond',q:'Conditioning',opts:[['yes','Schedule it'],['no','Lifting only']]},
  {k:'goal',q:'What matters most',opts:[['general','All-round'],['endurance','Endurance'],['run','Running'],['size','Size'],['minimal','Least time']]},
  {k:'days',q:'Lifting days a week',opts:[['2','2'],['3','3'],['4','4']]},
  {k:'other',q:'Something else hard: a fight gym, a sport',opts:[['no','No'],['yes','Yes']]},
  {k:'exp',q:'Barbell experience',opts:[['new','Little or none'],['some','Some'],['advanced','A lot']]},
  {k:'barbell',q:'A barbell to train with',opts:[['yes','Yes'],['no','No']]},
  {k:'bb',q:'Base Building done',opts:[['no','Not yet'],['yes','Yes']]},
  {k:'older',q:'40 or older',opts:[['no','No'],['yes','Yes']]},
];
const CHZ_DEF={cond:'yes',goal:'general',days:'3',other:'no',exp:'some',barbell:'yes',bb:'no',older:'no'};
let chz=null;
// Last time's answers come back, so running it again is a matter of changing one.
function chzOpen(ctx){
  const saved=((plan.programGoals||{}).chooser)||{}, a=Object.assign({},CHZ_DEF);
  for(const q of CHZ_Q) if(q.opts.some(o=>o[0]===saved[q.k])) a[q.k]=saved[q.k];
  return chz={ctx,a,full:ctx!=='next',used:null,reason:null,start:null,
    aim:((plan.programGoals||{}).aim)||'',from:{},mine:{},fill:null,manual:false};
}
/* Filling the answers in from a goal in your own words (step 5; the prototype's "C on
   top of B", 2026-11-15). The coach only sorts the words into answers, each quoting
   what it came from (POST /api/coach/fill); recommendProgram still makes the pick.
   An answer you tap afterwards is yours, and a later fill leaves it alone. */
function chzCoachOn(){ coachLoad(); return !!(coach.configured&&!(coach.cap&&coach.used>=coach.cap)) }
function chzFill(){
  if(!chz||chz.fill&&chz.fill.busy) return false;
  const aim=String(chz.aim||'').trim(); if(!aim) return false;
  chz.fill={busy:true}; render();
  api('POST','/coach/fill',{aim,today:realToday()})
    .then(r=>{ coach.used=r.used; chzApply(r); render() })
    .catch(e=>{ if(chz) chz.fill={err:(e&&e.message)||'That did not go through.'}; render() });
  return true;
}
function chzApply(r){
  if(!chz||!r) return false;
  chz.from={};
  for(const [k,x] of Object.entries(r.answers||{})){
    if(chz.mine[k]||!CHZ_Q.some(q=>q.k===k&&q.opts.some(o=>o[0]===x.v))) continue;
    chz.a[k]=x.v; chz.from[k]=x.quote;
  }
  chz.fill={res:r}; chz.used=null; chz.full=true;
  const aim=String(chz.aim||'').trim();
  mutatePlan(p=>{ p.programGoals=Object.assign({},p.programGoals,{aim},r.event&&r.event.date?{by:r.event.date}:{}) });
  return true;
}
/* Starting over, for answers or a goal that went in wrong (asked 2026-11-15): every
   answer back to the commonest, the goal box empty, the tags gone, and last time's
   answers forgotten so they do not come back next time. The goal in Setup goes too when
   it is the one this chooser saved; one typed there by hand is left alone. */
// Asking the coach for swaps for the pick that the bar schedules.
function chzSwapAsk(){
  if(!chz||chz.sw&&chz.sw.busy) return false;
  const pk=chzResult().picks[0], aim=String(chz.aim||(plan.programGoals||{}).aim||'').trim();
  if(!pk||!pk.cl||!aim) return false;
  const base={fs:pk.cl.fs,e:pk.cl.e};
  chz.sw={busy:true,taken:{}}; render();
  swapAsk(aim,base).then(r=>{ coach.used=r.used; if(chz) chz.sw={res:r,taken:{}}; render() })
    .catch(e=>{ if(chz) chz.sw={err:(e&&e.message)||'That did not go through.',taken:{}}; render() });
  return true;
}
function chzSwapTake(i,on){
  const s=chz&&chz.sw&&chz.sw.res&&chz.sw.res.swaps[i]; if(!s) return false;
  const t=Object.assign({},chz.sw.taken); if(on) t[s.out]=s.in; else delete t[s.out];
  chz.sw.taken=t; return true;
}
function chzReset(){
  if(!chz) return false;
  const aim=String(chz.aim||'').trim(), g=plan.programGoals||{}, mine=!!(aim&&g.aim===aim&&chz.fill&&chz.fill.res);
  if(chz.ctx==='wz'&&wz) wz.chooser=null;
  Object.assign(chz,{a:Object.assign({},CHZ_DEF),aim:'',from:{},mine:{},fill:null,manual:false,used:null,sw:null});
  mutatePlan(p=>{ const o=Object.assign({},p.programGoals); delete o.chooser; if(mine){o.aim='';o.by=''} p.programGoals=o });
  return true;
}
function chzDirty(){ return !!chz&&(!!chz.fill||String(chz.aim||'').trim()!==''||CHZ_Q.some(q=>chz.a[q.k]!==CHZ_DEF[q.k])) }
// Where an answer came from, once the goal has been read.
function chzTag(k){
  if(!chz||!chz.fill||!chz.fill.res) return null;
  if(chz.mine[k]) return {t:'You set this'};
  if(chz.from[k]) return {t:'From your goal',q:chz.from[k]};
  return {t:'Assumed'};
}
// A dated goal: the year planned back to it, with the matching goal.
const CHZ_EVENT_GOAL={race:'race',event:'event',size:'size',strength:'strength'};
function chzYear(){
  const e=chz&&chz.fill&&chz.fill.res&&chz.fill.res.event; if(!e||!CHZ_EVENT_GOAL[e.kind]) return false;
  ygOpen(); yg.goal=CHZ_EVENT_GOAL[e.kind]; yg.date=e.date; chz=null; yrAdd=null; yrSel=-1;
  return true;
}
function chzSet(k,v){
  const q=CHZ_Q.find(x=>x.k===k); if(!chz||!q||!q.opts.some(o=>o[0]===v)) return false;
  chz.a[k]=v; chz.mine[k]=true; delete chz.from[k]; chz.used=null; return true;
}
// The answers as recommendProgram reads them. In Programs there are maxes to go on,
// which is what TB I's definition of a beginner is made of.
function chzInput(a,ctx){
  const o={cond:a.cond!=='no',goal:a.goal,days:+a.days,other:a.other==='yes',exp:a.exp,barbell:a.barbell!=='no',bbDone:a.bb==='yes',older:a.older==='yes'};
  if(ctx&&ctx!=='wz'){ const m=carryMaxes(); o.bench=m.bench; o.squat=m.squat }
  return o;
}
function chzResult(){ const r=recommendProgram(chzInput(chz.a,chz.ctx));
  for(const pk of [...r.picks,...r.alts]) if(!pk.oms){ pk.cl=chzClusterFor(pk,chz.a); if(pk.cl&&chz.sw&&chz.sw.taken) pk.cl=Object.assign({},pk.cl,swapApply(pk.cl,chz.sw.taken)) }
  return Object.assign(r,{all:[...r.picks,...r.alts]}) }
/* The sessions a pick runs on, chosen with it (asked 2026-11-15: "I also want the
   chooser to choose the specific HIC and E sessions"): a cluster and an E session from
   your goal and the kit you have, by the book's rules (recommendCluster above). Black
   recommends from it each day; Green runs its E and its every-other-week HIC from it. */
const CL_PROTOS=['black','green'];
function chzClusterFor(pk,a){
  if(!pk||!CL_PROTOS.includes(pk.cproto)) return null; a=a||{};
  return recommendCluster({kit:kitHave(),goal:a.goal==='endurance'?'endurance':a.other==='yes'?'combat':''});
}
function pickName(pk){ return pk.stempl?STEMPL[pk.stempl].name:CPROTO[pk.cproto].name }
function pickLine(pk){
  const P=CPROTO[pk.cproto], cond=pk.cproto==='none'?'lifting only':pk.stempl?'with '+P.name:'';
  return [pickName(pk),cond].filter(Boolean).join(' ')+(pk.cproto==='mtirun'?' from week '+(pk.runFrom||1):'')+(pk.bb?', '+(pk.bb==='mass'?'Mass Base Building':'Base Building')+' first ('+bbLen(pk.bb)+' weeks)':'');
}
/* Taking a pick in the welcome setup. Its fields are the setup's own, so the Program
   step shows the pick selected and every step after it still applies; the path, the
   Base Building version and the answers go in with the rest on Start. */
function chzUseWz(pk){
  if(!wz||!pk||pk.oms) return false;
  if(pk.stempl) wz.stempl=pk.stempl;
  wz.cproto=pk.cproto; wz.runFrom=pk.runFrom||1; wz.bb=!!pk.bb; wz.bbVer=pk.bb||''; wz.progPath=pk.path||'';
  if(pk.path==='tb1beg') wz.test=1;
  wz.chooser=Object.assign({},chz.a); wz.cl=pk.cl||null;
  return true;
}
/* Where the program you are on naturally hands over: the Monday after its next retest,
   when the new maxes are in, or after the cycle under way if it never retests; on the
   OMS rotation, the end of its block. */
function progSwitchMonday(){
  const o=omsState(); if(o.on&&o.end) return addDays(o.end,1);
  const t=mondayOf(realToday()), i0=Math.max(0,idxOf(t)), list=weeks(i0+80);
  for(let i=i0;i<list.length;i++) if(list[i].kind==='test') return addDays(list[i].monday,7);
  for(let i=i0+1;i<list.length;i++) if(list[i].kind==='cycle'&&list[i].w===1) return list[i].monday;
  return addDays(t,7);
}
/* When a lined-up program can start: when the cycle under way ends, or at the
   handover above, after the retest. Both, by request (2026-11-15): the retest is the
   book's point to change (TB I p33), and the end of a cycle is a clean one too, at the
   cost of this block going untested. */
function progHandovers(){
  const t=mondayOf(realToday()), i0=Math.max(0,idxOf(t)), list=weeks(i0+80), out=[], cur=list[i0];
  if(cur&&cur.kind==='cycle'&&cycleWeeks()!==Infinity){
    const last=list.find(w=>w.kind==='cycle'&&w.cycle===cur.cycle&&w.w===cycleWeeks());
    if(last) out.push({k:'cycle',label:'When cycle '+cur.cycle+' ends',start:addDays(last.monday,7)});
  }
  const sw=progSwitchMonday();
  if(!out.some(h=>h.start===sw)) out.push({k:'handover',label:omsState().on?'When this OMS block ends':list.some(w=>w.kind==='test'&&w.monday<sw&&w.monday>=t)?'After the retest':'When this program ends',start:sw});
  return out.sort((a,b)=>a.start<b.start?-1:1);
}
function chzStart(){ const hs=progHandovers(); return chz&&(hs.some(h=>h.start===chz.start)||progStartOk(chz.start))?chz.start:hs[hs.length-1].start }
function progWeeksLeft(){ return Math.round((D(progSwitchMonday())-D(mondayOf(realToday())))/(7*864e5)) }
// A pick as the next program takes it: template, protocol, path, and Base Building at
// its start, after the bridge week when there is one.
function pickPatch(pk,rest){
  return next=>{
    if(pk.stempl) next.stempl=pk.stempl;
    next.cproto=pk.cproto; next.progPath=pk.path||'';
    if(pk.cproto==='mtirun') next.runFrom=pk.runFrom||1;
    if(pk.path==='tb1beg') next.testEvery=1; else if(pk.cycles) next.testEvery=pk.cycles; else if(plan.progPath==='tb1beg') next.testEvery=DEF.testEvery;
    // A week off lined up before it is the new program's first week (an Off insert).
    const s0=pk.offFirst?addDays(next.startMonday,7):next.startMonday;
    if(pk.offFirst) next.inserts=Object.assign({},next.inserts,{[next.startMonday]:'off'});
    // Its sessions, joining when it starts: where the Advanced-then-swap rule counts from.
    if(pk.cl&&pk.cl.fs){ next.hicCluster=pk.cl.fs.map(f=>({f,since:s0})); next.hicE=pk.cl.e }
    if(pk.bb){ const at=next.bridge?addDays(s0,7):s0;
      next.inserts=Object.assign({},next.inserts,{[at]:'bb'});
      if(pk.bb!=='standard') next.bbVer=Object.assign({},next.bbVer,{[at]:pk.bb}); }
    // Started from the queue: the rest of the year goes with it, and what follows is
    // pinned to start when this one ends.
    if(rest){ next.nextPrograms=rest.map(x=>Object.assign({},x));
      if(rest[0]&&!rest[0].start) next.nextPrograms[0].start=addDays(next.startMonday,((pk.offFirst?1:0)+itemWeeks(pk))*7); }
    omsRebase(next);
  };
}
function pickOf(pk){ const o={stempl:pk.stempl||null,cproto:pk.cproto,bb:pk.bb||'',path:pk.path||''}; if(pk.why&&pk.why[0]) o.why=Array.isArray(pk.why[0])?pk.why[0]:pk.why;
  if(pk.cycles) o.cycles=pk.cycles; if(pk.weeks) o.weeks=pk.weeks; if(pk.cproto==='mtirun') o.runFrom=pk.runFrom||1;
  if(pk.cl&&pk.cl.fs) o.cl={fs:pk.cl.fs.slice(),e:pk.cl.e}; return o }
// Lining one up: kept on the plan until its start, then offered.
function chzLineUp(pk){
  if(!pk||pk.oms) return false;
  const o=Object.assign(pickOf(pk),{start:chzStart()});
  // The queue is the year (04e-year.js); this replaces its first program, keeping any
  // week off lined up before it.
  const q=yrItems().map(x=>Object.assign({},x)); let i=0; while(q[i]&&q[i].off) i++;
  const st=o.start; q.splice(i,q[i]?1:0,o); q.forEach(x=>{ delete x.start }); q[0].start=st;
  mutatePlan(p=>{ p.nextPrograms=q; if(chz) p.programGoals=Object.assign({},p.programGoals,{chooser:Object.assign({},chz.a)}) });
  chz=null; chzDone={line:pickLine(pk),start:st}; return true;
}
/* Said once it is scheduled, with the way to the calendar: asked 2026-11-15, "the
   chooser is choosing but I'm not seeing it reflected on the calendar. We need an
   obvious button on the chooser to apply the scheduling". */
let chzDone=null;
// The one button: what the pinned bar does with the pick shown first.
function chzMain(){
  if(!chz) return null;
  if(chz.ctx==='next'&&!chz.full) return chzBookNext();
  const r=chzResult(); return r.picks[0]||null;
}
function chzSchedule(){
  const pk=chzMain(); if(!pk||pk.oms) return false;
  if(chz.ctx==='next') return chzLineUp(pk);
  if(chz.ctx==='add'){ const at=chz.at; yrInsert(at,pickOf(pk)); chz=null; const b=yrBlocks()[at]; chzDone=b?{line:pickLine(pk),start:b.start}:null; return true }
  if(chz.ctx==='now') return chzSwitch(pk);
  return false;
}
// Switching now: the new-program form, with the pick to start on. Its own second tap
// is the confirmation.
function chzSwitch(pk){
  if(!pk||pk.oms) return false;
  newProg={name:'Block '+((plan.programSeq||1)+1),start:addDays(mondayOf(realToday()),7),mode:'carry',pick:pickOf(pk)};
  if(chz&&chz.ctx!=='reason') mutatePlan(p=>{ p.programGoals=Object.assign({},p.programGoals,{chooser:Object.assign({},chz.a)}) });
  chz=null; return true;
}
// The next program to start: the first in the year, after any week off lined up before
// it, which then becomes its first week.
function nextQueued(){
  const q=yrItems(); let i=0; while(q[i]&&q[i].off) i++;
  return q[i]?Object.assign({},q[i],{start:q[0].start||progSwitchMonday(),offFirst:i>0,qi:i}):null;
}
function nextDue(){ const n=nextQueued(); return !!(n&&n.start&&realToday()>=addDays(n.start,-7)) }
function nextStart(){
  const n=nextQueued(); if(!n) return false;
  newProg={name:'Block '+((plan.programSeq||1)+1),start:n.start<mondayOf(realToday())?mondayOf(realToday()):n.start,mode:'carry',pick:n,queued:true};
  return true;
}
/* What has changed, and what the books have for it. A wish for variety has no program:
   the book's answer is to finish the block (TB I p49). */
const CHZ_WHY={
  back:{label:'My back needs a break',pick:()=>({stempl:'backsquat',cproto:cprotoKey(),why:[['Back Break: bench and the pull-up as usual, and one squat day a week, so the back rests and the rest of you keeps training.','Ageless Athlete ch. 12']]})},
  time:{label:'My schedule changed',pick:()=>({stempl:'fighter',cproto:cprotoKey(),why:[['Fighter: two lifting days a week, for when something else is taking the time.','TB I p52']]})},
  event:{label:'An event moved up',pick:()=>({stempl:'fighter',cproto:'green',why:[['Green for selection, a race or an expedition, with Fighter for its strength days.','TB II p69, p71']]})},
  other:{label:'I just want something different',pick:()=>null},
};
// Taking pick `i` of the sheet, in whatever way the chooser's context means.
function chzUse(i){
  if(!chz) return false;
  const pk=chzResult().all[i]; if(!pk) return false;
  if(chz.ctx==='wz'){ if(!chzUseWz(pk)) return false; chz.used=i; return true }
  if(chz.ctx==='next') return chzLineUp(pk);
  if(chz.ctx==='now') return chzSwitch(pk);
  if(chz.ctx==='add'&&!pk.oms){ const at=chz.at; yrInsert(at,pickOf(pk)); chz=null; const b=yrBlocks()[at]; chzDone=b?{line:pickLine(pk),start:b.start}:null; return true }
  return false;
}
function chzBookNext(){ return nextProgram({stempl:stemplKey(),cproto:cprotoKey(),path:plan.progPath||''},carryMaxes()) }
