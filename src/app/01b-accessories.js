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
  hpull: {name:'Horizontal pull',  why:'Balances the pressing. The one accessory worth never skipping.'},
  rdelt: {name:'Rear delt / upper back', why:'Shoulder health under a lot of benching.'},
  core:  {name:'Core',             why:'Anti-rotation and anti-extension, not sit-ups.'},
  biceps:{name:'Biceps',           why:'Elbow health as much as size, with this much pulling.'},
  triceps:{name:'Triceps',         why:'Lockout strength that carries to the bench.'},
  delts: {name:'Shoulders',        why:'Side delts, which pressing alone misses.'},
  pullup:{name:'Pull-up progression', why:'Whatever rung you are on. The app prescribes it.'},
  sleg:  {name:'Single-leg',       why:'Catches the imbalance a bar hides.'},
  pchain:{name:'Posterior chain',  why:'Hamstrings and back, away from a maximal pull.'},
  carry: {name:'Carry / grip',     why:'Grip, trunk and a lot of general hardiness, cheaply.'},
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
  ohext:   {slot:'triceps',name:'Overhead triceps extension',gear:'Dumbbell, cable or band'},
  cgbench: {slot:'triceps',name:'Close-grip bench',         gear:'Barbell'},
  dip:     {slot:'triceps',name:'Dip',                      gear:'Bars'},
  kickback:{slot:'triceps',name:'Triceps kickback',         gear:'Dumbbells'},

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
  slrdl:   {slot:'sleg',  name:'Single-leg Romanian deadlift', gear:'Dumbbell or kettlebell'},

  rdl:     {slot:'pchain',name:'Romanian deadlift',         gear:'Barbell or dumbbells'},
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
const ACC_DAYS={ mon:['hpull','rdelt','core','biceps','triceps'], wed:['delts','pullup','biceps','triceps'], fri:['sleg','pchain','carry','biceps','triceps'] };
const ACC_DEF={ hpull:'csrow', rdelt:'facepull', core:'pallof', biceps:'bbcurl', triceps:'pushdown',
  delts:'latraise', pullup:'pu_prog', sleg:'rfess', pchain:'rdl', carry:'farmer' };

/* ---------------- reading the choice ---------------- */

// Your own exercises, stored in the plan so they reach every device.
function accCustom(){ const a=(plan.accCustom||[]); return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name&&ASLOT[x.slot]):[] }
function accAll(){ const out=Object.assign({},ALIB); for(const x of accCustom()) out[x.id]={slot:x.slot,name:x.name,gear:x.gear||'',mine:true}; return out }
function accEx(id){ return accAll()[id]||null }
function accName(id){ const e=accEx(id); return e?e.name:'' }
function accFor(slot){ const all=accAll(); return Object.keys(all).filter(k=>all[k].slot===slot) }

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
