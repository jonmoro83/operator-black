/* ---------------- constants ---------------- */
// Every lift the app knows. Lift 3 is one of L3K per session (see l3For).
const LK=['squat','bench','pull','ohp','wpu','dead'];
const L3K=['pull','ohp','wpu'];
const DAYN=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PCT5={1:1,2:.95,3:.93,4:.9,5:.87,6:.85,7:.83,8:.8,9:.77,10:.75};
const HIC={
  map:{name:'MAP',sess:'8–10 × 1 min hard / 1 min easy',sys:'Max aerobic power'},
  anaerobic:{name:'Anaerobic',sess:'6–8 × 30 sec near-max / 2 min easy',sys:'Glycolytic'},
  threshold:{name:'Threshold',sess:'4 × 4 min hard / 3 min easy',sys:'Threshold / VO2'},
  long:{name:'Long HIC',sess:'5 × 3 min hard / 90 sec easy',sys:'Aerobic power'},
  liss:{name:'LISS',sess:'30–45 min conversational',sys:'Aerobic base'},
  fobbit:{name:'FOBBIT',sess:'An easy base, broken by bouts of work',sys:'Aerobic base with bursts',noMetric:true},
  /* Tactical Barbell III's own named sessions. The book is explicit that these replace
     TB II's Green and Black work while mass is the objective: "Use the sessions
     provided in this book - NOT the Green/Black training found in Tactical Barbell II."
     Green is long and easy, Black is short and hard. Walk, Ruck and Recovery Run are
     already expressible as LISS on the right activity, so only these four are new. */
  predator:{name:'Endurance Predator',sess:'A long walk, broken by all-out sprints',sys:'Aerobic base with sprints',noMetric:true},
  sprints:{name:'Anabolic Sprints',sess:'30 m flat out \u00d7 5\u201310, walk back between',sys:'Alactic power'},
  reset20:{name:'RESET-20',sess:'20 sec flat out / 2\u20135 min rest \u00d7 3\u20135',sys:'Alactic / anaerobic'},
  hillsprint:{name:'Hill Sprints',sess:'10\u201320 sec up a steep hill \u00d7 3\u201310',sys:'Alactic power'}
};
// Activities for HIC/LISS days. Each logs the measure that makes sense for it:
// [field, unit] for HIC and for LISS. Results only compare within one activity + format.
// Units follow the Setup choice: metricFor turns 'mi' into 'km' and 'yd' into 'm' on
// metric. A distance you measure yourself is written here in its imperial form so the
// conversion reaches it.
//
// `fixedUnit` opts out, for the cases where the unit is not a preference: the rower and
// ski erg read meters on their own displays whatever you prefer, and a pool is measured
// in meters. Relabelling either would be telling you something untrue about the number
// in front of you.
const MOD={
  echo:{name:'Echo bike',hic:['cal','cal'],liss:['cal','cal'],wu:'5 min easy spin, then 3 × 15 s at HIC pace with 45 s easy between.'},
  rower:{name:'Rower',hic:['cal','cal'],liss:['dist','m'],fixedUnit:true,wu:'5 min easy row, then 3 × 15 s at HIC pace with 45 s easy between.'},
  ski:{name:'Ski erg',hic:['cal','cal'],liss:['dist','m'],fixedUnit:true,wu:'5 min easy, then 3 × 15 s at HIC pace with 45 s easy between.'},
  stair:{name:'Stair machine',hic:['floors','floors'],liss:['floors','floors'],
    wu:'5 min at an easy pace, then 3 \u00d7 15 s at HIC pace with 45 s easy between.',
    tip:'Hands off the rails. Leaning takes a large share of the work off your legs and makes the number meaningless next to a session where you did not \u2014 if you need them to hold the pace, the pace is too high. A floor is not the same distance on every machine either, so results only mean something against the same one.'},
  run:{name:'Run / sprints',hic:['dist','yd'],liss:['dist','mi'],wu:'5 min jog, leg swings, then 3–4 strides building up to HIC pace.',tip:'Running adds impact. Keep hard efforts smooth (about 90%) on MAP, threshold and long intervals, and save true sprints for anaerobic days. Hills are easier on the legs than flat sprints.'},
  cycle:{name:'Cycling',hic:['watts','avg W'],liss:['dist','mi'],wu:'10 min easy spin, then 3 × 15 s at HIC pace.'},
  trail:{name:'Trail run',hic:['dist','yd'],liss:['dist','mi'],elev:true,wu:'10 min easy jog on flat ground, then 3 × 20 s hard uphill with an easy jog back down.',tip:'Uneven ground makes pace meaningless, so run the hard efforts by breathing rather than by watch. Downhills are where the damage is: that is eccentric load, and it turns up as sore quads two days later, so take them easy before a squat day.'},
  ruck:{name:'Ruck',hic:['dist','mi'],liss:['dist','mi'],load:true,elev:true,tip:'Build ruck load gradually, starting around 10–15% of bodyweight. Rucking loads the back and hips, so keep it easy before heavy squat or deadlift days.'},
  hike:{name:'Hike',hic:['dist','mi'],liss:['dist','mi'],elev:true,wu:'10 min easy walking, then 3 × 20 s hard uphill with a walk back down.',tip:'Hills do the work: on HIC days use a steep section for the hard efforts and walk down easy. On LISS days keep it conversational the whole way.'},
  hill:{name:'Hill sprints',hic:['dist','yd'],liss:null,elev:true,
    wu:'10 min easy jog on the flat, leg swings, then 2\u20133 build-ups on the hill at about half effort, walking back down each time.',
    tip:'The safest way to sprint: the incline shortens the stride and caps the top speed, so most of the hamstring risk of flat sprinting goes with it. The cost is calves and Achilles, and these are a true anaerobic effort \u2014 keep them to anaerobic days, walk down slowly as the rest, and stop when your times start slipping rather than grinding out the last few. Log the total distance run, or let the elevation stand in for it.'},
  swim:{name:'Swim',hic:['dist','m'],liss:['dist','m'],fixedUnit:true,wu:'200 easy, then 4 × 25 building to HIC pace.'},
  other:{name:'Other',hic:null,liss:null}
};

/* FOBBITs. Named for the soldier who never leaves the forward operating base: a session
   with no ground to cover and barely any kit.

   A FOBBIT is not one session, it is a shape: hold an easy aerobic base, step off it
   every so often for a bout of work, get back on. Tactical Barbell II gives one of them
   (HIC #9, kettlebell swings and snatches), Mass Protocol gives a shorter one and says
   plainly that you are not restricted to kettlebells, and the author published three
   more as Mods on tacticalbarbell.com. They disagree on every axis, so every axis here
   is data rather than a constant:

     every   seconds of base between bouts. A number, or [lo,hi] when the source gives a
             range — the timer takes the low end and the prose says the range.
     count   what the minutes measure. 'base' counts only the base, which is how TB2
             reads ("until your treadmill reads 20 minutes"); 'total' counts the whole
             session, which is how the three Mods read.
     mv      the rotation, in order, one or more movements. TB2 alternates two, Mod #1 is
             a single lift, Mod #2 and #3 cycle three.
     mins    the duration choices, and `def` the one to start on.
     bpm     the pace band the source gives, where it gives one.

   A dose is a plain string when it is reps ('20', '10 / arm', '30 m' — a label rather
   than a number, because some are per side and one is a carry). It is an object when it
   is anything else: {s} for a timed bout in seconds, {r,pct,lift} for a set at a
   percentage of a 1RM.

   The governing rule, from Part II and stated in those words: any FOBBIT over 30 minutes
   is an E session, anything under is a HIC. That is `fobIsE`, and it is why duration is
   not just cosmetic here. */
