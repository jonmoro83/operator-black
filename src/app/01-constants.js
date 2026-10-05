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
  fobbit:{name:'FOBBIT',sess:'2 min base, then a set of reps × 10',sys:'Aerobic base with bursts',noMetric:true}
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
  vertj:{name:'Vertical jump',
    setup:'Stand side on to a wall. Reach up with the near arm, feet flat, and mark the highest point your fingers reach: that is your standing reach. Chalk, tape or a coach\u2019s eye all work; a Vertec or a wall you can mark is easiest.',
    exec:'From a standstill, dip to about a quarter squat, swing both arms down and back, then jump as high as you can and touch the wall at the top with the near hand. No run-up and no step into it. Three attempts, resting fully between them, and keep the best.',
    cues:'Down fast, up faster: the dip should be quick and shallow. Throw the arms up as you extend. Reach at the top of the jump, not on the way up.',
    errors:'Dipping too deep or too slowly, which loses the stretch reflex. Taking a step in. Measuring the jump touch but forgetting the standing reach, which is the number you subtract.',
    note:'Jump height is the touch height minus your standing reach. Record the same way every time \u2014 same wall, same shoes, same arm \u2014 or the comparison is meaningless.'},
  triple:{name:'Standing triple jump',
    setup:'A line to start behind and about 10 metres of flat, forgiving space. Grass or rubber flooring; do not test this on concrete. Warm up fully first: it is the highest-force test in the set.',
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
  slam:{name:'Overhead med ball slam',
    setup:'Feet hip to shoulder width, a non-bouncy slam ball of 8–15 lb. Floor you do not mind hitting.',
    exec:'Reach the ball overhead with the whole body long, then throw it into the floor in front of your feet as hard as you can, folding at the hips and ribs. Pick it up, reset, repeat.',
    cues:'Throw the ball through the floor, not at it. The power comes from the hips and trunk, not the arms.',
    errors:'Bending only at the arms. Rushing the reset so the set turns into conditioning. Using a bouncy ball, which takes the finish away from you.',
    note:'Intent is the whole exercise. If the ball is heavy enough to slow you down, it is too heavy.'},
  chestpass:{name:'Med ball chest pass',
    setup:'A metre or two from a solid wall, ball at the sternum, athletic stance.',
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
const PLYO_PULLBACK=['Broad jump distance is down more than 5% from recent sessions before you have even started the work sets.','Achilles, patellar tendon or shin soreness you can feel while walking. Tendon complaints build quietly over weeks, then stop you for months.','Sleep has been short or broken for several nights running.','Wednesday’s squat session was unusually heavy or left you sore into Thursday.'];
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
  wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:3,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:3,r:2,p:95}],
  inc:{squat:10,bench:5,pull:5,ohp:5,wpu:2.5,dead:10},
  deloadEvery:0, testEvery:2,   // the book: retest after 2 blocks, no scheduled deload
  deload:{s:2,r:5,p:60},
  goal:'lose', sleepTarget:8, proteinPerLb:0.8,
  rest:{squat:3,bench:3,pull:2,ohp:3,wpu:3,dead:3},
  warmRest:{squat:90,bench:90,pull:90,ohp:90,wpu:90,dead:90},
  cardio:{def:'echo'},
  askDeload:true, voice:false, guideAuto:true,
  plates:{lb:[45,35,25,10,5,2.5],kg:[25,20,15,10,5,2.5,1.25]},
  cycleMaxes:{}, inserts:{}, skips:{}
};
