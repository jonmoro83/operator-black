/* ---------------- accessories ----------------
Accessories used to be lines of text with a tick box, and the ticks were stored by
position: edit the list in Setup and every old checkmark silently pointed at a different
movement. This replaces that with slots.

A **slot** is the job (Horizontal pull, Biceps, Carry). An **exercise** fills it. You pick
the exercise per cycle, the way cluster lifts work, and you can swap one for a single
session when the barbell is taken. Everything is logged against the slot, so nothing
re-points when a list changes, and against the exercise, so a year from now the log still
says which curl it was.

The catalogue is here; your own additions live in `plan.accCustom` and sync with the rest
of the plan. There is no separate admin screen: one person uses this app, and adding a
name to a list is not worth a second login. */

const ASLOT={
  hpull: {name:'Horizontal pull',  why:'Balances the pressing, and sits on the overhead day for that reason. The one accessory worth never skipping.'},
  rdelt: {name:'Rear delt / upper back', why:'Shoulder health under a lot of benching.'},
  core:  {name:'Core',             why:'Anti-rotation and anti-extension, not sit-ups.'},
  biceps:{name:'Biceps',           why:'Elbow health as much as size, with this much pulling.'},
  triceps:{name:'Triceps',         why:'Lockout strength that carries to the bench.'},
  spress:{name:'Shoulder press',   why:'A lighter overhead push than the main lift, on the day the main lift is not pressing overhead.'},
  // Kept as `delts` rather than renamed: everything already logged and picked is keyed by
  // it, and its catalogue was only ever lateral raises, so the id still means what it did.
  delts: {name:'Lateral raise',    why:'Side delts, which pressing alone misses. Away from the overhead press day.'},
  pullup:{name:'Pull-up progression', why:'Whatever rung you are on. The app prescribes it.'},
  sleg:  {name:'Single-leg',       why:'Catches the imbalance a bar hides.'},
  pchain:{name:'Posterior chain',  why:'Hamstrings and back, away from a maximal pull.'},
  carry: {name:'Carry / grip',     why:'Grip, trunk and a lot of general hardiness, cheaply. Last, because a fried grip makes everything after it worse.'},
};

