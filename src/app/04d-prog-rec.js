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
    alts.push(pick('operator',cp,[['The OMS rotation: Operator, Mass and Specificity blocks in turn, for strength and size long term.','TB III p126']]));
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