const FOB_SRC={tb2:'Tactical Barbell II',mass:'Mass Protocol',mod1:'TB article, Mod #1',mod2:'TB article, Mod #2',mod3:'TB article, Mod #3',ours:'Ours'};
const FOB_EVERY=120, FOB_HELD=30;   // default base interval; and what a held set is assumed to cost when sizing by total time
const FOBBIT={
  kb:{name:'Kettlebell',gear:'One kettlebell',src:'tb2',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Kettlebell swing','20'],['Kettlebell snatch','10 / arm']],
    note:'The original, straight out of Tactical Barbell II. Set the base a notch below a comfortable jog — if your jog is level 5, run it at 4. One or two handed swings both count, and the swing and the snatch can use different bells.'},
  massfob:{name:'Mass Protocol',gear:'One kettlebell',src:'mass',every:120,count:'base',mins:[15,20],def:20,bpm:[120,150],
    mv:[['Kettlebell swing','10']],
    note:'The Mass Protocol version: the same shape, half the swings, and fifteen to twenty minutes with no longer allowed. It is general conditioning while you are growing, so the variety matters more than the numbers.'},
  maxstrength:{name:'Maximal strength',gear:'A press you can leave loaded',src:'mod1',every:[180,300],count:'total',mins:[30,45,60],def:45,bpm:[130,150],
    mv:[['Overhead press',{r:'3',pct:[70,75],lift:'ohp'}]],
    note:'Mod #1, from a reader the author published. Thirty minutes is the floor and sixty is fine once you are used to it; it defaults to forty-five because the article puts it in the week as the day-six E session, and thirty exactly would still count as a HIC. It buys press volume while you build an aerobic base, and it is deliberately easy: you should never be unreasonably fatigued when you get to the bar. Out of breath at the station means the base is too fast; tired at the press means lengthen the base, drop the load, or both. Walking back between sets is fine. Swap the press for bench if that is the volume you want, and change it week to week.'},
  se:{name:'Strength-endurance',gear:'A pull-up bar and a floor',src:'mod2',every:120,count:'total',mins:[20,30,45,60],def:30,bpm:[130,150],
    mv:[['Push-up','10'],['Pull-up','10'],['Sit-up','10']],
    note:'Mod #2. Three movements on rotation — the ones you are tested on, if you are tested. Scale the pull-ups to what you have: one to five is fine if ten is not. Keep strength-endurance to a tenth or a fifth of the training week; weeks of it at the expense of maximal strength goes backwards, because maximal strength is what feeds it.'},
  seamrap:{name:'Strength-endurance, AMRAP',gear:'A pull-up bar and a floor',src:'mod2',every:120,count:'total',mins:[20,30,45,60],def:30,bpm:[130,150],
    mv:[['Push-up',{s:60}],['Pull-up',{s:60}],['Sit-up',{s:60}]],
    note:'Mod #2 run on the clock instead of on a count: sixty seconds of as many as you can manage, rather than a fixed ten. The bouts are timed, so unlike the rep versions they do count toward the session.'},
  combat:{name:'Combat',gear:'A bag, or room to shadow box',src:'mod3',every:[60,90],count:'total',mins:[20,30,45,60],def:30,bpm:[130,150],
    mv:[['Heavy bag',{s:[120,180]}],['Straight punches',{s:[120,180]}],['Shadow boxing',{s:[120,180]}]],
    note:'Mod #3, and the one that runs the other way round: the drill is longer than the base. If you fight, set the work and rest to your event instead. Starting out, flip it — two minutes easy, sixty to ninety seconds of work. Gloves rule out the rower for the base. It is a more specific conditioning option, not a replacement for Base Building.'},
  sledge:{name:'Sledgehammer',gear:'A sledgehammer and a tire',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Sledgehammer strike','10 / side'],['Push-up','15']],
    note:'Mass Protocol names sledgehammer and tire drills as a work interval but gives no count, so the numbers here are ours. Alternate the top hand every set or one side does all the work.'},
  pushpress:{name:'Barbell push press',gear:'A loaded barbell',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Push press','10']],
    note:'Mass Protocol names the push press as a work interval but gives no load or count, so those are ours. Keep it light enough that the base is still the hard part.'},
  sandbag:{name:'Sandbag',gear:'One sandbag',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Shoulder it, alternating sides','10'],['Bear-hug squat','15']],
    note:'Drop it to the floor between reps rather than lowering it under control — the point is to keep moving, and eccentric lowering a bag this often is what makes people sore for days.'},
  sandbagheavy:{name:'Sandbag, heavy',gear:'A bag you would not want to carry far',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Ground to shoulder','6 / side'],['Front carry','30 m']],
    note:'The heavy version. The carry is the rest, so do not put the bag down during it — if you have to, the bag is too heavy for this session rather than you being unfit.'},
  sandbagbar:{name:'Sandbag over bar',gear:'A sandbag and a bar you can fix at a height',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Sandbag over the bar','5'],['Push-up','15']],
    note:'Explosive hip extension, so it is the first thing to go when you are tired — if the back is rounding to get the bag up, the set is over. Reset the bag on the floor each rep rather than catching it on the way back, and keep the bar at the same height every session or the count means nothing against the last one.'},
  sandbagtoss:{name:'Sandbag over the shoulder',gear:'One sandbag and room behind you',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Over-the-shoulder toss','10']],
    note:'Ground to shoulder, then keep it going and throw the bag over that shoulder behind you. Turn around, pick it up off the floor, do the other side. One movement is enough here because each rep is the whole chain, hip to shoulder to release. Alternate shoulders or one side does all the work. Check what is behind you before the first rep and do not try to guide the bag down — let it land. Like the over-the-bar version it is explosive hip extension, so it is the first thing to fall apart when you are tired: if the bag is going up by rounding your back, the bout is over.'},
  bodyweight:{name:'Bodyweight',gear:'Nothing at all',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Burpee','10'],['Push-up','15']],
    note:'The one you can do in a hotel room. Nothing here is loaded, so take the base a little faster to keep it honest.'},
  db:{name:'Dumbbells',gear:'Two dumbbells',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Thruster','10'],['Renegade row','10 / side']]},
  other:{name:'Something else',gear:'',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,mv:null},
};
function defFob(){ return FOBBIT[plan.fobbit]?plan.fobbit:'kb' }
function fobOf(date){ const v=(logs[date]||{}).hic; return v&&FOBBIT[v.fob]?v.fob:defFob() }
function fobDef(id){ const F=FOBBIT[id]; return F&&F.mv&&F.mv.length?F:null }
/* The accessors below take a spec -- an object carrying every/count/mv/mins/def -- so
   that anything shaped like "hold a base, step off it for a bout" can use them. A
   FOBBIT catalog entry is one such spec; so is Endurance Predator, which lives on its
   interval-timer entry instead. The fob* wrappers are the FOBBIT-by-id versions. */
function specEvery(F){ return lo(F&&F.every)||FOB_EVERY }
function specCount(F){ return (F||{}).count==='total'?'total':'base' }
function specMinOpts(F){ return (F&&F.mins)||[15,20,30] }
function specDefMins(F){ return (F&&F.def)||20 }
function specEveryLabel(F){ return rangeLabel((F&&F.every)||FOB_EVERY,secsLabel) }
function specBouts(F,ease,what){
  if(!F||!F.mv||!F.mv.length){
    const w=String(what||'').trim().split('/').map(x=>x.trim()).filter(Boolean);
    return (w.length?w:['Burst']).map(n0=>Object.assign({name:n0},fobDose('Set',false)));
  }
  return F.mv.map(([n0,d])=>Object.assign({name:n0},fobDose(d,ease)));
}
function specRounds(F,mins){
  const ev=specEvery(F);
  if(specCount(F)==='base') return Math.max(1,Math.round(mins*60/ev));
  const bs=specBouts(F,false,'').map(b=>b.secs||FOB_HELD);
  return Math.max(1,Math.round(mins*60/(ev+bs.reduce((a,b)=>a+b,0)/bs.length)));
}
// Ranges read as [lo,hi]; the timer needs one number and takes the low end, which is the
// one that gives the session its full count of bouts.
function lo(v){ return Array.isArray(v)?v[0]:v }
function fobEvery(id){ return specEvery(FOBBIT[id]) }
function fobCount(id){ return specCount(FOBBIT[id]) }
function fobMinOpts(id){ return specMinOpts(FOBBIT[id]) }
function fobDefMins(id){ return specDefMins(FOBBIT[id]) }
/* The rule from Part II, in those words: over 30 minutes it is an E, under it is a HIC.
   So a 60-minute Mod #1 is not a hard session and must not be counted as one. */
function fobIsE(mins){ return +mins>30 }
// A dose, normalised for the timer. Reps are held — you tap Done, and they are not on
// the clock. Anything with seconds is timed and does count.
function fobDose(d,ease){
  if(d&&typeof d==='object'){
    if(d.s!=null) return {secs:lo(d.s),hold:false,reps:null,pct:null};
    // A set at a percentage of a 1RM is already three reps and deliberately easy. Halving
    // it makes it pointless rather than lighter, so the easy week shortens the session
    // instead, which it does anyway by dropping to the shortest length on offer.
    return {secs:null,hold:true,reps:d.r,pct:d.pct||null,lift:d.lift||null};
  }
  return {secs:null,hold:true,reps:ease?halveReps(d):d,pct:null,lift:null};
}
/* Halving for a low-readiness day or an easy conditioning week. It halves the leading
   count and leaves the rest, so "10 / arm" becomes "5 / arm" and "30 m" becomes "15 m",
   and a load written into the unit is not touched. Odd counts round up, because five and
   a half swings is not a thing. Timed bouts are left alone: an AMRAP is already
   self-limiting, and the easy week shortens the session instead. */
function halveReps(q){
  return String(q).replace(/^\s*(\d+)/,(m,d)=>String(Math.max(1,Math.ceil(+d/2))));
}
/* The rotation as the timer wants it: one entry per movement, cycled in order.

   `other` prescribes nothing, so it falls back to whatever was typed on the day and then
   to a neutral label — the structure still runs, it just does not tell you what to do. */
function fobBouts(id,ease,what){ return specBouts(fobDef(id),ease,what) }
// How many bouts fit. A base-counted FOBBIT divides the base by the interval; a
// total-counted one has to pay for the bouts too, and a held set is assumed to cost
// FOB_HELD seconds since nobody can know what it really takes.
function fobRounds(id,mins){ return specRounds(fobDef(id)||FOBBIT[id],mins) }
// Choosing one for a single session. Only a real difference from the default is worth
// storing as a swap, the same rule the activity picker follows.
function setFob(date,v){
  if(!FOBBIT[v]) return false;
  setLog(date,'hic.fob',v===defFob()?null:v);
  return true;
}
function secsLabel(s){ return (s>=120&&s%60===0)?(s/60)+' min':s+' s' }
function rangeLabel(v,f){ return Array.isArray(v)?f(v[0])+' to '+f(v[1]):f(v) }
// "every two minutes", "every 3 min to 5 min", "every 60 s to 90 s".
function fobEveryLabel(id){ return specEveryLabel(FOBBIT[id]) }
function doseLabel(b){
  if(b.secs!=null) return secsLabel(b.secs)+(b.secs<=60?' AMRAP':'');
  if(b.pct) return b.reps+' at '+rangeLabel(b.pct,p=>p+'%');
  return b.reps;
}
// The rotation as one line, for the day card, the Guide table and the week's record.
function boutsLine(bs){
  return (bs||[]).map((b,i)=>`${i?b.name.charAt(0).toLowerCase()+b.name.slice(1):b.name} × ${doseLabel(b)}`).join(', then ');
}
function fobLine(id,ease){ const F=fobDef(id); return F?boutsLine(fobBouts(id,ease,'')):'' }
function fobSrcLabel(id){ return FOB_SRC[(FOBBIT[id]||{}).src]||FOB_SRC.ours }
// Plyometric program and exercise library, from Plyometric_Program_Thursday.pdf.
// Contacts count ground impacts (one landing = one contact), as the program does.
/* Macro targets.

   For building, Tactical Barbell III gives a formula outright (p.108): "Multiply your
   bodyweight x 1.3 for grams of protein, and x 2 for carb. Divide your bodyweight in
   half for fat. That's it." It also says what to do when the scale stops moving: "If
   you're not putting on weight after a month or two, add another 500 calories per day
   using the same ratio."

   For losing or holding there is no formula in any of the books -- Mass Protocol is a
   mass protocol, and the others leave food alone -- so those two rows are the app's
   own and say so wherever they are shown. Protein stays high because a deficit is
   where muscle is at risk; fat has a floor rather than a target, because going very
   low is where people feel terrible; carbohydrate takes whatever calories are left,
   which is also the lever that moves when the target changes.

   Grams per pound of bodyweight. `c:null` means "fill the remainder". */
const MACRO={
  gain:    {src:'tb3',  p:1.3, c:2,    f:0.5},
  lose:    {src:'ours', p:1.1, c:null, f:0.4},
  maintain:{src:'ours', p:1.0, c:null, f:0.4},
};
const KCAL_G={p:4,c:4,f:9};
const MACRO_STEP=500;        // the book's increment when the scale will not move
function macroGoal(){ return MACRO[plan.goal]?plan.goal:'maintain' }
// Bodyweight in pounds, which is what every formula here is written in.
function bwLb(date){ const bw=bwFor(date); if(!bw) return null; return u()==='kg'?bw*2.2046:bw }
/* The calorie target the energy card already works to: your burn, moved by the goal.
   Pulled out so the macro split and that card cannot drift apart. */
function kcalTarget(date){
  const est=tdeeOn(date); if(!est) return null;
  const g=macroGoal();
  if(g==='lose') return est.tdee-Math.round(est.tdee*0.18/10)*10;
  if(g==='gain') return est.tdee+250;
  return est.tdee;
}
/* Today's grams. Building follows the book's formula and takes its calorie total from
   it; the other two start from the calorie target and split that up. `bump` is the
   book's 500-calorie step, applied in the same ratio, and is how a stalled scale gets
   answered rather than by inventing a new formula. */
function macroTarget(date,bump){
  const lb=bwLb(date); if(!lb) return null;
  // The stored adjustment unless a caller deliberately asks for a different one, so
  // nobody can show a target that quietly ignores it.
  bump=bump==null?(+plan.macroBump||0):+bump;
  const g=macroGoal(), M=MACRO[g], r=n=>Math.round(n/5)*5;
  const own=+plan.proteinPerLb>0?+plan.proteinPerLb:null;      // a setting of your own wins
  if(g==='gain'){
    const k=1+((+bump||0)*MACRO_STEP)/(lb*(M.p*KCAL_G.p+M.c*KCAL_G.c+M.f*KCAL_G.f));
    const P=r(lb*(own||M.p)*k), C=r(lb*M.c*k), F=r(lb*M.f*k);
    return {p:P,c:C,f:F,kcal:Math.round(P*KCAL_G.p+C*KCAL_G.c+F*KCAL_G.f),src:M.src,goal:g,bump:+bump||0};
  }
  const base=kcalTarget(date); if(base==null) return null;
  const kcal=Math.max(1200,base+(+bump||0)*MACRO_STEP);
  const P=r(lb*(own||M.p)), F=r(lb*M.f);
  const C=Math.max(0,r((kcal-P*KCAL_G.p-F*KCAL_G.f)/KCAL_G.c));
  return {p:P,c:C,f:F,kcal:Math.round(P*KCAL_G.p+C*KCAL_G.c+F*KCAL_G.f),src:M.src,goal:g,bump:+bump||0};
}
const PLIB={
  pogo:{name:'Pogo hop',
    setup:'Stand tall, feet hip width, arms at your sides or lightly bent. Weight on the balls of your feet.',
    exec:'Hop straight up repeatedly using only the ankles. Knees stay nearly straight and barely bend. Height is small, two to four inches. The goal is the shortest possible time on the ground, not air time.',
    cues:'Think “stiff spring.” Toes pulled up toward your shin before you land so the forefoot contacts first. The rhythm should sound fast and even.',
    errors:'Bending the knees to create height, which turns it into a squat jump and removes the ankle stimulus. Landing flat-footed or heel-first. Letting the rhythm slow as the set goes on.',
    note:'The lowest-stress drill in the program, and the one that most directly builds the Achilles and calf stiffness everything else relies on.'},
  askip:{name:'Ankle skip',
    setup:'Standing, ready to travel forward over about 20 meters.',
    exec:'Skip forward driving off the ankle with a minimal knee bend, opposite arm swinging. Cover ground with quick, light contacts rather than big bounds.',
    cues:'Light and quick. Contacts should be barely audible.',
    errors:'Turning it into a powerful A-skip with high knee drive. That is a different drill and adds fatigue you do not want before the main sets.'},
  broad:{name:'Broad jump (single effort)',
    setup:'Feet hip to shoulder width behind a line. Clear landing space of at least 3 meters. A flat, non-slip surface: grass or rubber gym flooring is ideal, concrete is the worst option.',
    exec:'Hinge and load by dipping to roughly a quarter squat, swinging the arms back. Jump forward and slightly up, driving the arms forward and fully extending hips, knees and ankles. Land on both feet with hips back and knees tracking over toes, then absorb and stick: no extra hop, no stagger.',
    cues:'Reach, don’t fall. Drive the arms hard; they contribute more distance than most people expect. Land like you are catching yourself in a quarter squat, not a deep one.',
    errors:'Landing stiff-legged with straight knees (jarring and risky). Knees collapsing inward on landing. Piking at the waist in the air. Taking a step after landing. If you cannot stick it, you jumped past your current ability to absorb it.',
    note:'Your measured lift for the block. Mark the takeoff line and measure to your rearmost heel. Log the best jump of each session.'},
  vertj:{name:'Vertical jump',
    setup:'Stand side on to a wall. Reach up with the near arm, feet flat, and mark the highest point your fingers reach: that is your standing reach. Chalk, tape or a coach\u2019s eye all work; a Vertec or a wall you can mark is easiest.',
    exec:'From a standstill, dip to about a quarter squat, swing both arms down and back, then jump as high as you can and touch the wall at the top with the near hand. No run-up and no step into it. Three attempts, resting fully between them, and keep the best.',
    cues:'Down fast, up faster: the dip should be quick and shallow. Throw the arms up as you extend. Reach at the top of the jump, not on the way up.',
    errors:'Dipping too deep or too slowly, which loses the stretch reflex. Taking a step in. Measuring the jump touch but forgetting the standing reach, which is the number you subtract.',
    note:'Jump height is the touch height minus your standing reach. Record the same way every time \u2014 same wall, same shoes, same arm \u2014 or the comparison is meaningless.'},
  triple:{name:'Standing triple jump',
    setup:'A line to start behind and about 10 meters of flat, forgiving space. Grass or rubber flooring; do not test this on concrete. Warm up fully first: it is the highest-force test in the set.',
    exec:'From a two-foot standstill, jump forward and land on one foot (the hop), immediately bound forward onto the opposite foot (the step), then jump off that foot and land on both feet (the jump). Three linked efforts, no pause between them. Measure from the line to your rearmost heel on the final landing.',
    cues:'Even, rhythmic, flowing. Aim for three jumps of similar length rather than an enormous first one that leaves you nothing to land on. Arms drive on every contact.',
    errors:'Attacking the hop so hard that the step and jump collapse. Pausing between contacts, which turns it into three standing jumps. Reaching for distance on the last landing and falling backwards \u2014 stick it or the attempt does not count.',
    note:'The most demanding jump test here, and the one that exposes single-leg elasticity and left-to-right differences the broad jump hides. Skip it if an ankle or Achilles is complaining.'},
  cbroad:{name:'Continuous broad jump',
    setup:'Same as the broad jump, with space for two to three consecutive jumps.',
    exec:'Perform a broad jump, and the instant you land, immediately jump again with minimal time on the ground. The landing of jump one is the loading for jump two.',
    cues:'Rebound, don’t reset. The whole point is that ground contact is short. Slightly shorter individual jumps with fast contacts beat long jumps with a pause.',
    errors:'Pausing to re-set between reps, which makes it separate single jumps. Sinking into a deep squat on each landing, which kills the elastic stimulus.'},
  box:{name:'Box jump, step down',
    setup:'A stable box or plyo platform at a height you can land on in a quarter squat, not a deep one: typically 18 to 24 inches. Stand about a foot back.',
    exec:'Dip, swing the arms, and jump onto the box, landing softly on both feet with hips slightly back. Stand fully upright on top, then step down one foot at a time.',
    cues:'Soft, quiet landing. If you hear a thud, you are landing too heavily or the box is too high.',
    errors:'Choosing a box so tall you have to tuck your knees to your chest to clear it. That measures hip flexibility, not power. Jumping down off the box, which adds eccentric load with none of the benefit.',
    note:'Always step down. Repeated jump-downs are where box jump injuries come from, and they add contacts you did not program.'},
  lbound:{name:'Lateral bound (stick 2 seconds)',
    setup:'Stand on one leg. Clear space to your side. Non-slip footing matters more here than anywhere else.',
    exec:'Push laterally off the standing leg and land on the opposite leg. Absorb on that single leg with a soft knee and the hip loaded, and hold the landing completely still for a two-count before bounding back the other way.',
    cues:'Land with the knee tracking over the middle of the foot and the hip taking the load. The two-second hold is the exercise: it trains deceleration and frontal-plane control.',
    errors:'Rushing the hold. Letting the knee cave inward. Landing on a stiff, straight leg. Bounding so far sideways you cannot control the landing. Distance is capped by your ability to stick it.'},
  slhop:{name:'Single-leg hop (straight line)',
    setup:'Balance on one leg, hands free. Flat surface with several meters ahead.',
    exec:'Hop forward on the same leg repeatedly, aiming for consistent distance and short contacts. Complete all reps on one leg, then switch.',
    cues:'Stay tall through the torso. Hips level: do not let the opposite hip drop on each landing.',
    errors:'Letting distance shrink through the set. Excessive side-to-side drift. Hunching forward at the waist.',
    note:'Compare left to right. A noticeable asymmetry in distance or landing control is worth addressing with unilateral strength work before adding jump volume.'},
  sllat:{name:'Single-leg lateral hop (continuous)',
    setup:'Balance on one leg. Optionally use a line or low object to hop over.',
    exec:'Hop side to side on the same leg, continuously, with short ground contacts. No pause between reps.',
    cues:'Small and fast beats big and slow. Knee tracks over the foot on every contact.',
    errors:'Knee caving inward as fatigue sets in: stop the set when you see it. Landing flat-footed.',
    note:'The highest frontal-plane demand in the program, and the most protective for ankles and knees.'},
  bdist:{name:'Bound for distance',
    setup:'Space of 20 to 30 meters. Start with a few walking steps into the first bound rather than from a dead stop.',
    exec:'Alternate legs in exaggerated running strides, driving off one leg and landing on the other, covering as much ground per contact as possible. Opposite arm drives forward with each bound.',
    cues:'Push the ground behind you and reach with the landing leg. Long, powerful, rhythmic.',
    errors:'Turning it into ordinary running. Landing heel-first. Leaning back to try to hang in the air.'},
  bheight:{name:'Bound for height',
    setup:'Same as bounding for distance, with the same run-in.',
    exec:'Alternate-leg bounds emphasizing vertical displacement rather than horizontal: drive the knee up and get as high as you can per contact, covering less ground.',
    cues:'Punch the knee up and the arms up. Think “up” on every contact.',
    errors:'Drifting back into distance bounding once you fatigue. Collapsing into a deep knee bend on landing.'},
  hurdle:{name:'Hurdle hop (low, continuous)',
    setup:'Three to five low hurdles, cones, or 6 to 12 inch objects in a line, roughly a meter apart. Use objects that fall over harmlessly if clipped.',
    exec:'Hop over each with both feet, landing and immediately rebounding into the next with minimal ground contact. Complete the line, walk back, repeat.',
    cues:'Minimal time on the ground. Land on the balls of the feet, ankles stiff.',
    errors:'Hurdles too high, which forces a knee tuck and a long pause on each landing. Pausing between hurdles to re-set.',
    note:'If you only have one or two objects, use fewer and reset between passes rather than raising the height.'},
  slam:{name:'Overhead med ball slam',
    setup:'Feet hip to shoulder width, a non-bouncy slam ball of 8–15 lb. Floor you do not mind hitting.',
    exec:'Reach the ball overhead with the whole body long, then throw it into the floor in front of your feet as hard as you can, folding at the hips and ribs. Pick it up, reset, repeat.',
    cues:'Throw the ball through the floor, not at it. The power comes from the hips and trunk, not the arms.',
    errors:'Bending only at the arms. Rushing the reset so the set turns into conditioning. Using a bouncy ball, which takes the finish away from you.',
    note:'Intent is the whole exercise. If the ball is heavy enough to slow you down, it is too heavy.'},
  chestpass:{name:'Med ball chest pass',
    setup:'A meter or two from a solid wall, ball at the sternum, athletic stance.',
    exec:'Push the ball into the wall as fast as you can, catch the rebound and reset. Feet stay planted.',
    cues:'Fast hands. Think of pushing the wall away rather than throwing at it.',
    errors:'Standing so close that the rebound arrives before you are set. Turning it into a rep count instead of a speed drill.'},
  rotthrow:{name:'Rotational med ball throw',
    setup:'Side on to a wall, feet shoulder width, ball at the hip furthest from it.',
    exec:'Turn the back hip through and release the ball into the wall across your body. Complete all reps on one side, then switch.',
    cues:'Hips lead, arms follow. The back heel should come off the floor as you turn.',
    errors:'Throwing with the arms while the hips stay square. Taking the ball too far behind the body and losing the whip.',
    note:'The only rotation in a week of squats, presses and riding. Worth keeping even when you cut everything else.'},
  scoop:{name:'Backward scoop toss',
    setup:'Feet slightly wider than the hips, ball held low between the legs, clear space behind you.',
    exec:'Dip into a quarter squat and throw the ball up and behind you, extending hips, knees and ankles fully.',
    cues:'One long push from the floor to the fingertips. Let it pull you onto your toes.',
    errors:'Squatting deep and turning it into a lift. Throwing with the back rather than the legs.'},
  plyopush:{name:'Plyometric push-up',
    setup:'Push-up position on a forgiving surface. Hands under the shoulders.',
    exec:'Lower under control, then drive up hard enough that the hands leave the floor. Land with soft elbows and go straight into the next rep only if you can keep the height.',
    cues:'Short time on the floor, ribs down, body in one line. Height over reps.',
    errors:'Letting the hips sag. Grinding out reps once the push-off slows, which is where shoulders get sore.',
    note:'The highest-stress movement in this block. Leave it out on weeks where the bench already feels heavy.'},
  speedpress:{name:'Speed bench or floor press',
    setup:'Bar at about 50–60% of your bench max, or a pair of dumbbells you could press 15 times. A spotter or safeties if you are on a bench.',
    exec:'Lower under control to the chest, pause for nothing, and drive the bar up as fast as you possibly can. Three reps, then rack it. Speed decides the set, never the weight.',
    cues:'Accelerate all the way through: the bar should feel like it wants to leave your hands at the top. Reset your brace before every rep.',
    errors:'Creeping the weight up until it stops moving fast, which turns this back into ordinary benching. Bouncing the bar off the chest. Running the reps together.',
    note:'The option that needs no new equipment. Because it is the same pattern as your work sets, it is also the one most likely to cost you on Friday: keep it light.'},
  plyopushbox:{name:'Push-up onto plates or low boxes',
    setup:'Two 25 lb plates, low boxes or steps, a little wider than shoulder width, with the floor between them.',
    exec:'From the floor, push up hard enough to land both hands on top of the plates, then lower back down between them and repeat. Or start on top and drop into the gap.',
    cues:'Land with the elbows soft and the body still in one line. Height and control over speed.',
    errors:'Plates too far apart, which throws the shoulders into a wide catch. Piking the hips to get airborne.',
    note:'Easier on the wrists and shoulders than clapping push-ups, and it gives the drop a defined height.'},
  dbsnatch:{name:'Single-arm dumbbell snatch',
    setup:'One moderate dumbbell or kettlebell between the feet, feet a little wider than the hips, chest up.',
    exec:'Hinge, then drive the floor away and pull the weight straight up past the ribs, punching the hand through overhead as the elbow turns over. Lock the arm out with the weight over the shoulder. Lower it down the same path and reset on the floor between reps.',
    cues:'Legs and hips throw it, the arm only guides it. One clean line close to the body.',
    errors:'Swinging it out in an arc and catching it on a bent, soft arm. Chasing reps for breath: this is a power set, not a circuit.',
    note:'The most total-body option here, and the closest thing in the block to an Olympic lift without needing the technique.'},
  highpull:{name:'Explosive high pull',
    setup:'A barbell at about 40–50% of your deadlift, or a pair of dumbbells. Start with the bar just above the knee rather than the floor.',
    exec:'Push the floor away, extend the hips hard, and let that speed carry the bar up the body to about sternum height with the elbows high and outside. Lower it back to the start under control.',
    cues:'The hips throw it; the arms only finish the ride. Bar stays close, elbows finish above the hands.',
    errors:'Turning it into an upright row by pulling early with the arms. Going heavy enough that the bar never gets above the navel. Leaning back at the top.'},
  explpull:{name:'Explosive pull-up',
    setup:'A bar you can do at least five clean pull-ups on. Full hang, no kipping.',
    exec:'From a dead hang, pull as violently as you can and aim to bring the chest to the bar, or to release the hands at the top if the bar and your grip allow it. Lower under control, re-hang, and reset for the next rep.',
    cues:'Every rep starts from a still hang. The aim is speed off the bottom, not getting the chin over by any means.',
    errors:'Swinging the legs to generate the pull. Grinding out reps once the speed goes: the set ends when the bar stops coming fast.',
    note:'The only explosive pulling in the program, and it pairs well with the pull-up progression you are already running.'},
  bandrow:{name:'Explosive band row',
    setup:'A band anchored at chest height, standing far enough back that it is under tension with your arms straight.',
    exec:'Snap both elbows back to the ribs as fast as you can, then let the band pull the arms straight again under control. Reset your stance between reps if it drags you forward.',
    cues:'Fast in, slow out. Shoulder blades move, the torso does not.',
    errors:'Leaning back to help. Band so heavy that the pull turns slow, which makes it strength work instead.'},
  bandrot:{name:'Band rotational punch',
    setup:'A band anchored at chest height behind you, side on, both hands on the handle at the ribs.',
    exec:'Turn the back hip through and punch the hands across the body as fast as you can, then return under control. All reps on one side, then switch.',
    cues:'Hips lead, arms follow, back heel turns. Same pattern as the med ball throw with no ball and no wall.',
    errors:'Rotating with the arms while the feet stay stuck. Letting the band snap you back around rather than controlling the return.',
    note:'The travel-friendly rotation option: one band and a door anchor.'},
  depth:{name:'Depth jump',
    setup:'Box 12 to 16 inches high. Stand at the edge. Landing area must be flat and non-slip with room to jump forward or up.',
    exec:'Step off the box. Do not jump off or down. Land on both feet on the balls of the feet and, as fast as humanly possible, rebound into a maximal vertical jump. The time between landing and takeoff is the entire exercise.',
    cues:'Land and leave. Imagine the floor is hot. Target roughly a quarter-second on the ground; if you sink into a deep squat before jumping, the box is too high.',
    errors:'Jumping off the box instead of stepping, which changes the landing force unpredictably. Using too high a box: the single most common error, and it converts an elastic drill into a heavy eccentric one. Pausing on landing.',
    note:'Highest-stress movement in the program. If your vertical rebound off the box is lower than a normal standing vertical jump, the box is too high. Lower it. Start at 12 inches even if that feels trivially easy.'}
};
// Variants for the lifts that have them. Barbell only, both slots: a movement whose
// limit is what you can hold (goblet, double kettlebell front) or that has no lockout to
// test (RDL) has no one-rep max to run percentages against, so it belongs in the
// accessory and travel-week lists instead.
// `r` is the variant's usual share of the reference lift's max, used to work out the
// weight when you have not tested the variant itself; enter a real max in Setup and that
// wins instead. The first entry in each list is the reference: the max everything else is
// derived from, the one retests measure, and what you get if you never touch this.
/* The rule, in the owner's words: a lift variant is a barbell. A straight bar, or a
   specialty bar -- safety squat, trap, football, axle. Dumbbell and landmine work is
   accessory work and lives in the accessory slots, which is where it already is.

   It happens to give the same answer as the mechanical test above and is easier to
   apply: a barbell lift has a lockout to test and a weight that does not depend on what
   your hands can hold, so there is an honest one-rep max to run percentages against. */
// The lift itself, as opposed to the variant of it you are running. `liftName()`
// resolves a key to the variant in use, which is what every prescription wants and is
// wrong anywhere the subject is the lift: a table of squat variants headed with the
// squat you happen to be squatting reads as nonsense.
const VAR_OF={squat:'Squat',bench:'Bench press',ohp:'Overhead press',dead:'Deadlift'};
const VARS={
  squat:{
    high:{name:'High-bar back squat',short:'High bar',r:1,note:'Bar on the traps, upright torso, deeper knee bend. The reference: everything else here is a share of it.'},
    low:{name:'Low-bar back squat',short:'Low bar',r:1.03,note:'Bar on the rear delts, more hip and more forward lean. Usually a few percent heavier than high bar.'},
    ssb:{name:'Safety squat bar squat',short:'SSB',r:.9,note:'Cambered bar, handles in front. The weight sits forward and wants to fold you, so the upper back works hard. Usually about 10% under a straight-bar squat, but the gap is personal.'},
    front:{name:'Front squat',short:'Front',r:.85,note:'Rack position, vertical torso, quads and upper back. About 85% of a back squat, and the upper back usually gives out first.'},
    box:{name:'Box squat',short:'Box',r:.95,note:'Sit to a box at or just below parallel, pause, drive up. Kills the stretch reflex, so it is honest hip strength.'},
    pause:{name:'Paused squat',short:'Paused',r:.9,note:'Two seconds in the hole, no bounce. Exposes whether the bottom position is actually under control.'},
    zercher:{name:'Zercher squat',short:'Zercher',r:.77,note:'Bar in the crooks of the elbows. Brutal on the upper back and trunk, and the limiter is usually how much your arms will take.'}
  },
  bench:{
    flat:{name:'Bench press',short:'Bench',r:1,note:'Straight bar, flat, feet down, touch and press. The reference: everything else here is a share of it.'},
    close:{name:'Close-grip bench',short:'Close grip',r:.92,note:'Hands about shoulder width, elbows tucked. More triceps, less shoulder, and the usual answer to a front delt that complains on the wide grip.'},
    incline:{name:'Incline barbell bench',short:'Incline',r:.82,note:'Thirty to forty-five degrees. Upper chest and front delt, which is the one gap three days of flat pressing leaves.'},
    floor:{name:'Floor press',short:'Floor',r:.92,note:'Flat on the floor, upper arms stop on the way down. No leg drive and no stretch at the bottom, so it is lockout strength and it is kind to the shoulder.'},
    pause:{name:'Paused bench',short:'Paused',r:.93,note:'A dead stop on the chest, no bounce. Exposes whether the weight was ever under control.'},
    neutral:{name:'Neutral-grip bar bench',short:'Neutral grip',r:.92,note:'Football or Swiss bar, palms facing. The one to run for a whole block when the shoulder will not tolerate a straight bar.'},
    pin:{name:'Pin or board press',short:'Pins',r:1.05,note:'Short range from pins or boards, overloading the top half. Easy to flatter yourself with \u2014 pick one height and keep it.'}
  },
  ohp:{
    strict:{name:'Overhead press',short:'Strict',r:1,note:'Standing, strict, no leg drive and no layback beyond a braced trunk. The reference: everything else here is a share of it.'},
    push:{name:'Push press',short:'Push press',r:1.25,note:'A dip and drive off the legs, then press it out. More weight overhead and more total-body coordination; the lockout is still yours.'},
    seated:{name:'Seated barbell press',short:'Seated',r:.95,note:'Takes the legs and the hips out of it. Less weight, and nowhere to hide a sloppy brace.'},
    btn:{name:'Behind-the-neck press',short:'Behind neck',r:.9,note:'Wants genuine shoulder mobility and gives a narrow margin for error. Worth it for upper-back and overhead position if you have the range; skip it if you do not.'},
    z:{name:'Z press',short:'Z press',r:.72,note:'Seated on the floor, legs straight. Removes every bit of help from below the waist, which is why the number is so much lower.'},
    pin:{name:'Pin press',short:'Pins',r:1.05,note:'Dead start from pins at forehead height. No stretch reflex and no dip, so it is the sticking point on its own.'}
  },
  dead:{
    conv:{name:'Conventional deadlift',short:'Conventional',r:1,note:'The reference. Everything else here is expressed against it.'},
    sumo:{name:'Sumo deadlift',short:'Sumo',r:1,note:'Wide stance, hands inside the knees, shorter bar path and more quad. Treated as equal to conventional because the gap is personal — if yours differs, give it its own max.'},
    trap:{name:'Trap bar deadlift',short:'Trap bar',r:1.05,note:'Neutral grip, load closer to the hips, easier on the lower back. Usually a touch heavier than conventional, more so from the high handles.'},
    deficit:{name:'Deficit deadlift',short:'Deficit',r:.9,note:'Standing on 1–3 inches. Longer pull off the floor, harder start, and the reason to use it is a weak break from the floor.'},
    snatch:{name:'Snatch-grip deadlift',short:'Snatch grip',r:.85,note:'Wide grip, much longer range, heavy on the upper back. Grip usually decides the set.'},
    pause:{name:'Paused deadlift',short:'Paused',r:.85,note:'Pause an inch or two off the floor, or below the knee. Punishes any slack in the start position.'},
    block:{name:'Block or rack pull',short:'Blocks',r:1.1,note:'Bar raised to just below the knee. Shorter pull, heavier weight, and easy to overload — keep it honest.'}
  }
};
// The variants you can pick from: the built-in list plus anything you have defined
// yourself in Setup. A custom variant is just a name and a share of the reference lift's
// max, which is all the program needs to prescribe it.
function varsOf(k){
  if(!VARS[k]) return null;
  const out=Object.assign({},VARS[k]);
  for(const c of ((plan.customVar||{})[k]||[])){
    if(!c||!c.id||!c.name||!(+c.r>0)) continue;
    out[c.id]={name:c.name,short:c.short||c.name,r:+c.r,note:c.note||('Your own variant, at '+Math.round(+c.r*100)+'% of the '+VARS[k][varRef(k)].name.toLowerCase()+'.'),custom:true};
  }
  return out;
}
function varRef(k){return VARS[k]?Object.keys(VARS[k])[0]:null}
// The 12–15 min warm-up as a checklist. `s` marks the 7-minute short version.
const WARMUP=[
  {g:'Raise temp',n:'Bike, rower or easy jog',d:'4–5 min',s:1},
  {g:'Breathe / reset',n:'90/90 breathing (back, feet on bench or wall)',d:'5 breaths',s:1},
  {g:'Breathe / reset',n:'Cat / cow',d:'8–10 slow reps',s:1},
  {g:'Spine / t-spine',n:'Thread the needle',d:'6–8 per side'},
  {g:'Spine / t-spine',n:'Open book (side-lying rotation)',d:'8 per side'},
  {g:'Spine / t-spine',n:'Quadruped t-spine extension',d:'8 per side'},
  {g:'Hips',n:'90/90 hip switches, seated',d:'10 switches',s:1},
  {g:'Hips',n:'90/90 lean-forward hold',d:'20–30 sec per side'},
  {g:'Hips',n:'Couch stretch',d:'45–60 sec per side',s:1},
  {g:'Hips',n:'Frog stretch, gentle rocking',d:'10 rocks'},
  {g:'Hips',n:'World’s greatest stretch',d:'5 per side'},
  {g:'Activate',n:'Leg swings, both directions',d:'10 each way per leg'},
  {g:'Activate',n:'Band pull-aparts + shoulder dislocates',d:'15 each',s:1},
  {g:'Activate',n:'Glute bridge or bodyweight squat',d:'10 reps'}
];

/* Asked for: whichever routine is running, these two are in it. They are already in
   the list above, in their own positions, so that list is left exactly as it was and
   every tick logged against it on a past day still lines up. The other routines get
   them prepended. */
const WARM_CORE=[
  {g:'Always',n:'90/90 breathing (back, feet on bench or wall)',d:'5 breaths',s:1},
  {g:'Always',n:'90/90 hip switches, seated',d:'10 switches',s:1}
];
/* Joe DeFranco's Agile 8, from his own "Training Rules for Washed-up Meatheads", with
   his doses. Not Tactical Barbell and not ours -- the books prescribe no mobility
   routine at all, and Ageless Athlete says to bring your own: "If you have a
   flexibility or mobility protocol you like to follow (not a bad idea), incorporate
   that as much as you like."

   Copies of this routine differ. Several swap in frog jumps or a bent-knee iron cross;
   the original has mountain climbers and no iron cross, so that is what is here. */
const AGILE8=[
  {g:'Roll',n:'Foam roll IT band',d:'10\u201315 passes per leg'},
  {g:'Roll',n:'Foam roll adductors',d:'10\u201315 passes per leg'},
  {g:'Roll',n:'Glute and piriformis release, tennis ball',d:'30 sec per side'},
  {g:'Move',n:'Rollovers into V-sits',d:'10 reps'},
  {g:'Move',n:'Fire hydrant circles',d:'10 forward + 10 back per leg'},
  {g:'Move',n:'Mountain climbers',d:'20 total'},
  {g:'Move',n:'Groiners',d:'10 reps, hold the last 10 sec'},
  {g:'Stretch',n:'Static hip flexor stretch',d:'3 \u00d7 10 sec per leg'}
];
const WARM_ROUTINES={
  ours:{name:'Ours',mins:'12\u201315 min',short:'7 min',items:()=>WARMUP,core:false,
    note:'Built for this app, not taken from the books \u2014 none of them prescribe a mobility routine. Breathing and t-spine first, then hips, then something to switch the glutes on.'},
  agile8:{name:'Agile 8',mins:'10\u201315 min',items:()=>AGILE8,
    note:'Joe DeFranco\u2019s, from \u201cTraining Rules for Washed-up Meatheads\u201d, at his doses. Needs a foam roller and a tennis ball.'},
  mine:{name:'Mine',mins:'',items:()=>warmMine(),
    note:'Yours. One movement per line, dose after a comma.'}
};
// Mobility to finish each session. The program notes keep deep holds out of the warm-up
// and put them after training, so each session type ends with what it actually loaded.
const MOB={
  lift:{name:'Hips and t-spine',why:'Squats three times a week plus riding: hips first.',items:[
    ['Couch stretch','60–90 sec per side'],['90/90 lean-forward hold','45 sec per side'],
    ['Figure-4 glute stretch','45 sec per side'],['Thread the needle or open book','8 per side'],
    ['Child’s pose with lat reach','45 sec per side']]},
  dead:{name:'Posterior chain',why:'After deadlifts: decompress and open the hamstrings.',items:[
    ['Dead hang from the bar','20–30 sec'],['Standing forward fold, soft knees','45–60 sec'],
    ['Supine hamstring stretch (strap or doorway)','45 sec per side'],['Couch stretch','60–90 sec per side'],
    ['Figure-4 glute stretch','45 sec per side'],['Cat / cow, slow','8–10 reps']]},
  hic:{name:'Hip flexors and calves',why:'Riding in the same position compounds with squats. This is the antidote.',items:[
    ['Couch stretch','60–90 sec per side'],['Standing quad stretch','45 sec per side'],
    ['Straight-leg calf stretch against a wall','45 sec per side'],['Figure-4 glute stretch','45 sec per side'],
    ['Seated forward fold','45–60 sec']]},
  plyo:{name:'Ankles and calves',why:'Jumping loads the Achilles and calves hardest.',items:[
    ['Straight-leg calf stretch (gastroc)','45 sec per side'],['Bent-knee calf stretch (soleus)','45 sec per side'],
    ['Knee-to-wall ankle mobilization','10 reps per side'],['Foot / arch roll on a ball','60 sec per side'],
    ['Couch stretch','60–90 sec per side']]},
  off:{name:'Full mobility',why:'No training today: the best day for the long holds.',items:[
    ['Couch stretch','90 sec per side'],['Frog stretch, gentle rocking','2 min'],
    ['90/90 switches and lean holds','45 sec per side'],['Pigeon or figure-4','60–90 sec per side'],
    ['Thoracic extension over a foam roller','10 slow reps'],['Dead hang','30 sec'],
    ['Diaphragmatic breathing, legs up the wall','2–3 min']]}
};
const PLYO_WARMUP=[['pogo','Pogo hops','3 × 10','Wakes up the ankle spring; short, fast ground contacts'],['askip','Ankle skips','2 × 20 m','Rhythm and elastic timing through the calf and Achilles'],['broad','Submaximal broad jumps','3 × 1 at ~70%','Rehearses the landing pattern before full effort']];
const PLYO=[
  {name:'Extensive',target:60,desc:'Extensive means volume over intensity — plenty of contacts, none of them all-out. Bilateral, stick every landing. This phase is about teaching the landing and building tissue tolerance, not chasing distance.',
   ex:[{id:'broad',label:'Broad jump, single effort',s:5,r:'3',c:15,rest:60},{id:'box',label:'Box jump, step down',s:5,r:'3',c:15,rest:60},{id:'lbound',label:'Lateral bound, stick 2 sec',s:4,r:'4 / side',c:16,rest:60},{id:'pogo',label:'Pogo hops in place',s:4,r:'8',c:32,rest:45,low:true}]},
  {name:'Unilateral + reactive',target:80,desc:'Single-leg work enters. Measure and log your best broad jump every session from here on; it is your progress marker.',
   ex:[{id:'cbroad',label:'Broad jump, 2 continuous',s:5,r:'2 jumps',c:20,rest:90},{id:'slhop',label:'Single-leg hop, straight line',s:4,r:'4 / side',c:32,rest:90},{id:'bdist',label:'Bound for distance',s:4,r:'6 contacts',c:24,rest:90},{id:'hurdle',label:'Hurdle hops, low, continuous',s:3,r:'5',c:15,rest:90}]},
  {name:'Elastic',target:90,desc:'Depth jumps enter: the highest-stress sets in the block. Start at the lower box height and only raise it if landings stay silent and controlled.',
   ex:[{id:'depth',label:'Depth jump from 12–16 in',s:5,r:'3',c:15,rest:120},{id:'sllat',label:'Single-leg lateral hop, continuous',s:4,r:'5 / side',c:40,rest:90},{id:'cbroad',label:'Continuous broad jump, 3 reps',s:4,r:'3 jumps',c:24,rest:90},{id:'bheight',label:'Bound for height',s:3,r:'4',c:12,rest:90}]}
];
// Optional upper-body power. Off by default. Every slot offers a med ball, a bodyweight,
// a barbell/dumbbell and (where it works) a band option, so the block runs in any gym or
// none. Throws are counted separately from ground contacts: they add no impact, but they
// do add fatigue before Friday's bench.
const UP_THROW={name:'Total-body throw',opts:[
  {id:'slam',label:'Overhead slam',gear:'Slam ball',r:'5',rest:60},
  {id:'scoop',label:'Backward scoop toss',gear:'Med ball, space behind',r:'5',rest:60},
  {id:'dbsnatch',label:'Single-arm DB snatch',gear:'Dumbbell or kettlebell',r:'3 / side',rest:90},
  {id:'highpull',label:'Explosive high pull',gear:'Barbell or dumbbells',r:'3',rest:90}]};
const UP_PUSH={name:'Push',opts:[
  {id:'chestpass',label:'Chest pass into a wall',gear:'Med ball, wall',r:'5',rest:60},
  {id:'plyopush',label:'Plyometric push-up',gear:'Bodyweight',r:'4',rest:90},
  {id:'plyopushbox',label:'Push-up onto plates',gear:'Two plates or low boxes',r:'4',rest:90},
  {id:'speedpress',label:'Speed bench or floor press',gear:'Barbell or dumbbells, ~50%',r:'3',rest:90}]};
const UP_ROT={name:'Rotation',opts:[
  {id:'rotthrow',label:'Rotational throw',gear:'Med ball, wall',r:'5 / side',rest:60},
  {id:'bandrot',label:'Band rotational punch',gear:'Band',r:'6 / side',rest:60}]};
const UP_PULL={name:'Pull',opts:[
  {id:'explpull',label:'Explosive pull-up',gear:'Pull-up bar',r:'3',rest:90},
  {id:'bandrow',label:'Explosive band row',gear:'Band',r:'6',rest:60},
  {id:'highpull',label:'Explosive high pull',gear:'Barbell or dumbbells',r:'3',rest:90}]};
const PLYO_UPPER=[
  {name:'Power',slots:[{s:3,...UP_THROW},{s:3,...UP_PUSH}]},
  {name:'Rotation',slots:[{s:3,...UP_ROT},{s:3,...UP_PULL}]},
  {name:'Elastic',slots:[{s:3,...UP_PUSH,def:'plyopush'},{s:3,...UP_THROW},{s:2,...UP_ROT}]},
];
// The road to a weighted pull-up, in the order the strength actually arrives. `at` is the
// best clean rep count that puts you on this rung. What you do on Lift 3 days, and the
// one thing that moves you up.
const PULLUP=[
  {at:0,name:'Hangs and negatives',work:'5 × 10–20 s dead hang, then 4–6 negatives: jump or step to the top, lower for 5 seconds, no faster.',next:'One clean rep from a dead hang.',
   why:'The negative builds the top half and the grip at the same time, and it is the only thing that works when you cannot yet pull your own weight.'},
  {at:1,name:'Band-assisted volume',work:'4 × 4–6 with the lightest band that lets you finish the set clean. Keep the negatives.',next:'Five clean reps in one set.',
   why:'Volume is what moves this. A band you can barely finish with is doing too little; one that makes it easy is doing too much.'},
  {at:5,name:'Clean reps',work:'4–5 sets across, stopping two short of failure. Full hang at the bottom, chin clearly over at the top.',next:'Ten clean reps in one set.',
   why:'Reps in reserve matter more here than grinding: the set that leaves you shaking costs you the next two sessions.'},
  {at:10,name:'Ready to load',work:'Add weight: start at 10% of bodyweight for 4 × 3–5, and run it as Lift 3 on the Operator percentages.',next:'A weighted single at 25% of bodyweight.',
   why:'Ten clean reps is the usual threshold where adding weight beats adding reps. The app can run the weighted pull-up as Lift 3 from here.'},
  {at:15,name:'Weighted',work:'Weighted pull-ups as a cluster lift, retested like any other max.',next:'Keep adding, and keep one bodyweight set a week for the reps.',
   why:'From here it is ordinary strength work: the percentages apply to bodyweight plus the added weight.'}
];
function pullupStage(reps){let i=0;for(let j=0;j<PULLUP.length;j++) if(reps>=PULLUP[j].at) i=j;return i}
const PLYO_PULLBACK=['Broad jump distance is down more than 5% from recent sessions before you have even started the work sets.','Achilles, patellar tendon or shin soreness you can feel while walking. Tendon complaints build quietly over weeks, then stop you for months.','Sleep has been short or broken for several nights running.','The lifting session before this one was unusually heavy, or left you sore into today.'];
function libBody(e){return `<div class="plib">${[['Setup',e.setup],['Execution',e.exec],['Cues',e.cues],['Common errors',e.errors]].map(([t,x])=>`<p><b>${t}.</b> ${esc(x)}</p>`).join('')}${e.note?`<p class="plib-note">${esc(e.note)}</p>`:''}</div>`}
function plyoEntry(id){const e=PLIB[id];if(!e)return '';return `<div class="plib">${[['Setup',e.setup],['Execution',e.exec],['Cues',e.cues],['Common errors',e.errors]].map(([t,x])=>`<p><b>${t}.</b> ${esc(x)}</p>`).join('')}${e.note?`<p class="plib-note">${esc(e.note)}</p>`:''}</div>`}
// A week away from the barbell. Rep targets rather than percentages, so nothing here
// touches your maxes, and the cycle pauses rather than counting these as trained weeks.
const TRAVEL={
  day1:{name:'Squat pattern and push',items:[
    ['Goblet, double KB front or DB front squat','3 × 8–12'],['Push-up or DB bench press','3 × 10–15'],
    ['DB or band row','3 × 10–12'],['Plank','3 × 30–45 sec']]},
  day2:{name:'Single leg and overhead',items:[
    ['Rear-foot-elevated split squat','3 × 8–10 per side'],['DB overhead press','3 × 8–12'],
    ['Chin-up, band-assisted, or DB curl','3 × 8–12'],['Hollow hold','3 × 20–30 sec']]},
  day3:{name:'Hinge and carry',items:[
    ['DB Romanian deadlift','3 × 10–12'],['Floor press or dips','3 × 8–12'],
    ['Single-arm row','3 × 10 per side'],['Suitcase carry','3 × 30 m per side']]},
};
const ACC={
  mon:['Horizontal pull: chest-supported row','Rear delt / upper back: face pull or reverse fly','Core: Pallof press or hanging knee raise','Arms: curls + triceps pushdown'],
  wed:['Arms: curls + triceps pushdown','Shoulders: DB lateral raise','Pull-up progression'],
  fri:['Single-leg: rear-foot-elevated split squat','Posterior chain: Romanian deadlift, back extension or hamstring curl','Carry / grip: farmer carry']
};
const DEF={
  startMonday:'2026-09-28', bridge:true, unit:'lb', bar:45, bodyweight:null,
  maxes:{squat:null,bench:null,pull:null,ohp:null,wpu:null,dead:null},
  lift3Name:'Lat pulldown', machineNote:'',
  l3:{on:{pull:true,ohp:true,wpu:false},mode:'same',primary:'pull'},
  acc:null,
  basis:'1rm', tmPct:90,
  round:{squat:5,bench:5,pull:5,ohp:5,wpu:2.5,dead:5},
  // Calendar feed. mode 'allday' or 'timed'; time/weekend are HH:MM in your own local
  // time wherever you are; alarm is minutes before the start, null for none.
  cal:{mode:'allday',time:'06:00',weekend:'',alarm:null},
  // Accessories: which slots each day fills, what fills them this block and later,
  // and your own additions to the catalogue. See 01b-accessories.js.
  accSlots:{}, accPick:{}, accCycle:{}, accCustom:[], accRest:90,
  // Plyos ride on a weekday of their own rather than being welded to a session, so
  // moving the conditioning around does not drag them with it. plyoMove overrides the
  // default for one week. 0 = Monday.
  // plyoOn false drops them from the plan entirely; plyoDow is the usual weekday.
  // plyoPerWeek 2 splits the phase's contacts across two days rather than doubling them.
  plyoOn:true, plyoDow:3, plyoPerWeek:1, plyoDow2:null, plyoMove:{},
  // Which program this is. Two independent choices, composed into a week by
  // composeSlot — see 01c-templates.js.
  stempl:'operator', cproto:'black',
  // Zulu's two halves of the cluster. Empty means the template's default.
  halves:{},
  schema:0,   // 0 = written before versioning existed; migrate() brings it to SCHEMA
  waves:Object.fromEntries(Object.entries(STEMPL).map(([k,v])=>[k,v.wave.map(x=>Object.assign({},x))])),
  inc:{squat:10,bench:5,pull:5,ohp:5,wpu:2.5,dead:10},
  deloadEvery:0, testEvery:2,   // the book: retest after 2 blocks, no scheduled deload
  deload:{s:2,r:5,p:60},
  goal:'lose', sleepTarget:8, proteinPerLb:0.8, macroBump:0,
  /* Long-run goals, as opposed to `goal` just above, which is about food, and the
     per-session `aims` in the log, which are about today. Nothing in the app schedules
     off these -- they exist so the coach knows what you are training for, and so that
     you had to write it down once. `sticking` is keyed by lift. */
  programGoals:{aim:'',by:'',sticking:{},notes:''},
  rest:{squat:3,bench:3,pull:2,ohp:3,wpu:3,dead:3}, restWarn:10,
  warmRest:{squat:90,bench:90,pull:90,ohp:90,wpu:90,dead:90},
  cardio:{def:'echo'}, fobbit:'kb',
  askDeload:true, voice:false, guideAuto:true,
  // 'duck' shares the speaker with your music, 'takeover' seizes it, 'silent' is mute.
  soundMode:'duck',
  elevPer:{lb:1000,kg:190},
  se:{cluster:'bw',custom:[],rest:60},
  bbVer:{},
  plates:{lb:[45,35,25,10,5,2.5],kg:[25,20,15,10,5,2.5,1.25]},
  // A day's session moved onto another day in the same week. See 04-schedule.js.
  stack:{},
  cycleMaxes:{}, inserts:{}, skips:{}, recovery313:false
};

// Where a complaint plausibly comes from. Used to attach it to the right lifts in the
// cycle review, and spelled out there in words so the reasoning is never a mystery.
const PAIN_AT={
  shoulder:{name:'Shoulder',lifts:['bench','ohp','pull','wpu']},
  elbow:{name:'Elbow',lifts:['bench','ohp','pull','wpu']},
  wrist:{name:'Wrist or hand',lifts:['bench','ohp','pull','wpu']},
  back:{name:'Lower back',lifts:['dead','squat']},
  hip:{name:'Hip',lifts:['squat','dead']},
  knee:{name:'Knee',lifts:['squat','dead']},
  other:{name:'Somewhere else',lifts:[]}
};
const FEELS=[['easy','Easy'],['right','About right'],['hard','Hard']];
const PAINS=[['none','Nothing'],['niggle','A niggle'],['sharp','Sharp pain']];

/* Base Building — Tactical Barbell II, Block I. Eight weeks, straight from the book's
   template. Day rows are [kind, ...args]: se = circuits × reps, e = endurance minutes
   (one number, or a floor and a ceiling), ms = max strength, rec = recovery, rest. */
const BB_WEEKS=[
  [['se',3,20],['e',30],['e',30],['se',2,20],['rec'],['e',35,120],['rest']],
  [['se',3,30],['e',40],['e',40],['se',2,30],['rec'],['e',45,120],['rest']],
  [['se',3,40],['e',50],['e',50],['se',2,40],['rec'],['e',55,120],['rest']],
  [['se',1,50],['e',60],['e',60],['se',1,50],['rec'],['e',60,120],['rest']],
  [['se',3,50],['e',45,60],['e',45,60],['se',2,50],['rec'],['e',45,120],['rest']],
  [['ms'],['hic'],['rec'],['ms'],['hic'],['e',30,60],['rest']],
  [['ms'],['hic'],['rec'],['ms'],['hic'],['e',30,60],['rest']],
  [['ms'],['hic'],['rec'],['ms'],['hic'],['e',30,60],['rest']]
];
/* Tactical Barbell III's Base Building, which is not TB II's. Six weeks rather than
   eight, and only two domains: strength-endurance three times a week on alternate days,
   and endurance three times on the days between. No barbell strength week, no HIC, no
   recovery day -- the book strips it to what supports hypertrophy and nothing else.

   The reps climb within the week (10, 20, 30) rather than across it, and weeks 4 to 6
   add five percent to each. E is capped at 30 minutes and the book means the cap:
   "No more, no less." Asked outright whether you can do longer E sessions, it answers
   "The short answer is NO."  */
const BB_MASS=(()=>{
  const row=(a,b,c)=>[['se',3,a[0],a[1]],['e',30],['se',3,b[0],b[1]],['e',30],['se',3,c[0],c[1]],['e',30],['rest']];
  const early=row([10,15],[20,20],[30,25]), late=row([10,20],[20,25],[30,30]);
  return [early,early,early,late,late,late];
})();
// How long each version of the block runs. TB II's is eight weeks, TB III's is six.
const BB_LEN={standard:8,strength:8,mass:6};
// Strength-first reverses SE and Max Strength. The book says only "reverse it" and gives
// no rep scheme for the late SE weeks, so this ramp to 50 is ours, and says so on screen.
const BB_SF_SE=[[3,30],[3,40],[3,50]];
// The book's example clusters. Five to eight exercises covering the whole body.
const SE_CLUSTERS={
  mass:{name:'TB III barbell',ex:['Bench press','Squat','Romanian deadlift','Abs'],
      note:'The book’s cluster for TB III Base Building: the same lifts General Mass runs, so the base you build is the one you are about to need. It says not to use the conventional deadlift here — it is an awkward movement light and for high reps.'},
  bw:{name:'Bodyweight',ex:['Push-ups','Squats','Kipping pull-ups or inverted rows','Bicycle crunches','Dips','Back extensions'],
      note:'Add a weight vest or a pack with 5–10 lb to make it harder.'},
  bar:{name:'Barbell',ex:['Push press','Front squat','Row','Bench or floor press','Shrugs','Romanian deadlift'],
      note:'One bar, one light weight, the whole circuit. An Olympic bar with a pair of 10s is the right idea.'},
  kb:{name:'Kettlebell',ex:['Swings','Goblet squat','Renegade rows','Single-arm floor press','Kettlebell deadlift'],
      note:'Anything one arm or one leg at a time splits the reps: 30 means 15 a side.'},
  db:{name:'Dumbbell',ex:['Bench or floor press','Lunges','Rows','Dumbbell push press','Squats','Lying leg raises'],
      note:'A pair of light dumbbells for everything except the leg raises.'},
  mine:{name:'Mine',ex:[],note:'Your own five to eight, covering the whole body.'}
};
const SE_RESTS=[0,30,45,60,90,120];

/* ---------------- stored-data schema ----------------
Writes replace a whole document, and `deepMerge(clone(DEF), stored)` fills anything
missing from the defaults, so a field that quietly disappears looks exactly like one that
was never set. That is fine while every change is additive. It is not fine the first time
a field changes shape or meaning, and this is the machinery for that day.

Two halves, and the second is the one that actually protects the data:
  forwards  - old data meets a new app: run the migrations it has not had yet, once.
  backwards - new data meets an OLD app: that app sees a schema it does not know and
              stops writing instead of flattening what it cannot understand.

Adding one: append to MIGRATIONS with the next `to`, bump SCHEMA, write a test. Never
renumber or edit a shipped migration - someone's phone may be about to run it. */
const SCHEMA=6;
// Fields that are meant to be arrays. setPath builds arrays for numeric keys today, but
// data written before it did (and anything restored from an old export) can hold
// {"0":…,"1":…} instead, which is why wuList and two `Array.isArray` guards exist.
const ARRAY_FIELDS=['warmup','mobility','acc'];
function asArray(v){
  if(Array.isArray(v)||!v||typeof v!=='object') return v;
  const out=[]; for(const k of Object.keys(v)){ if(!/^\d+$/.test(k)) return v; out[+k]=v[k] }
  for(let i=0;i<out.length;i++) if(out[i]===undefined) out[i]=null;
  return out;
}
const MIGRATIONS=[
  {to:1,note:'Numeric-keyed objects in logs become arrays',run(d){
    const fix=L=>{ if(!L||typeof L!=='object') return;
      for(const f of ARRAY_FIELDS) if(f in L) L[f]=asArray(L[f]);
      for(const x of Object.values(L.lifts||{})){ if(!x||typeof x!=='object') continue;
        if('warmup' in x) x.warmup=asArray(x.warmup);
        if('sets' in x) x.sets=asArray(x.sets) }
      if(L.se&&typeof L.se==='object'){ if('done' in L.se) L.se.done=asArray(L.se.done); if('ex' in L.se) L.se.ex=asArray(L.se.ex) } };
    for(const L of Object.values(d.logs||{})) fix(L);
    for(const p of Object.values(d.programs||{})) for(const L of Object.values((p&&p.logs)||{})) fix(L);
  }},
  {to:2,note:'Accessory ticks move from positions to slots',run(d){
    // Ticks were stored by position, so editing a day's list re-pointed every old one.
    // Pin them to the slot they meant at the moment of migration and the drift stops.
    // Archived programs are left alone: their day layout is not this plan's, so the
    // reader falls back to reading the old array in place rather than guessing here.
    for(const [date,L] of Object.entries(d.logs||{})){
      if(!Array.isArray(L.acc)) continue;
      const dp=dayPlan(date), slots=dp&&dp.acc?accSlots(dp.acc):[];
      const done={};
      L.acc.forEach((v,i)=>{ if(v&&slots[i]) done[slots[i]]=true });
      L.acc=Object.keys(done).length?{done}:{};
    }
  }},
  {to:3,note:'Accessory picks are keyed by day as well as slot',run(d,p){
    // 1.53 picked one exercise per job. The same job now appears on more than one day,
    // so a pick that was {biceps:'ezcurl'} becomes that choice on every day that has it.
    const spread=o=>{
      if(!o||typeof o!=='object'||Array.isArray(o)) return null;
      if(Object.keys(o).some(k=>ACC_DAYS[k])) return o;         // already per day
      const out={};
      for(const day of Object.keys(ACC_DAYS)){
        for(const [slot,id] of Object.entries(o)) if(accSlots(day).includes(slot)) (out[day]||(out[day]={}))[slot]=id;
      }
      return out;
    };
    const pk=spread(p.accPick); if(pk) p.accPick=pk;
    const cy=p.accCycle;
    if(cy&&typeof cy==='object') for(const [c,v] of Object.entries(cy)){ const n=spread(v); if(n) cy[c]=n }
  }},
  {to:4,note:'Warm-up rests shorter than a minute become 90 s',run(d,p){
    // 30 s and 45 s used to be on offer and are no longer: too short between ramp singles.
    // Anything set that low was almost certainly the old default rather than a choice.
    const w=p.warmRest;
    if(w&&typeof w==='object') for(const [k,v] of Object.entries(w)) if(+v<60) w[k]=90;
  }},
  {to:5,note:'The wave moves under the template that owns it',run(d,p){
    // plan.wave was global because Operator was the only template. Fighter's wave is a
    // different shape, so an edited wave belongs to the program it was edited for.
    if(Array.isArray(p.wave)&&p.wave.length){
      p.waves=Object.assign({},p.waves,{[STEMPL[p.stempl]?p.stempl:'operator']:p.wave});
    }
    delete p.wave;
  }},
  {to:6,note:'Silent timers become a three-way sound choice',run(d,p){
    // The old setting was a yes/no: beeps, or your music. Both at once is what people
    // actually want, and ducking gives it whenever the ring switch is on.
    if(!p.soundMode) p.soundMode=p.quietTimer?'silent':'duck';
    delete p.quietTimer;
  }},
];