// gear: what you need, so the picker reads usefully when the rack is busy.
const ALIB={
  csrow:   {slot:'hpull', name:'Chest-supported row',       gear:'Bench + dumbbells, or a machine'},
  bbrow:   {slot:'hpull', name:'Barbell bent-over row',     gear:'Barbell'},
  dbrow:   {slot:'hpull', name:'Single-arm dumbbell row',   gear:'Dumbbell + bench'},
  cablerow:{slot:'hpull', name:'Seated cable row',          gear:'Cable'},
  invrow:  {slot:'hpull', name:'Inverted row',              gear:'Bar or rings'},
  tbar:    {slot:'hpull', name:'T-bar row',                 gear:'T-bar or landmine'},
  kbrow:   {slot:'hpull', name:'Kettlebell row',            gear:'Kettlebell'},

  facepull:{slot:'rdelt', name:'Face pull',                 gear:'Cable or band'},
  revfly:  {slot:'rdelt', name:'Reverse fly',               gear:'Dumbbells'},
  pullapart:{slot:'rdelt',name:'Band pull-apart',           gear:'Band'},
  prone_y: {slot:'rdelt', name:'Prone Y-raise',             gear:'Bench, light plates'},

  pallof:  {slot:'core',  name:'Pallof press',              gear:'Cable or band'},
  hangknee:{slot:'core',  name:'Hanging knee raise',        gear:'Bar'},
  hangleg: {slot:'core',  name:'Hanging leg raise',         gear:'Bar'},
  abwheel: {slot:'core',  name:'Ab wheel',                  gear:'Wheel'},
  plank:   {slot:'core',  name:'Plank',                     gear:'Nothing'},
  sideplank:{slot:'core', name:'Side plank',                gear:'Nothing'},
  copen:   {slot:'core',  name:'Copenhagen plank',          gear:'Bench or box'},
  deadbug: {slot:'core',  name:'Dead bug',                  gear:'Nothing'},
  cablecr: {slot:'core',  name:'Cable crunch',              gear:'Cable'},

  bbcurl:  {slot:'biceps',name:'Barbell curl',              gear:'Barbell'},
  ezcurl:  {slot:'biceps',name:'EZ-bar curl',               gear:'EZ bar'},
  dbcurl:  {slot:'biceps',name:'Dumbbell curl',             gear:'Dumbbells'},
  hammer:  {slot:'biceps',name:'Hammer curl',               gear:'Dumbbells'},
  inccurl: {slot:'biceps',name:'Incline dumbbell curl',     gear:'Dumbbells + bench'},
  cablecurl:{slot:'biceps',name:'Cable curl',               gear:'Cable'},
  chinup:  {slot:'biceps',name:'Chin-up',                   gear:'Bar'},

  pushdown:{slot:'triceps',name:'Triceps pushdown',         gear:'Cable'},
  skull:   {slot:'triceps',name:'Skullcrusher',             gear:'EZ bar or dumbbells'},
  jmpress: {slot:'triceps',name:'JM press',                 gear:'Barbell or EZ bar'},
  ohext:   {slot:'triceps',name:'Overhead triceps extension',gear:'Dumbbell, cable or band'},
  cgbench: {slot:'triceps',name:'Close-grip bench',         gear:'Barbell'},
  dip:     {slot:'triceps',name:'Dip',                      gear:'Bars'},
  kickback:{slot:'triceps',name:'Triceps kickback',         gear:'Dumbbells'},

  dbohp:   {slot:'spress',name:'Dumbbell shoulder press',   gear:'Dumbbells'},
  seatedohp:{slot:'spress',name:'Seated dumbbell press',    gear:'Dumbbells + bench'},
  arnold:  {slot:'spress',name:'Arnold press',              gear:'Dumbbells'},
  landmine:{slot:'spress',name:'Landmine press',            gear:'Landmine or a barbell in a corner'},
  pushpress:{slot:'spress',name:'Push press',               gear:'Barbell'},
  machohp: {slot:'spress',name:'Machine shoulder press',    gear:'Machine'},
  kbpress: {slot:'spress',name:'Single-arm kettlebell press',gear:'Kettlebell'},
  pike:    {slot:'spress',name:'Pike push-up',              gear:'Nothing'},

  latraise:{slot:'delts', name:'Dumbbell lateral raise',    gear:'Dumbbells'},
  cablelat:{slot:'delts', name:'Cable lateral raise',       gear:'Cable'},
  machlat: {slot:'delts', name:'Machine lateral raise',     gear:'Machine'},
  uprow:   {slot:'delts', name:'Upright row',               gear:'Barbell or dumbbells'},
  bandlat: {slot:'delts', name:'Band lateral raise',        gear:'Band'},

  pu_prog: {slot:'pullup',name:'Pull-up progression',       gear:'Bar'},
  pu_band: {slot:'pullup',name:'Band-assisted pull-up',     gear:'Bar + band'},
  pu_neg:  {slot:'pullup',name:'Negative pull-up',          gear:'Bar'},
  pu_wt:   {slot:'pullup',name:'Weighted pull-up',          gear:'Bar + belt'},

  rfess:   {slot:'sleg',  name:'Rear-foot-elevated split squat', gear:'Dumbbells + bench'},
  lunge:   {slot:'sleg',  name:'Walking lunge',             gear:'Dumbbells'},
  revlunge:{slot:'sleg',  name:'Reverse lunge',             gear:'Dumbbells or barbell'},
  stepup:  {slot:'sleg',  name:'Step-up',                   gear:'Box + dumbbells'},
  cossack: {slot:'sleg',  name:'Cossack squat',             gear:'Nothing, or a light weight'},
  slrdl:   {slot:'sleg',  name:'Single-leg Romanian deadlift', gear:'Dumbbell or kettlebell'},

  rdl:     {slot:'pchain',name:'Romanian deadlift',         gear:'Barbell or dumbbells'},
  revhyper:{slot:'pchain',name:'Reverse hyper',             gear:'Reverse hyper, or a high bench'},
  backext: {slot:'pchain',name:'Back extension',            gear:'Bench or GHD'},
  hamcurl: {slot:'pchain',name:'Hamstring curl',            gear:'Machine'},
  goodmorn:{slot:'pchain',name:'Good morning',              gear:'Barbell'},
  ghr:     {slot:'pchain',name:'Glute-ham raise',           gear:'GHD'},
  nordic:  {slot:'pchain',name:'Nordic curl',               gear:'A partner or a strap'},
  kbswing: {slot:'pchain',name:'Kettlebell swing',          gear:'Kettlebell'},

  farmer:  {slot:'carry', name:'Farmer carry',              gear:'Dumbbells or handles'},
  suitcase:{slot:'carry', name:'Suitcase carry',            gear:'One dumbbell'},
  trapcarry:{slot:'carry',name:'Trap-bar carry',            gear:'Trap bar'},
  deadhang:{slot:'carry', name:'Dead hang',                 gear:'Bar'},
  pinch:   {slot:'carry', name:'Plate pinch',               gear:'Plates'},
  sandbag: {slot:'carry', name:'Sandbag carry',             gear:'Sandbag'},
};

