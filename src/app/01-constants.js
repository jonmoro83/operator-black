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
  liss:{name:'LISS',sess:'30–45 min conversational',sys:'Aerobic base'}
};
// Activities for HIC/LISS days. Each logs the measure that makes sense for it:
// [field, unit] for HIC and for LISS. Results only compare within one activity + format.
const MOD={
  echo:{name:'Echo bike',hic:['cal','cal'],liss:['cal','cal'],wu:'5 min easy spin, then 3 × 15 s at HIC pace with 45 s easy between.'},
  rower:{name:'Rower',hic:['cal','cal'],liss:['dist','m'],wu:'5 min easy row, then 3 × 15 s at HIC pace with 45 s easy between.'},
  ski:{name:'Ski erg',hic:['cal','cal'],liss:['dist','m'],wu:'5 min easy, then 3 × 15 s at HIC pace with 45 s easy between.'},
  run:{name:'Run / sprints',hic:['dist','m'],liss:['dist','mi'],wu:'5 min jog, leg swings, then 3–4 strides building up to HIC pace.',tip:'Running adds impact. Keep hard efforts smooth (about 90%) on MAP, threshold and long intervals, and save true sprints for anaerobic days. Hills are easier on the legs than flat sprints.'},
  cycle:{name:'Cycling',hic:['watts','avg W'],liss:['dist','mi'],wu:'10 min easy spin, then 3 × 15 s at HIC pace.'},
  ruck:{name:'Ruck',hic:['dist','mi'],liss:['dist','mi'],load:true,tip:'Build ruck load gradually, starting around 10–15% of bodyweight. Rucking loads the back and hips, so keep it easy before heavy squat or deadlift days.'},
  hike:{name:'Hike',hic:['dist','mi'],liss:['dist','mi'],wu:'10 min easy walking, then 3 × 20 s hard uphill with a walk back down.',tip:'Hills do the work: on HIC days use a steep section for the hard efforts and walk down easy. On LISS days keep it conversational the whole way.'},
  swim:{name:'Swim',hic:['dist','yd'],liss:['dist','yd'],wu:'200 easy, then 4 × 25 building to HIC pace.'},
  other:{name:'Other',hic:null,liss:null}
};
// Plyometric program and exercise library, from Plyometric_Program_Thursday.pdf.
// Contacts count ground impacts (one landing = one contact), as the program does.
const PLIB={
  pogo:{name:'Pogo hop',
    setup:'Stand tall, feet hip width, arms at your sides or lightly bent. Weight on the balls of your feet.',
    exec:'Hop straight up repeatedly using only the ankles. Knees stay nearly straight and barely bend. Height is small, two to four inches. The goal is the shortest possible time on the ground, not air time.',
    cues:'Think “stiff spring.” Toes pulled up toward your shin before you land so the forefoot contacts first. The rhythm should sound fast and even.',
    errors:'Bending the knees to create height, which turns it into a squat jump and removes the ankle stimulus. Landing flat-footed or heel-first. Letting the rhythm slow as the set goes on.',
    note:'The lowest-stress drill in the program, and the one that most directly builds the Achilles and calf stiffness everything else relies on.'},
  askip:{name:'Ankle skip',
    setup:'Standing, ready to travel forward over about 20 metres.',
    exec:'Skip forward driving off the ankle with a minimal knee bend, opposite arm swinging. Cover ground with quick, light contacts rather than big bounds.',
    cues:'Light and quick. Contacts should be barely audible.',
    errors:'Turning it into a powerful A-skip with high knee drive. That is a different drill and adds fatigue you do not want before the main sets.'},
  broad:{name:'Broad jump (single effort)',
    setup:'Feet hip to shoulder width behind a line. Clear landing space of at least 3 metres. A flat, non-slip surface: grass or rubber gym flooring is ideal, concrete is the worst option.',
    exec:'Hinge and load by dipping to roughly a quarter squat, swinging the arms back. Jump forward and slightly up, driving the arms forward and fully extending hips, knees and ankles. Land on both feet with hips back and knees tracking over toes, then absorb and stick: no extra hop, no stagger.',
    cues:'Reach, don’t fall. Drive the arms hard; they contribute more distance than most people expect. Land like you are catching yourself in a quarter squat, not a deep one.',
    errors:'Landing stiff-legged with straight knees (jarring and risky). Knees collapsing inward on landing. Piking at the waist in the air. Taking a step after landing. If you cannot stick it, you jumped past your current ability to absorb it.',
    note:'Your measured lift for the block. Mark the takeoff line and measure to your rearmost heel. Log the best jump of each session.'},
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
    setup:'Balance on one leg, hands free. Flat surface with several metres ahead.',
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
    setup:'Space of 20 to 30 metres. Start with a few walking steps into the first bound rather than from a dead stop.',
    exec:'Alternate legs in exaggerated running strides, driving off one leg and landing on the other, covering as much ground per contact as possible. Opposite arm drives forward with each bound.',
    cues:'Push the ground behind you and reach with the landing leg. Long, powerful, rhythmic.',
    errors:'Turning it into ordinary running. Landing heel-first. Leaning back to try to hang in the air.'},
  bheight:{name:'Bound for height',
    setup:'Same as bounding for distance, with the same run-in.',
    exec:'Alternate-leg bounds emphasising vertical displacement rather than horizontal: drive the knee up and get as high as you can per contact, covering less ground.',
    cues:'Punch the knee up and the arms up. Think “up” on every contact.',
    errors:'Drifting back into distance bounding once you fatigue. Collapsing into a deep knee bend on landing.'},
  hurdle:{name:'Hurdle hop (low, continuous)',
    setup:'Three to five low hurdles, cones, or 6 to 12 inch objects in a line, roughly a metre apart. Use objects that fall over harmlessly if clipped.',
    exec:'Hop over each with both feet, landing and immediately rebounding into the next with minimal ground contact. Complete the line, walk back, repeat.',
    cues:'Minimal time on the ground. Land on the balls of the feet, ankles stiff.',
    errors:'Hurdles too high, which forces a knee tuck and a long pause on each landing. Pausing between hurdles to re-set.',
    note:'If you only have one or two objects, use fewer and reset between passes rather than raising the height.'},
  depth:{name:'Depth jump',
    setup:'Box 12 to 16 inches high. Stand at the edge. Landing area must be flat and non-slip with room to jump forward or up.',
    exec:'Step off the box. Do not jump off or down. Land on both feet on the balls of the feet and, as fast as humanly possible, rebound into a maximal vertical jump. The time between landing and takeoff is the entire exercise.',
    cues:'Land and leave. Imagine the floor is hot. Target roughly a quarter-second on the ground; if you sink into a deep squat before jumping, the box is too high.',
    errors:'Jumping off the box instead of stepping, which changes the landing force unpredictably. Using too high a box: the single most common error, and it converts an elastic drill into a heavy eccentric one. Pausing on landing.',
    note:'Highest-stress movement in the program. If your vertical rebound off the box is lower than a normal standing vertical jump, the box is too high. Lower it. Start at 12 inches even if that feels trivially easy.'}
};
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
    ['Knee-to-wall ankle mobilisation','10 reps per side'],['Foot / arch roll on a ball','60 sec per side'],
    ['Couch stretch','60–90 sec per side']]},
  off:{name:'Full mobility',why:'No training today: the best day for the long holds.',items:[
    ['Couch stretch','90 sec per side'],['Frog stretch, gentle rocking','2 min'],
    ['90/90 switches and lean holds','45 sec per side'],['Pigeon or figure-4','60–90 sec per side'],
    ['Thoracic extension over a foam roller','10 slow reps'],['Dead hang','30 sec'],
    ['Diaphragmatic breathing, legs up the wall','2–3 min']]}
};
const PLYO_WARMUP=[['pogo','Pogo hops','3 × 10','Wakes up the ankle spring; short, fast ground contacts'],['askip','Ankle skips','2 × 20 m','Rhythm and elastic timing through the calf and Achilles'],['broad','Submaximal broad jumps','3 × 1 at ~70%','Rehearses the landing pattern before full effort']];
const PLYO=[
  {name:'Extensive',target:60,desc:'Bilateral, stick every landing. This phase is about teaching the landing and building tissue tolerance, not chasing distance.',
   ex:[{id:'broad',label:'Broad jump, single effort',s:5,r:'3',c:15,rest:60},{id:'box',label:'Box jump, step down',s:5,r:'3',c:15,rest:60},{id:'lbound',label:'Lateral bound, stick 2 sec',s:4,r:'4 / side',c:16,rest:60},{id:'pogo',label:'Pogo hops in place',s:4,r:'8',c:32,rest:45,low:true}]},
  {name:'Unilateral + reactive',target:80,desc:'Single-leg work enters. Measure and log your best broad jump every session from here on; it is your progress marker.',
   ex:[{id:'cbroad',label:'Broad jump, 2 continuous',s:5,r:'2 jumps',c:20,rest:90},{id:'slhop',label:'Single-leg hop, straight line',s:4,r:'4 / side',c:32,rest:90},{id:'bdist',label:'Bound for distance',s:4,r:'6 contacts',c:24,rest:90},{id:'hurdle',label:'Hurdle hops, low, continuous',s:3,r:'5',c:15,rest:90}]},
  {name:'Elastic',target:90,desc:'Depth jumps enter: the highest-stress sets in the block. Start at the lower box height and only raise it if landings stay silent and controlled.',
   ex:[{id:'depth',label:'Depth jump from 12–16 in',s:5,r:'3',c:15,rest:120},{id:'sllat',label:'Single-leg lateral hop, continuous',s:4,r:'5 / side',c:40,rest:90},{id:'cbroad',label:'Continuous broad jump, 3 reps',s:4,r:'3 jumps',c:24,rest:90},{id:'bheight',label:'Bound for height',s:3,r:'4',c:12,rest:90}]}
];
const PLYO_PULLBACK=['Broad jump distance is down more than 5% from recent sessions before you have even started the work sets.','Achilles, patellar tendon or shin soreness you can feel while walking. Tendon complaints build quietly over weeks, then stop you for months.','Sleep has been short or broken for several nights running.','Wednesday’s squat session was unusually heavy or left you sore into Thursday.'];
function plyoEntry(id){const e=PLIB[id];if(!e)return '';return `<div class="plib">${[['Setup',e.setup],['Execution',e.exec],['Cues',e.cues],['Common errors',e.errors]].map(([t,x])=>`<p><b>${t}.</b> ${esc(x)}</p>`).join('')}${e.note?`<p class="plib-note">${esc(e.note)}</p>`:''}</div>`}
// A week away from the barbell. Rep targets rather than percentages, so nothing here
// touches your maxes, and the cycle pauses rather than counting these as trained weeks.
const TRAVEL={
  day1:{name:'Squat pattern and push',items:[
    ['Goblet or DB front squat','3 × 8–12'],['Push-up or DB bench press','3 × 10–15'],
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
  wed:['Arms: curls + triceps pushdown','Shoulders: DB lateral raise','Pull-up progression: negatives or band-assisted'],
  fri:['Single-leg: rear-foot-elevated split squat','Posterior chain: back extension or hamstring curl','Carry / grip: farmer carry']
};
const DEF={
  startMonday:'2026-09-28', bridge:true, unit:'lb', bar:45, bodyweight:null,
  maxes:{squat:null,bench:null,pull:null,ohp:null,wpu:null,dead:null},
  lift3Name:'Lat pulldown', machineNote:'',
  l3:{on:{pull:true,ohp:true,wpu:false},mode:'same',primary:'pull'},
  acc:null,
  basis:'1rm', tmPct:90,
  round:{squat:5,bench:5,pull:5,ohp:5,wpu:2.5,dead:5},
  wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:3,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:3,r:2,p:95}],
  inc:{squat:10,bench:5,pull:5,ohp:5,wpu:2.5,dead:10},
  deloadEvery:2, testEvery:3,
  deload:{s:2,r:5,p:60},
  goal:'lose', sleepTarget:8, proteinPerLb:0.8,
  rest:{squat:3,bench:3,pull:2,ohp:3,wpu:3,dead:3},
  cardio:{def:'echo'},
  askDeload:true, voice:false, guideAuto:true,
  plates:{lb:[45,35,25,10,5,2.5],kg:[25,20,15,10,5,2.5,1.25]},
  cycleMaxes:{}, inserts:{}, skips:{}
};