// Which slots each lifting day fills, and what fills them unless you say otherwise.
// Same count per day as the lists these replaced; arms split across the two press days.
// Shoulders sit on OP1, away from whichever day the overhead press lands on, and the
// row moves to OP2 to balance it. Rear delts stay with the shoulders: that slot is
// shoulder health, not back volume.
// Posterior chain twice a week, not once: Operator squats three times and deadlifts on
// one of them, so a single hamstring job on Friday was the thinnest part of the split.
// It goes first on Monday, before the small stuff, because it is the biggest thing there.
const ACC_DAYS={ mon:['pchain','spress','rdelt','core','biceps','triceps'], wed:['hpull','delts','pullup','biceps','triceps'], fri:['sleg','pchain','biceps','triceps','carry'],
  // Fighter lifts twice a week, so the same jobs have to fit across two days instead of
  // three. Like the three-day split, this is the app's arrangement and not the book's:
  // TB1 prescribes no accessory work, it only says Fighter leaves less room for it.
  f1:['spress','hpull','core','biceps','triceps'], f2:['sleg','pchain','pullup','delts','carry'],
  // Zulu's halves run twice each, so the same two lists cover four days. The book says
  // Zulu leaves the most room for assistance work, so these are the fullest.
  // Zulu's A day is squat and bench with no hinge in it, and B already deadlifts, so
  // the posterior chain goes on A — which Zulu runs twice a week anyway.
  z1:['pchain','spress','rdelt','core','biceps','triceps'], z2:['hpull','delts','pullup','sleg','carry'],
  // Fighter HT is deliberately spare: the book says bodyweight finishers are fine and
  // anything more means you picked the wrong template.
  h1:['pullup','biceps','triceps'], h2:['core','rdelt'],
  // Grey Man's two supplementary clusters. The book says four to six exercises, split
  // in two, and that what goes in them is yours — these are a starting split.
  // Same reasoning for Grey Man's A day, and single-leg comes out to make room: the
  // book caps the supplementary clusters at "no more than four to six" exercises, and
  // six is what these are. Squat is already on this day, so single-leg was the most
  // redundant of the four.
  gm1:['pchain','spress','triceps'], gm2:['hpull','biceps','core'],
  // Mass is spare on purpose: the book says weighted pull-ups cover the arms well
  // enough that you need not train them separately, and the deadlift day is its own
  // posterior chain. These are the app's, as every accessory split here is.
  ms1:['core','triceps'], ms2:['sleg','carry'],
  // Gladiator is high volume and high frequency and the book says use it sparingly, so
  // there is little room for anything else. Two jobs a day, and the deadlift day covers
  // the posterior chain on its own.
  gl1:['core','triceps'], gl2:['biceps','carry'] };
const ACC_DEF={ hpull:'csrow', rdelt:'facepull', core:'pallof', biceps:'bbcurl', triceps:'pushdown',
  spress:'dbohp', delts:'latraise', pullup:'pu_prog', sleg:'rfess', pchain:'rdl', carry:'farmer' };

/* ---------------- reading the choice ---------------- */

// Your own exercises, stored in the plan so they reach every device.
// Anything a person added before the catalogue was shared. Still resolved so nobody's
// choice breaks; no longer addable, because the list is curated now.
function accCustom(){ const a=(plan.accCustom||[]); return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name&&ASLOT[x.slot]):[] }
function accShared(){ return Array.isArray(catalog)?catalog.filter(x=>x&&x.id&&ASLOT[x.slot]):[] }

// Everything that can be resolved, hidden ones included. A retired movement still has
// to have a name: someone may be mid-cycle with it, and showing them a blank row or
// silently swapping their exercise would be worse than letting them finish with it.
function accAll(){
  const out=Object.assign({},ALIB);
  for(const x of accShared()){
    if(x.hidden&&!x.name){ if(out[x.id]) out[x.id]=Object.assign({},out[x.id],{hidden:true}); continue }
    out[x.id]={slot:x.slot,name:x.name,gear:x.gear||'',shared:true,hidden:!!x.hidden};
  }
  for(const x of accCustom()) if(!out[x.id]) out[x.id]={slot:x.slot,name:x.name,gear:x.gear||'',mine:true};
  return out;
}
function accEx(id){ return accAll()[id]||null }
function accName(id){ const e=accEx(id); return e?e.name:'' }
// What to offer in a picker: everything not retired, plus whatever is already chosen
// here so the dropdown still shows the right thing.
function accFor(slot,keep){
  const all=accAll();
  return Object.keys(all).filter(k=>all[k].slot===slot&&(!all[k].hidden||k===keep));
}

// The slots a day fills. Editable per day, falling back to the defaults above.
function accSlots(day){
  const a=(plan.accSlots||{})[day];
  return Array.isArray(a)?a.filter(s=>ASLOT[s]):(ACC_DAYS[day]||[]);
}

// What fills a slot, on a given day. Keyed by day as well as slot, because the same job
// turns up on more than one Operator day and there is no reason the same curl has to do
// it every time. Picked per cycle, like the cluster lifts: `accCycle[n]` is this block's
// choice and `accPick` is what later blocks start on.
function accPickFor(day,slot,cycle){
  const c=cycle!=null?(((plan.accCycle||{})[cycle]||{})[day]||{})[slot]:null;
  if(c&&accEx(c)) return c;
  const p=((plan.accPick||{})[day]||{})[slot];
  if(p&&accEx(p)) return p;
  return ACC_DEF[slot]||accFor(slot)[0]||null;
}
function accCycleOf(date){ const wk=weekOf(date); return wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):null }
function accDayOf(date){ const dp=dayPlan(date); return dp&&dp.acc||null }
// What you are actually doing in that slot today: a one-session swap wins over the block.
function accOn(date,slot){
  const d=((lg(date).acc||{}).ex||{})[slot];
  if(d&&accEx(d)) return d;
  return accPickFor(accDayOf(date),slot,accCycleOf(date));
}
function accSwapped(date,slot){
  const d=((lg(date).acc||{}).ex||{})[slot];
  return !!(d&&accEx(d)&&d!==accPickFor(accDayOf(date),slot,accCycleOf(date)));
}

/* ---------------- what you logged ---------------- */

function accSets(date,slot){ const A=lg(date).acc; if(Array.isArray(A)) return [];
  const s=((A||{}).sets||{})[slot]; return Array.isArray(s)?s:[] }
function accDone(date,slot){
  const A=lg(date).acc;
  // An archived program still holds the old by-position array. Read it where it sits
  // rather than rewriting history we cannot map with confidence.
  if(Array.isArray(A)){ const dp=dayPlan(date), sl=dp&&dp.acc?accSlots(dp.acc):[]; const i=sl.indexOf(slot); return i>=0&&!!A[i] }
  if(((A||{}).done||{})[slot]) return true;
  return accSets(date,slot).some(x=>x&&((x.w!=null&&x.w!=='')||(x.r!=null&&x.r!=='')));
}
function accDoneCount(date,day){ return accSlots(day).filter(s=>accDone(date,s)).length }

/* ---------------- bands ----------------
A band has no number on it, only a colour, and the colour means different things by
brand. Worse, it means different things within one brand: Rogue's own Monster chart
lists Red twice, at 18 lb and at 115 lb, so a colour alone cannot identify a band.
And the published figure is peak resistance at full stretch — the force at the bottom
of a rep is a fraction of it.

So the app does not pretend to a lookup. Your bands are a list you keep, each with the
number you want it logged as, and the presets below are a starting point you can edit.
They are Rogue's own published Monster Band figures; third-party charts for the same
bands disagree by enough (Black at 65 lb or at 100 lb) that only the maker's is worth
seeding from. */
const BAND_PRESETS={
  rogue:{name:'Rogue Monster',
    note:'Rogue publish one figure per band, their peak resistance at full stretch.',
    bands:[{n:'Rogue #0 Orange',w:9},{n:'Rogue #1 Red',w:18},{n:'Rogue #2 Blue',w:30},
           {n:'Rogue #3 Green',w:40},{n:'Rogue #4 Black',w:65},{n:'Rogue #5 Purple',w:95},
           {n:'Rogue #6 Red',w:115},{n:'Rogue #7 Silver',w:225}]},
  elitefts:{name:'elitefts Pro',
    note:'elitefts publish a range per band, and their own pages do not agree with each other \u2014 the Pro Mini is listed at 25\u201354 lb in one place and 5\u201335 lb in another. These are the midpoints of the higher, more consistent set. Treat them as a starting point and nothing more.',
    bands:[{n:'elitefts Micro',lo:13.8,hi:29.2},{n:'elitefts Mini',lo:25.5,hi:53.8},
           {n:'elitefts Monster Mini',lo:39.4,hi:91.5},{n:'elitefts Light',lo:56.8,hi:124.9},
           {n:'elitefts Average',lo:86.9,hi:192.5},{n:'elitefts Strong',lo:122.9,hi:275.1}]},
  westside:{name:'Westside Barbell',
    note:'Westside publish a range per band, and their own articles quote higher numbers again depending on whether the band is choked, doubled or anchored, and on how tall you are. These are the midpoints of the product-page ranges. There is no Average here because the product pages do not list one.',
    bands:[{n:'Westside Mini',lo:30,hi:70},{n:'Westside Monster Mini',lo:65,hi:105},
           {n:'Westside Light',lo:70,hi:130},{n:'Westside Strong',lo:180,hi:290}]},
};
// The number a preset seeds with: the published figure where there is one, the middle of
// the range where there is not. A range cannot be a log entry, and the midpoint is the
// least wrong single number to start from.
function bandPresetW(b){ return b.w!=null?b.w:Math.round((b.lo+b.hi)/2) }
function bandPresetLabel(b){ return b.w!=null?String(b.w):Math.round(b.lo)+'\u2013'+Math.round(b.hi) }

function bands(){
  const b=plan.bands;
  return Array.isArray(b)?b.filter(x=>x&&x.n&&+x.w>0).map(x=>({n:String(x.n),w:+x.w})):[];
}
// An exercise is banded if its gear says so. Data-driven, so a new band exercise needs
// no second list to be added to.
function isBandEx(id){ const e=accEx(id); return !!e&&/band/i.test(e.gear||'') }
function bandAdd(n,w){
  n=String(n||'').trim(); w=+w;
  if(!n||!(w>0)) return false;
  if(bands().some(b=>b.n.toLowerCase()===n.toLowerCase())) return false;
  mutatePlan(p=>{p.bands=[...bands(),{n,w}]});
  return true;
}
function bandRemove(n){
  const next=bands().filter(b=>b.n!==n);
  if(next.length===bands().length) return false;
  mutatePlan(p=>{p.bands=next});
  return true;
}
// Seeding converts, because the published chart is in pounds and your log is in whatever
// you train in. This is new data being created from a known unit, not a stored number
// being rewritten, so it is the one place a conversion belongs.
function bandSeed(brand){
  const set=BAND_PRESETS[brand]; if(!set) return 0;
  const kg=u()==='kg', have=new Set(bands().map(b=>b.n.toLowerCase()));
  const add=set.bands.filter(b=>!have.has(b.n.toLowerCase()))
    .map(b=>{const w=bandPresetW(b); return {n:b.n,w:kg?Math.round(w*0.4536*2)/2:w}});
  if(!add.length) return 0;
  mutatePlan(p=>{p.bands=[...bands(),...add]});
  return add.length;
}

/* ---------------- supersets ----------------
Pairing two jobs means doing a set of each back to back and resting once, which is how
most people run curls against pushdowns. Stored as the *first* slot of each pair, per
day, because a pair is defined by where it starts: `accSuper.mon = ['biceps']` pairs
biceps with whatever the day lists next.

Keeping it positional rather than storing both names means re-ordering a day's jobs, or
removing one, cannot leave a pair pointing at something that is no longer there. */
function accSuperSet(day){ const a=(plan.accSuper||{})[day]; return Array.isArray(a)?a:[] }
// The day's jobs grouped into runs: [[a,b],[c]] — a paired with b, then c on its own.
function accGroups(day){
  const slots=accSlots(day), on=new Set(accSuperSet(day)), out=[];
  for(let i=0;i<slots.length;i++){
    if(on.has(slots[i])&&i+1<slots.length){ out.push([slots[i],slots[i+1]]); i++ }
    else out.push([slots[i]]);
  }
  return out;
}
function accIsSuper(day,slot){ return accGroups(day).some(g=>g.length>1&&g[0]===slot) }
// Can only pair with something after it, and not with a job that is already the second
// half of a pair — otherwise one movement ends up in two supersets at once.
function accCanSuper(day,slot){
  const g=accGroups(day);
  const i=g.findIndex(x=>x[0]===slot);
  // The one after it has to be free as well. Without this, pairing a job could take the
  // first half of a pair that already existed and quietly re-draw someone else's.
  return i>=0&&g[i].length===1&&i+1<g.length&&g[i+1].length===1;
}
function accSuperToggle(day,slot){
  const cur=accSuperSet(day);
  if(cur.includes(slot)){ mutatePlan(p=>{p.accSuper=Object.assign({},p.accSuper,{[day]:cur.filter(s=>s!==slot)})}); return true }
  if(!accCanSuper(day,slot)) return false;
  mutatePlan(p=>{p.accSuper=Object.assign({},p.accSuper,{[day]:[...cur,slot]})});
  return true;
}
