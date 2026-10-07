(function(){
"use strict";
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
  trail:{name:'Trail run',hic:['dist','m'],liss:['dist','mi'],elev:true,wu:'10 min easy jog on flat ground, then 3 × 20 s hard uphill with an easy jog back down.',tip:'Uneven ground makes pace meaningless, so run the hard efforts by breathing rather than by watch. Downhills are where the damage is: that is eccentric load, and it turns up as sore quads two days later, so take them easy before a squat day.'},
  ruck:{name:'Ruck',hic:['dist','mi'],liss:['dist','mi'],load:true,elev:true,tip:'Build ruck load gradually, starting around 10–15% of bodyweight. Rucking loads the back and hips, so keep it easy before heavy squat or deadlift days.'},
  hike:{name:'Hike',hic:['dist','mi'],liss:['dist','mi'],elev:true,wu:'10 min easy walking, then 3 × 20 s hard uphill with a walk back down.',tip:'Hills do the work: on HIC days use a steep section for the hard efforts and walk down easy. On LISS days keep it conversational the whole way.'},
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
  // Calendar feed. mode 'allday' or 'timed'; time/weekend are HH:MM in your own local
  // time wherever you are; alarm is minutes before the start, null for none.
  cal:{mode:'allday',time:'06:00',weekend:'',alarm:null},
  // Accessories: which slots each day fills, what fills them this block and later,
  // and your own additions to the catalogue. See 01b-accessories.js.
  accSlots:{}, accPick:{}, accCycle:{}, accCustom:[],
  schema:0,   // 0 = written before versioning existed; migrate() brings it to SCHEMA
  wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:3,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:3,r:2,p:95}],
  inc:{squat:10,bench:5,pull:5,ohp:5,wpu:2.5,dead:10},
  deloadEvery:0, testEvery:2,   // the book: retest after 2 blocks, no scheduled deload
  deload:{s:2,r:5,p:60},
  goal:'lose', sleepTarget:8, proteinPerLb:0.8,
  rest:{squat:3,bench:3,pull:2,ohp:3,wpu:3,dead:3},
  warmRest:{squat:90,bench:90,pull:90,ohp:90,wpu:90,dead:90},
  cardio:{def:'echo'},
  askDeload:true, voice:false, guideAuto:true,
  elevPer:{lb:1000,kg:190},
  se:{cluster:'bw',custom:[],rest:60},
  bbVer:{},
  plates:{lb:[45,35,25,10,5,2.5],kg:[25,20,15,10,5,2.5,1.25]},
  cycleMaxes:{}, inserts:{}, skips:{}
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
// Strength-first reverses SE and Max Strength. The book says only "reverse it" and gives
// no rep scheme for the late SE weeks, so this ramp to 50 is ours, and says so on screen.
const BB_SF_SE=[[3,30],[3,40],[3,50]];
// The book's example clusters. Five to eight exercises covering the whole body.
const SE_CLUSTERS={
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
const SCHEMA=3;
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
];

/* ---------------- warm-up and mobility library ---------------- */
// The same treatment the plyometric drills get: what it is for, how to set it up, what
// good looks like, and the ways it usually goes wrong. Most of these are done badly far
// more often than they are done wrong-exercise, so the cues matter more than the names.
const MLIB={
  raise:{name:'Raise the temperature',
    setup:'Any steady machine or an easy jog. Nothing that needs a decision.',
    exec:'Four to five minutes at a pace you could hold a conversation at, building slightly. You want warm, not tired.',
    cues:'Finish breathing a little deeper and faintly warm. If you are sweating hard you have gone too far.',
    errors:'Treating it as conditioning. Skipping it because the gym is already warm — the point is blood flow and joint fluid, not air temperature.'},
  breath9090:{name:'90/90 breathing',
    setup:'On your back, feet flat on a bench or against a wall, hips and knees at 90 degrees. Low back flat.',
    exec:'Breathe in through the nose for four, out through the mouth for six to eight, emptying completely. Five breaths.',
    cues:'The ribs should move down and in on the exhale, not up. Push gently through the heels to keep the pelvis tucked.',
    errors:'Arching the low back on the inhale. Rushing the exhale — the long out-breath is what settles the nervous system before a heavy session.',
    note:'Thirty seconds, and it is the difference between walking in distracted and starting the first warm-up set present.'},
  catcow:{name:'Cat / cow',
    setup:'On hands and knees, hands under shoulders, knees under hips.',
    exec:'Round the spine one segment at a time from the tailbone up, then reverse into extension the same way. Slow, eight to ten reps.',
    cues:'Move the whole spine, not just the lower back. Breathe out as you round, in as you extend.',
    errors:'Hinging at one point and letting the rest stay rigid. Going fast enough that it becomes a rock rather than a stretch.'},
  thread:{name:'Thread the needle',
    setup:'On hands and knees. One arm reaches up toward the ceiling, eyes following the hand.',
    exec:'Thread that arm under the opposite shoulder, reaching across until the shoulder and ear rest toward the floor, then open back up. Six to eight per side.',
    cues:'Rotate from the ribs, not the neck. Keep the hips square and over the knees the whole time.',
    errors:'Letting the hips swing away to get more range. Twisting the head instead of the thoracic spine.'},
  openbook:{name:'Open book',
    setup:'On your side, knees stacked and bent at 90 degrees, arms straight out in front, palms together. A foam roller or cushion under the top knee keeps the hips honest.',
    exec:'Keeping the knees pinned, open the top arm in a wide arc toward the floor behind you and follow it with your eyes. Hold a breath at the end, then return. Eight per side.',
    cues:'The knees staying down is the exercise. Exhale into the last few degrees rather than forcing it.',
    errors:'Letting the top knee lift, which turns it into a lumbar twist. Snapping back rather than controlling the return.'},
  quadtspine:{name:'Quadruped t-spine extension',
    setup:'On hands and knees, one hand behind the head, elbow out.',
    exec:'Rotate the elbow down toward the opposite wrist, then open it up toward the ceiling, opening the chest. Eight per side.',
    cues:'Sit back toward the heels a little first — it locks the low back out and makes the mid-back do the work.',
    errors:'Arching the lower back to fake the range. Letting the supporting elbow collapse.'},
  hip9090:{name:'90/90 hip switches',
    setup:'Sitting on the floor, one leg bent in front at 90 degrees, the other out to the side at 90. Hands behind you at first.',
    exec:'Keeping the feet where they are, drop both knees across to the other side and sit up tall. Ten switches.',
    cues:'Lead with the knees, not the torso. Chest stays tall — hands on the floor behind you is fine while the hips are tight.',
    errors:'Rolling the pelvis back and rounding the spine to get down. Dropping the knees with a bang rather than lowering them.'},
  lean9090:{name:'90/90 lean-forward hold',
    setup:'In the 90/90 position, front shin roughly parallel to your chest.',
    exec:'Sit tall, then hinge forward over the front shin and hold for 20 to 45 seconds, breathing.',
    cues:'Hinge at the hip with a long spine. The stretch should be in the outside of the front hip, not the knee.',
    errors:'Rounding over instead of hinging. Any pain on the inside of the front knee — open the angle until there is none.'},
  couch:{name:'Couch stretch',
    setup:'Back foot up on a bench, sofa or against a wall, knee on a pad close to the base. Front foot planted.',
    exec:'Squeeze the back glute and tuck the pelvis under, then come up tall. Hold 60 to 90 seconds per side, breathing.',
    cues:'The pelvic tuck is the whole exercise. If you can lean back comfortably straight away, you have not tucked.',
    errors:'Arching the low back to get upright, which feels like more stretch and is less. Knee pain from being too far from the wall or on a hard floor.',
    note:'Three lifting days plus riding is a lot of hip flexor in a shortened position. This is the single most valuable thing in the mobility list.'},
  frog:{name:'Frog stretch',
    setup:'Knees wide on a padded floor, shins in line with the knees, ankles flexed, forearms down.',
    exec:'Rock the hips gently back toward the heels and forward again, ten slow rocks, going a little further as it opens.',
    cues:'Keep the low back neutral and let the movement come from the hips. Rock, do not sit and strain.',
    errors:'Pushing into a static end-range hold on cold adductors. Letting the knees slide wider than is comfortable.'},
  wgs:{name:'World’s greatest stretch',
    setup:'From a long lunge, front foot flat, back leg straight, hands on the floor inside the front foot.',
    exec:'Drop the back of the front hip toward the floor, then rotate the inside arm up to the ceiling and follow it with your eyes. Five per side.',
    cues:'Back knee off the floor and back leg long. The rotation comes from the mid-back with the hips stable.',
    errors:'Letting the back knee drop, which removes the hip flexor part. Rotating with a bent back leg and calling it done.'},
  legswing:{name:'Leg swings',
    setup:'Hold something solid. Stand tall on one leg.',
    exec:'Swing the free leg front to back ten times, then side to side ten times, building range gradually. Both legs.',
    cues:'Stay upright and let the leg swing from a relaxed hip. Range builds over the set — the first swing is not the biggest.',
    errors:'Throwing the leg to its end range on rep one. Twisting the whole torso to get height.'},
  bandpull:{name:'Band pull-aparts and dislocates',
    setup:'A light band held at shoulder width for pull-aparts, and wide for dislocates. Wide enough that nothing pinches.',
    exec:'Fifteen pull-aparts, squeezing the shoulder blades together with straight arms, then fifteen slow dislocates taking the band overhead and behind.',
    cues:'Keep the ribs down and the neck long. Widen the grip on dislocates until the path is smooth.',
    errors:'Shrugging on the pull-aparts. A band so heavy the dislocates turn into a shoulder jam — lighter and wider is better.'},
  glutebridge:{name:'Glute bridge or bodyweight squat',
    setup:'On your back, feet flat and close to the hips — or standing, for squats.',
    exec:'Ten reps. Bridges: drive through the heels and squeeze the glutes at the top. Squats: full depth, controlled.',
    cues:'Finish the bridge with the glutes, not the low back. The squats are a rehearsal of your pattern, not a set.',
    errors:'Hyperextending the lower back at the top of the bridge. Rushing — this is the last thing before the bar, so it should look like what you are about to do.'},
  fig4:{name:'Figure-4 glute stretch',
    setup:'On your back, one ankle crossed over the opposite thigh just above the knee.',
    exec:'Reach through and pull the supporting thigh toward you until you feel it in the crossed glute. Hold 45 seconds per side.',
    cues:'Keep the crossed knee pushed gently away. Head and shoulders stay down.',
    errors:'Pulling on the crossed knee itself. Lifting the head and neck to get closer.'},
  childlat:{name:'Child’s pose with lat reach',
    setup:'Kneeling, sitting back toward the heels, arms extended in front.',
    exec:'Walk both hands to one side until you feel it down the opposite side of the ribs and under the armpit. Hold 45 seconds per side.',
    cues:'Keep the hips back over the heels and press the opposite ribs toward the floor.',
    errors:'Letting the hips drift forward, which turns it into a shoulder stretch instead of a lat one.'},
  deadhang:{name:'Dead hang',
    setup:'A bar you can hang from with the feet clear, or knees bent if it is low.',
    exec:'Hang relaxed for 20 to 30 seconds, letting the shoulders come up around the ears and the spine lengthen.',
    cues:'Let it be passive. Breathe. Grip is the usual limit, not the shoulders.',
    errors:'Holding an active shrug-down the whole time — that is a different exercise. Dropping off rather than stepping down.',
    note:'The cheapest spinal decompression there is, and it doubles as grip work on a deadlift day.'},
  fold:{name:'Standing forward fold',
    setup:'Feet hip width, knees soft, not locked.',
    exec:'Hinge and let the upper body hang, hands wherever they reach. Hold 45 to 60 seconds, breathing out into it.',
    cues:'Soft knees and a long spine beat straight legs and a rounded back. Let gravity do it.',
    errors:'Locking the knees and bouncing. Chasing the floor with the fingers at the cost of the hamstrings doing the work.'},
  hamstring:{name:'Supine hamstring stretch',
    setup:'On your back, a strap, belt or towel around the foot of one leg. A doorway works instead.',
    exec:'Raise the leg with the knee nearly straight until you feel the hamstring, keeping the other leg flat. Hold 45 seconds per side.',
    cues:'Keep the opposite leg on the floor and the pelvis down. A slight knee bend is fine.',
    errors:'Letting the other leg creep up, which hides the range. Pulling into pain behind the knee rather than mid-belly stretch.'},
  quadstand:{name:'Standing quad stretch',
    setup:'Hold something for balance, heel pulled to the backside.',
    exec:'Tuck the pelvis, then draw the knee back and down. Hold 45 seconds per side.',
    cues:'Squeeze the glute on the side you are stretching. Knees stay together.',
    errors:'Arching the back and calling it a stretch. Yanking the ankle into the backside, which is a knee complaint waiting to happen.'},
  calfstraight:{name:'Straight-leg calf stretch',
    setup:'Hands on a wall, one leg back, heel down, both feet pointing forward.',
    exec:'Keep the back knee straight and press the hips forward until the upper calf stretches. Hold 45 seconds per side.',
    cues:'Back heel stays glued down and the back foot points straight ahead, not out.',
    errors:'Letting the heel lift, which removes the stretch. Turning the foot out to fake range.'},
  calfbent:{name:'Bent-knee calf stretch',
    setup:'Same position as the straight-leg version.',
    exec:'Bend the back knee while keeping the heel down. The stretch drops lower, near the Achilles. Hold 45 seconds per side.',
    cues:'A small bend is enough. This one targets the soleus, which is what a plyo session beats up.',
    errors:'Bending so far the heel lifts. Skipping it because the straight-leg version felt like enough — they are different muscles.'},
  kneewall:{name:'Knee-to-wall ankle mobilisation',
    setup:'Stand facing a wall, toes a few inches back from it, foot pointing straight at it.',
    exec:'Drive the knee forward over the middle of the foot until it touches the wall, keeping the heel down. Ten reps per side, moving the foot back as it improves.',
    cues:'Heel stays down and the knee tracks over the second toe, not inward.',
    errors:'Letting the heel lift or the arch collapse. Measuring progress by distance alone while losing the heel.',
    note:'Ankle range is the quietest limiter on squat depth and the most common reason a landing collapses.'},
  footroll:{name:'Foot and arch roll',
    setup:'A lacrosse or tennis ball under the arch of a bare foot, seated or standing.',
    exec:'Roll slowly heel to toe for 60 seconds per side, pausing a few seconds on sore spots.',
    cues:'Slow enough to feel individual spots. Pressure you can breathe through, not pressure you brace against.',
    errors:'Rolling fast, which does nothing. Standing full weight on a hard ball on a sore foot.'},
  seatedfold:{name:'Seated forward fold',
    setup:'Sitting with legs straight out, sit bones under you. Sit on a folded towel if the low back rounds immediately.',
    exec:'Hinge forward with a long spine, reaching for the feet, and hold 45 to 60 seconds.',
    cues:'Lead with the chest, not the head. The last thing to round is the lower back.',
    errors:'Rounding from the start and pulling on the toes. Bouncing.'},
  pigeon:{name:'Pigeon',
    setup:'Front shin across in front of you, back leg long behind. A cushion under the front hip if it does not reach the floor.',
    exec:'Square the hips forward and fold over the front shin. Hold 60 to 90 seconds per side.',
    cues:'Hips square is what makes it work. Back toes pointed straight back, not out to the side.',
    errors:'Collapsing onto the front hip, which twists the knee. Ignoring front-knee pain — use figure-4 on your back instead, it does the same job.'},
  foamtspine:{name:'Thoracic extension over a foam roller',
    setup:'Roller across the mid-back, hands behind the head, hips down or lifted.',
    exec:'Extend back over the roller, breathe out at the end, come up, move the roller an inch and repeat. Ten slow reps up the mid-back.',
    cues:'Stay above the bottom of the ribs — never extend over the low back. The exhale is what gets the range.',
    errors:'Rolling up and down fast. Flaring the ribs and arching the lumbar spine instead of extending the thoracic one.'},
  breathwall:{name:'Legs up the wall breathing',
    setup:'On your back with the legs resting up a wall, backside close to it.',
    exec:'Two to three minutes of slow nasal breathing, long exhales.',
    cues:'Nothing to achieve. Let the legs be heavy and make the out-breath longer than the in-breath.',
    errors:'Checking your phone. Treating it as a stretch and pushing the hamstrings.',
    note:'The best-value two minutes on an off day: it is the one block that is purely about coming down.'}
};
// The names in WARMUP and MOB are editable text, so entries are matched by a normalised
// name through this table. A test asserts every built-in item still resolves.
function mnorm(s){return String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9/]+/g,' ').trim()}
const MLIB_ALIAS={};
(function(){
  const pairs=[
    ['bike rower or easy jog','raise'],['90/90 breathing back feet on bench or wall','breath9090'],
    ['cat / cow','catcow'],['cat / cow slow','catcow'],
    ['thread the needle','thread'],['thread the needle or open book','thread'],
    ['open book side lying rotation','openbook'],['quadruped t spine extension','quadtspine'],
    ['90/90 hip switches seated','hip9090'],['90/90 switches and lean holds','hip9090'],
    ['90/90 lean forward hold','lean9090'],['couch stretch','couch'],
    ['frog stretch gentle rocking','frog'],['worlds greatest stretch','wgs'],
    ['leg swings both directions','legswing'],['band pull aparts shoulder dislocates','bandpull'],
    ['glute bridge or bodyweight squat','glutebridge'],['figure 4 glute stretch','fig4'],
    ['childs pose with lat reach','childlat'],['dead hang from the bar','deadhang'],['dead hang','deadhang'],
    ['standing forward fold soft knees','fold'],['supine hamstring stretch strap or doorway','hamstring'],
    ['standing quad stretch','quadstand'],['straight leg calf stretch against a wall','calfstraight'],
    ['straight leg calf stretch gastroc','calfstraight'],['bent knee calf stretch soleus','calfbent'],
    ['knee to wall ankle mobilisation','kneewall'],['foot / arch roll on a ball','footroll'],
    ['seated forward fold','seatedfold'],['pigeon or figure 4','pigeon'],
    ['thoracic extension over a foam roller','foamtspine'],
    ['diaphragmatic breathing legs up the wall','breathwall']
  ];
  for(const [k,v] of pairs) MLIB_ALIAS[k]=v;
})();
function mlibId(name){const n=mnorm(name);return MLIB_ALIAS[n]||(MLIB[n]?n:null)}
function mlibEntry(name){const id=mlibId(name);return id?MLIB[id]:null}

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
// Shoulders sit on OP1, away from whichever day the overhead press lands on, and the
// row moves to OP2 to balance it. Rear delts stay with the shoulders: that slot is
// shoulder health, not back volume.
const ACC_DAYS={ mon:['spress','rdelt','core','biceps','triceps'], wed:['hpull','delts','pullup','biceps','triceps'], fri:['sleg','pchain','biceps','triceps','carry'] };
const ACC_DEF={ hpull:'csrow', rdelt:'facepull', core:'pallof', biceps:'bbcurl', triceps:'pushdown',
  spress:'dbohp', delts:'latraise', pullup:'pu_prog', sleg:'rfess', pchain:'rdl', carry:'farmer' };

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

/* ---------------- state ---------------- */
let plan=clone(DEF), logs={}, planV=0;
// Bumped whenever a log changes. Every other path that replaces `logs` wholesale already
// bumps planV, so planV + logsV together are a complete version of the data a view reads.
let logsV=0;
// Archived programs (id → {id, name, startMonday, end, archivedAt, plan}). While one is
// being viewed, `plan` is its frozen copy, `stash` holds the current plan, and every
// write is refused.
let programs={}, viewing=null, stash=null;
// Set when the stored data is newer than this copy of the app understands. Everything
// becomes read-only rather than risk writing an old shape over a new one.
let schemaAhead=false;
let view='today', sel=todayStr(), planShow=26, planMode='list', calMonth=null;
try{const pm=localStorage.getItem('ob.planmode'); if(pm==='cal'||pm==='list') planMode=pm}catch(e){}
try{ const v=localStorage.getItem('ob.view'); if(v) view=v; }catch(e){}

/* ---------------- utils ---------------- */
function clone(o){return JSON.parse(JSON.stringify(o))}
function pad(n){return String(n).padStart(2,'0')}
function D(s){const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)}
function S(t){return new Date(t).toISOString().slice(0,10)}
function addDays(s,n){return S(D(s)+n*864e5)}
function realToday(){const n=new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate())}
// In an archived program, "today" is its last day, so every view shows it as it ended.
function todayStr(){const t=realToday();return viewing&&viewing.end<t?viewing.end:t}
// The dates that belong to the program on screen (programs never overlap).
function inProgram(d){return d>=plan.startMonday&&(!viewing||d<=viewing.end)}
function progLogs(){return Object.entries(logs).filter(([d])=>inProgram(d))}
function dow(s){return (new Date(D(s)).getUTCDay()+6)%7}
function mondayOf(s){return addDays(s,-dow(s))}
function fmtD(s,withDow){const d=new Date(D(s));const t=(d.getUTCMonth()+1)+'/'+d.getUTCDate();return withDow?DAYN[dow(s)]+' '+t:t}
function fmtLong(s){const d=new Date(D(s));return DAYN[dow(s)]+', '+MON[d.getUTCMonth()]+' '+d.getUTCDate()+(d.getUTCFullYear()!==new Date().getFullYear()?', '+d.getUTCFullYear():'')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function rnd(x,inc){inc=+inc||5;return Math.round(x/inc)*inc}
function floorTo(x,inc){inc=+inc||5;return Math.floor(x/inc+1e-9)*inc}
function n(x){if(x==null||x==='')return '—';const v=Math.round(x*100)/100;return String(v)}
function deepMerge(base,over){if(!over||typeof over!=='object')return base;for(const k of Object.keys(over)){const v=over[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k]))base[k]=deepMerge(base[k],v);else base[k]=v}return base}
function setPath(o,path,v){const ks=path.split('.');let c=o;for(let i=0;i<ks.length-1;i++){if(c[ks[i]]==null||typeof c[ks[i]]!=='object')c[ks[i]]=/^\d+$/.test(ks[i+1])?[]:{};c=c[ks[i]]}c[ks[ks.length-1]]=v}
function getPath(o,path){return path.split('.').reduce((c,k)=>c==null?undefined:c[k],o)}
function liftName(k,date){
  if(VARS[k]) return varsOf(k)[varOf(k,date)].name;
  return k==='pull'?(plan.lift3Name||'Lat pulldown'):{bench:'Bench',dead:'Deadlift',ohp:'Overhead press',wpu:'Weighted pull-up'}[k];
}
// Which variant of a lift a session uses. Two different things:
//
//   the block lift   what this cycle is built on. Tactical Barbell picks its cluster
//                    lifts for a block and runs them for the whole block, so this is a
//                    per-cycle choice and the max you store IS that lift's max. No ratio.
//   a one-off        a swap for a single session, because the rack is taken or your back
//                    is unhappy. The weight is scaled off the block lift's max by the
//                    ratio between the two, and the card says so.
//
// Retest and bridge weeks always use the block lift, even against a one-off, because
// their whole job is to measure the max the next block is built on.
function varOf(k,date){
  if(!VARS[k]) return null;
  const d=date||sel, wk=d?weekOf(d):null, bv=blockVar(k,d);
  if(wk&&(wk.kind==='test'||wk.kind==='bridge')) return bv;
  const o=((logs[d]||{}).var||{})[k];
  return varsOf(k)[o]?o:bv;
}
function blockVar(k,date){
  if(!VARS[k]) return null;
  const d=date||sel, wk=d?weekOf(d):null;
  const c=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):null;
  const cv=((plan.cycleVar||{})[c]||{})[k];
  return varsOf(k)[cv]?cv:varDefault(k);
}
function varDefault(k){const v=(plan.liftVar||{})[k];return VARS[k]&&varsOf(k)[v]?v:varRef(k)}
// The max to work from. The block lift uses the max you stored, as it stands: that number
// is this lift's max. A one-off is scaled from it by the two variants' ratios.
function varMax(k,c,date){
  const base=maxFor(c)[k]; if(!base) return null;
  const bv=blockVar(k,date), v=varOf(k,date);
  if(v===bv) return {v:base.v,src:base.src,vr:v,bv};
  const V=varsOf(k), r=V[v].r/V[bv].r;
  return {v:base.v*r,src:'ratio',vr:v,bv,from:base.v,r};
}
function l3On(){const on=(plan.l3&&plan.l3.on)||{};const xs=L3K.filter(k=>on[k]);return xs.length?xs:['pull']}
function activeLifts(){return ['squat','bench',...l3On(),'dead']}
function isBarbell(k){return k!=='pull'&&k!=='wpu'}
function isBW(k){return k==='wpu'}
// Which Lift 3 variant a session uses: a per-day swap wins, otherwise the rotation rule.
function l3Auto(date){
  const fw=weekOf(date); if(fw&&fw.l3&&fw.l3[slotOf(date)]) return fw.l3[slotOf(date)];
  const on=l3On(); if(on.length===1) return on[0];
  const mode=(plan.l3||{}).mode||'same';
  if(mode==='same') return on.includes(plan.l3.primary)?plan.l3.primary:on[0];
  const wk=weekOf(date); if(!wk) return on[0];
  const wi=wk.kind==='cycle'?wk.plyoIdx:wk.idx;
  const k=mode==='alt-day'?wi*2+(slotOf(date)===2?1:0):mode==='alt-week'?wi:(wk.kind==='cycle'?wk.cycle:wk.refCycle)-1;
  return on[((k%on.length)+on.length)%on.length];
}
function l3For(date){const o=(logs[date]||{}).l3;return o&&l3On().includes(o)?o:l3Auto(date)}
// Working load. Weighted pull-up percentages apply to bodyweight + added weight;
// the result is the weight to add (0 or less = bodyweight only).
function loadFor(k,max,pct,date){
  if(isBW(k)){const bw=bwFor(date||sel);if(!bw)return null;return rnd((bw+max)*mult()*pct/100-bw,plan.round[k])}
  return rnd(max*mult()*pct/100,plan.round[k]);
}
function estMax(k,w,r,date){
  if(w==null||w===''||!r) return null;
  if(isBW(k)){const bw=bwFor(date||sel);if(!bw)return null;const e=e1rm(bw+ +w,r);return e==null?null:e-bw}
  return e1rm(w,r);
}
function fmtLoad(k,w){return isBW(k)?(w>0?'+'+n(w):'BW'):n(w)}
function mult(){return plan.basis==='tm'?(+plan.tmPct||90)/100:1}
function tier(p){return p<=75?'light':p>=90?'heavy':'mid'}
function e1rm(w,r){w=+w;r=+r;if(!w||!r)return null;return w/(PCT5[r]||1/(1+r/30))}
function monAdd(m,i){return addDays(m,i)}
function elevUnit(){return u()==='kg'?'m':'ft'}
// Climbing counted as distance: the trail rule of thumb is 1,000 ft of gain ≈ 1 mile
// (190 m ≈ 1 km). One factor for every activity, so the numbers stay comparable.
function elevPerDist(){const v=+((plan.elevPer||{})[u()]);return v>0?v:(u()==='kg'?190:1000)}
function u(){return plan.unit||'lb'}

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
  const out=[], fz=plan.frozen||{}; let g=null, m=plan.startMonday, cw=0, lastC=0, resume=null, bbLeft=0, bbVer='standard';
  for(let i=0;i<=need+10;i++){
    let wk;
    if(!g&&fz[m]){
      wk=Object.assign({},fz[m],{locked:true});
      if(wk.kind==='bb'&&wk.w<8){bbLeft=8-wk.w;bbVer=wk.ver||'standard'}
      if(!wk.inserted) resume=wk.kind==='bridge'?{c:1,w:1}:wk.kind==='cycle'?(wk.w<6?{c:wk.cycle,w:wk.w+1}:{c:wk.cycle,phase:'rule'}):wk.after?{c:wk.after+1,w:1}:resume;
    } else {
      if(!g) g=ruleSeq(plan,resume);
      const ins=plan.inserts[m];
      if(bbLeft>0){ wk={kind:'bb',w:9-bbLeft,ver:bbVer,inserted:true}; bbLeft--; }
      else if(ins==='bb'){ bbVer=((plan.bbVer||{})[m])||'standard'; wk={kind:'bb',w:1,ver:bbVer,inserted:true}; bbLeft=7; }
      else if(ins) wk={kind:ins,inserted:true}; else wk=g.next().value;
    }
    wk=Object.assign({},wk,{monday:m,idx:i});
    if(wk.kind==='cycle'){if(wk.plyoIdx==null)wk.plyoIdx=cw;cw=wk.plyoIdx+1;lastC=wk.cycle}
    if(wk.kind==='bb'&&wk.rx==null){
      const i=(wk.ver==='strength')?wk.w-1:wk.w-6;      // which lifting week of the block
      if(i>=0) wk.rx=clone(plan.wave[Math.min(i,plan.wave.length-1)]);
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
function wkRx(wk){return wk.rx||(wk.kind==='cycle'?plan.wave[wk.w-1]:plan.deload)}
// TB2's Easy Week Principle: every third week the conditioning load comes down, and it is
// meant to land on the strength wave's 90-95% weeks so the heavy lifting gets the energy.
// In a six-week wave those are weeks 3 and 6, which is exactly `tier()==='heavy'`.
function easyCondWeek(date){const wk=date?weekOf(date):null;return !!(wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy')}
// Lock every week that has fully passed: its type, cycle/week, prescription and Lift 3
// picks. A cycle whose last week is locked also gets its maxes locked.
function freezePast(){
  const cur=idxOf(todayStr()); if(cur<=0) return false;
  const list=weeks(cur+1), fz=plan.frozen||(plan.frozen={}), lm=plan.lockedMax||(plan.lockedMax={});
  let changed=false;
  for(let i=0;i<cur&&i<list.length;i++){
    const wk=list[i]; if(fz[wk.monday]) continue;
    const f={kind:wk.kind};
    for(const key of ['cycle','w','after','rule','inserted','plyoIdx','refCycle','ver']) if(wk[key]!=null) f[key]=wk[key];
    if(wk.kind==='cycle'||wk.kind==='deload'||(wk.kind==='bb'&&wk.rx)){f.rx=clone(wkRx(wk));const ord=dayOrder(wk.monday);f.l3={};for(let j=0;j<7;j++){const sl=ord[j];if(sl===0||sl===2)f.l3[sl]=l3Auto(addDays(wk.monday,j))}}
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
function rx(wk,k,date){
  let s,r,p,c;
  const d=date||sel;
  const v=wkRx(wk);s=+v.s;r=+v.r;p=+v.p;c=wk.kind==='cycle'?wk.cycle:wk.refCycle;
  // Operator I/A lets the lifter choose the volume: a wave entry can carry `sMax`, a
  // ceiling above the prescribed sets. `s` stays what the program asks for; the sets from
  // s+1 to sMax are yours to take or leave on the day. Deadlift is the standard template's
  // own version of the same idea -- one set required, up to three -- so it goes through
  // here too rather than being special-cased by every caller.
  let sx=v.sMax!=null&&+v.sMax>s?+v.sMax:s;
  if(k==='dead'){ s=1; sx=wk.kind==='cycle'?3:1 }
  // ...and a set added on the day widens it further, for this session only. Setup declares
  // the program's intent; this is the lifter deciding in the gym, which is the half of
  // Operator I/A that actually matters.
  sx+=Math.max(0,+(((lg(d).lifts||{})[k]||{}).extra)||0);
  const m=VARS[k]?varMax(k,c,d):maxFor(c)[k];
  return {s,sMax:sx,r,p,c,m,w:m?loadFor(k,m.v,p,d):null,t:wk.kind==='cycle'?tier(p):'light',vr:VARS[k]?varOf(k,d):null};
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
  if(wk.kind==='bb'){
    const row=bbRow(wk)[d]||['rest'], k=row[0];
    if(k==='se') return {t:'se',circuits:row[1],reps:row[2],short:'SE '+row[1]+'×'+row[2]};
    if(k==='e') return {t:'hic',fmt:'liss',eMin:row[1],eMax:row[2]||row[1],short:'E '+row[1]+(row[2]?'–'+row[2]:'')+'m',
      note:d===5?'The long one. You have a recovery day behind you and a rest day ahead, so push the duration — a long ruck, a longer run than you have done, or one of the fun-runs.':'Minimum 30 minutes, conversational. Run-walk-run is fine and still aerobic.'};
    if(k==='hic') return {t:'hic',fmt:(plan.bbHic||{})[monAdd(wk.monday,d)]||'map',bbHic:true,short:'HIC',
      note:'Weeks 6–8 use the aerobic-leaning HIC sessions only. Keep off the purely lactic ones: you cannot build the aerobic and lactic systems at once.'};
    if(k==='ms') return {t:'lift',lifts:d===0?['squat','bench',l3For(date)]:['squat','bench','dead'],bbLift:true,short:'Strength',
      note:'Two strength days a week this block, kept spartan. Two or three compounds, no assistance work.'};
    if(k==='rec') return {t:'off',recovery:true,short:'Recovery',
      note:'Movement drills, mobility, an easy swim or bike, a walk, yoga, a massage. Or nothing. If you are still raring to go, one easy E session or half an SE circuit is allowed.'};
    return {t:'off',short:'Rest',note:'Complete rest. No structured training. Walking, a casual swim or pick-up sport is fine.'};
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
    {t:'plyohic',fmt:'anaerobic',short:'Plyo+HIC'},
    {t:'travel',slot:'day3',short:'Travel 3'},
    {t:'hic',fmt:'threshold',short:'HIC',note:'Swap to LISS or a walk if the week has been long.'},
    {t:'off',short:'Off'}][d];
  return {t:'off',short:'Off',note:'Off week. Walk, sleep, eat. The plan resumes next Monday.'};
}
// The block's row for a week, after the strength-first swap if that version is running.
function bbRow(wk){
  const base=BB_WEEKS[Math.min(Math.max((wk.w||1)-1,0),BB_WEEKS.length-1)];
  if((wk.ver||'standard')!=='strength') return base;
  const r=BB_SF_SE[Math.min(Math.max((wk.w||6)-6,0),BB_SF_SE.length-1)];
  return base.map((x,i)=>x[0]==='se'?['ms']:x[0]==='ms'?['se',i===0?r[0]:2,r[1]]:x);
}
function weekTitle(wk){
  if(!wk) return 'Before start';
  if(wk.kind==='cycle'){const v=wkRx(wk);return {t:'Cycle '+wk.cycle+' · Week '+wk.w,chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:tier(+v.p)}}
  if(wk.kind==='deload'){const v=wkRx(wk);return {t:'Deload week',chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:'light'}}
  if(wk.kind==='test') return {t:'Retest week',chip:'Heavy singles',cls:'heavy'};
  if(wk.kind==='bb'){
    const r=bbRow(wk), se=r.filter(x=>x[0]==='se').length, ms=r.filter(x=>x[0]==='ms').length;
    return {t:'Base Building · Week '+wk.w+' of 8',chip:ms?'Strength + HIC':'SE + endurance',cls:ms?'mid':'light'};
  }
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
function metricFor(mod,fmt){if(HIC[fmt]&&HIC[fmt].noMetric)return null;const m=MOD[mod]&&MOD[mod][fmt==='liss'?'liss':'hic'];if(!m)return null;let un=m[1];if(u()==='kg'){if(un==='mi')un='km';if(un==='yd')un='m'}return [m[0],un]}
function metricLabel(met){return met[0]==='cal'?'Total calories':met[0]==='watts'?'Average watts':'Distance ('+met[1]+')'}
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

/* ---------------- persistence ---------------- */
// One JSON document per path (plan/main, logs/YYYY-MM-DD), stored in D1 behind /api.
// The phone keeps its own copy (ob.cache) so the app opens offline, and an outbox of
// unsent documents (ob.outbox) so changes made offline survive closing the app.
// Writes are debounced per document; failed writes retry until they land.
const writers={};
let loaded=false, signedOut=false;
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
let outbox=LS.get('ob.outbox')||{};
function saveOutbox(){LS.set('ob.outbox',outbox)}
let cacheTimer=null;
function saveCache(){clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>LS.set('ob.cache',{plan:stash?stash.plan:plan,logs,programs}),800)}
// Who's signed in. Everything on the server is theirs alone; the phone's copy is wiped
// if a different person signs in on the same device.
let me=LS.get('ob.user');
function docFor(path){return path==='plan/main'?(stash?stash.plan:plan):path.startsWith('programs/')?programs[path.slice(9)]:logs[path.slice(5)]}
function pending(path){const w=writers[path];return !!(w&&(w.dirty||w.busy||w.timer))||!!outbox[path]}
function anyPending(){return Object.keys(writers).some(pending)||Object.keys(outbox).length>0}
function waitingCount(){return Object.keys(outbox).length}
async function api(method,path,body){
  const r=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'manual',
    headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  // An expired Access session answers with a redirect to the login page.
  if(r.type==='opaqueredirect'){const e=new Error('signed out');e.status=401;throw e}
  if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e}
  return r.status===204?null:r.json();
}
function errText(e){
  if(e&&(e.status===401||e.status===403)) return 'Signed out · tap to sign in';
  if(e&&e.status===413) return 'Entry too large to save';
  const w=waitingCount();
  if(e&&e.status) return 'Server error '+e.status+' · retrying';
  return 'Offline'+(w?' · '+w+' waiting':' · saved on phone');
}
function queueWrite(path,get){
  if(!loaded){setStatus('Still loading…',true);return}
  const w=writers[path]||(writers[path]={});
  w.get=get;w.dirty=true;clearTimeout(w.timer);
  outbox[path]=clone(get()); saveOutbox(); saveCache();
  setStatus(navigator.onLine===false?errText(null):'Saving…',navigator.onLine===false);
  w.timer=setTimeout(()=>{w.timer=null;flush(path)},500);
  // The calendar is generated from the plan, so a plan write is the only thing that can
  // change it. calPush debounces and compares before uploading, so this is usually free.
  if(path==='plan/main'&&typeof calPush==='function') calPush();
}
async function flush(path){
  const w=writers[path]||(writers[path]={get:()=>outbox[path]});
  if(w.busy){w.again=true;return} if(!w.dirty)return;
  w.dirty=false;w.busy=true;
  const body=clone(w.get()), sent=JSON.stringify(body);
  try{
    await api('PUT','/doc/'+path,body);
    if(outbox[path]&&JSON.stringify(outbox[path])===sent){delete outbox[path];saveOutbox()}
    signedOut=false; if(!anyPendingExcept(path)) setStatus('Saved');
  }
  catch(e){
    if(e&&(e.status===401||e.status===403)) signedOut=true;
    setStatus(errText(e),true);
    if(!(e&&e.status===413)){ w.dirty=true; clearTimeout(w.timer); w.timer=setTimeout(()=>{w.timer=null;flush(path)},signedOut?30000:5000) }
  }
  w.busy=false; if(w.dirty&&!w.timer||w.again){w.again=false;flush(path)}
}
function anyPendingExcept(path){return Object.keys(writers).some(p=>p!==path&&pending(p))||Object.keys(outbox).some(p=>p!==path)}
function setStatus(t,err){const el=document.getElementById('status');el.textContent=t;el.className=err?'err':'';el.classList.toggle('link',signedOut);if(typeof acctPaint==='function')acctPaint()}
function readOnly(){
  if(schemaAhead){ setStatus('App out of date · read-only',true); render(); return true }
  if(viewing){ setStatus('Archived program · read-only',true); render(); return true }
  return false;
}
// Bring stored data up to SCHEMA, then save whatever actually changed. Runs on every load
// and after every sync, and costs one integer comparison when there is nothing to do.
function migrate(){
  const at=+(plan.schema||0);
  if(at===SCHEMA) return false;
  if(at>SCHEMA){ schemaAhead=true; return false }   // the backwards half: stop writing
  schemaAhead=false;
  const d={logs,programs}, before={};
  for(const [id,L] of Object.entries(logs)) before['logs/'+id]=JSON.stringify(L);
  for(const [id,P] of Object.entries(programs)) before['programs/'+id]=JSON.stringify(P);
  for(const m of MIGRATIONS) if(m.to>at&&m.to<=SCHEMA) m.run(d,plan);
  plan.schema=SCHEMA; planV++;
  queueWrite('plan/main',()=>plan);
  for(const [id,L] of Object.entries(logs)) if(JSON.stringify(L)!==before['logs/'+id]) queueWrite('logs/'+id,()=>logs[id]);
  for(const [id,P] of Object.entries(programs)) if(JSON.stringify(P)!==before['programs/'+id]) queueWrite('programs/'+id,()=>programs[id]);
  return true;
}
function setLog(date,path,v){ if(readOnly()) return; if(!logs[date]) logs[date]={date}; setPath(logs[date],path,v); logsV++; queueWrite('logs/'+date,()=>logs[date]); }
function setPlan(path,v){ if(readOnly()) return; setPath(plan,path,v); planV++; queueWrite('plan/main',()=>plan); }
function mutatePlan(fn){ if(readOnly()) return; fn(plan); planV++; queueWrite('plan/main',()=>plan); render(); }

/* ---------------- when two devices disagree ----------------
Writes replace whole documents and the last one in wins. For one person that is almost
always right, because a device with nothing to say sends nothing: only documents this
phone actually changed are ever uploaded.

The exception is both devices editing the same day while offline. Below, a document with
unsent local changes is kept and the server's copy dropped — which is a defensible
choice, but it used to happen in silence. Now it is written down and shown in Setup, so
"my Tuesday looks wrong" has an answer instead of being a mystery.

Device-local, like the error log: it describes what this phone did, not what happened. */
const CONFLICT_KEEP=10;
function conflicts(){const v=LS.get('ob.conflicts');return Array.isArray(v)?v:[]}
function clearConflicts(){LS.set('ob.conflicts',[]);render()}
function noteConflict(path){
  try{
    const all=conflicts().filter(c=>c.path!==path);
    all.unshift({path,at:new Date().toISOString()});
    LS.set('ob.conflicts',all.slice(0,CONFLICT_KEEP));
  }catch(e){}
}

function applyState(st){
  let changed=false;
  for(const [id,d] of Object.entries(st.programs||{})){
    if(pending('programs/'+id)){ if(JSON.stringify(d)!==JSON.stringify(programs[id])) noteConflict('programs/'+id); continue }
    if(JSON.stringify(d)!==JSON.stringify(programs[id])){programs[id]=d;changed=true}
  }
  if(stash){ // viewing an archive: refresh the current plan behind it
    if(!pending('plan/main')&&st.plan) stash.plan=deepMerge(clone(DEF),st.plan);
  } else if(!pending('plan/main')){
    const next=st.plan?deepMerge(clone(DEF),st.plan):clone(DEF);
    if(JSON.stringify(next)!==JSON.stringify(plan)){plan=next;planV++;changed=true}
  }
  for(const [id,d] of Object.entries(st.logs||{})){
    if(pending('logs/'+id)){ if(JSON.stringify(d)!==JSON.stringify(logs[id])) noteConflict('logs/'+id); continue }
    if(JSON.stringify(d)!==JSON.stringify(logs[id])){logs[id]=d;changed=true;logsV++}
  }
  // entries removed on the server go away here too (unless this phone has unsent changes)
  if(st.logs) for(const id of Object.keys(logs)) if(!(id in st.logs)&&!pending('logs/'+id)){delete logs[id];changed=true;logsV++}
  saveCache();
  if(!stash&&!pending('plan/main')&&migrate()) changed=true;
  if(changed) render();
}
// Open instantly from the phone's copy, with any unsent changes laid on top.
function loadLocal(){
  const c=LS.get('ob.cache');
  if(c){ if(c.plan) plan=deepMerge(clone(DEF),c.plan); logs=c.logs||{}; programs=c.programs||{}; }
  for(const [path,doc] of Object.entries(outbox)){
    if(path==='plan/main') plan=deepMerge(clone(DEF),doc);
    else if(path.startsWith('logs/')) logs[path.slice(5)]=doc;
    else if(path.startsWith('programs/')) programs[path.slice(9)]=doc;
    writers[path]={get:()=>docFor(path),dirty:true};
  }
  planV++;
  if(c||Object.keys(outbox).length){ loaded=true; migrate() }
  return !!c;
}
function flushAll(){for(const p of new Set([...Object.keys(writers),...Object.keys(outbox)])){const w=writers[p]||(writers[p]={get:()=>docFor(p)});if(outbox[p])w.dirty=true;if(w.dirty){clearTimeout(w.timer);w.timer=null;flush(p)}}}
// A different person signed in on this phone: drop the previous person's local copy
// and unsent changes so nothing of theirs is shown or uploaded to the new account.
function switchUser(user){
  for(const w of Object.values(writers)) clearTimeout(w.timer);
  for(const k of Object.keys(writers)) delete writers[k];
  outbox={}; saveOutbox(); LS.set('ob.cache',null); LS.set('ob.rest',null); LS.set('ob.iv',null); LS.set('ob.push',null);
  plan=clone(DEF); logs={}; programs={}; stash=null; viewing=null; planV++;
  rest=null; iv=null; showRest(); ivShow();
  me=user; LS.set('ob.user',user);
}
async function connect(){
  if(!loaded) setStatus('Loading…');
  try{
    const st=await api('GET','/state'); signedOut=false;
    if(st.user&&me&&st.user!==me) switchUser(st.user);
    if(st.user&&!me){me=st.user;LS.set('ob.user',me)}
    loaded=true; applyState(st);
    if(!st.plan&&!Object.keys(st.logs||{}).length&&!plan.onboarded&&!wz){wz=wzNew(false);plan.startMonday=nextMonday();planV++;render()}
    if(!viewing&&freezePast()) render();
    flushAll(); if(!anyPending()) setStatus('Saved');
    healAlerts();
  }
  catch(e){
    if(e&&(e.status===401||e.status===403)) signedOut=true;
    setStatus(loaded?errText(e):(signedOut?'Signed out · tap to sign in':'Can’t reach server · reload'),true);
  }
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') connect() });
window.addEventListener('online',()=>{ flushAll(); connect() });
window.addEventListener('offline',()=>setStatus(errText(null),true));
document.getElementById('status').addEventListener('click',()=>{ if(signedOut) location.replace('/') });

/* ---------------- rendering helpers ---------------- */
function numIn(bind,val,ph,attrs){return `<input type="number" inputmode="decimal" step="any" id="in-${bind.replace(/\./g,'-')}" data-bind="${bind}" data-type="num" value="${val??''}" placeholder="${esc(ph??'')}" ${attrs||''}>`+oddNote(bind,val)}

/* ---------------- does that number look right? ----------------
Nothing stops a bodyweight of 2050 or a 4000 lb squat, and a single fat-fingered weigh-in
now carries a long way: the 7-day average, the protein target, the weighted pull-up load
and the burn estimate all read from it for a fortnight.

This is a note, not a block. Ranges are deliberately wide enough that a genuinely strong
or genuinely light person never sees one, and the value is kept exactly as typed either
way. The note stays until the number is changed, which is the point: a typo should keep
asking rather than be dismissed once and forgotten. */
function oddBand(bind){
  const kg=u()==='kg';
  const W=(lo,hi)=>kg?[Math.round(lo/2.205),Math.round(hi/2.205),'kg']:[lo,hi,'lb'];
  const L=(lo,hi)=>kg?[Math.round(lo*2.54),Math.round(hi*2.54),'cm']:[lo,hi,'in'];
  const b=String(bind||'');
  if(b.includes('.warmup.')) return null;            // ramp rows are too cramped for a note
  if(b==='bodyweight'||b==='checkin.bw') return W(60,400);
  if(b==='bar') return W(5,100);
  if(b==='checkin.kcal') return [500,8000,'kcal'];
  if(b==='checkin.sleepH') return [0,24,'h'];
  if(b==='sleepTarget') return [3,14,'h'];
  if(b==='proteinPerLb') return [0.2,2,'g'];
  if(b==='pullups') return [0,100,'reps'];
  if(b==='meas.neck') return L(8,25);
  if(b==='meas.waist') return L(20,70);
  if(b==='meas.hip') return L(25,80);
  if(/^maxes\./.test(b)||/^test\.[a-z]+\.w$/.test(b)||/^lifts\.[a-z0-9]+\.used$/.test(b)) return W(0,1200);
  return null;
}
function oddNote(bind,val){
  if(val==null||val==='') return '';
  const v=+val; if(!isFinite(v)) return '';
  const band=oddBand(bind); if(!band) return '';
  const [lo,hi,unit]=band;
  if(v>=lo&&v<=hi) return '';
  return `<span class="oddnote">${n(v)} ${esc(unit)} is outside the usual ${n(lo)}\u2013${n(hi)}. Kept as typed \u2014 change it if it was a slip.</span>`;
}
function lg(date){return logs[date]||{}}
function ramp(k,W,t,deload){
  if(isBW(k)) return W==null?[]:W>0&&!deload?[{w:0,r:5,lbl:'BW'},{w:rnd(W*.5,plan.round[k]),r:2,lbl:'50%'}]:[{w:0,r:3,lbl:'BW'}];
  if(!W) return [];
  const inc=plan.round[k], bar=+plan.bar; let st;
  if(k==='pull') st=deload?[[50,10]]:[[40,10],[70,5]];
  else if(deload) st=[[0,10],[50,5]];
  else if(k==='dead') st=t==='light'?[[50,5],[70,3]]:[[40,5],[65,3],[85,1]];
  else {st=[[0,10],[40,5],[55,3],[70,3]]; if(t!=='light') st.push([85,1]); if(t==='heavy') st.push([90,1]);}
  return st.map(([p,r])=>({w:p===0?bar:(k==='pull'?rnd(W*p/100,inc):Math.max(bar,rnd(W*p/100,inc))),r,lbl:p===0?'Bar':p+'%'}));
}
// Plates per side from the gym's inventory (Setup). Greedy is exact for standard sets;
// if a target can't be loaded, `rem` is what's left over per side.
const ALL_PLATES={lb:[55,45,35,25,10,5,2.5,1.25],kg:[25,20,15,10,5,2.5,1.25]};
function plateSet(){const v=((plan.plates||{})[u()]||[]).map(Number).filter(x=>ALL_PLATES[u()].includes(x));return (v.length?v:ALL_PLATES[u()]).sort((a,b)=>b-a)}
function sidePlates(W){
  const bar=+plan.bar; let side=(W-bar)/2; const out=[];
  if(!(W>0)||side<=0) return {list:out,rem:0,bar:side<0};
  for(const p of plateSet()) while(side>=p-1e-9){out.push(p);side-=p}
  return {list:out,rem:side>0.01?Math.round(side*100)/100:0};
}
function loadable(W){const sp=sidePlates(W);return sp.rem?Math.round((W-2*sp.rem)*100)/100:W}
function plates(W){
  const sp=sidePlates(W); if(!sp.list.length&&!sp.rem) return 'Empty bar';
  return 'Per side: '+(sp.list.join(' + ')||'none')+(sp.rem?` · can’t load ${n(sp.rem)} more with your plates (nearest: ${n(loadable(W))})`:'');
}
function platesShort(W){
  const sp=sidePlates(W); if(!(W>0)) return ''; if(!sp.list.length&&!sp.rem) return 'bar';
  return (sp.list.join(' + ')||'—')+' / side'+(sp.rem?' (+'+n(sp.rem)+' short)':'');
}
// A drawn half-barbell: collar, then plates from the heaviest inward, in bumper colors.
function plateCls(p){return u()==='kg'?{25:'pr',20:'pb',15:'py',10:'pg',5:'pw',2.5:'pr',1.25:'pc'}[p]:{55:'pr',45:'pb',35:'py',25:'pg',10:'pw',5:'pr',2.5:'pc',1.25:'pc'}[p]}
function plateDims(p){const big=u()==='kg'?10:25;const h=p>=big?60:p>=(u()==='kg'?5:10)?42:p>=(u()==='kg'?2.5:5)?32:26;const w=u()==='kg'?{25:13,20:12,15:10,10:8,5:6,2.5:5,1.25:4}[p]:{55:14,45:13,35:11,25:9,10:7,5:6,2.5:5,1.25:4}[p];return {w,h}}
function plateSvg(W,big){
  const sp=sidePlates(W); if(!(W>0)) return '';
  let x=52, g='';
  for(const p of sp.list){const d=plateDims(p);g+=`<rect class="plate ${plateCls(p)}" x="${x}" y="${(70-d.h)/2}" width="${d.w}" height="${d.h}" rx="2"><title>${n(p)} ${u()}</title></rect>`;x+=d.w+1.5}
  const lbl=sp.list.length?sp.list.map(n).join(' + '):'bar only';
  return `<svg class="loader${big?' big':''}" viewBox="0 0 ${Math.max(200,x+30)} 70" role="img" aria-label="Per side: ${esc(lbl)}"><rect class="bar-shaft" x="0" y="32" width="44" height="6" rx="1"/><rect class="bar-collar" x="44" y="26" width="7" height="18" rx="1.5"/><rect class="bar-sleeve" x="51" y="31" width="${Math.max(120,x-40)}" height="8" rx="1"/>${g}</svg>`;
}
function testRamp(k,W,isRm5){
  if(isBW(k)) return W==null?[]:W>0?[{w:0,r:5,lbl:'BW'},{w:rnd(W*.5,plan.round[k]),r:2,lbl:'50%'},{w:rnd(W*.75,plan.round[k]),r:1,lbl:'75%'}]:[{w:0,r:3,lbl:'BW'}];
  if(!W) return [];
  const inc=plan.round[k], bar=+plan.bar;
  const st=k==='pull'?(isRm5?[[40,10],[70,3]]:[[40,10],[65,3],[85,1]])
    :isRm5?(k==='dead'?[[40,5],[60,3],[80,1]]:[[0,10],[40,5],[60,3],[75,2],[90,1]])
    :(k==='dead'?[[40,5],[60,3],[75,1],[85,1],[92,1]]:[[0,10],[40,5],[60,3],[75,2],[85,1],[92,1]]);
  return st.map(([p,r])=>({w:p===0?bar:(k==='pull'?rnd(W*p/100,inc):Math.max(bar,rnd(W*p/100,inc))),r,lbl:p===0?'Bar':p+'%'}));
}
function hardSessions(){
  const t=todayStr(), from=addDays(t,-13); let c=0;
  for(const [d,L] of Object.entries(logs)){
    if(d<from||d>t||!L.lifts) continue;
    const g=Object.values(L.lifts).some(x=>x&&x.grinder);
    const miss=L.done&&Object.values(L.lifts).some(x=>x&&Array.isArray(x.sets)&&x.sets.length&&x.sets.slice(0,2).some(v=>!v));
    if((+L.rpe>=9)||g||miss) c++;
  }
  return c;
}

/* ---------------- when something breaks ----------------
render() writes one big innerHTML. Before this, a single thrown error anywhere in a view
left a blank page with no clue what happened — mid-session, in a gym, with a loaded bar.

Three parts: render() catches and paints something you can act on, the last few errors
are kept so the failure is reportable rather than "it just broke", and Setup shows them.

Errors are kept on the device only. A stack trace can carry a lift name or a date, and
there is no reason for that to reach the server. */

const CRASH_KEEP = 5;

function crashList(){ const v=LS.get('ob.errs'); return Array.isArray(v)?v:[] }
function crashClear(){ LS.set('ob.errs',[]); render() }

function crashLog(err,where){
  try{
    const e={
      at:new Date().toISOString(),
      where:where||'app',
      view:typeof view==='string'?view:'',
      msg:String((err&&err.message)||err||'Unknown error').slice(0,300),
      // A few frames is enough to find it; the whole trace is noise on a phone screen.
      stack:String((err&&err.stack)||'').split('\n').slice(1,5).map(s=>s.trim()).join('\n').slice(0,600),
      v:typeof APP_VERSION==='string'?APP_VERSION:'',
    };
    const all=[e,...crashList()].slice(0,CRASH_KEEP);
    LS.set('ob.errs',all);
  }catch(e2){}
  try{ if(typeof console!=='undefined'&&console.error) console.error('[operator-black]',where,err) }catch(e3){}
}

// What you see instead of a blank screen. Deliberately plain strings: whatever broke the
// view might break any helper, so this uses nothing but escaping.
function crashHtml(err){
  const msg=esc(String((err&&err.message)||err||'Unknown error').slice(0,300));
  return `<div class="banner alert"><div><b>Something went wrong drawing this screen.</b>
    Your training is saved — this is the display, not your data. Reload, and if it keeps
    happening send me the details below.<div class="mono small" style="margin-top:6px;word-break:break-word">${msg}</div></div>
    <div class="row"><button class="btn sm primary" data-act="reload">Reload</button><button class="btn sm" data-act="errcopy">Copy details</button></div></div>`;
}

// Everything a report needs, as text you can paste into a message.
function crashReport(){
  const list=crashList();
  if(!list.length) return 'No errors recorded.';
  const head=`Operator + Black ${typeof APP_VERSION==='string'?APP_VERSION:''} · ${typeof navigator!=='undefined'?navigator.userAgent:''}`;
  return head+'\n\n'+list.map(e=>`${e.at} · ${e.where} · view ${e.view||'?'} · v${e.v||'?'}\n${e.msg}\n${e.stack||''}`).join('\n\n---\n\n');
}

function crashCard(){
  const list=crashList();
  if(!list.length) return '';
  return `<div class="card"><div class="lift-h"><h2>Problems</h2><span class="chip alert">${list.length}</span></div>
  <p class="small muted" style="margin:0">Errors this app hit on this device. They are kept here only — never sent anywhere — and a stack trace can name a lift or a date, so read before you share. If one of these lines up with something going wrong, send it to me.</p>
  <div class="stack">${list.map(e=>`<div class="banner"><div class="small"><b>${esc(fmtD(e.at.slice(0,10),true))} ${esc(e.at.slice(11,16))}</b> · ${esc(e.where)}${e.view?' · '+esc(e.view):''}${e.v?' · v'+esc(e.v):''}<div class="mono" style="word-break:break-word;margin-top:4px">${esc(e.msg)}</div></div></div>`).join('')}</div>
  <div class="row"><button class="btn" data-act="errcopy">Copy all details</button><button class="btn ghost" data-act="errclear">Clear</button></div></div>`;
}

// Anything that escapes a handler, a timer or a promise lands here too, so a failure
// that never touches render() is still reportable rather than silent.
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('error',e=>{ crashLog(e.error||e.message,'window') });
  window.addEventListener('unhandledrejection',e=>{ crashLog(e.reason,'promise') });
}

/* ---------------- views ---------------- */
// A thrown error in any view used to leave a blank page. Now it leaves a banner you can
// read, copy and reload from. See 06a-crash.js.
function render(){
  try{ renderMain() }
  catch(err){
    crashLog(err,'render');
    try{ document.getElementById('main').innerHTML=crashHtml(err) }catch(e2){}
  }
}
function renderMain(){
  const a=document.activeElement, aid=a&&a.id, pos=a&&typeof a.selectionStart==='number'?a.selectionStart:null;
  document.querySelectorAll('#nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===view?'page':'false'));
  const m=document.getElementById('main');
  m.classList.toggle('ro',!!viewing);
  if(wz&&!viewing){m.innerHTML=vWelcome();if(aid){const el=document.getElementById(aid);if(el)el.focus({preventScroll:true})}return}
  m.innerHTML=archiveBanner()+(['status','plan','history'].includes(view)?programPicker():'')+({today:vToday,status:vStatus,plan:vPlan,releases:vReleases,history:vHistory,setup:vSetup,guide:vGuide}[view]||vToday)();
  if(aid){const el=document.getElementById(aid); if(el){el.focus({preventScroll:true}); try{if(pos!=null&&el.setSelectionRange)el.setSelectionRange(pos,pos)}catch(e){}}}
  showToast();
}

function vToday(){
  const t=todayStr(), wk=weekOf(sel), dp=dayPlan(sel), mon=mondayOf(sel);
  let h=`<div class="dnav"><button class="btn sm ghost" data-act="go" data-date="${addDays(sel,-1)}" aria-label="Previous day">‹</button><h2>${fmtLong(sel)}</h2>${sel!==t?`<button class="btn sm" data-act="go" data-date="${t}">Today</button>`:''}<button class="btn sm ghost" data-act="go" data-date="${addDays(sel,1)}" aria-label="Next day">›</button></div>`;
  h+=`<div class="week">`;
  for(let i=0;i<7;i++){const d=addDays(mon,i), p=dayPlan(d);
    h+=`<button class="day${d===sel?' sel':''}${d===t?' today':''}" data-act="go" data-date="${d}"><span class="dn">${DAYN[i]}</span><span class="dd">${+d.slice(8)}</span><span class="dl">${esc(p.short||'')}</span><span class="dot${lg(d).done?' on':''}"></span></button>`}
  h+=`</div>`;
  if(!wk){ return h+checkinCard(sel)+`<div class="card"><h3>Not started</h3><p class="muted">The program starts the week of ${fmtLong(plan.startMonday)}. Change the start date in Setup.</p></div>` }
  const wt=weekTitle(wk);
  h+=`<div class="wkline"><b>${wt.t}</b><span class="chip ${wt.cls}">${wt.chip}</span>${wk.kind==='cycle'&&(dp.t==='plyohic'||dp.t==='plyobase')?`<span class="small muted">Plyo: ${plyoPhase(wk).name} · ~${dp.plyoCut||(lg(sel).plyo||{}).cut?Math.round(plyoPhase(wk).target/2):plyoPhase(wk).target} contacts</span>`:''}${wk.inserted?'<span class="chip">Added</span>':''}${isReordered(mon)?'<span class="chip blue">Days moved</span>':''}${!viewing&&dp.t!=='pre'?`<button class="btn sm ghost" style="margin-left:auto" data-act="move">Move…</button>`:''}</div>`;
  if(moveOpen&&!viewing) h+=moveCard();
  h+=weekSummaryCard();
  h+=weeklyCard();
  h+=prCard(sel);
  h+=finishCard(sel,dp);
  h+=banners(wk,dp);
  if(sel===todayStr()){const rc=reviewCycleFor(sel);if(rc) h+=reviewCard(rc);const dc=deloadCheckCycle(sel);if(dc) h+=deloadCheckCard(dc)}
  h+=checkinCard(sel);
  h+=sessionHtml(wk,dp);
  return h;
}
// Kind of each of the week's seven prescribed sessions, by slot.
function slotKinds(mon){return [0,1,2,3,4,5,6].map(sl=>sessKind(dayPlanSlot(mon,sl)))}
function edgeKinds(mon){
  const p=addDays(mon,-1), n=addDays(mon,7);
  return [idxOf(p)>=0?sessKind(dayPlan(p)):'other', weekOf(n)?sessKind(dayPlan(n)):'other'];
}
// The valid week order that moves the fewest days, optionally forcing one day's session.
// Days already gone in the current week stay where they are.
function bestOrder(mon,fixDay,fixSlot){
  const K=slotKinds(mon), cur=dayOrder(mon), ek=edgeKinds(mon), prevK=ek[0], nextK=ek[1];
  const t=realToday(), pinTo=mondayOf(t)===mon?dow(t):-1;
  const used=new Array(7).fill(false), ord=new Array(7);
  let best=null, bestCost=99;
  (function go(i,prev,cost){
    if(cost>=bestCost) return;
    if(i===7){ if((prev==='strength'||prev==='hic')&&prev===nextK) return; best=ord.slice(); bestCost=cost; return }
    for(let sl=0;sl<7;sl++){
      if(used[sl]) continue;
      if(i<pinTo&&sl!==cur[i]) continue;           // days already past this week don't move
      if(fixDay!=null&&fixDay===i&&sl!==fixSlot) continue;
      if(fixDay!=null&&fixDay!==i&&sl===fixSlot) continue;
      const k=K[sl]; if((k==='strength'||k==='hic')&&k===prev) continue;
      used[sl]=true; ord[i]=sl;
      go(i+1,k,cost+(cur[i]===sl?0:1));
      used[sl]=false;
    }
  })(0,prevK,0);
  return best?{ord:best,moved:bestCost}:null;
}
let moveOpen=false;
function moveCard(){
  const mon=mondayOf(sel), ord=dayOrder(mon), me=dow(sel), mine=ord[me];
  const past=mondayOf(realToday())===mon&&me<dow(realToday());
  let h=`<div class="card"><div class="lift-h"><h3>Change ${DAYN[me]}’s session</h3><button class="btn sm ghost" data-act="movex">Close</button></div>`;
  if(past) h+=`<div class="banner warn"><div class="small">${DAYN[me]} has already passed this week, so it stays put. Open today to rearrange what’s left.</div></div>`;
  else{
    h+=`<p class="small muted" style="margin:0">Pick what you’ll do on ${DAYN[me]}. The week keeps all seven sessions; the app shuffles the rest as little as it can and never puts two strength days or two hard conditioning days together.</p><div class="stack">`;
    // Two days can share a label (Tue and Sat are both "HIC"): offer the one that
    // needs the least shuffling, and only call it impossible if neither works.
    const byLabel=new Map();
    for(let sl=0;sl<7;sl++){
      if(sl===mine) continue;
      const lbl=dayPlanSlot(addDays(mon,sl),sl).short||'Session', r=bestOrder(mon,me,sl), was=byLabel.get(lbl);
      if(!was||(r&&(!was.r||r.moved<was.r.moved))) byLabel.set(lbl,{sl,r});
    }
    for(const [lbl,{sl,r}] of byLabel){
      h+=`<button class="btn" style="justify-content:space-between;gap:10px" data-act="swap" data-sl="${sl}" ${r?'':'disabled'}><span>${esc(lbl)}</span><span class="small${r?'':' muted'}">${r?(r.moved>1?`moves ${r.moved-1} other day${r.moved>2?'s':''} →`:'no other changes →'):'nothing valid this week'}</span></button>`;
    }
    h+=`</div>`;
  }
  if(isReordered(mon)) h+=`<div><button class="btn sm ghost" data-act="ordreset">Reset this week to the standard order</button></div>`;
  return h+`</div>`;
}
// Shown once a day is marked done: what actually got logged, and anything still missing.
function finishCard(date,dp){
  const L=lg(date); if(!L.done||['off','pre','convert'].includes(dp.t)) return '';
  const bits=[], gaps=[];
  if(dp.t==='lift'||dp.t==='rm5'||dp.t==='test'){
    const wk=weekOf(date);
    for(const k of (dp.lifts||[])){
      const x=(L.lifts||{})[k]||{}, t=((L.test||{})[k])||{};
      if(dp.t==='lift'&&wk){const r=rx(wk,k),nS=r.s,dn=(x.sets||[]).filter(Boolean).length;
        bits.push(`${liftName(k,date)} ${dn}/${nS}${r.sMax>nS?'+':''}${x.grinder?' · grinder':''}`); if(dn<nS) gaps.push(`${liftName(k)}: ${nS-dn} set${nS-dn>1?'s':''} unticked`);}
      else if(t.w!=null&&t.w!=='') bits.push(`${liftName(k,date)} ${isBW(k)?fmtLoad(k,+t.w):n(t.w)} × ${t.r||'?'}`);
    }
    const w=(L.warmup||[]).filter(Boolean).length; if(w) bits.push(`warm-up ${w} done`);
  }
  if(dp.t==='hic'||dp.t==='plyohic'||dp.cardio){
    const f=effFmt(date), mod=modOf(date), met=metricFor(mod,f), v=met?(L.hic||{})[met[0]]:null;
    if(v!=null&&v!=='') bits.push(`${MOD[mod].name} ${HIC[f].name} ${n(v)} ${met[1]}`); else gaps.push('conditioning result not logged');
  }
  if(dp.t==='plyohic'||dp.t==='plyobase'){const c=(L.plyo||{}).contacts; if(c) bits.push(`${c} contacts`); if((L.plyo||{}).best||(L.plyo||{}).mark) bits.push(`broad jump ${r1((L.plyo||{}).best||(L.plyo||{}).mark)} in`)}
  if(dp.t==='travel'){
    const items=travelList(dp.slot), tv=(L.travel||{}), n0=items.filter((_,i)=>tv[i]).length;
    bits.push(`${n0} of ${items.length} movements`);
    if(n0<items.length) gaps.push(`${items.length-n0} movement${items.length-n0>1?'s':''} unticked`);
    const w=(L.warmup||[]).filter(Boolean).length; if(w) bits.push(`warm-up ${w} done`);
  }
  const m=(L.mobility||[]).filter(Boolean).length; if(m) bits.push(`mobility ${m} done`);
  if(!L.rpe) gaps.push('no session RPE');
  return `<div class="card done"><div class="lift-h"><h3>Session complete</h3><span class="chip light">✓ ${esc(dp.short||'Done')}${L.rpe?' · RPE '+L.rpe:''}</span></div>
  ${bits.length?`<div class="small">${esc(bits.join(' · '))}</div>`:''}
  ${gaps.length?`<div class="small muted">Still open: ${esc(gaps.join(', '))}.</div>`:'<div class="small muted">Everything logged. Nice work.</div>'}</div>`;
}
function banners(wk,dp){
  let h='';
  const needMax=dp.t==='lift'&&(dp.lifts||[]).some(k=>!maxFor(wk.kind==='cycle'?wk.cycle:wk.refCycle)[k]);
  if(needMax) h+=`<div class="banner warn"><div><b>Some maxes are missing.</b> Working weights need a 1RM for every lift. Finish the bridge week tests or enter maxes in Setup.</div><div><button class="btn sm" data-act="view" data-view="setup">Open Setup</button></div></div>`;
  if(wk.kind==='bridge'&&dp.t!=='convert') h+=`<div class="banner info"><div><b>Bridge week.</b> Testing and calibration, not training. Leave two reps in reserve on every test set. Sunday turns your 5RMs into maxes.</div></div>`;
  const hol=holidayOn(sel);
  if(hol&&(dp.t==='lift'||dp.t==='test')){const alt={0:'Sun or Tue',2:'Tue or Thu',3:'Wed or Fri',4:'Thu or Sat',5:'Fri or Sun'}[dow(sel)]||'an adjacent day';h+=`<div class="banner warn"><div><b>${hol}.</b> Shift this session to ${alt} if the gym is closed.</div></div>`}
  if(sel===todayStr()&&(wk.kind==='cycle')){
    const hs=hardSessions(), nm=addDays(mondayOf(sel),7), nw=weekOf(nm);
    if(hs>=2&&nw&&nw.kind==='cycle') h+=`<div class="banner alert"><div><b>${hs} hard lifting sessions in the last two weeks</b> (RPE 9+, a grinder, or missed sets). Operator is meant to stay sub-maximal. Lower the max on the lift that's grinding, or take a deload week starting ${fmtD(nm,true)}.</div><div class="row"><button class="btn sm" data-act="insert" data-kind="deload" data-monday="${nm}">Deload next week</button></div></div>`;
  }
  return h;
}
function sessionHtml(wk,dp){
  let h='';
  const note=dp.note?`<p class="muted small" style="margin:0">${esc(dp.note)}</p>`:'';
  if(dp.t==='off'){ return h+`<div class="card"><h3>Rest</h3><p style="margin:0">${esc(dp.note||'Full rest. Walk, sleep, eat.')} Deep stretching belongs today if you want it — the block below is the long version.</p></div>`+mobCard(sel,dp)+footer(false) }
  if(dp.t==='lift'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    h+=warmupCard(sel);
    for(const k of dp.lifts) h+=liftCard(wk,k,dp);
    h+=accCard(wk,dp);
    return h+mobCard(sel,dp)+footer(true);
  }
  if(dp.t==='travel') return h+warmupCard(sel)+travelCard(dp)+mobCard(sel,dp)+footer(true);
  if(dp.t==='hic') return h+hicCard(dp,note)+mobCard(sel,dp)+footer(true);
  if(dp.t==='plyohic') return h+plyoCard(wk,dp)+`<div class="divider">Rest 10 min</div>`+hicCard(dp,'')+mobCard(sel,dp)+footer(true);
  if(dp.t==='rm5'||dp.t==='test'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    if(dp.note) h+=`<div class="banner info"><div>${esc(dp.note)}</div></div>`;
    h+=warmupCard(sel);
    if(dp.jumps) h+=plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('First, before any lifting.');
    for(const k of dp.lifts) h+=testCard(k,dp.t==='rm5'?5:1,dp.t==='rm5');
    if(dp.pullups) h+=`<div class="card"><h3>Max unassisted pull-ups</h3><p class="muted small" style="margin:0">The number the Lift 3 substitution was aimed at. One all-out set, full hang to chin over bar.</p><label class="f">Reps${numIn('pullups',lg(sel).pullups,'0','class="num-in"')}</label>${bestPullups()}</div>`;
    if(dp.apply) h+=applyCard(wk);
    if(dp.cardio) h+=`<div class="divider">Then, easy</div>`+hicCard(dp,'');
    return h+mobCard(sel,dp)+footer(true);
  }
  if(dp.t==='se') return h+warmupCard(sel)+seCard(dp)+mobCard(sel,dp)+footer(true);
  if(dp.t==='plyobase') return h+warmupCard(sel)+plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('Baselines. Three good attempts each, keep the best.')+mobCard(sel,dp)+footer(true);
  if(dp.t==='convert') return h+convertCard(wk)+mobCard(sel,dp)+footer(false);
  return h;
}
function mobKind(dp){
  if(dp.t==='travel') return dp.slot==='day3'?'dead':'lift';
  if(dp.t==='plyohic'||dp.t==='plyobase') return 'plyo';
  if(dp.t==='hic') return 'hic';
  if(dp.t==='off'||dp.t==='convert'||dp.t==='pre') return 'off';
  return (dp.lifts||[]).includes('dead')?'dead':'lift';
}
function mobList(kind){const a=(plan.mob||{})[kind];return Array.isArray(a)&&a.length?a.map(x=>Array.isArray(x)?x:[x,'']):MOB[kind].items}
// "45–60 sec per side" -> a 60 s hold, two sides. Reps and breaths get no timer.
function holdSecs(dose){
  const m=String(dose||'').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(sec|min)/i);
  if(!m) return null;
  const v=+(m[2]||m[1]), s=m[3].toLowerCase()==='min'?v*60:v;
  return s>=10?{s,sides:/per side/i.test(dose)?2:1}:null;
}
function travelList(slot){const a=(plan.travel||{})[slot];return Array.isArray(a)&&a.length?a.map(x=>Array.isArray(x)?x:[x,'']):TRAVEL[slot].items}
function travelCard(dp){
  const L=lg(sel).travel||{}, items=travelList(dp.slot), done=items.filter((_,i)=>L[i]).length;
  return `<div class="card"><div class="lift-h"><span class="lift-name">${esc(TRAVEL[dp.slot].name)}</span><span class="rx">${done} of ${items.length}</span></div>
  <p class="small muted" style="margin:0">Rep targets rather than percentages \u2014 a week on hotel kit keeps the habit without touching your maxes. Leave two reps in reserve, as always.</p>
  <div class="stack">${items.map(([n,d],i)=>checkRow('travel.'+i,L[i],n,d)).join('')}</div>
  <div class="small muted">Edit these in Setup \u2192 Travel week.</div></div>`;
}
function checkRow(bind,on,name,dose){
  const h=holdSecs(dose), e=mlibEntry(name), id='c-'+bind.replace(/\./g,'-'), key='m-'+bind.replace(/\./g,'-');
  const open=!!e&&openPx.has(key);
  // No <details> here: ticking the box re-renders, and a native disclosure would be
  // rebuilt before its toggle event landed. The button drives openPx and the panel is
  // rendered from it, so the two cannot race.
  const info=e?`<button class="libinfo${open?' on':''}" data-act="mlib" data-k="${key}" aria-expanded="${open}" aria-label="How to do ${esc(name)}">i</button>`:'<span></span>';
  return `<div class="crow"><input type="checkbox" id="${id}" data-bind="${bind}" ${on?'checked':''}><label class="crow-n" for="${id}">${esc(name)}</label>${info}${dose?`<span class="mono small muted">${esc(dose)}</span>`:'<span></span>'}${h?`<button class="btn sm ghost hold" data-act="hold" data-n="${esc(name)}" data-s="${h.s}" data-sides="${h.sides}" aria-label="Time ${esc(name)}">\u23f1</button>`:'<span></span>'}</div>${open?libBody(e):''}`;
}


function warmupCard(date){
  const W=lg(date).warmup||[], short=!!lg(date).warmShort;
  const idx=WARMUP.map((x,i)=>i).filter(i=>!short||WARMUP[i].s);
  const done=idx.filter(i=>W[i]).length;
  let rows='', g=null;
  for(const i of idx){ const x=WARMUP[i]; if(x.g!==g){g=x.g;rows+=`<h4 class="sub-h">${esc(g)}</h4>`} rows+=checkRow('warmup.'+i,W[i],x.n,x.d); }
  return `<details class="plain card" data-px="gwu"${openPx.has('gwu')?' open':''}><summary><b>Warm-up</b> · ${done} of ${idx.length} done · ${short?'7 min':'12–15 min'}</summary>
  <div class="stack" style="margin-top:10px">
    <div class="restsel"><span>Version</span><div class="seg"><button class="segb${short?'':' on'}" data-act="wshort" data-v="0">Full · 12–15 min</button><button class="segb${short?' on':''}" data-act="wshort" data-v="1">Short · 7 min</button></div></div>
    ${rows}
    <div class="small muted">Keep static holds easy before lifting. Long aggressive holds right before heavy squats blunt force output — the deep work belongs in the mobility block at the end.</div>
    <div class="row"><button class="btn" data-act="guide" data-k="warmup">Guide me through it</button>${done?`<button class="btn sm ghost" data-act="wclear">Clear</button>`:''}</div>
  </div></details>`;
}
function mobCard(date,dp){
  const kind=mobKind(dp), M=MOB[kind], items=mobList(kind), L=lg(date).mobility||[], done=items.filter((_,i)=>L[i]).length;
  return `<details class="plain card" data-px="mob"${openPx.has('mob')?' open':''}><summary><b>Mobility</b> · ${done} of ${items.length} done · ${esc(M.name)}</summary>
  <div class="stack" style="margin-top:10px"><div class="small muted">${esc(M.why)} Hold each one easy; this is the place for the longer holds.</div>
    ${items.map(([n,d],i)=>checkRow('mobility.'+i,L[i],n,d)).join('')}
    <div class="row"><button class="btn" data-act="guide" data-k="mobility">Guide me through it</button>${done?`<button class="btn sm ghost" data-act="mclear">Clear</button>`:''}</div>
  </div></details>`;
}
/* ---------- strength-endurance circuits ---------- */
function seCluster(date){const o=(lg(date).se||{}).cluster;return SE_CLUSTERS[o]?o:(((plan.se||{}).cluster)in SE_CLUSTERS?plan.se.cluster:'bw')}
function seList(key){
  if(key==='mine'){const a=(plan.se||{}).custom;return Array.isArray(a)?a.filter(Boolean):[]}
  return (SE_CLUSTERS[key]||SE_CLUSTERS.bw).ex;
}
// What you're actually doing today. Starts as the cluster, and stays that way until you
// change something — a bar that's taken, a bell you'd rather use — which is per day only.
function seDayList(date){const a=(lg(date).se||{}).ex;return Array.isArray(a)&&a.length?a:seList(seCluster(date))}
function seEdited(date){const a=(lg(date).se||{}).ex;return Array.isArray(a)&&a.length>0}
// Everything the app knows about, for the swap list.
function seVocab(){
  const out=[];
  for(const c of Object.values(SE_CLUSTERS)) for(const e of c.ex) if(!out.includes(e)) out.push(e);
  for(const e of ((plan.se||{}).custom||[])) if(e&&!out.includes(e)) out.push(e);
  return out;
}
function seRestSecs(){const v=+((plan.se||{}).rest);return SE_RESTS.includes(v)?v:60}
function seDone(date){const d=(lg(date).se||{}).done;return Array.isArray(d)?d:[]}
let seEdit=null;
function seSwap(i,name,ex){
  const pool=seVocab().filter(e=>!ex.includes(e));
  return `<div class="seswap"><div class="small muted">Swap this one for today. The cluster and your other days stay as they are.</div>
  <div class="seg">${pool.map(e=>`<button class="segb" data-act="seput" data-i="${i}" data-v="${esc(e)}">${esc(e)}</button>`).join('')||'<span class="small muted">Nothing else on the list.</span>'}</div>
  <div class="row" style="align-items:flex-end"><label class="f" style="flex:1">Or type one<input type="text" id="se-ex-${i}" data-seex="${i}" value="${esc(name)}"></label><button class="btn sm ghost" data-act="serm" data-i="${i}">Remove</button><button class="btn sm" data-act="seedit" data-i="${i}">Done</button></div></div>`;
}
function seCard(dp){
  const key=seCluster(sel), ex=seDayList(sel), done=seDone(sel), C=dp.circuits, R=dp.reps, edited=seEdited(sel);
  const ticks=ex.reduce((a,_,i)=>a+((done[i]||[]).filter(Boolean).length),0), total=ex.length*C;
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Strength-endurance</span><span class="rx">${C} circuit${C>1?'s':''} × ${R} reps</span></div>
  <div class="small muted">Light resistance, high repetition, short rests. Work down the cluster, rest ${seRestSecs()?seRestSecs()+' sec':'as little as you can'} between exercises, then 2 minutes before the next circuit. Can't get all ${R} at once? Rest-pause until they're done, then move on.</div>
  <div class="restsel"><span>Cluster</span><div class="seg">${Object.entries(SE_CLUSTERS).map(([k,c])=>`<button class="segb${k===key&&!edited?' on':''}" data-act="secl" data-v="${k}" aria-pressed="${k===key&&!edited}">${c.name}</button>`).join('')}</div>${edited?`<span class="chip blue">Changed for today</span><button class="btn sm ghost" data-act="sereset">Back to ${esc(SE_CLUSTERS[key].name)}</button>`:''}</div>`;
  if(!ex.length) return h+`<div class="banner warn"><div class="small">No exercises in your own cluster yet. Add five to eight in <b>Setup → Strength-endurance</b>, or pick one of the book's above.</div></div></div>`;
  h+=`<div class="setbl">${ex.map((name,i)=>`<div class="serow"><button class="sename" data-act="seedit" data-i="${i}" aria-expanded="${seEdit===i}">${esc(name)}<span class="swap">swap</span></button><div class="sets">${Array.from({length:C},(_,j)=>`<button class="setb sm${(done[i]||[])[j]?' on':''}" data-act="setick" data-i="${i}" data-j="${j}" aria-pressed="${!!(done[i]||[])[j]}">${R}<small>${j+1}</small></button>`).join('')}</div>${seEdit===i?seSwap(i,name,ex):''}</div>`).join('')}</div>
  <div><button class="btn sm ghost" data-act="seadd">+ Add an exercise</button></div>
  <div class="row between"><span class="small muted">${ticks} of ${total} sets</span><span class="small muted">${esc(SE_CLUSTERS[key].note)}</span></div>
  <div class="restsel"><span>Rest between exercises</span><div class="seg">${SE_RESTS.map(v=>`<button class="segb${seRestSecs()===v?' on':''}" data-act="serest" data-v="${v}">${v?v+'s':'none'}</button>`).join('')}</div></div>
  ${key==='bar'||key==='db'||key==='kb'?`<div class="small muted">Use roughly 15–30% of your one-rep max. Don't test for it, and if it feels heavy take weight off.</div>`:''}
  </div>`;
  return h;
}
function warmupShort(){return `<div class="stack small"><div><b>1 · Raise temp</b> Bike, rower or easy jog, 4–5 min</div><div><b>2 · Breathe</b> 90/90 breathing ×5 breaths · cat/cow ×8–10</div><div><b>3 · T-spine</b> Thread the needle 6–8/side · open book 8/side · quadruped extension 8/side</div><div><b>4 · Hips</b> 90/90 switches ×10 · 90/90 lean 20–30 s/side · couch stretch 45–60 s/side · frog rocks ×10 · world's greatest ×5/side</div><div><b>5 · Activate</b> Leg swings 10 each way · band pull-aparts + dislocates ×15 · glute bridge or BW squat ×10</div><div class="muted">Short version (7 min): bike 4 min, 90/90 breathing, cat/cow, 90/90 switches, couch stretch, band pull-aparts. Keep static holds easy before heavy squats.</div></div>`}
function liftCard(wk,k,dp){
  const r=rx(wk,k), L=(lg(sel).lifts||{})[k]||{}, sets=L.sets||[];
  const isDead=k==='dead'&&wk.kind==='cycle';
  const nSets=r.sMax;
  const setLbl=r.sMax>r.s?r.s+'–'+r.sMax:String(r.s);
  const bar=isBarbell(k);
  const T=L.used!=null&&L.used!==''?+L.used:r.w, has=T!=null&&(isBW(k)||T>0);
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${setLbl} × ${r.r} @ ${r.p}%${plan.basis==='tm'?' TM':''}</span></div>`;
  if(VARS[k]&&!viewing){
    const V=varsOf(k), v=r.vr, cur=V[v];
    h+=`<label class="restsel"><span>This session</span><select class="varsel" data-act-var="${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===v?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    if(v!==varRef(k)) h+=`<div class="small muted">${esc(cur.note)}</div>`;
  }
  if(L3K.includes(k)&&l3On().length>1) h+=`<div class="restsel"><span>This session</span><div class="seg">${l3On().map(v=>`<button class="segb${v===k?' on':''}" data-act="l3swap" data-v="${v}" aria-pressed="${v===k}">${esc(liftName(v))}</button>`).join('')}</div></div>`;
  if(has){
    h+=`<div class="row between"><div class="big">${fmtLoad(k,T)}<small>${isBW(k)?(T>0?u()+' added':'bodyweight'):u()}</small></div><div class="stack small" style="text-align:right;gap:2px">${bar?`<span class="plates">${plates(T)}</span>`:''}${r.w&&T!==r.w?`<span class="chip mid" style="align-self:flex-end">Prescribed ${n(r.w)}</span>`:''}<span class="muted">${r.m?`Max ${isBW(k)?'+'+n(r.m.v):n(r.m.src==='ratio'?Math.round(r.m.v):r.m.v)} · Cycle ${r.c}${r.m.src==='proj'?' (projected)':''}`:''}</span></div></div>`;
    if(bar) h+=plateSvg(T);
    if(r.m&&r.m.src==='ratio') h+=`<div class="small muted"><b>Swapped for this session.</b> This cycle is built on the ${esc(varsOf(k)[r.m.bv].name.toLowerCase())}, so the weight is your ${n(r.m.from)} max at the ${Math.round(r.m.r*100)}% a ${esc(varsOf(k)[r.vr].name.toLowerCase())} usually carries against it. Change the lift for the whole cycle in Setup instead if this is not a one-off.</div>`;
    if(isBW(k)) h+=`<div class="small muted">${T>0?`Hang ${n(T)} ${u()} from a belt. `:'Today’s percentage is at or below your bodyweight: do bodyweight reps. '}Based on ${r1(bwFor(sel))} ${u()} bodyweight${(bwAvg(sel,7)||{}).n>1?' (7-day average)':''}.</div>`;
    if(k==='pull'&&plan.machineNote) h+=`<div class="small muted">Machine: ${esc(plan.machineNote)}</div>`;
  } else h+=`<div class="muted">${isBW(k)&&r.m&&!bwFor(sel)?'Enter your bodyweight (Setup or the daily check-in) to calculate the added weight.':`No max entered for ${esc(liftName(k))}. Add it in Setup.`}</div>`;
  h+=`<div class="sets">`;
  for(let i=0;i<nSets;i++) h+=`<button class="setb${sets[i]?' on':''}${popKey===k+':'+i?' pop':''}${i>=r.s?' opt':''}" data-act="set" data-lift="${k}" data-i="${i}" aria-pressed="${!!sets[i]}">${r.r}<small>Set ${i+1}</small></button>`;
  if(!viewing&&nSets<SETCAP(r)) h+=`<button class="setb add" data-act="addset" data-lift="${k}" aria-label="Add a set to ${esc(liftName(k))}">+<small>Set</small></button>`;
  const ex=+L.extra||0;
  const rm=restMins(k), heavyNote=(k==='squat'||k==='dead')&&r.t==='heavy'&&rm<5;
  h+=`</div><div class="restsel"><span>Rest</span><div class="seg">${[2,3,4,5].map(m=>`<button class="segb${rm===m?' on':''}" data-act="restmin" data-lift="${k}" data-v="${m}" aria-pressed="${rm===m}">${m} min</button>`).join('')}</div>${heavyNote?'<span>Heavy week: the book calls 5\u201310 min normal at this load.</span>':''}</div>`;
  h+=`<div class="row between"><label class="check"><input type="checkbox" id="g-${k}" data-bind="lifts.${k}.grinder" ${L.grinder?'checked':''}> Felt like a grinder</label><label class="f" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px">${isBW(k)?'Added weight':'Working weight'}${numIn('lifts.'+k+'.used',L.used,r.w!=null?n(isBW(k)?Math.max(0,r.w):r.w):'','class="num-in"')}</label></div>`;
  if(L.grinder&&r.m&&!dp.deload&&r.p<=85) h+=`<div class="banner warn"><div>A grinder at ${r.p}% means the max is too high. Lower it rather than pushing through.</div><div><button class="btn sm" data-act="lower" data-lift="${k}" data-c="${r.c}">Lower Cycle ${r.c} max 5% (${n(floorTo(r.m.v*.95,plan.round[k]))})</button></div></div>`;
  if(ex>0&&!sets[nSets-1]&&!viewing) h+=`<div><button class="btn sm ghost" data-act="rmset" data-lift="${k}">− Remove the last set</button></div>`;
  if(isDead) h+=`<div class="small muted">Deadlift stays 1–3 sets. Rest 5 min on heavy weeks.</div>`;
  else if(r.sMax>r.s) h+=`<div class="small muted">${r.s} sets is the prescription. The dashed ones are optional — take them when you have it in you, leave them when you don’t. The two-minute rest still applies to every set you take.</div>`;
  h+=warmupLog(k,ramp(k,has?T:null,r.t,dp.deload),has?`Calculated from today's working weight (${fmtLoad(k,T)} ${u()}). Change the working weight above and the warm-ups recalculate.`:'');
  return h+`</div>`;
}
const openWarm=new Set();
function wuList(k){const W=((lg(sel).lifts||{})[k]||{}).warmup;return Array.isArray(W)?W:W?Object.keys(W).reduce((a,i)=>(a[+i]=W[i],a),[]):[]}
function warmupLog(k,sug,basis){
  const W=wuList(k), rows=Math.max(sug.length,W.length), open=openWarm.has(k)||(!sug.length&&W.length>0);
  let done=0, chips='';
  for(let i=0;i<rows;i++){const x=W[i]||{}, s=sug[i]; if(x.done) done++;
    const w=x.w!=null&&x.w!==''?x.w:s&&s.w, r=x.r!=null&&x.r!==''?x.r:s&&s.r;
    if(w!=null) chips+=`<span class="chipw${x.done?' on':''}">${isBW(k)?fmtLoad(k,+w):n(w)}×${r??'?'}</span>`}
  let body='';
  for(let i=0;i<rows;i++){const x=W[i]||{}, s=sug[i];
    const ew=x.w!=null&&x.w!==''?+x.w:s&&s.w, pl=isBarbell(k)&&ew?platesShort(ew):'';
    body+=`<div class="wu-row"><span class="wu-lbl">${s?s.lbl:'+'+(i+1)}</span>${numIn(`lifts.${k}.warmup.${i}.w`,x.w,s?n(s.w):u(),`aria-label="Warm-up ${i+1} weight"`)}<span class="wu-x">×</span>${numIn(`lifts.${k}.warmup.${i}.r`,x.r,s?String(s.r):'reps',`aria-label="Warm-up ${i+1} reps"`)}<button class="wu-chk${x.done?' on':''}" data-act="wu" data-lift="${k}" data-i="${i}" aria-pressed="${!!x.done}" aria-label="Warm-up ${i+1} done">✓</button>${s?'<span></span>':`<button class="wu-rm" data-act="wurm" data-lift="${k}" data-i="${i}" aria-label="Remove warm-up ${i+1}">×</button>`}${pl?`<span class="wu-pl">${pl}</span>`:''}</div>`}
  return `<details class="wu" data-lift="${k}"${open?' open':''}><summary><span class="wu-t">Warm-up${rows?` ${done}/${rows}`:''}</span>${chips||'<span class="muted">none logged</span>'}</summary><div class="wu-body">${sug.length?`<div class="small muted">${basis?basis+' ':''}Tap ✓ to log a set as suggested, or type what you actually used.</div>`:'<div class="small muted">Enter a target weight above to get calculated warm-ups.</div>'}${viewing?'':`<div class="restsel"><span>Rest between warm-ups</span><div class="seg">${WARM_RESTS.map(v=>`<button class="segb${warmRestSecs(k)===v?' on':''}" data-act="warmrest" data-lift="${k}" data-v="${v}" aria-pressed="${warmRestSecs(k)===v}">${warmRestLabel(v)}</button>`).join('')}</div></div>`}${body}<div><button class="btn sm ghost" data-act="wuadd" data-lift="${k}">+ Add warm-up set</button></div></div></details>`;
}

/* ---------- daily check-in ---------- */
const CI_Q=[
  {grp:'Last night'},
  {f:'sleepH',q:'How many hours did you sleep?',num:true,opts:[[5,'5'],[6,'6'],[7,'7'],[8,'8'],[9,'9+']]},
  {f:'sleepQ',q:'How well did you sleep?',opts:[[1,'Awful'],[2,'Poor'],[3,'OK'],[4,'Good'],[5,'Great']]},
  {grp:'Right now'},
  {f:'energy',q:'Energy level?',opts:[[1,'Drained'],[2,'Low'],[3,'Normal'],[4,'Good'],[5,'Fired up']]},
  {f:'soreness',q:'How sore are you?',opts:[[1,'None'],[2,'A little'],[3,'Some'],[4,'Very'],[5,'Wrecked']]},
  {f:'stress',q:'Stress outside the gym?',opts:[[1,'Low'],[2,'Mild'],[3,'Moderate'],[4,'High'],[5,'Very high']]},
  {grp:'Yesterday’s eating'},
  {f:'protein',q:'Did you hit your protein target?',hint:'target',opts:[['yes','Yes'],['close','Close'],['no','No']]},
  {f:'fuel',q:'How much did you eat compared to your plan?',opts:[['under','Under'],['on','About right'],['over','Over']]},
  {f:'water',q:'Enough water?',opts:[['yes','Yes'],['no','Not really']]},
  {f:'alcohol',q:'Any alcohol?',opts:[['none','None'],['some','1–2 drinks'],['lots','3+']]},
  {f:'kcal',q:'Calories yesterday',kcal:true},
  {grp:'Optional'},
  {f:'bw',q:'Bodyweight this morning',bw:true}
];
const openCI=new Set();
const cvErr={};              // per-lift error from the add-a-variant form
function ci(date){return (lg(date).checkin)||{}}
// Calories are asked for the morning after, so what you ate on day d is logged on d+1.
function kcalOn(d){const v=ci(addDays(d,1)).kcal;return v==null||v===''?null:+v}
// Measured ("adaptive") TDEE: what you ate against what the scale trend did about it.
// 3500 kcal per lb, 7700 per kg. Needs a settled 7-day average at both ends of the
// window and calories on most of its days, or it says nothing.
function endAvg(from,to){
  let sw=0,sd=0,n=0;
  for(let d=from;d<=to;d=addDays(d,1)){const L=logs[d];if(!L||!inProgram(d))continue;const v=L.checkin&&L.checkin.bw;if(v==null||v==='')continue;sw+=+v;sd+=D(d);n++}
  return n?{avg:sw/n,at:sd/n,n}:null;
}
function tdeeMeasured(date,days){
  days=days||28;
  const from=addDays(date,-(days-1)), kc=[];
  for(let d=from;d<=date;d=addDays(d,1)){const v=kcalOn(d);if(v)kc.push(v)}
  // Both ends average their own 7 days, so the window needs no history before it. The
  // divisor is the real gap between the two groups' mean dates, not the window length.
  const a=endAvg(from,addDays(from,6)), b=endAvg(addDays(date,-6),date);
  if(!a||!b||a.n<2||b.n<2||kc.length<Math.ceil(days*.6)) return null;
  const gap=(b.at-a.at)/864e5; if(gap<7) return null;
  const mean=kc.reduce((x,y)=>x+y,0)/kc.length, dw=b.avg-a.avg, per=u()==='kg'?7700:3500;
  return {tdee:Math.round(mean-dw*per/gap),mean:Math.round(mean),dw,gap:Math.round(gap),days,n:kc.length,from,to:date};
}
// Mifflin-St Jeor, the usual predictive formula, for before there is enough data.
function bmr(date){
  const bw=bwFor(date), ht=+plan.height, sex=plan.sex, age=ageNow();
  if(!bw||!ht||!sex||!age) return null;
  const kg=u()==='kg'?bw:bw/2.2046, cm=u()==='kg'?ht:ht*2.54;
  return Math.round(10*kg+6.25*cm-5*age+(sex==='f'?-161:5));
}
function ageNow(){const b=+plan.birthYear;if(!b||b<1900)return null;return +todayStr().slice(0,4)-b}
const ACT=[[1.375,'Light · desk job, little else'],[1.55,'Moderate · this program, desk job'],[1.725,'High · this program plus an active job'],[1.9,'Very high · manual work or two-a-days']];
function actFactor(){const v=+plan.activity;return ACT.some(x=>x[0]===v)?v:1.55}
function tdeePredicted(date){const b=bmr(date);return b?Math.round(b*actFactor()):null}
// The running estimate. Your burn is not a constant: it drifts with bodyweight, with how
// much you move, and with a long deficit. So this is recomputed for every day from the
// window ending that day, longest window that has the data.
// Early on the window is short and the scale noise dominates, so the estimate is pulled
// toward the formula; the weight on your own data is the window's span over span + 10
// days, scaled by how many of its days have calories. By a full 28-day window it is ~70%
// yours, and `tdeeTrust` keeps climbing as history accumulates until the formula drops out.
function tdeeOn(date){
  const pred=tdeePredicted(date);
  const m=tdeeMeasured(date,28)||tdeeMeasured(date,21)||tdeeMeasured(date,14);
  if(!m) return pred?{tdee:pred,predicted:pred,measured:null,w:0}:null;
  if(!pred) return {tdee:m.tdee,predicted:null,measured:m,w:1};
  // Two things decide how much of your own number to use: how long you have been logging
  // both (six weeks of it and the formula drops out entirely) and how completely you
  // filled in the window. Today's intake is unknowable, so it is not counted against you.
  const w=Math.min(1,tdeeHistory(date)/42);
  return {tdee:Math.round(m.tdee*w+pred*(1-w)),predicted:pred,measured:m,w};
}
function tdeeHistory(date){
  let n=0; for(let i=1;i<=42;i++){const d=addDays(date,-i),L=logs[d];if(kcalOn(d)!=null&&L&&L.checkin&&L.checkin.bw!=null&&L.checkin.bw!=='')n++}
  return n;
}
// The estimate over time: one point per week, each from its own 28-day window.
function tdeeSeries(date,weeks){
  const out=[];
  for(let i=(weeks||12)-1;i>=0;i--){
    const d=addDays(date,-7*i); if(d<plan.startMonday) continue;
    const t=tdeeOn(d); if(t&&t.measured) out.push({d,v:t.tdee,w:t.w,mean:t.measured.mean});
  }
  return out;
}
// US Navy circumference method. Men use waist and neck, women add the hips. Measurements
// are in inches with lb, cm with kg. Typical error is 3–4 points, so it is a trend tool.
function measBefore(date){
  let best=null;
  for(const [d,L] of Object.entries(logs)) if(d<date&&inProgram(d)&&L.meas&&L.meas.waist&&L.meas.neck&&(!best||d>best.d)) best={d,m:L.meas};
  return best;
}
function measOn(date){
  let best=null;
  for(const [d,L] of Object.entries(logs)) if(d<=date&&inProgram(d)&&L.meas&&L.meas.waist&&L.meas.neck&&(!best||d>best.d)) best={d,m:L.meas};
  return best;
}
function navyBf(m,date){
  const ht=+plan.height, sex=plan.sex;
  if(!ht||!sex||!m||!m.waist||!m.neck) return null;
  const toIn=v=>u()==='kg'?+v/2.54:+v;
  const w=toIn(m.waist), nk=toIn(m.neck), hp=m.hip?toIn(m.hip):null, h=toIn(ht);
  let v;
  if(sex==='f'){ if(!hp) return null; v=163.205*Math.log10(w+hp-nk)-97.684*Math.log10(h)-78.387 }
  else { if(w<=nk) return null; v=86.010*Math.log10(w-nk)-70.041*Math.log10(h)+36.76 }
  return v>0&&v<70?Math.round(v*10)/10:null;
}
function bfSeries(date){
  return progLogs().filter(([d,L])=>d<=date&&L.meas&&L.meas.waist&&L.meas.neck)
    .map(([d,L])=>({d,m:L.meas,bf:navyBf(L.meas,d)})).filter(x=>x.bf!=null).sort((a,b)=>a.d<b.d?-1:1);
}
function latestBw(date){let best=null;for(const [d,L] of Object.entries(logs)) if(d<=date&&L.checkin&&L.checkin.bw&&(!best||d>best.d)) best={d,v:+L.checkin.bw};return best?best.v:(plan.bodyweight?+plan.bodyweight:null)}
// Daily weigh-ins are noisy; everything that reacts to bodyweight uses a 7-day average
// and falls back to the latest single reading until there are two in the window.
function bwAvg(date,days){
  days=days||7; const from=addDays(date,-(days-1)), xs=[];
  for(const [d,L] of Object.entries(logs)) if(d>=from&&d<=date&&L.checkin&&L.checkin.bw) xs.push(+L.checkin.bw);
  return xs.length?{avg:xs.reduce((a,b)=>a+b,0)/xs.length,n:xs.length}:null;
}
function bwFor(date){const a=bwAvg(date,7);return a?a.avg:latestBw(date)}
// Change per week from the 7-day average now against the one `back` days ago.
function bwRate(date,back){
  back=back||14; const now=bwAvg(date,7), then=bwAvg(addDays(date,-back),7);
  if(!now||!then||now.n<2||then.n<2) return null;
  return {perWeek:(now.avg-then.avg)/back*7, from:then.avg, to:now.avg, back};
}
function proteinTarget(date){const bw=bwFor(date);if(!bw)return null;const lb=u()==='kg'?bw*2.2046:bw;return Math.round(lb*(+plan.proteinPerLb||0.8)/5)*5}
function readiness(c){
  const part=[], add=(v,w)=>{if(v!=null&&!Number.isNaN(v))part.push([Math.max(0,Math.min(1,v)),w])};
  const tgt=+plan.sleepTarget||8;
  if(c.sleepH!=null&&c.sleepH!=='') add((+c.sleepH-4)/(tgt-4),.25);
  if(c.sleepQ) add((c.sleepQ-1)/4,.15);
  if(c.energy) add((c.energy-1)/4,.2);
  if(c.soreness) add(1-(c.soreness-1)/4,.15);
  if(c.stress) add(1-(c.stress-1)/4,.1);
  const nut=[]; if(c.protein) nut.push({yes:1,close:.6,no:.2}[c.protein]); if(c.fuel) nut.push({on:1,over:.8,under:.3}[c.fuel]); if(c.water) nut.push({yes:1,no:.5}[c.water]); if(c.alcohol) nut.push({none:1,some:.7,lots:.3}[c.alcohol]);
  if(nut.length) add(nut.reduce((a,b)=>a+b,0)/nut.length,.15);
  if(part.length<3) return null;
  const tw=part.reduce((a,x)=>a+x[1],0);
  return Math.round(100*part.reduce((a,x)=>a+x[0]*x[1],0)/tw);
}
function rLevel(sc){return sc==null?null:sc>=75?{k:'go',cls:'light',t:'Ready'}:sc>=55?{k:'care',cls:'mid',t:'Moderate'}:{k:'stop',cls:'heavy',t:'Low'}}
// Black rotates its conditioning; the app lets you pick anything and never noticed when
// you stopped rotating. Looks at the hard sessions only — LISS is meant to be samey.
function hicRut(date,n0){
  const xs=hicSessions().filter(x=>x.d<=date&&x.f!=='liss').slice(-(n0||6));
  if(xs.length<(n0||6)) return null;
  const f=xs[0].f, mod=xs[0].mod;
  const sameF=xs.every(x=>x.f===f), sameM=xs.every(x=>x.mod===mod);
  if(!sameF&&!sameM) return null;
  return {n:xs.length,f:sameF?f:null,mod:sameM?mod:null,since:xs[0].d};
}
// One session you repeat to compare against itself. Results only compare within an
// activity and a format, so a benchmark is the single line worth watching when the rest
// of your conditioning moves around.
function benchmark(){
  const b=plan.benchmark;
  if(b&&MOD[b.mod]&&HIC[b.fmt]&&!HIC[b.fmt].noMetric) return b;
  // not chosen yet: the hard pairing you have done most
  const tally={};
  for(const x of hicSessions()) if(x.f!=='liss'&&x.v!=null) tally[x.mod+'|'+x.f]=(tally[x.mod+'|'+x.f]||0)+1;
  const top=Object.keys(tally).sort((a0,b0)=>tally[b0]-tally[a0])[0];
  if(!top) return null;
  const [mod,fmt]=top.split('|');
  return {mod,fmt,auto:true};
}
function benchmarkState(date){
  const b=benchmark(); if(!b) return null;
  const xs=hicSessions().filter(x=>x.d<=date&&x.mod===b.mod&&x.f===b.fmt&&x.v!=null);
  const last=xs[xs.length-1]||null, first=xs[0]||null;
  const days=last?Math.round((D(date)-D(last.d))/864e5):null;
  const every=+plan.benchEvery||35;
  return {...b,xs,last,first,days,every,due:!last||days>=every,best:xs.reduce((a0,x)=>Math.max(a0,x.v),0)};
}
function suggestions(date){
  const c=ci(date), sc=readiness(c), lv=rLevel(sc), wk=weekOf(date), dp=dayPlan(date), out=[];
  if(!lv) return out;
  const add=(tone,title,text,act)=>out.push({tone,title,text,act});
  const heavy=wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
  const hicFmt=(dp.t==='hic'||dp.t==='plyohic')?effFmt(date):null;
  // today's session
  if(dp.t==='lift'){
    if(dp.deload) add('go','Deload day','Keep it easy regardless of how you feel. The point is recovery.');
    else if(lv.k==='go'&&sc>=85&&!(c.soreness>=4)) add('go','Green light: room for extra volume',`Operator allows 3–5 sets. If bar speed stays crisp, add a 4th set on squat and bench${heavy?' (heavy week: stop at 4)':''}. Deadlift stays at 1–3.`);
    else if(lv.k==='go') add('go','Train as written','Recovery looks good. Run the session as prescribed.');
    else if(lv.k==='care') add('care','Train as written, no extras','Hold at 3 sets (deadlift 1–2) and keep accessories to two movements.');
    else add('stop','Do the minimum today','3 sets on each lift, 1 set of deadlift, skip accessories. If the 70% warm-up feels heavy, lower today’s working weight 5–10%. Type it into the working weight box and the warm-ups recalculate. A lighter session still beats a skipped one.');
  }
  if(hicFmt&&hicFmt!=='liss'){
    const low={map:'8 rounds instead of 10',anaerobic:'6 rounds instead of 8',threshold:'3 rounds instead of 4',long:'4 rounds instead of 5'}[hicFmt];
    const hm=modOf(date), last=lastHic(hicFmt,hm,date).last;
    if(lv.k==='go') add('go','Push the conditioning',last?`Last ${HIC[hicFmt].name} (${MOD[hm].name}): ${n(last.v)} ${last.u}. Try to beat it.`:`Go hard and record your result as a baseline.`);
    else if(lv.k==='care') add('care','Conditioning: low end of the range',`Do ${low}. Hold the same pace, just fewer rounds.`);
    else add('stop','Swap today’s HIC to LISS','30–45 min conversational. Change the format in the conditioning card so your history stays clean.');
  }
  if(dp.t==='plyohic'&&(lv.k==='stop'||c.soreness>=4)) add('care','Plyos: halve the contacts','Cut, don’t skip. Tick “halve the contacts” and drop depth jumps today. Stop the moment a jump comes up short.');
  if(dp.t==='test'||dp.t==='rm5'){
    if(lv.k!=='go') add('care','Testing on a so-so day','If you can move the test a day, do it. If not, take the lower number. Starting light and adding later works. Starting heavy and stalling doesn’t.');
    else add('go','Good day to test','Ramp in singles, stop when the bar slows.');
  }
  if(dp.t==='off'&&lv.k==='stop') add('go','Good timing for a rest day','Prioritize sleep tonight. An easy walk helps more than lying still.');
  // recovery
  const tgt=+plan.sleepTarget||8;
  if(c.sleepH!=null&&c.sleepH!==''&&+c.sleepH<6) add('care','Short on sleep','Have caffeine early (nothing within 8 h of bed). A 20-minute nap before 3 pm helps. Don’t chase PRs today.');
  const recent=[];for(let i=0;i<7;i++){const d=addDays(date,-i),x=ci(d);if(x.sleepH!=null&&x.sleepH!=='')recent.push(+x.sleepH)}
  if(recent.length>=3){const avg=recent.reduce((a,b)=>a+b,0)/recent.length;if(avg<tgt-1) add('care',`Sleep averaging ${avg.toFixed(1)} h`,`That’s your biggest recovery lever. Set a fixed wake time, keep the room cool and dark, screens off 30 min before bed, and no HIC within 3 h of bedtime. Aim for ${tgt} h.`)}
  if(c.stress>=4) add('care','High stress counts as training load','Do the required sessions but drop anything optional: swap Saturday HIC to LISS and skip extra sets.');
  if(c.soreness>=4&&(dp.t==='lift'||dp.t==='test')) add('care','Very sore','Add 5 minutes to the cardio warm-up and extra hip work; soreness usually eases once warm. Sharp or joint pain is different: skip that lift.');
  // nutrition
  const pt=proteinTarget(date);
  if(c.protein==='no'||c.protein==='close') add('care','Protein',pt?`Aim for about ${pt} g today: 4 meals of ~${Math.round(pt/4/5)*5} g. Easy wins: Greek yogurt, eggs, chicken, lean beef, a whey shake.`:'Add your bodyweight (in Setup or below) to get a daily protein target.');
  const training=dp.t!=='off'&&dp.t!=='convert';
  if(c.fuel==='under'&&training) add('care','Fuel the session',`Under-eating shows up first in conditioning numbers. Eat carbs 2–3 h before training (rice, oats, potatoes, fruit)${plan.goal==='lose'?'. You can stay in a deficit, just put most of your carbs around training':''}.`);
  if(c.water==='no') add('care','Hydrate','Start with 16–24 oz of water now, and add 16–24 oz for each hour of hard conditioning. A pinch of salt helps on HIC days.');
  if(hicFmt&&hicFmt!=='liss'){
    const rut=hicRut(date,6);
    if(rut) add('care','Rotate your conditioning',`Your last ${rut.n} hard sessions were all ${rut.f?HIC[rut.f].name:''}${rut.f&&rut.mod?' on the ':''}${rut.mod?MOD[rut.mod].name.toLowerCase():''}. Black rotates formats and tools on purpose \u2014 pick a different one today and the adaptation stays broad.`);
    const bm=benchmarkState(date);
    if(bm&&bm.due&&bm.last) add('go','Benchmark due',`It has been ${bm.days} days since your ${MOD[bm.mod].name} ${HIC[bm.fmt].name} benchmark (best ${n(bm.best)}). Run that one today and you get a number that compares straight back.`);
  }
  if(c.alcohol==='lots') add('care','After a big night','Expect lower HIC numbers and don’t chase a PR. Extra water and a solid breakfast.');
  // trends
  let lowDays=0;for(let i=0;i<7;i++){const x=readiness(ci(addDays(date,-i)));if(x!=null&&x<55)lowDays++}
  const nm=addDays(mondayOf(date),7), nw=weekOf(nm);
  if(lowDays>=3&&nw&&nw.kind==='cycle') add('stop',`${lowDays} low-readiness days this week`,`Recovery isn’t keeping up. Consider a deload week starting ${fmtD(nm,true)}.`,{act:'insert',kind:'deload',monday:nm,label:'Deload next week'});
  {const r=bwRate(date,14);
    if(r){const perWk=r.perWeek, pct=perWk/r.from*100;
      if(plan.goal==='lose'&&pct<-1) add('care',`Losing ${Math.abs(perWk).toFixed(1)} ${u()}/week`,'That is from your 7-day average, and faster than about 1% of bodyweight per week tends to cost strength and conditioning. Add 200–300 kcal a day, mostly carbs around training.');
      else if(plan.goal==='lose'&&pct>-0.2) add('care','Bodyweight is flat','Two weeks of 7-day averages with no real change: trim about 200 kcal a day, or add one LISS session.');
      else if(plan.goal==='gain'&&pct<0.1) add('care','Not gaining','Add 200–300 kcal a day. Easiest from an extra meal or a bigger post-training meal.');
    }}
  return out;
}
function checkinCard(date){
  if(date>todayStr()) return '';
  const c=ci(date), sc=readiness(c), lv=rLevel(sc), open=openCI.has(date)||sc==null, pt=proteinTarget(date);
  const qs=CI_Q.map(q=>{
    if(q.grp) return `</div><div class="ci-grp"><h4>${q.grp}</h4>`;
    if(q.bw) return `<label class="q"><span>${q.q} <small>(${u()})</small></span>${numIn('checkin.bw',c.bw,latestBw(date)?n(latestBw(date)):'','class="num-in"')}</label>`;
    if(q.kcal) return `<label class="q"><span>${q.q} <small>(kcal, optional)</small></span>${numIn('checkin.kcal',c.kcal,'','class="num-in"')}</label>`;
    const hint=q.hint==='target'&&pt?` <small>(~${pt} g)</small>`:'';
    return `<div class="q"><span>${q.q}${hint}</span><div class="seg">${q.opts.map(([v,l])=>`<button class="segb${c[q.f]==v&&c[q.f]!==''&&c[q.f]!=null?' on':''}" data-act="ci" data-f="${q.f}" data-v="${v}" aria-pressed="${c[q.f]==v}">${l}</button>`).join('')}${q.num?numIn('checkin.sleepH',c.sleepH,'exact','class="num-in" style="max-width:84px" aria-label="Exact hours slept"'):''}</div></div>`;
  }).join('');
  const sug=suggestions(date);
  let h=`<div class="card"><div class="lift-h"><h3>Daily check-in</h3>${lv?`<span class="chip ${lv.cls}">${lv.t}</span>`:''}</div>`;
  if(lv) h+=`<div class="ready"><div class="big">${sc}</div><div class="small muted">Readiness out of 100, from sleep, energy, soreness, stress and yesterday’s eating.</div></div>`;
  else h+=`<p class="small muted" style="margin:0">Answer at least three questions (30 seconds) and the app adjusts today’s suggestions to how you’re recovering.</p>`;
  if(sug.length) h+=`<ul class="sug">${sug.map(x=>`<li class="${x.tone}"><div><b>${esc(x.title)}</b>${esc(x.text)}${x.act?`<div style="margin-top:6px"><button class="btn sm" data-act="${x.act.act}" data-kind="${x.act.kind}" data-monday="${x.act.monday}">${x.act.label}</button></div>`:''}</div></li>`).join('')}</ul>`;
  h+=`<details class="plain" id="ci-${date}"${open?' open':''}><summary>${lv?'Edit answers':'Questions'}</summary><div class="stack" style="gap:16px;margin-top:12px">${qs.replace(/^<\/div>/,'')}</div></div></details>`;
  if(lv) h+=`<p class="small muted" style="margin:0">General training guidance, not medical advice.</p>`;
  return h+`</div>`;
}
function accList(day){const a=(plan.acc||{})[day];return Array.isArray(a)&&a.length?a:ACC[day]}
function accCard(wk,dp){
  if(dp.deload) return `<div class="card"><h3>Accessories</h3><p class="muted" style="margin:0">None this week. Deload.</p></div>`;
  const v=wkRx(wk);
  if(wk.kind==='cycle'&&tier(+v.p)==='heavy') return `<div class="card"><h3>Accessories</h3><p class="muted" style="margin:0">Skip them. Heavy week.</p></div>`;
  const day=dp.acc; if(!day) return '';
  const slots=accSlots(day), done=accDoneCount(sel,day);
  let h=`<div class="card"><div class="lift-h"><h3>Accessories</h3><span class="small muted">${done} of ${slots.length} done</span></div>
  <p class="muted small" style="margin:0">Two or three sets each, a couple of reps short of failure. Nothing that leaves you sore for tomorrow\u2019s HIC.</p>`;
  if(!slots.length) h+=`<div class="muted small">No accessory slots on this day. Add some in Setup \u2192 Accessories.</div>`;
  for(const sl of slots) h+=accSlotRow(sel,sl);
  return h+`</div>`;
}

// One slot: what it is for, what is filling it today, and what you did.
function accSlotRow(date,slot){
  const id=accOn(date,slot), e=accEx(id), sets=accSets(date,slot), swapped=accSwapped(date,slot);
  const list=accFor(slot), all=accAll();
  const isDone=accDone(date,slot), noSets=!sets.length;
  let h=`<div class="acc-slot">
  <div class="acc-head"><span class="acc-role">${esc((ASLOT[slot]||{}).name||slot)}</span>${swapped?'<span class="chip blue">today only</span>':''}${isDone?'<span class="chip light">done</span>':''}</div>`;
  if(viewing){
    h+=`<div><b>${esc(e?e.name:'\u2014')}</b></div>`;
  } else {
    h+=`<select data-act-acc="${esc(slot)}" aria-label="${esc((ASLOT[slot]||{}).name||slot)}">${list.map(k=>`<option value="${esc(k)}"${k===id?' selected':''}>${esc(all[k].name)}${all[k].gear?' \u00b7 '+esc(all[k].gear):''}</option>`).join('')}</select>`;
  }
  if(slot==='pullup') h+=`<div class="small muted">${esc(pullupState(date).st.work)}</div>`;
  for(let i=0;i<sets.length;i++){
    const x=sets[i]||{};
    h+=`<div class="wu-row"><span class="wu-lbl">${i+1}</span>${numIn(`acc.sets.${slot}.${i}.w`,x.w,isBWAcc(id)?'bw':u(),`aria-label="Set ${i+1} weight"`)}<span class="wu-x">\u00d7</span>${numIn(`acc.sets.${slot}.${i}.r`,x.r,'reps',`aria-label="Set ${i+1} reps"`)}<span></span>${viewing?'<span></span>':`<button class="wu-rm" data-act="accrm" data-slot="${esc(slot)}" data-i="${i}" aria-label="Remove set ${i+1}">\u00d7</button>`}</div>`;
  }
  if(!viewing) h+=`<div class="row" style="gap:8px"><button class="btn sm ghost" data-act="accadd" data-slot="${esc(slot)}">+ Add set</button>${noSets?`<button class="btn sm${isDone?' primary':' ghost'}" data-act="accdone" data-slot="${esc(slot)}">${isDone?'\u2713 Done':'Mark done'}</button>`:''}</div>`;
  return h+`</div>`;
}
// Pull-ups and dips are loaded by bodyweight unless you hang a belt on.
function isBWAcc(id){ return ['chinup','dip','pu_prog','pu_band','pu_neg','invrow','plank','sideplank','deadbug','deadhang','nordic','ghr','abwheel','hangknee','hangleg','backext','pullapart','pike'].includes(id) }

function lastHic(fmt,mod,before){
  let best=null,last=null;
  for(const x of hicSessions(true)){ if(x.d>=before||x.f!==fmt||x.mod!==mod||x.v==null) continue;
    if(!last||x.d>last.d) last=x; if(!best||hicValue(x)>hicValue(best)) best=x; }
  return {best,last};
}
function hicCard(dp,note){
  const L=lg(sel).hic||{}, f=L.format||dp.fmt, H=HIC[f], mod=modOf(sel), M=MOD[mod], met=metricFor(mod,f);
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${esc(mod==='other'&&L.what?L.what:M.name)} · ${H.name}</span><span class="chip">${H.sys}</span></div>`;
  h+=`<div style="font-size:18px;font-weight:700">${H.sess}</div>${note}`;
  h+=`<div class="restsel"><span>Activity</span><div class="seg">${Object.entries(MOD).map(([k,x])=>`<button class="segb${k===mod?' on':''}" data-act="mod" data-v="${k}" aria-pressed="${k===mod}">${x.name}</button>`).join('')}</div></div>`;
  if((IV[f]||{}).lead){
    const rp=ivOpts(sel,f).reps||[];
    h+=`<div class="small muted">Keep moving on an easy base \u2014 a pace just under a jog, not a jog \u2014 and step off every two minutes for a set of reps, alternating two movements: <b>${rp.map(([n0,q])=>q+' '+n0.toLowerCase()).join('</b>, then <b>')}</b>. Kettlebells are the book\u2019s choice; dumbbells do the job, and a push-press can stand in for the snatch. Row, skip, cycle or take the stairs if you would rather not run.</div>
    <div class="small muted"><b>The sets are not on the clock.</b> Only the base counts toward the session, so the timer holds at each set until you tap Done, and the wall clock will read a good deal longer than the session length.</div>`;
  }
  else if(f!=='liss') h+=`<div class="small muted">Warm-up: ${M.wu||'5 min easy, then 3 × 15 s at HIC pace with 45 s easy between.'}</div>`;
  if(M.tip&&(f!=='liss'||mod==='ruck')) h+=`<div class="small muted">${M.tip}</div>`;
  if(dp.t==='plyohic'&&mod==='run'&&f!=='liss') h+=`<div class="banner warn"><div class="small">Plyos already loaded your legs today. Keep sprint volume at the low end of the range, or ride instead.</div></div>`;
  h+=`<div class="grid2"><label class="f">Format<select id="hic-fmt" data-bind="hic.format">${Object.entries(HIC).map(([k,x])=>`<option value="${k}"${k===f?' selected':''}>${x.name}</option>`).join('')}</select></label>`;
  if(mod==='other'&&!(HIC[f]||{}).noMetric) h+=`<label class="f">Activity<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="e.g. hill sprints, assault runner"></label>`;
  if((HIC[f]||{}).noMetric){
    h+=`<label class="f">Movements<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="KB swings / snatches"></label>`;
    h+=`<label class="f">Sets done${numIn('hic.rounds',L.rounds,'')}</label>`;
  }
  {
    const plan0=ivPartsLabel(f,ivOpts(sel,f)).total;
    h+=`<label class="f">Minutes${numIn('hic.min',L.min,String(plan0))}</label>`;
  }
  if(met) h+=`<label class="f">${metricLabel(met)}${f==='liss'?' <span style="font-weight:500">(optional)</span>':''}${numIn('hic.'+met[0],L[met[0]],'')}</label>`;
  if(M.load) h+=`<label class="f">Ruck load (${u()})${numIn('hic.load',L.load,'')}</label>`;
  if(M.elev) h+=`<label class="f">Elevation gain (${elevUnit()})${numIn('hic.elev',L.elev,'')}</label>`;
  h+=`</div>`;
  {
    const plan0=ivPartsLabel(f,ivOpts(sel,f)).total;
    if(L.min==null||L.min==='') {
      const pl=ivPartsLabel(f,ivOpts(sel,f));
      h+=`<div class="row" style="align-items:baseline"><span class="small muted">No minutes logged.</span><button class="btn sm" data-act="minplan" data-v="${plan0}">Use ${plan0} min</button></div><div class="small muted">That is ${esc(pl.text)}${pl.rounds?((IV[f]||{}).lead?`, counted as ${pl.rounds} \u00d7 two minutes of base; the ${pl.rounds} sets of reps sit on top, so the clock will say more`:`, from ${pl.rounds} rounds (there is no easy period after the last one, so ${pl.rounds} \u00d7 hard + ${pl.rounds-1} \u00d7 easy)`):''}. Change the field if you did more or less.</div>`;
    }
  }
  {
    const o=ivOpts(sel,f), r=IV[f], segs=ivSegments(f,o), running=iv&&iv.date===sel&&!iv.done;
    h+=`<div class="ivset"><div class="lift-h"><span class="lift-name">Interval timer</span><span class="small muted mono">${ivPartsLabel(f,o).total} min${(IV[f]||{}).hold?' of base':' total'}</span></div>`;
    if(r&&r.roundOpts) h+=`<div class="restsel"><span>Session</span><div class="seg">${r.roundOpts.map(([v,l])=>`<button class="segb${o.rounds===v?' on':''}" data-act="ivopt" data-k="rounds" data-v="${v}" aria-pressed="${o.rounds===v}">${l}</button>`).join('')}</div></div>`;
    else if(r&&r.rounds[0]!==r.rounds[1]) h+=`<div class="restsel"><span>Rounds</span><div class="seg">${Array.from({length:r.rounds[1]-r.rounds[0]+1},(_,i)=>r.rounds[0]+i).map(v=>`<button class="segb${o.rounds===v?' on':''}" data-act="ivopt" data-k="rounds" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    if(ivOpts(sel,f).ease&&easyCondWeek(sel)) h+=`<div class="small muted"><b>Easy conditioning week.</b> Your lifts are at ${wkRx(weekOf(sel)).p}% this week, so the conditioning comes down to leave the energy for them — fewer rounds, shorter sessions. This is deliberate, not a missed week.</div>`;
  if(f==='liss') h+=`<div class="restsel"><span>Minutes</span><div class="seg">${[30,35,40,45].map(v=>`<button class="segb${o.lissMin===v?' on':''}" data-act="ivopt" data-k="lissMin" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    h+=`<div class="row" style="gap:14px">${f!=='liss'?`<label class="check"><input type="checkbox" id="iv-warm" data-act-change="ivwarm" ${o.warm?'checked':''}> Warm-up (5 min + 3 pickups ≈ 8 min)</label>`:''}<label class="check"><input type="checkbox" id="iv-cool" data-act-change="ivcool" ${o.cool?'checked':''}> 5 min cool-down</label><label class="check"><input type="checkbox" id="iv-voice" data-pbind="voice" ${plan.voice?'checked':''}> Spoken cues</label><label class="check"><input type="checkbox" id="iv-quiet" data-pbind="quietTimer" ${plan.quietTimer?'checked':''}> Silent (keep my music)</label></div>`;
    if(plan.quietTimer) h+=`<div class="small muted">Silent: the timer vibrates and counts down on screen, and never opens an audio channel, so whatever you are listening to keeps playing. Turn rest alerts on in Setup if you want a notification at each change.</div>`;
    h+=`<div><button class="btn primary" data-act="ivstart" data-f="${f}" ${running||sel!==todayStr()?'disabled':''}>${running?'Timer running':'Start intervals'}</button>${sel!==todayStr()?' <span class="small muted">Available on the day.</span>':''}</div></div>`;
  }
  if(f!=='liss'&&met){const hist=lastHic(f,mod,sel);
    h+= hist.last?`<div class="small muted">Last ${M.name} ${H.name}: <span class="mono">${n(hist.last.v)}</span> ${met[1]}${flatEquiv(hist.last)!=null?` (<span class="mono">${n(flatEquiv(hist.last))}</span> ${met[1]} flat)`:''} on ${fmtD(hist.last.d,true)} · Best <span class="mono">${n(hicValue(hist.best))}</span>${flatEquiv(hist.best)!=null?' flat':''}</div>`:`<div class="small muted">First logged ${M.name} ${H.name} session. Results only compare against the same activity and format.</div>`}
  return h+`</div>`;
}
const openPx=new Set();
let popKey=null;
function plyoSets(ex,cut){return cut?Math.ceil(ex.s/2):ex.s}
function plyoContactsDone(ph,L,cut){let c=0;ph.ex.forEach((e,i)=>{const t=((L.sets||[])[i]||[]).filter(Boolean).length;c+=t*e.c/e.s});return Math.round(c)}
function plyoPullback(date){
  const c=ci(date), out=[];
  if(c.soreness>=4) out.push('you logged high soreness today');
  let short=0;for(let i=0;i<3;i++){const x=ci(addDays(date,-i));if(x.sleepH!=null&&x.sleepH!==''&&+x.sleepH<6.5)short++}
  if(short>=2) out.push('sleep has been short for several nights');
  const wed=lg(addDays(date,-1)); if(+wed.rpe>=9||Object.values(wed.lifts||{}).some(x=>x&&x.grinder)) out.push('yesterday’s lifting was hard');
  return out;
}
// The jump-prep drills. Shared by the Thursday plyo session and the jump-test days,
// where three maximal attempts off a cold ankle is exactly how a calf goes.
function plyoWarmBlock(L,cls){
  const done=(L.warm||[]).filter(Boolean).length;
  return `<details class="plain${cls||''}" data-px="wu"${openPx.has('wu')?' open':''}><summary>Jump warm-up · ${done} of ${PLYO_WARMUP.length} done · about 8 min, not counted</summary><div class="stack" style="margin-top:8px">${PLYO_WARMUP.map(([id,l,d,why],i)=>`<div class="pwu"><button class="wu-chk${(L.warm||[])[i]?' on':''}" data-act="pwu" data-i="${i}" aria-pressed="${!!(L.warm||[])[i]}" aria-label="${esc(l)} done">✓</button><details class="px" data-px="wu-${id}"${openPx.has('wu-'+id)?' open':''}><summary><span>${l}</span><span class="mono small">${d}</span></summary><div class="small muted" style="margin:4px 0 6px">${why}</div>${plyoEntry(id)}</details></div>`).join('')}</div></details>`
}
// The upper-body block: throws, not ground contacts, and the first thing to drop.
// Each phase is a set of slots (a movement pattern); which movement fills a slot is the
// person's choice and is remembered per phase, so the block fits whatever kit is around.
function plyoUpperPhase(wk){return wk.kind==='cycle'?PLYO_UPPER[Math.floor((wk.plyoIdx%9)/3)]:PLYO_UPPER[0]}
function upKey(ph,k){return PLYO_UPPER.indexOf(ph)+'-'+k}
function plyoUpperEx(ph){
  return ph.slots.map((sl,k)=>{
    const want=(plan.plyoUp||{})[upKey(ph,k)]||sl.def;
    const o=sl.opts.find(x=>x.id===want)||sl.opts[0];
    return {...o,s:sl.s,slot:sl.name,opts:sl.opts,k};
  });
}
function plyoUpperCard(wk,cut,pullback){
  const on=!!plan.plyoUpper, ph=plyoUpperPhase(wk), L=(lg(sel).plyo||{}).up||{};
  let h=`<div class="ivset"><div class="lift-h"><span class="lift-name">Upper body${on?' · '+esc(ph.name):''}</span><label class="check"><input type="checkbox" id="p-upper" data-act="plyoupper" ${on?'checked':''}> Include</label></div>`;
  if(!on) return h+`<div class="small muted">Optional upper-body power: throws, explosive pulls and speed presses. Operator's bench is deliberately sub-maximal and the bike does nothing for the upper body, so this fills a real gap. Pick a movement per slot from whatever you have — med ball, bodyweight, barbell or a band. Five minutes, full rest, every rep maximal.</div></div>`;
  h+=`<div class="stack" style="gap:10px">`;
  plyoUpperEx(ph).forEach((e,i)=>{
    const n0=cut?Math.ceil(e.s/2):e.s, sets=(L[i])||[];
    h+=`<div class="pex"><label class="f up-pick"><span class="small muted">${esc(e.slot)}</span><select data-pbind="plyoUp.${upKey(ph,i)}">${e.opts.map(o=>`<option value="${o.id}"${o.id===e.id?' selected':''}>${esc(o.label)} · ${esc(o.gear)}</option>`).join('')}</select></label>
    <details class="px" data-px="up${i}"${openPx.has('up'+i)?' open':''}><summary><span>${esc(e.label)}</span><span class="mono small">${n0} × ${esc(e.r)} · ${e.rest} s</span></summary>${plyoEntry(e.id)}</details>
    <div class="sets">${Array.from({length:n0},(_,j)=>`<button class="setb sm${sets[j]?' on':''}" data-act="upset" data-i="${i}" data-j="${j}" aria-pressed="${!!sets[j]}">${esc(String(e.r).split(' ')[0])}<small>Set ${j+1}</small></button>`).join('')}</div></div>`;
  });
  h+=`</div><div class="small muted">Throws and explosive reps, not ground contacts, so they do not count toward the contact target. Bench is on all three lifting days and Friday is the day after: if it ever feels flat, this is the first block to cut.</div>`;
  if(pullback||cut) h+=`<div class="banner warn"><div class="small">You are already pulling back today. Drop this block or do one movement.</div></div>`;
  return h+`</div>`;
}
function plyoCard(wk,dp){
  const ph=plyoPhase(wk), L=lg(sel).plyo||{}, cut=!!(dp.plyoCut||L.cut);
  const done=plyoContactsDone(ph,L,cut), target=cut?Math.round(ph.target/2):ph.target;
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Plyos · ${ph.name}</span><span class="rx">~${target} contacts</span></div><div class="small muted">${esc(ph.desc)} 15–20 min of actual work, before HIC.</div>`;
  const pb=plyoPullback(sel);
  if(pb.length&&!cut) h+=`<div class="banner warn"><div class="small"><b>Pull-back check:</b> ${esc(pb.join('; '))}. The program says cut the session in half (or warm-up only). Cut, don’t skip.</div></div>`;
  h+=plyoWarmBlock(L);
  h+=`<div class="stack" style="gap:12px">`;
  ph.ex.forEach((e,i)=>{
    const n0=plyoSets(e,cut), sets=((L.sets||[])[i])||[];
    h+=`<div class="pex"><details class="px" data-px="ex${i}"${openPx.has('ex'+i)?' open':''}><summary><span>${esc(e.label)}${e.low?' <span class="chip">low intensity</span>':''}</span><span class="mono small">${n0} × ${e.r} · ${e.rest>=120?e.rest/60+' min':e.rest+' s'}</span></summary>${plyoEntry(e.id)}</details>
    <div class="sets">${Array.from({length:n0},(_,j)=>`<button class="setb sm${sets[j]?' on':''}" data-act="pset" data-i="${i}" data-j="${j}" aria-pressed="${!!sets[j]}">${esc(e.r.split(' ')[0])}<small>Set ${j+1}</small></button>`).join('')}</div></div>`;
  });
  h+=`</div>`;
  h+=`<div class="grid3"><label class="f">First broad jump (in)${numIn('plyo.mark',L.mark,'')}</label><label class="f">Best broad jump (in)${numIn('plyo.best',L.best,'')}</label><label class="f">Contacts done${numIn('plyo.contacts',L.contacts,String(done))}</label></div>`;
  if(L.mark) h+=`<div class="small">Stop the session if a jump drops below <b class="mono">${n(Math.round(L.mark*.95*10)/10)} in</b> (5% off your first jump).</div>`;
  if(!dp.plyoCut) h+=`<label class="check"><input type="checkbox" id="p-cut" data-bind="plyo.cut" ${L.cut?'checked':''}> Hard lifting week: halve the contacts</label>`;
  h+=plyoUpperCard(wk,cut,pb.length>0);
  h+=`<details class="plain"><summary>The three rules, and when to pull back</summary><div class="stack small" style="margin-top:8px"><div><b>1. Watch your distance, not your set count.</b> If any jump drops more than about 5% off your first broad jump, the session is over, even with sets remaining.</div><div><b>2. Every rep is maximal or near it.</b> Rest fully between sets. If you are breathing hard, you are doing conditioning, not plyometrics.</div><div><b>3. Cut, don’t skip.</b> After an unusually hard lifting week, halve the contacts rather than dropping the session.</div><div><b>Cut the session in half, or do the warm-up only, if:</b><ul class="tight" style="margin-top:4px">${PLYO_PULLBACK.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></details>`;
  return h+`</div>`;
}
function jumpCard(sub){
  const J=lg(sel).jumps||{};
  const f=(id,lbl,key,unit)=>`<div class="pex"><details class="px" data-px="jt-${id}"${openPx.has('jt-'+id)?' open':''}><summary><span>${lbl}</span><span class="mono small">3 attempts · best counts</span></summary>${plyoEntry(id)}</details><label class="f">Best (${unit})${numIn('jumps.'+key,J[key],'')}</label></div>`;
  return `<div class="card"><h3>Jump tests</h3><p class="muted small" style="margin:0">${sub} Maximal efforts: do the jump warm-up above first, rest a full minute between attempts so each one is fresh, and measure the same way every time.</p>
  <div class="stack" style="gap:10px;margin-top:10px">${f('broad','Broad jump','broad','in')}${f('vertj','Vertical','vertical','in')}${f('triple','Standing triple jump','triple','in')}</div></div>`;
}
function testCard(k,defReps,isRm5){
  const T=(lg(sel).test||{})[k]||{}, reps=T.r||defReps, e=estMax(k,T.w,reps,sel), cur=currentMax(k)??((plan.prevMaxes||{})[k]??null);
  const bw=latestBw(sel);
  const est=cur==null?null:isBW(k)?(bw?floorTo((bw+cur)*(isRm5?.87:1)-bw,plan.round[k]):null):(isRm5?floorTo(cur*.87,plan.round[k]):cur);
  const tgt=T.target!=null&&T.target!==''?+T.target:(T.w!=null&&T.w!==''?+T.w:est);
  return `<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${isRm5?'5RM · 2 in reserve':'Heavy single'}${isBW(k)?' · added weight':''}</span></div>
  <div class="grid4"><label class="f">Target${numIn('test.'+k+'.target',T.target,est?n(est):'')}</label><label class="f">Result weight${numIn('test.'+k+'.w',T.w,'')}</label><label class="f">Reps${numIn('test.'+k+'.r',T.r,String(defReps))}</label><label class="f">Est. 1RM<div class="big" style="font-size:34px">${e?n(floorTo(e,plan.round[k])):'—'}</div></label></div>
  ${warmupLog(k,testRamp(k,tgt,isRm5),tgt!=null?`Calculated from a target of ${isBW(k)?fmtLoad(k,tgt):n(tgt)} ${u()}${T.target?'':T.w?' (your result)':' (from your current max)'}.`:'')}
  <div class="small muted">${isRm5?'If the bar slows, you have found your number. Bad day: take the lower number.':'Work up in singles. Stop when the bar slows.'}${cur!=null?(currentMax(k)==null?' Last program’s max: ':' Current max: ')+'<span class="mono">'+(isBW(k)?'+':'')+n(cur)+'</span>.':''}${k==='pull'?' Note the machine and pin setting.':''}${isBW(k)?' Enter the weight you added (0 for bodyweight). Uses your latest bodyweight.':''}</div></div>`;
}
function currentMax(k){const wk=weekOf(sel);if(!wk)return null;const c=wk.kind==='cycle'?wk.cycle:wk.refCycle;const m=maxFor(c)[k];return m?m.v:null}
function bestPullups(){let b=null;for(const [d,L] of Object.entries(logs)) if(d<sel&&L.pullups&&(!b||+L.pullups>b.v)) b={d,v:+L.pullups};return b?`<div class="small muted">Previous best: <span class="mono">${b.v}</span> on ${fmtD(b.d,true)}</div>`:''}
function weekResults(wk,field){
  const out={};for(let i=0;i<7;i++){const d=addDays(wk.monday,i),T=(lg(d)[field])||{};for(const k of LK){const t=T[k];if(t&&t.w!=null&&t.w!==''){const def=dayPlan(d).t==='rm5'?5:1;const e=estMax(k,t.w,t.r||def,d);if(e)out[k]=floorTo(e,plan.round[k])}}}
  return out;
}
function applyCard(wk){
  const res=weekResults(wk,'test'), nc=wk.nextCycle, cur=nc?(plan.cycleMaxes[nc]||{}):{};
  const rows=activeLifts().map(k=>{const proj=nc?maxFor(nc)[k]:null;return `<tr><td>${esc(liftName(k))}</td><td class="n">${res[k]!=null?n(res[k]):'—'}</td><td class="n">${proj?n(proj.v):'—'}</td></tr>`}).join('');
  const applied=nc&&LK.every(k=>res[k]==null||+cur[k]===res[k]);
  return `<div class="card"><h3>Feed results forward</h3><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Tested</th><th class="n">Cycle ${nc||'—'} now</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="small muted" style="margin:0">If a lift didn't move, that's information, not failure. Leave it blank to keep the projected number.</p>
  <div><button class="btn primary" data-act="applytest" data-monday="${wk.monday}" ${!nc||!Object.keys(res).length||applied?'disabled':''}>${applied&&Object.keys(res).length?'Applied to Cycle '+nc:'Use for Cycle '+(nc||'—')}</button></div></div>`;
}
function convertCard(wk){
  const res=weekResults(wk,'test');
  const rows=activeLifts().map(k=>`<tr><td>${esc(liftName(k))}</td><td class="n">${res[k]!=null?n(res[k]):'—'}</td><td class="n">${plan.maxes[k]!=null&&plan.maxes[k]!==''?n(plan.maxes[k]):'—'}</td></tr>`).join('');
  const done=LK.every(k=>res[k]==null||+plan.maxes[k]===res[k]);
  return `<div class="card"><h3>Convert 5RMs to maxes</h3><p class="small muted" style="margin:0">Each 5RM ÷ 0.87, rounded down. Missing a lift? Enter it in Setup.</p><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Est. 1RM</th><th class="n">Saved max</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div><button class="btn primary" data-act="savemaxes" data-monday="${wk.monday}" ${!Object.keys(res).length||done?'disabled':''}>${done&&Object.keys(res).length?'Saved as your maxes':'Save as my maxes'}</button></div></div>`;
}
function painAt(L){const a=L.painAt;return Array.isArray(a)?a:a?[a]:[]}
function footer(active){
  if(!active) return '';
  const L=lg(sel), dp=dayPlan(sel), lifting=dp.t==='lift'||dp.t==='rm5'||dp.t==='test';
  const after=lifting?`<div class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px">
    <div class="restsel"><span>How did it move?</span><div class="seg">${FEELS.map(([v,l])=>`<button class="segb${L.feel===v?' on':''}" data-act="sfeel" data-v="${v}" aria-pressed="${L.feel===v}">${l}</button>`).join('')}</div></div>
    <div class="restsel"><span>Anything hurt?</span><div class="seg">${PAINS.map(([v,l])=>`<button class="segb${L.pain===v?' on':''}" data-act="spain" data-v="${v}" aria-pressed="${L.pain===v}">${l}</button>`).join('')}</div></div>
    ${L.pain&&L.pain!=='none'?`<div class="restsel"><span>Where</span><div class="seg">${Object.entries(PAIN_AT).map(([k,x])=>`<button class="segb${painAt(L).includes(k)?' on':''}" data-act="spainat" data-v="${k}" aria-pressed="${painAt(L).includes(k)}">${x.name}</button>`).join('')}</div></div>
    <div class="small muted">${L.pain==='sharp'?'Sharp pain counts against that lift at the end of the cycle. Stop the movement causing it rather than working around it.':'Logged as a flag. It won’t move your numbers, but it shows up in the cycle review if it keeps happening.'}</div>`:''}
  </div>`:'';
  return `<div class="card"><div class="grid2"><label class="f">Session RPE<select id="rpe" data-bind="rpe" data-type="num"><option value="">—</option>${[5,6,7,8,9,10].map(v=>`<option value="${v}"${+L.rpe===v?' selected':''}>${v}</option>`).join('')}</select></label><div style="display:flex;align-items:flex-end"><button class="btn ${L.done?'':'primary'}" style="width:100%" data-act="done">${L.done?'✓ Done · undo':'Mark session done'}</button></div></div><label class="f">Notes<textarea id="notes" data-bind="notes" placeholder="Machine settings, how it moved, anything to remember">${esc(L.notes||'')}</textarea></label>${after}</div>`;
}

/* ---------- end-of-cycle review ---------- */
// Operator has no autoregulation. At the end of each cycle this reads what you logged
// (grinders, missed sets, effort on heavy weeks, readiness) and suggests next cycle's
// max per lift. Nothing changes until you apply it.
let reviewSel={};
function reviewCycleFor(date){
  const wk=weekOf(date); if(!wk) return null;
  let c=null;
  if(wk.kind==='cycle'&&wk.w===6&&dow(date)>=4) c=wk.cycle;
  else if(wk.kind==='cycle'&&wk.w<=2&&wk.cycle>1) c=wk.cycle-1;
  else if(wk.kind!=='cycle'&&wk.kind!=='bridge'&&wk.refCycle) c=wk.refCycle;
  if(!c||(plan.reviews||{})[c]) return null;
  return c;
}
function cycleStats(c){
  const list=weeks(), stats={}, rd=[];
  for(const wk of list){
    if(wk.kind!=='cycle'||wk.cycle!==c) continue;
    const heavy=tier(+wkRx(wk).p)==='heavy', p=+wkRx(wk).p;
    for(let i=0;i<7;i++){
      const d=addDays(wk.monday,i), L=logs[d]; if(!L) continue;
      const r=readiness(L.checkin||{}); if(r!=null) rd.push(r);
      const dp=dayPlan(d); if(dp.t!=='lift') continue;
      for(const k of dp.lifts){
        const x=(L.lifts||{})[k]; if(!x) continue;
        const sets=Array.isArray(x.sets)?x.sets:[], ticked=sets.filter(Boolean).length;
        if(!ticked&&!x.grinder) continue;
        const need=k==='dead'?1:+wkRx(wk).s;
        const S=stats[k]||(stats[k]={n:0,grind:0,heavyGrind:0,lightGrind:0,missed:0,rpe:[],sharp:0,niggle:0,where:{}});
        S.n++; if(x.grinder){S.grind++; if(heavy)S.heavyGrind++; if(p<=85)S.lightGrind++}
        // a complaint counts against the lifts its location plausibly belongs to
        if(L.pain==='sharp'||L.pain==='niggle'){
          const where=painAt(L), mine=where.length?where.filter(w=>((PAIN_AT[w]||{}).lifts||[]).includes(k)):[];
          if(!where.length||mine.length){ S[L.pain==='sharp'?'sharp':'niggle']++; for(const w of mine) S.where[w]=(S.where[w]||0)+1 }
        }
        if(L.done&&ticked<need) S.missed++;
        if(heavy&&L.rpe) S.rpe.push(+L.rpe);
      }
    }
  }
  return {stats, readiness:rd.length?rd.reduce((a,b)=>a+b,0)/rd.length:null};
}
function reviewOptions(k,cur){
  const inc=+plan.inc[k]||0, rd=+plan.round[k]||5;
  return {reduce:floorTo(cur*.95,rd), hold:cur, standard:cur+inc, bigger:cur+inc+rd};
}
function painWords(S){
  const w=Object.entries(S.where||{}).sort((a,b)=>b[1]-a[1]).map(([k])=>(PAIN_AT[k]||{}).name||k);
  return w.length?' ('+w.join(', ').toLowerCase()+')':'';
}
function recommend(S,rdAvg){
  if(!S) return ['standard','Not enough logged sessions to judge, so the standard increase.'];
  const rpe=S.rpe.length?S.rpe.reduce((a,b)=>a+b,0)/S.rpe.length:null;
  const pain=[]; if(S.sharp) pain.push(`${S.sharp} with sharp pain${painWords(S)}`); if(S.niggle) pain.push(`${S.niggle} with a niggle`);
  const bits=[`${S.n} sessions`,`${S.grind} grinder${S.grind===1?'':'s'}`,`${S.missed} missed`].concat(rpe!=null?[`heavy-week RPE ${rpe.toFixed(1)}`]:[]).concat(pain).join(' · ');
  // pain outranks everything else, including too few sessions to judge on
  if(S.sharp>=2) return ['reduce',bits+'. Sharp pain more than once on this lift: take the weight down and find out why before adding any.'];
  if(S.sharp>=1) return ['hold',bits+'. Sharp pain on this lift: hold the max rather than adding to it.'];
  if(S.n<3) return ['standard',(S.niggle?bits+'. ':'')+'Not enough logged sessions to judge, so the standard increase.'];
  if(S.missed>=3||S.lightGrind>=2) return ['reduce',bits+'. Grinding at moderate weights means the max is too high.'];
  if(S.missed>=1||S.heavyGrind>=1||S.grind>=2) return ['hold',bits+'. Repeat this max and own it.'];
  if(rpe!=null&&rpe<=7&&(rdAvg==null||rdAvg>=55)) return ['bigger',bits+'. Heavy weeks moved easily.'];
  return ['standard',bits+'. On track.'];
}
function reviewCard(c){
  const {stats,readiness:rdAvg}=cycleStats(c), mx=maxFor(c), nxt=(plan.cycleMaxes||{})[c+1]||{};
  const lifts=activeLifts().filter(k=>mx[k]);
  if(!Object.keys(stats).length) return '';
  const lbl={reduce:'Lower 5%',hold:'Hold',standard:'Standard',bigger:'Bigger jump'};
  let h=`<div class="card"><div class="lift-h"><h3>Cycle ${c} review</h3><span class="chip blue">Next: Cycle ${c+1}</span></div><p class="small muted" style="margin:0">Suggested from your grinders, missed sets and effort on heavy weeks${rdAvg!=null?` (average readiness ${Math.round(rdAvg)})`:''}. Pick next cycle’s max for each lift, then apply.</p>`;
  for(const k of lifts){
    const cur=mx[k].v, opts=reviewOptions(k,cur), [rec,why]=recommend(stats[k],rdAvg), preset=nxt[k]!=null&&nxt[k]!=='';
    const choice=reviewSel[k]||(preset?'keep':rec);
    const fmt=v=>isBW(k)?'+'+n(v):n(v);
    h+=`<div class="stack" style="gap:6px;border-top:1px solid var(--line);padding-top:10px"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="small muted mono">now ${fmt(cur)}</span></div><div class="small muted">${esc(why)}</div><div class="seg">${preset?`<button class="segb${choice==='keep'?' on':''}" data-act="rvsel" data-lift="${k}" data-v="keep">Keep ${fmt(+nxt[k])} (set)</button>`:''}${Object.entries(opts).map(([o,v])=>`<button class="segb${choice===o?' on':''}" data-act="rvsel" data-lift="${k}" data-v="${o}">${lbl[o]} ${fmt(v)}${o===rec?' ★':''}</button>`).join('')}</div></div>`;
  }
  h+=`<div class="row"><button class="btn primary" data-act="rvapply" data-c="${c}">Apply to Cycle ${c+1}</button><button class="btn ghost" data-act="rvdismiss" data-c="${c}">Dismiss</button><span class="small muted">★ = suggested</span></div></div>`;
  return h;
}

/* ---------- deload check-in (every 2 cycles) ---------- */
// In weeks 5-6 of cycles 2, 4, 6… ask whether the scheduled-deload setting still fits,
// with a recap of the last two cycles. Answers are kept in plan.deloadChecks.
const DELOAD_OPTS=[[0,'As needed'],[1,'After every cycle'],[2,'After every 2 cycles']];
function deloadLabel(v){const o=DELOAD_OPTS.find(x=>x[0]===v);return o?o[1]:'Every '+v+' cycles'}
function deloadCheckCycle(date){
  if(plan.askDeload===false) return null;
  const wk=weekOf(date); if(!wk||wk.kind!=='cycle'||wk.cycle%2||wk.w<5) return null;
  if((plan.deloadChecks||{})[wk.cycle]) return null;
  return wk.cycle;
}
function deloadCheckCard(c){
  const a=cycleStats(c-1), b=cycleStats(c), cur=+plan.deloadEvery||0;
  let grind=0, missed=0, sessions=0;
  for(const st of [a.stats,b.stats]) for(const S of Object.values(st)){grind+=S.grind;missed+=S.missed;sessions+=S.n}
  const rd=[a.readiness,b.readiness].filter(x=>x!=null), rdAvg=rd.length?Math.round(rd.reduce((x,y)=>x+y,0)/rd.length):null;
  const recap=sessions?`${sessions} lift entries · ${grind} grinder${grind===1?'':'s'} · ${missed} missed session${missed===1?'':'s'}${rdAvg!=null?' · average readiness '+rdAvg:''}`:'Not much logged in these two cycles yet.';
  const hint=rdAvg!=null&&rdAvg<60||grind+missed>=4?'Recovery looks strained. A deload after every cycle may fit better.':rdAvg!=null&&rdAvg>=75&&grind+missed<=1?'Recovery looks solid. As needed or every 2 cycles both fit.':'';
  return `<div class="card"><div class="lift-h"><h3>Deload check-in</h3><span class="chip blue">Cycles ${c-1}–${c}</span></div>
  <p class="small" style="margin:0">You’re set to <b>${deloadLabel(cur)}</b>. ${esc(nextScheduled('deload'))} Keep it, or change it for the next two cycles.</p>
  <div class="small muted">${esc(recap)}${hint?'. '+esc(hint):''}</div>
  <div class="seg"><button class="segb on" data-act="dlcheck" data-v="keep">Keep: ${deloadLabel(cur)}</button>${DELOAD_OPTS.filter(([v])=>v!==cur).map(([v,l])=>`<button class="segb" data-act="dlcheck" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="small muted">Asks again after Cycle ${c+2}. Turn this off in Setup.</div></div>`;
}

/* ---------- rest timer ---------- */
// State lives in localStorage with an absolute end time, so it survives the phone
// locking, the app being backgrounded, or a reload.
let rest=LS.get('ob.rest'), restTick=null, audioCtx=null, wakeLock=null;
function restMins(k){const m=+((plan.rest||{})[k]);return m>=2&&m<=5?m:3}
// Seconds between ramp sets. Short enough to stay warm, long enough that the last
// ramp single doesn't eat into the first working set.
const WARM_RESTS=[30,45,60,90,120];
function warmRestSecs(k){const v=+((plan.warmRest||{})[k]);return v>=15&&v<=600?v:90}
function warmRestLabel(v){return v<120?v+'s':(v/60)+' min'}
// Spoken cues (Setup / timer card). iOS only speaks after a first utterance inside a
// tap, so unlockAudio primes it with a silent one.
let voicePrimed=false;
function say(text){
  if(quiet()||!plan.voice||!('speechSynthesis' in window)) return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=1.05; u.pitch=1; speechSynthesis.speak(u) }catch(e){}
}
function quiet(){return !!plan.quietTimer}
function unlockAudio(){
  if(quiet()) return;
  try{ if(plan.voice&&!voicePrimed&&'speechSynthesis' in window){ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); voicePrimed=true } }catch(e){}
  try{
    if(navigator.audioSession) navigator.audioSession.type='transient';
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const b=audioCtx.createBuffer(1,1,22050), s=audioCtx.createBufferSource(); s.buffer=b; s.connect(audioCtx.destination); s.start(0);
  }catch(e){}
}
function beep(){
  try{
    if(quiet()) return; if(!audioCtx) unlockAudio(); if(!audioCtx) return;
    if(audioCtx.state==='suspended') audioCtx.resume();
    const t0=audioCtx.currentTime;
    [0,.28,.56].forEach((dt,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=i===2?1320:880;g.gain.setValueAtTime(0.0001,t0+dt);g.gain.exponentialRampToValueAtTime(0.5,t0+dt+.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+dt+.22);o.connect(g);g.connect(audioCtx.destination);o.start(t0+dt);o.stop(t0+dt+.25)});
  }catch(e){}
  try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}
}
// iOS drops the lock whenever the page is hidden, and a dropped lock still reads as an
// object, so re-check `released` rather than trusting we still hold it.
async function holdScreen(on){
  try{
    if(on){
      if(!navigator.wakeLock) return;
      if(wakeLock&&!wakeLock.released) return;
      wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null});
    } else if(wakeLock){ const w=wakeLock; wakeLock=null; await w.release() }
  }catch(e){wakeLock=null}
}
// The screen stays on for as long as anything is actually going on, not just while a
// rest happens to be counting: a session is open, or any timer is running.
function wantScreen(){
  if(ls||guide) return true;                      // session mode, or the guided runner
  if(rest&&!rest.done) return true;
  if(iv&&!iv.done) return true;
  if(gt&&!gt.paused&&!gt.done) return true;
  return false;
}
function syncScreen(){ holdScreen(wantScreen()) }
// Coming back to the app: take the lock again if we still need it, and wake the audio
// context, which iOS suspends while the page is hidden and a silent beep never recovers.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible') return;
  syncScreen();
  try{ if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume() }catch(e){}
});

/* ---------- a timer for anything ---------- */
// Deliberately not tied to a session: open it from the header on any tab, any day, with
// nothing started. Countdown or stopwatch. Like the other timers it runs off absolute
// times, so locking the phone or reloading the app doesn't make it drift, and it sits
// above the rest bar rather than replacing it, so a rest keeps counting underneath.
const GT_PRESETS = [30, 60, 120, 180, 300, 600];
const GT_STALE_MS = 12 * 3600 * 1000;
let gt = LS.get('ob.gt'), gtTick = null, gtPushT = null;

function gtSave(){ LS.set('ob.gt', gt) }
function gtFmt(s){
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s % 60);
}
/** Seconds left on a countdown, or elapsed on a stopwatch. */
function gtSecs(){
  if(!gt) return 0;
  const now = gt.paused || Date.now();
  return gt.mode === 'up' ? Math.max(0, Math.floor((now - gt.start - gt.pausedMs) / 1000))
                          : Math.max(0, Math.ceil((gt.end - now) / 1000));
}
function gtStart(mode, secs){
  unlockAudio();
  const now = Date.now();
  gt = mode === 'up' ? { mode:'up', start:now, pausedMs:0, paused:null }
                     : { mode:'down', dur:secs, end:now + secs * 1000, pausedMs:0, paused:null, done:false };
  gtSave(); syncScreen(); gtShow(); gtPush();
}
function gtPause(){
  if(!gt) return;
  if(gt.paused){ const d = Date.now() - gt.paused; gt.pausedMs += d; if(gt.mode === 'down') gt.end += d; gt.paused = null }
  else gt.paused = Date.now();
  gtSave(); syncScreen(); gtRender(); gtPanelDraw(); gtPush();
}
function gtAdd(s){
  if(!gt || gt.mode !== 'down') return;
  const base = gt.paused || Date.now();
  gt.end = Math.max(base + 1000, gt.end + s * 1000);
  gt.dur = Math.max(gt.dur, Math.round((gt.end - base) / 1000));
  if(gt.end > base) gt.done = false;
  gtSave(); gtRender(); gtPanelDraw(); gtPush();
}
function gtStop(){
  gt = null; gtSave();
  clearInterval(gtTick); gtTick = null;
  syncScreen();
  gtShow(); gtPanelDraw(); gtPush();
}
function gtShow(){
  const el = document.getElementById('gt'); if(!el) return;
  const btn = document.getElementById('tmr-b');
  if(!gt){ el.hidden = true; document.body.classList.remove('gt-on'); if(btn) btn.classList.remove('on'); clearInterval(gtTick); gtTick = null; return }
  el.hidden = false; document.body.classList.add('gt-on');
  const b = document.getElementById('tmr-b'); if(b) b.classList.add('on');
  if(!gtTick) gtTick = setInterval(gtRender, 250);
  gtRender();
}
function gtRender(){
  if(!gt) return;
  const el = document.getElementById('gt'); if(!el) return;
  const s = gtSecs(), down = gt.mode === 'down', over = down && s === 0;
  document.getElementById('gt-t').textContent = gtFmt(s);
  document.getElementById('gt-l').textContent = gt.paused ? 'Paused' : over ? 'Time’s up' : down ? 'Timer' : 'Stopwatch';
  document.getElementById('gt-p').textContent = gt.paused ? 'Resume' : 'Pause';
  el.classList.toggle('done', over);
  if(over && !gt.done){
    gt.done = true; gtSave(); beep(); syncScreen();
    setTimeout(() => say('Timer done'), 700);
  }
  if(over && Date.now() - gt.end > 5 * 60000) gtStop();   // nobody dismissed it
}
// Only touch the alert queue when nothing in a session owns it.
function gtPush(){
  if(!alertsOn()) return;
  if((rest && !rest.done) || (iv && !iv.done)) return;
  clearTimeout(gtPushT);
  gtPushT = setTimeout(() => {
    if(gt && gt.mode === 'down' && !gt.paused && !gt.done) api('POST', '/push/schedule', { at: gt.end, title: 'Timer done', body: 'The timer you set has finished.' }).catch(() => {});
    else api('POST', '/push/cancel').catch(() => {});
  }, 300);
}

/* the header panel */
function gtPanel(){
  if(gt){
    const down = gt.mode === 'down';
    return `<div class="gt-m-h">${down ? 'Countdown' : 'Stopwatch'}${gt.paused ? ' · paused' : ''}</div>
    <div class="row"><button class="btn" data-act="gtpause">${gt.paused ? 'Resume' : 'Pause'}</button>${down ? `<button class="btn" data-act="gtadd" data-v="-30">−30s</button><button class="btn" data-act="gtadd" data-v="30">+30s</button>` : ''}</div>
    <div class="row"><button class="btn ghost" data-act="gtstop">Stop and clear</button></div>`;
  }
  return `<div class="gt-m-h">Time anything</div>
  <div class="seg">${GT_PRESETS.map(v => `<button class="segb" data-act="gtdown" data-v="${v}">${gtFmt(v)}</button>`).join('')}</div>
  <div class="row" style="align-items:flex-end"><label class="f" style="flex:1">Minutes<input type="number" inputmode="decimal" step="any" min="0" id="gt-c" placeholder="e.g. 4.5"></label><button class="btn" data-act="gtcustom">Start</button></div>
  <div class="row"><button class="btn" data-act="gtup">Start a stopwatch</button></div>
  <div class="small muted">Runs on its own, so a rest or an interval keeps counting underneath.</div>`;
}
function gtPanelDraw(){
  const m = document.getElementById('tmr-m');
  if(m && !m.hidden) m.innerHTML = gtPanel();
}

/* wiring: the header button, the panel, and the bar's own buttons */
function gtAct(a, b){
  if(a === 'gtdown'){ gtStart('down', +b.dataset.v); gtPanelDraw(); return true }
  if(a === 'gtup'){ gtStart('up'); gtPanelDraw(); return true }
  if(a === 'gtcustom'){
    const el = document.getElementById('gt-c'), m = parseFloat(el && el.value);
    if(!(m > 0)){ if(el) el.focus(); return true }
    gtStart('down', Math.max(1, Math.round(m * 60))); gtPanelDraw(); return true;
  }
  if(a === 'gtpause'){ gtPause(); return true }
  if(a === 'gtadd'){ gtAdd(+b.dataset.v); return true }
  if(a === 'gtstop'){ gtStop(); return true }
  return false;
}
(function(){
  const btn = document.getElementById('tmr-b'), menu = document.getElementById('tmr-m');
  if(!btn || !menu) return;
  const open = (on) => { menu.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false'); if(on) menu.innerHTML = gtPanel() };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(menu.hidden) });
  for(const el of [menu, document.getElementById('gt')]){
    if(el) el.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if(b) gtAct(b.dataset.act, b) });
  }
  document.addEventListener('click', (e) => { if(!menu.hidden && !e.target.closest('#tmr-m,#tmr-b')) open(false) });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && !menu.hidden){ open(false); btn.focus() } });
})();

/* ---------- welcome setup ---------- */
// Guided first run for a new person (no saved plan, no logs), or re-run from Setup.
let wz=null;
function st0Saved(){return !!plan.onboarded}
function nextMonday(){const t=realToday();return dow(t)===0?t:addDays(mondayOf(t),7)}
function wzNew(rerun){
  return {rerun:!!rerun,step:0,unit:plan.unit||'lb',bw:plan.bodyweight||'',l3:Object.assign({pull:true,ohp:false,wpu:false},rerun?(plan.l3||{}).on:{}),
    start:rerun?plan.startMonday:nextMonday(),mode:rerun&&!plan.bridge?'maxes':'bridge',rm:'1rm',maxes:rerun?clone(plan.maxes):{},cardio:defMod(),deload:rerun?(+plan.deloadEvery||0):0,test:rerun?(+plan.testEvery||0):3};
}
const WZ_STEPS=['You','Lift 3','Start','Conditioning','Deloads','Ready'];
function vWelcome(){
  const w=wz, steps=WZ_STEPS.map((t,i)=>`<span class="chip${i===w.step?' blue':i<w.step?' light':''}">${i+1}. ${t}</span>`).join('');
  let h=`<div class="card"><div class="lift-h"><h2>${w.rerun?'Welcome setup':'Welcome to Operator + Black'}</h2>${w.rerun?'':'<button class="btn sm ghost" data-act="wzskip">Skip</button>'}</div><div class="row" style="gap:6px">${steps}</div>`;
  const on=L3K.filter(k=>w.l3[k]);
  if(w.step===0){
    h+=`<p style="margin:0">A training log for Tactical Barbell’s <b>Operator</b> (squat, bench and a third lift, three days a week, never near failure) and the <b>Black</b> conditioning protocol (three hard cardio sessions a week), plus plyometrics on Thursdays. It works out your weights, rest and intervals.</p>
    <div class="grid2"><label class="f">Units<div class="seg">${['lb','kg'].map(x=>`<button class="segb${w.unit===x?' on':''}" data-act="wzset" data-k="unit" data-v="${x}">${x}</button>`).join('')}</div></label><label class="f">Bodyweight (${w.unit}, optional)<input type="number" inputmode="decimal" step="any" id="wz-bw" data-wz="bw" value="${w.bw??''}"></label></div>
    <div class="small muted">Bodyweight is used for protein targets and weighted pull-ups.</div>`;
  } else if(w.step===1){
    h+=`<p style="margin:0">Monday and Wednesday include a third lift. Pick the ones you’ll use; with more than one, you can swap on any day.</p>
    <div class="stack">${L3K.map(k=>`<button class="btn${w.l3[k]?' primary':''}" style="justify-content:flex-start" data-act="wzl3" data-v="${k}">${w.l3[k]?'✓ ':''}${esc(liftName(k))}${k==='wpu'?' <span class="small">(once you can do a strict pull-up)</span>':''}</button>`).join('')}</div>`;
  } else if(w.step===2){
    const lifts=['squat','bench',...on,'dead'];
    h+=`<label class="f" style="max-width:260px">Start the week of<input type="date" id="wz-start" data-wz="start" value="${w.start}"></label>
    <div class="stack">
      <button class="btn${w.mode==='bridge'?' primary':''}" style="justify-content:flex-start;text-align:left" data-act="wzset" data-k="mode" data-v="bridge">${w.mode==='bridge'?'✓ ':''}Start with a bridge week: test your 5-rep maxes over one easy week (recommended)</button>
      <button class="btn${w.mode==='maxes'?' primary':''}" style="justify-content:flex-start;text-align:left" data-act="wzset" data-k="mode" data-v="maxes">${w.mode==='maxes'?'✓ ':''}I know my maxes: start Cycle 1 straight away</button>
    </div>`;
    if(w.mode==='maxes') h+=`<div class="seg">${[['1rm','1-rep maxes'],['5rm','5-rep maxes']].map(([v,l])=>`<button class="segb${w.rm===v?' on':''}" data-act="wzset" data-k="rm" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="grid4">${lifts.map(k=>`<label class="f">${esc(liftName(k))}${isBW(k)?' (added)':''}<input type="number" inputmode="decimal" step="any" id="wz-m-${k}" data-wz="maxes.${k}" value="${w.maxes[k]??''}"></label>`).join('')}</div>
      ${w.rm==='5rm'?'<div class="small muted">5-rep maxes are converted to 1-rep maxes (÷ 0.87).</div>':''}`;
    else h+=`<div class="small muted">The bridge week tests two lifts per test day, then converts your 5-rep maxes into Cycle 1’s numbers on Sunday.</div>`;
    if(w.rerun) h+=`<div class="banner warn"><div class="small">Changing the start week or bridge choice re-plans your whole calendar, locked weeks included.</div></div>`;
  } else if(w.step===3){
    h+=`<label class="f">Main conditioning tool<div class="seg">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<button class="segb${w.cardio===k?' on':''}" data-act="wzset" data-k="cardio" data-v="${k}">${x.name}</button>`).join('')}</div></label>
    <div class="small muted">Three hard sessions a week, all on this by default. You can switch activity on any single day — sprints, rower, ruck, hike, swim and more — and the app compares results only against the same activity.</div>`;
  } else if(w.step===4){
    h+=`<p style="margin:0">How the block itself runs. Both of these apply to the whole program, not just one part of it.</p>
    <label class="f">Scheduled deload week<div class="seg">${DELOAD_OPTS.map(([v,l])=>`<button class="segb${w.deload===v?' on':''}" data-act="wzset" data-k="deload" data-v="${v}">${l}</button>`).join('')}</div></label>
    <div class="small muted">A deload week drops to ${plan.deload.s}×${plan.deload.r} @ ${plan.deload.p}%, swaps conditioning to easy steady work, halves plyos and skips accessories. <b>As needed</b> schedules none: the app still offers one when your check-ins show low readiness or repeated hard sessions, and you can add one from the Plan tab any time. Tactical Barbell doesn’t mandate a fixed deload, so this is your call.</div>
    <label class="f">Retest week<div class="seg">${[[0,'Never'],[2,'Every 2 cycles'],[3,'Every 3 cycles'],[4,'Every 4 cycles']].map(([v,l])=>`<button class="segb${w.test===v?' on':''}" data-act="wzset" data-k="test" data-v="${v}">${l}</button>`).join('')}</div></label>
    <div class="small muted">A retest week takes three easy days, then heavy singles across two days, and feeds the results into the next cycle. Every 3 cycles matches the 18-week block.</div>
    <div class="small muted">The app checks in every second cycle to ask whether the deload setting still fits.</div>`;
  } else {
    const lifts=['squat','bench',...on,'dead'];
    h+=`<dl class="kv"><dt>Units</dt><dd>${w.unit}${w.bw?' · bodyweight '+esc(w.bw):''}</dd><dt>Lift 3</dt><dd>${on.map(liftName).map(esc).join(', ')}</dd><dt>Starts</dt><dd>${fmtLong(mondayOf(w.start))} · ${w.mode==='bridge'?'bridge week':'Cycle 1'}</dd>${w.mode==='maxes'?`<dt>Maxes</dt><dd>${lifts.map(k=>esc(liftName(k))+' '+(w.maxes[k]!=null&&w.maxes[k]!==''?(w.rm==='5rm'?n(floorTo(+w.maxes[k]/.87,5)):n(+w.maxes[k])):'—')).join(' · ')}</dd>`:''}<dt>Conditioning</dt><dd>${MOD[w.cardio].name}</dd><dt>Deloads</dt><dd>${deloadLabel(w.deload).toLowerCase()}${w.test?' · retest every '+w.test+' cycles':' · no retest weeks'}</dd></dl>
    <div class="small muted">Everything can be changed later in Setup. Tip: turn on <b>Rest alerts</b> in Setup to get notified when a rest ends.</div>`;
  }
  h+=`<div class="row">${w.step>0?'<button class="btn" data-act="wzback">‹ Back</button>':''}${w.step<5?'<button class="btn primary" data-act="wznext">Next ›</button>':`<button class="btn primary" data-act="wzdone">${w.rerun?'Save':'Start my program'}</button>`}${w.rerun?'<button class="btn ghost" data-act="wzcancel">Cancel</button>':''}</div></div>`;
  return h;
}
function wzFinish(){
  const w=wz, on=L3K.filter(k=>w.l3[k]); if(!on.length) on.push('pull');
  mutatePlan(p=>{
    const start=mondayOf(w.start), restart=start!==p.startMonday||(w.mode==='bridge')!==!!p.bridge;
    p.unit=w.unit; p.bar=w.unit==='kg'?20:45; if(w.bw!==''&&w.bw!=null) p.bodyweight=+w.bw;
    p.l3=Object.assign({},p.l3||{},{on:Object.fromEntries(L3K.map(k=>[k,on.includes(k)])),primary:on[0]});
    p.cardio=Object.assign({},p.cardio||{},{def:w.cardio}); p.deloadEvery=w.deload; p.testEvery=w.test;
    p.startMonday=start; p.bridge=w.mode==='bridge';
    if(restart){p.frozen={};p.lockedMax={}}
    if(w.mode==='maxes'){const m={};for(const k of LK){const v=w.maxes[k];if(v!=null&&v!=='')m[k]=w.rm==='5rm'?floorTo(+v/.87,+(p.round||{})[k]||5):+v}p.maxes=Object.assign({},clone(DEF.maxes),p.maxes||{},m)}
    p.onboarded=true;
  });
  wz=null; sel=realToday(); view='today'; render(); window.scrollTo(0,0);
}

/* ---------- guided warm-up / mobility ---------- */
// A hands-free run through a checklist: timed items count down and advance themselves,
// per-side items run both sides, rep items wait for a tap. Timed from absolute end times
// so locking the phone or reloading doesn't lose the place.
let guide=LS.get('ob.guide'), gdTick=null;
function gdItems(kind,date){
  if(kind==='warmup'){
    const short=!!lg(date).warmShort;
    return WARMUP.map((x,i)=>({i,name:x.n,dose:x.d,grp:x.g})).filter(x=>!short||WARMUP[x.i].s);
  }
  return mobList(mobKind(dayPlan(date))).map(([nm,d],i)=>({i,name:nm,dose:d,grp:MOB[mobKind(dayPlan(date))].name}));
}
function gdField(){return guide.kind==='warmup'?'warmup':'mobility'}
function gdTickOff(idx){
  const f=gdField(), A=[...(lg(guide.date)[f]||[])];
  A[idx]=true; for(let j=0;j<A.length;j++) if(A[j]==null) A[j]=false;
  setLog(guide.date,f,A);
}
function gdBegin(){
  const items=gdItems(guide.kind,guide.date), it=items[guide.pos];
  if(!it){gdFinish();return}
  const h=holdSecs(it.dose);
  guide.sides=h?h.sides:0; guide.dur=h?h.s:0; guide.side=1;
  guide.end=h?Date.now()+h.s*1000:null; guide.paused=null; guide.wait=null;
  LS.set('ob.guide',guide);
  say(it.name+(h?'. '+durText(h.s)+(h.sides>1?' each side':''):(it.dose?'. '+it.dose:'')));
}
function gdStart(kind){
  if(!gdItems(kind,sel).length) return;
  unlockAudio(); stopRest();
  guide={kind,date:sel,pos:0};
  gdBegin(); syncScreen(); gdShow();
}
function gdGo(pos){
  const items=gdItems(guide.kind,guide.date);
  if(pos<0) return;
  if(pos>=items.length){gdFinish();return}
  guide.pos=pos; gdBegin(); gdRender();
}
function gdFinish(){
  say(guide.kind==='warmup'?'Warm-up done.':'Mobility done.');
  tone(880,.18); tone(1320,.35,.22); vib([160,90,220]);
  gdClose();
}
function gdClose(){ guide=null; LS.set('ob.guide',null); syncScreen(); gdShow(); render(); }
function gdShow(){
  const el=document.getElementById('gd');
  if(!guide||viewing){el.hidden=true;clearInterval(gdTick);gdTick=null;document.body.style.overflow='';return}
  el.hidden=false; document.body.style.overflow='hidden';
  if(!gdTick) gdTick=setInterval(gdRender,200);
  gdRender();
}
function gdRender(){
  const box=document.getElementById('gd-in'); if(!guide||!box) return;
  const items=gdItems(guide.kind,guide.date), it=items[guide.pos];
  if(!it){gdFinish();return}
  const timed=guide.dur>0, paused=!!guide.paused, auto=plan.guideAuto!==false;
  let left=0;
  if(timed){
    left=Math.max(0,Math.ceil((guide.end-(paused?guide.paused:Date.now()))/1000));
    if(!paused&&!guide.wait&&Date.now()>=guide.end){
      const more=guide.sides>guide.side;
      if(more){ tone(660,.3); vib([140,70,140]); say('Switch sides') }
      else { tone(1320,.3); vib([200]); gdTickOff(it.i) }
      if(auto){
        if(more){ guide.side++; guide.end=Date.now()+guide.dur*1000; left=guide.dur; }
        else { LS.set('ob.guide',guide); return gdGo(guide.pos+1) }
      } else { guide.wait=more?'side':'next'; if(!more) say('Done'); }
      LS.set('ob.guide',guide);
    }
    if(guide.wait) left=0;
  }
  const el=document.getElementById('gd');
  el.className=guide.wait?'rest':timed?(paused?'':'hold'):'';
  const next=items[guide.pos+1];
  box.innerHTML=`<div class="gd-top"><span>${guide.kind==='warmup'?'Warm-up':'Mobility'} · ${guide.pos+1} of ${items.length}</span><button class="btn sm ghost" data-gd="close">Close</button></div>
  <div class="gd-bar"><i style="width:${Math.round(100*guide.pos/items.length)}%"></i></div>
  ${it.grp?`<div class="gd-grp">${esc(it.grp)}</div>`:''}
  <div class="gd-name">${esc(it.name)}</div>
  ${timed?`<div class="gd-time">${Math.floor(left/60)}:${pad(left%60)}</div>${guide.sides>1?`<div class="gd-side">Side ${guide.side} of ${guide.sides}</div>`:''}`:`<div class="gd-dose">${esc(it.dose||'')}</div>`}
  ${guide.wait?`<button class="btn primary" style="padding:16px;font-size:18px;width:min(100%,460px);margin:0 auto" data-gd="go">${guide.wait==='side'?'Start side '+(guide.side+1)+' ›':(next?'Next: '+esc(next.name)+' ›':'Finish ›')}</button>`:timed?'':`<button class="btn primary" style="padding:16px;font-size:18px;width:min(100%,460px);margin:0 auto" data-gd="done">Done</button>`}
  ${guide.wait?'':`<div class="gd-next">${next?'Next: '+esc(next.name):'Last one'}</div>`}
  <div class="gd-btns"><button class="btn" data-gd="back" ${guide.pos===0?'disabled':''}>‹ Back</button>${timed&&!guide.wait?`<button class="btn" data-gd="pause">${paused?'Resume':'Pause'}</button>`:''}<button class="btn" data-gd="skip">Skip ›</button></div>
  <button class="btn sm ghost" style="margin:0 auto" data-gd="auto">Auto-advance: ${auto?'on':'off'}</button>`;
}
document.getElementById('gd').addEventListener('click',e=>{
  const b=e.target.closest('[data-gd]'); if(!b||!guide) return; const a=b.dataset.gd; unlockAudio();
  if(a==='close') return gdClose();
  if(a==='back') return gdGo(guide.pos-1);
  if(a==='skip') return gdGo(guide.pos+1);
  if(a==='done'){ gdTickOff(gdItems(guide.kind,guide.date)[guide.pos].i); return gdGo(guide.pos+1) }
  if(a==='go'){
    if(guide.wait==='side'){ guide.side++; guide.end=Date.now()+guide.dur*1000; guide.wait=null; LS.set('ob.guide',guide); return gdRender() }
    guide.wait=null; return gdGo(guide.pos+1);
  }
  if(a==='auto'){ mutatePlan(p=>{p.guideAuto=p.guideAuto===false}); return gdRender() }
  if(a==='pause'){
    if(guide.paused){ guide.end+=Date.now()-guide.paused; guide.paused=null }
    else guide.paused=Date.now();
    LS.set('ob.guide',guide); gdRender();
  }
});

/* ---------- lifting session mode ---------- */
// One set at a time on lifting days. Steps are rebuilt from the plan and the day's log
// on every render, so edits (working weight, warm-ups) flow straight through.
let ls=LS.get('ob.ls'), lsTick=null;
// Test-day target, same rules as the test card: typed target, else the result, else
// the current max (87% of it for a 5RM; last program's max during a bridge week).
function testTargetOn(date,k,isRm5){
  const T=((lg(date).test||{})[k])||{}, wk=weekOf(date);
  const c=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):1, m=maxFor(c)[k];
  const cur=m?m.v:((plan.prevMaxes||{})[k]??null), bw=bwFor(date);
  const est=cur==null?null:isBW(k)?(bw?floorTo((bw+cur)*(isRm5?.87:1)-bw,plan.round[k]):null):(isRm5?floorTo(cur*.87,plan.round[k]):cur);
  const tgt=T.target!=null&&T.target!==''?+T.target:(T.w!=null&&T.w!==''?+T.w:est);
  return {T,tgt,est};
}
function lsSteps(date){
  const wk=weekOf(date), dp=dayPlan(date); if(!wk) return [];
  if(dp.t==='rm5'||dp.t==='test'){
    const isRm5=dp.t==='rm5', steps=[];
    for(const k of dp.lifts){
      const {tgt}=testTargetOn(date,k,isRm5);
      if(ls&&ls.warm!==false&&tgt!=null) testRamp(k,tgt,isRm5).forEach((x,j,a)=>steps.push({k,type:'warm',j,n:a.length,w:x.w,r:x.r,lbl:x.lbl}));
      steps.push({k,type:'test',isRm5,w:tgt,r:isRm5?5:1});
    }
    if(dp.pullups) steps.push({type:'pullups'});
    steps.unshift({type:'gwarm'}); steps.push({type:'mob'});
    steps.push({type:'finish',test:true});
    return steps;
  }
  if(dp.t!=='lift') return [];
  const steps=[];
  for(const k of dp.lifts){
    const r=rx(wk,k), L=(lg(date).lifts||{})[k]||{}, T=L.used!=null&&L.used!==''?+L.used:r.w;
    if(T==null) continue;
    if(ls&&ls.warm!==false){ ramp(k,T,r.t,dp.deload).forEach((x,j,a)=>steps.push({k,type:'warm',j,n:a.length,w:x.w,r:x.r,lbl:x.lbl})) }
    const nS=r.sMax;
    for(let j=0;j<nS;j++) steps.push({k,type:'work',j,n:nS,w:T,r:r.r,opt:j>=r.s,pct:r.p});
  }
  const heavy=wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
  if(!dp.deload&&!heavy&&dp.acc) steps.push({type:'acc'});
  steps.unshift({type:'gwarm'}); steps.push({type:'mob'});
  steps.push({type:'finish'});
  return steps;
}
function lsStepDone(st){
  const L=(lg(ls.date).lifts||{})[st.k]||{};
  if(st.type==='warm') return !!((wuListFor(ls.date,st.k)[st.j]||{}).done);
  if(st.type==='work') return !!((L.sets||[])[st.j]);
  if(st.type==='test'){const t=((lg(ls.date).test||{})[st.k])||{};return t.w!=null&&t.w!==''}
  if(st.type==='pullups') return lg(ls.date).pullups!=null&&lg(ls.date).pullups!=='';
  return false;
}
function wuListFor(date,k){const W=((lg(date).lifts||{})[k]||{}).warmup;return Array.isArray(W)?W:W?Object.keys(W).reduce((a,i)=>(a[+i]=W[i],a),[]):[]}
function lsFirstOpen(){const st=lsSteps(ls.date);
  if(!st.some(x=>['warm','work','test','pullups'].includes(x.type)&&lsStepDone(x))) return 0;
  const i=st.findIndex(x=>['warm','work','test','pullups'].includes(x.type)&&!x.opt&&!lsStepDone(x));return i<0?st.length-1:i}
function lsStart(){ ls={date:sel,i:0,warm:true}; ls.i=lsFirstOpen(); LS.set('ob.ls',ls); unlockAudio(); syncScreen(); lsShow(); }
function lsClose(){ ls=null; LS.set('ob.ls',null); syncScreen(); lsShow(); render(); }
function lsShow(){
  const el=document.getElementById('ls');
  if(!ls||viewing){el.hidden=true;clearInterval(lsTick);lsTick=null;document.body.style.overflow='';return}
  el.hidden=false; document.body.style.overflow='hidden';
  if(!lsTick) lsTick=setInterval(lsRestTick,250);
  lsRender();
}
function lsRestHtml(){
  if(!rest) return '';
  const left=Math.max(0,Math.ceil((rest.end-Date.now())/1000));
  return `<div class="ls-rest${left===0?' done':''}" id="ls-rest"><div><div class="small" style="font-weight:700">${esc(rest.lbl)}</div><b id="ls-rest-t">${Math.floor(left/60)}:${pad(left%60)}</b></div><div class="ls-row" style="flex:0 0 auto"><button class="btn sm" data-ls="r-30">−30s</button><button class="btn sm" data-ls="r+30">+30s</button><button class="btn sm" data-ls="rskip">${left===0?'Clear':'Skip'}</button></div></div>`;
}
function lsRestTick(){
  if(!ls) return; const box=document.getElementById('ls-rest');
  if(!rest){ if(box) lsRender(); return } if(!box){ lsRender(); return }
  const left=Math.max(0,Math.ceil((rest.end-Date.now())/1000));
  document.getElementById('ls-rest-t').textContent=Math.floor(left/60)+':'+pad(left%60);
  box.classList.toggle('done',left===0);
}
// how it moved and whether anything hurt, asked on the finish screen too
function lsAfter(L){
  return `<label class="f">How did it move?<div class="seg">${FEELS.map(([v,l])=>`<button class="segb${L.feel===v?' on':''}" data-ls="sfeel" data-v="${v}">${l}</button>`).join('')}</div></label>
  <label class="f">Anything hurt?<div class="seg">${PAINS.map(([v,l])=>`<button class="segb${L.pain===v?' on':''}" data-ls="spain" data-v="${v}">${l}</button>`).join('')}</div></label>
  ${L.pain&&L.pain!=='none'?`<label class="f">Where<div class="seg">${Object.entries(PAIN_AT).map(([k,x])=>`<button class="segb${painAt(L).includes(k)?' on':''}" data-ls="spainat" data-v="${k}">${x.name}</button>`).join('')}</div></label>`:''}`;
}
function lsRender(){
  const box=document.getElementById('ls-in'); if(!ls||!box) return;
  const steps=lsSteps(ls.date); if(!steps.length){lsClose();return}
  ls.i=Math.min(Math.max(0,ls.i),steps.length-1);
  const st=steps[ls.i], wk=weekOf(ls.date), dp=dayPlan(ls.date), done=steps.filter(x=>['warm','work','test','pullups'].includes(x.type)&&lsStepDone(x)).length, total=steps.filter(x=>['warm','work','test','pullups'].includes(x.type)).length;
  let h=`<div class="ls-top"><span>${esc(dp.short||'')} · ${esc(weekTitle(wk).t)}</span><button class="btn sm ghost" data-ls="close">Close</button></div><div class="ls-prog"><i style="width:${total?100*done/total:0}%"></i></div>`;
  h+=lsRestHtml();
  if(st.type==='warm'||st.type==='work'){
    const k=st.k, L=(lg(ls.date).lifts||{})[k]||{}, isDone=lsStepDone(st), bar=isBarbell(k);
    const next=steps[ls.i+1];
    h+=`<div class="ls-card"><div class="ls-lift">${esc(liftName(k))}</div>
      <div class="ls-kind${st.type==='work'?' work':''}">${st.type==='warm'?`Warm-up ${st.j+1} of ${st.n} · ${esc(st.lbl)}`:`Working set ${st.j+1} of ${st.n}${st.opt?' · optional':''} · ${st.pct}%`}${isDone?' · ✓ done':''}</div>
      <div><span class="ls-w">${isBW(k)?fmtLoad(k,st.w):n(st.w)}<small>${isBW(k)?(st.w>0?u()+' added':'bodyweight'):u()}</small></span> <span class="ls-reps">× ${st.r}</span></div>
      ${bar?plateSvg(st.w,true)+`<div class="plates">${esc(plates(st.w))}</div>`:''}
      ${st.type==='work'?`<div class="ls-row"><button class="btn sm" data-ls="w-">−${n(plan.round[k]||5)}</button><button class="btn sm" data-ls="w+">+${n(plan.round[k]||5)}</button><button class="btn sm${L.grinder?' primary':''}" data-ls="grind">${L.grinder?'✓ Grinder':'Felt like a grinder'}</button></div>
      ${st.j===st.n-1&&st.n<SETCAP(rx(wk,k,ls.date))?`<div class="ls-row"><button class="btn sm ghost" data-ls="addset">+ One more set</button></div>`:''}`:''}
    </div>`;
    h+=`<button class="btn primary ls-done" data-ls="done">${isDone?'Done ✓ · next':'Done'}</button>`;
    if(next&&(next.type==='warm'||next.type==='work')) h+=`<div class="small muted" style="text-align:center">Next: ${esc(liftName(next.k))} · ${next.type==='warm'?'warm-up':'set '+(next.j+1)} · ${isBW(next.k)?fmtLoad(next.k,next.w):n(next.w)} × ${next.r}</div>`;
  } else if(st.type==='test'){
    const k=st.k, t=((lg(ls.date).test||{})[k])||{}, bar=isBarbell(k), reps=t.r||st.r, e=estMax(k,t.w,reps,ls.date), next=steps[ls.i+1];
    h+=`<div class="ls-card"><div class="ls-lift">${esc(liftName(k))}</div>
      <div class="ls-kind work">${st.isRm5?'5-rep max · leave 2 reps in reserve':'Heavy single · stop when the bar slows'}${lsStepDone(st)?' · ✓ saved':''}</div>
      ${st.w!=null?`<div><span class="ls-w">${isBW(k)?fmtLoad(k,st.w):n(st.w)}<small>${isBW(k)?(st.w>0?u()+' added':'bodyweight'):u()} target</small></span></div>
      ${bar?plateSvg(st.w,true)+`<div class="plates">${esc(plates(st.w))}</div>`:''}
      <div class="ls-row"><button class="btn sm" data-ls="t-">Target −${n(plan.round[k]||5)}</button><button class="btn sm" data-ls="t+">Target +${n(plan.round[k]||5)}</button></div>`:`<label class="f">Your target ${st.isRm5?'for 5 reps':'single'} (${u()})<input type="number" inputmode="decimal" step="any" id="ls-tt" data-lsin="target" data-k="${k}" placeholder="e.g. what you think you can do with 2 reps left"></label><div class="small muted">No max to aim from yet. Enter a target and the warm-up ramp is calculated from it, or just work up and log what you get.</div>`}
      <div class="grid3"><label class="f">Weight lifted<input type="number" inputmode="decimal" step="any" id="ls-tw" data-lsin="w" data-k="${k}" value="${t.w??''}" placeholder="${st.w!=null?n(st.w):''}"></label><label class="f">Reps<input type="number" inputmode="numeric" step="1" id="ls-tr" data-lsin="r" data-k="${k}" value="${t.r??''}" placeholder="${st.r}"></label><label class="f">Est. 1RM<div class="big" style="font-size:34px">${e!=null?(isBW(k)?'+':'')+n(floorTo(e,plan.round[k])):'—'}</div></label></div>
      ${isBW(k)?'<div class="small muted">Enter the weight you added (0 for bodyweight).</div>':''}
    </div><button class="btn primary ls-done" data-ls="tsave">${lsStepDone(st)?'Saved ✓ · next':'Save result'}</button>`;
    if(next&&next.type==='warm') h+=`<div class="small muted" style="text-align:center">Next: ${esc(liftName(next.k))} warm-ups</div>`;
  } else if(st.type==='pullups'){
    h+=`<div class="ls-card"><div class="ls-lift">Max pull-ups</div><div class="small muted">One all-out set, full hang to chin over bar.</div><label class="f">Reps<input type="number" inputmode="numeric" step="1" id="ls-pu" data-lsin="pullups" value="${lg(ls.date).pullups??''}"></label></div><button class="btn primary ls-done" data-ls="next">Next</button>`;
  } else if(st.type==='gwarm'||st.type==='mob'){
    const isW=st.type==='gwarm', short=!!lg(ls.date).warmShort;
    const items=isW?WARMUP.map((x,i)=>[i,x.n,x.d,x.g]).filter(([i])=>!short||WARMUP[i].s):mobList(mobKind(dp)).map(([n,d],i)=>[i,n,d,'']);
    const flags=(isW?lg(ls.date).warmup:lg(ls.date).mobility)||[], done=items.filter(([i])=>flags[i]).length;
    h+=`<div class="ls-card"><div class="ls-lift">${isW?'Warm-up':'Mobility'}</div>
      <div class="ls-kind">${done} of ${items.length} done · ${isW?(short?'7 min':'12–15 min'):esc(MOB[mobKind(dp)].name)}</div>
      ${isW?`<div class="seg"><button class="segb${short?'':' on'}" data-ls="wfull">Full</button><button class="segb${short?' on':''}" data-ls="wshort">Short</button></div>`:`<div class="small muted">${esc(MOB[mobKind(dp)].why)}</div>`}
      <div class="stack">${items.map(([i,n,d])=>`<button class="btn${flags[i]?' primary':''}" style="justify-content:flex-start;text-align:left" data-ls="${isW?'gw':'mb'}" data-i="${i}">${flags[i]?'✓ ':''}${esc(n)}${d?` <span class="small">· ${esc(d)}</span>`:''}</button>`).join('')}</div></div>
      <div class="ls-row"><button class="btn" data-ls="guide">Guide me ›</button><button class="btn primary" style="flex:2" data-ls="next">${done>=items.length?'Done ✓ · next':isW?'Skip to lifting ›':'Next'}</button></div>`;
  } else if(st.type==='acc'){
    const slots=accSlots(dp.acc);
    h+=`<div class="ls-card"><div class="ls-lift">Accessories</div><div class="small muted">Two or three sets each, a couple of reps short of failure. Tap one to mark it done; the weights go on Today’s card.</div><div class="stack">${slots.map(sl=>{
      const on=accDone(ls.date,sl), ns=accSets(ls.date,sl).length;
      return `<button class="btn${on?' primary':''}" style="justify-content:flex-start" data-ls="acc" data-slot="${esc(sl)}">${on?'✓ ':''}${esc((ASLOT[sl]||{}).name||sl)} · ${esc(accName(accOn(ls.date,sl)))}${ns?` <span class="small">(${ns} set${ns===1?'':'s'})</span>`:''}</button>`;
    }).join('')}</div></div><button class="btn primary ls-done" data-ls="next">Next</button>`;
  } else if(st.test){
    const L=lg(ls.date), isRm5=dp.t==='rm5';
    const rows=dp.lifts.map(k=>{const t=((L.test||{})[k])||{},e=estMax(k,t.w,t.r||(isRm5?5:1),ls.date);return `<tr><td>${esc(liftName(k))}</td><td class="n">${t.w!=null&&t.w!==''?(isBW(k)?fmtLoad(k,+t.w):n(t.w))+' × '+(t.r||(isRm5?5:1)):'—'}</td><td class="n">${e!=null?'≈ '+(isBW(k)?'+':'')+n(floorTo(e,plan.round[k])):''}</td></tr>`}).join('')+(dp.pullups?`<tr><td>Pull-ups</td><td class="n">${L.pullups??'—'}</td><td></td></tr>`:'');
    h+=`<div class="ls-card"><div class="ls-lift">Test results</div><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Result</th><th class="n">Est. 1RM</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="small muted">${isRm5?'Sunday turns these into your maxes (Today → Sunday → Save as my maxes).':'Use “Feed results forward” on Saturday’s card to set next cycle’s maxes.'}</div>
      <label class="f">Session RPE<div class="seg">${[6,7,8,9,10].map(v=>`<button class="segb${+L.rpe===v?' on':''}" data-ls="rpe" data-v="${v}">${v}</button>`).join('')}</div></label>${lsAfter(L)}</div>
      <button class="btn primary ls-done" data-ls="finish">${L.done?'Finished ✓ · close':'Finish session'}</button>`;
  } else {
    const L=lg(ls.date);
    const rows=dp.lifts.map(k=>{const x=(L.lifts||{})[k]||{},r=rx(wk,k),nS=r.s,dn=(x.sets||[]).filter(Boolean).length;return `<tr><td>${esc(liftName(k))}</td><td class="n">${dn}/${nS}${r.sMax>nS?'+':''}</td><td>${x.grinder?'<span class="chip mid">grinder</span>':''}</td></tr>`}).join('');
    h+=`<div class="ls-card"><div class="ls-lift">Session summary</div><div class="tbl-wrap"><table><tbody>${rows}</tbody></table></div>
      <label class="f">Session RPE<div class="seg">${[6,7,8,9,10].map(v=>`<button class="segb${+L.rpe===v?' on':''}" data-ls="rpe" data-v="${v}">${v}</button>`).join('')}</div></label>${lsAfter(L)}</div>
      <button class="btn primary ls-done" data-ls="finish">${L.done?'Finished ✓ · close':'Finish session'}</button>`;
  }
  h+=`<div class="ls-row"><button class="btn" data-ls="back" ${ls.i===0?'disabled':''}>‹ Back</button><button class="btn" data-ls="skip" ${ls.i>=steps.length-1?'disabled':''}>Skip ›</button></div>`;
  if(ls.i===0) h+=`<label class="check small" style="justify-content:center"><input type="checkbox" id="ls-warm" ${ls.warm!==false?'checked':''}> Include warm-up sets</label>`;
  box.innerHTML=h;
}
function lsMarkWarm(st){
  const W=wuListFor(ls.date,st.k).map(x=>x?Object.assign({},x):{});
  const x=W[st.j]||(W[st.j]={}); x.done=true; if(x.w==null||x.w==='')x.w=st.w; if(x.r==null||x.r==='')x.r=st.r;
  for(let j=0;j<W.length;j++) if(!W[j]) W[j]={};
  setLog(ls.date,'lifts.'+st.k+'.warmup',W);
}
document.getElementById('ls').addEventListener('click',e=>{
  const b=e.target.closest('[data-ls]'); if(!b||!ls) return; const a=b.dataset.ls;
  const steps=lsSteps(ls.date), st=steps[ls.i]; unlockAudio();
  const go=i=>{ls.i=i;LS.set('ob.ls',ls);lsRender();document.getElementById('ls').scrollTo(0,0)};
  if(a==='close') return lsClose();
  if(a==='back') return go(ls.i-1);
  if(a==='skip'||a==='next') return go(ls.i+1);
  if(a==='r-30'||a==='r+30'){ if(rest){rest.end=Math.max(Date.now()+1000,rest.end+(a==='r+30'?30000:-30000));rest.done=false;rest.dur=Math.max(rest.dur,Math.round((rest.end-Date.now())/1000));LS.set('ob.rest',rest);syncPush()} return lsRender() }
  if(a==='rskip'){ stopRest(); return lsRender() }
  if(a==='addset'){ addSet(st.k,1,ls.date); return lsRender() }
  if(a==='grind'){ const L=(lg(ls.date).lifts||{})[st.k]||{}; setLog(ls.date,'lifts.'+st.k+'.grinder',!L.grinder); return lsRender() }
  if(a==='w-'||a==='w+'){ const inc=+plan.round[st.k]||5; setLog(ls.date,'lifts.'+st.k+'.used',Math.max(isBW(st.k)?-500:+plan.bar||0,st.w+(a==='w+'?inc:-inc))); return lsRender() }
  if(a==='acc'){ const sl=b.dataset.slot; setLog(ls.date,'acc.done.'+sl,accDone(ls.date,sl)?null:true); return lsRender() }
  if(a==='guide'){gdStart(st.type==='gwarm'?'warmup':'mobility');return}
  if(a==='gw'||a==='mb'){ const f=a==='gw'?'warmup':'mobility', A=[...(lg(ls.date)[f]||[])], i=+b.dataset.i; A[i]=!A[i]; for(let j=0;j<A.length;j++) if(A[j]==null) A[j]=false; setLog(ls.date,f,A); return lsRender() }
  if(a==='wfull'||a==='wshort'){ setLog(ls.date,'warmShort',a==='wshort'); return lsRender() }
  if(a==='rpe'){ setLog(ls.date,'rpe',+b.dataset.v); return lsRender() }
  if(a==='sfeel'){ const v=b.dataset.v; setLog(ls.date,'feel',lg(ls.date).feel===v?null:v); return lsRender() }
  if(a==='spain'){ const v=b.dataset.v, same=lg(ls.date).pain===v; setLog(ls.date,'pain',same?null:v); if(!same&&v==='none') setLog(ls.date,'painAt',[]); return lsRender() }
  if(a==='spainat'){ const k=b.dataset.v, cur=painAt(lg(ls.date)); setLog(ls.date,'painAt',cur.includes(k)?cur.filter(y=>y!==k):[...cur,k]); return lsRender() }
  if(a==='finish'){ if(!lg(ls.date).done) setLog(ls.date,'done',true); stopRest(); say('Session done. Nice work.'); return lsClose() }
  if(a==='t-'||a==='t+'){ const inc=+plan.round[st.k]||5, base=st.w!=null?st.w:0; setLog(ls.date,'test.'+st.k+'.target',Math.max(isBW(st.k)?-500:+plan.bar||0,base+(a==='t+'?inc:-inc))); return lsRender() }
  if(a==='tsave'){
    if(lsStepDone(st)) return go(ls.i+1);
    const t=((lg(ls.date).test||{})[st.k])||{};
    if((t.w==null||t.w==='')&&st.w!=null) setLog(ls.date,'test.'+st.k+'.w',st.w);
    if(t.r==null||t.r==='') setLog(ls.date,'test.'+st.k+'.r',st.r);
    if(!lsStepDone(st)){ const inp=document.getElementById('ls-tw'); if(inp) inp.focus(); return }
    const next=lsSteps(ls.date)[ls.i+1];
    if(next&&(next.type==='warm'||next.type==='test')) startRest(st.k,liftName(next.k)+' · '+(next.type==='warm'?'warm-up 1':'test'),Math.max(restMins(st.k),3)*60,'Rest · after '+liftName(st.k)+' test');
    return go(ls.i+1);
  }
  if(a==='done'){
    if(lsStepDone(st)) return go(ls.i+1);
    if(st.type==='warm'){ lsMarkWarm(st); }
    else { const L=(lg(ls.date).lifts||{})[st.k]||{}, arr=[...(L.sets||[])]; arr[st.j]=true; for(let j=0;j<arr.length;j++) if(arr[j]==null) arr[j]=false; setLog(ls.date,'lifts.'+st.k+'.sets',arr); }
    const next=lsSteps(ls.date)[ls.i+1];
    if(next&&(next.type==='warm'||next.type==='work'||next.type==='test')){
      const label=liftName(next.k)+' · '+(next.type==='warm'?'warm-up '+(next.j+1):next.type==='test'?(next.isRm5?'5-rep max':'heavy single'):'set '+(next.j+1));
      // the lift's warm-up rest between ramp sets, its full rest before the first working set
      const intoWork=st.type==='warm'&&next.type!=='warm';
      if(st.type==='warm'){
        startRest(st.k,label,intoWork?restMins(st.k)*60:warmRestSecs(st.k),(intoWork?'Rest before working sets · ':'Warm-up rest · ')+liftName(st.k));
        if(!intoWork&&rest){rest.ramp=1;LS.set('ob.rest',rest)}
      }
      else startRest(st.k,label);
    } else if(st.type==='work') stopRest();
    return go(ls.i+1);
  }
});
document.getElementById('ls').addEventListener('change',e=>{ const t=e.target; if(t.dataset.lsin&&ls){ const v=t.value===''?null:+t.value; if(t.dataset.lsin==='pullups') setLog(ls.date,'pullups',v); else setLog(ls.date,'test.'+t.dataset.k+'.'+t.dataset.lsin,v); lsRender(); return }
  if(e.target.id==='ls-warm'&&ls){ ls.warm=e.target.checked; ls.i=0; LS.set('ob.ls',ls); lsRender(); } });

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

/* ---------- what's new (RELEASES comes from releases.js) ---------- */
const APP_VERSION=RELEASES[0].v;
// deploys are tagged v<version>-<commit>, so the server can name the latest version too
function tagVersion(t){const m=/^v(\d+\.\d+)/.exec(String(t||''));return m?m[1]:null}
function vReleases(){
  return `<div class="card"><div class="lift-h"><h2>What\u2019s new</h2><button class="btn sm ghost" data-act="view" data-view="setup">Back to Setup</button></div>
  <p class="small muted" style="margin:0">What each release added. The app updates itself: when a new one is deployed you get a banner at the top, and reloading is all it takes.</p></div>
  ${RELEASES.map(r=>`<div class="card"><div class="lift-h"><h3>${esc(r.title)}</h3><span class="chip${r.v===APP_VERSION?' blue':''}">${r.v===APP_VERSION?'Current \u00b7 ':''}${esc(r.v)}</span></div>
  <div class="small muted">${fmtLong(r.date)}</div>
  <ul class="tight small">${r.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}`;
}

/* ---------- undo ---------- */
// One step back for the things that are easy to tap by mistake. Snapshots are taken
// before the change and expire after a few seconds.
let undoItem=null, undoTimer=null;
function snapLog(date){
  const before=logs[date]?clone(logs[date]):null;
  return ()=>{ logs[date]=before?before:{date}; planV++; queueWrite('logs/'+date,()=>logs[date]); render(); };
}
function snapPlan(){
  const before=clone(plan);
  return ()=>{ plan=before; planV++; queueWrite('plan/main',()=>plan); render(); };
}
// The dates a plan change is liable to move. Taken before and after, the difference is
// what the person actually cares about: "my retest moved a week".
function milestones(){
  const t=realToday(), list=weeks(), out={};
  for(const kind of ['deload','test']){const w=list.find(x=>x.kind===kind&&addDays(x.monday,6)>=t); out[kind]=w?w.monday:null}
  const c=list.find(x=>x.kind==='cycle'&&x.w===1&&x.monday>t); out.cycle=c?c.monday:null;
  out.n=list.find(x=>x.monday<=t&&addDays(x.monday,6)>=t);
  out.now=out.n?(out.n.kind==='cycle'?'Cycle '+out.n.cycle+' week '+out.n.w:weekTitle(out.n).t):null;
  return out;
}
function milestoneDiff(a0,b0){
  const bits=[], name={deload:'deload',test:'retest',cycle:'next cycle'};
  for(const k of ['deload','test','cycle']){
    if(a0[k]===b0[k]) continue;
    if(!b0[k]) bits.push('no '+name[k]+' scheduled now');
    else if(!a0[k]) bits.push(name[k]+' now '+fmtD(b0[k],true));
    else bits.push(name[k]+' '+fmtD(a0[k])+' \u2192 '+fmtD(b0[k]));
  }
  if(a0.now!==b0.now&&b0.now) bits.push('this week is now '+b0.now);
  return bits.join(' \u00b7 ');
}
// Apply a plan change and say what it moved, with the usual undo.
function replan(label,fn){
  const before=milestones(), snap=snapPlan();
  mutatePlan(fn);
  const moved=milestoneDiff(before,milestones());
  offerUndo(label+(moved?' \u00b7 '+moved:''),snap);
}
function offerUndo(label,restore){
  undoItem={label,restore};
  clearTimeout(undoTimer); undoTimer=setTimeout(()=>{undoItem=null;showToast()},7000);
  showToast();
}
function showToast(){
  const el=document.getElementById('toast');
  if(!undoItem){el.hidden=true;return}
  document.getElementById('toast-msg').textContent=undoItem.label;
  el.hidden=false;
}
function doUndo(){
  if(!undoItem) return;
  const r=undoItem.restore; undoItem=null; clearTimeout(undoTimer);
  r(); showToast();
}
document.getElementById('toast-undo').addEventListener('click',doUndo);

/* ---------- appearance ---------- */
// Theme and gym mode are per device, so they live in localStorage rather than the plan.
function themePref(){const t=LS.get('ob.theme');return t==='light'||t==='dark'?t:'auto'}
function gymOn(){return !!LS.get('ob.gym')}
function applyTheme(){
  const t=themePref(), r=document.documentElement;
  if(t==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',t);
  r.setAttribute('data-gym',gymOn()?'1':'0');
  let dark=t==='dark';
  if(t==='auto'){ try{dark=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches}catch(e){dark=false} }
  // one meta we control, so an explicit choice also moves the phone's status bar
  document.querySelectorAll('meta[name="theme-color"][media]').forEach(m=>m.remove());
  let m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}
  m.content=dark?'#0f1311':'#e8ebe6';
}
try{ if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(themePref()==='auto')applyTheme()}) }catch(e){}

/* ---------- app updates ---------- */
// The server stamps each page with its fingerprint. On open, on return from the
// background and every 30 min, compare it with what's deployed now; if they differ,
// offer a reload. Reloading is safe: data, unsent changes and the timer live on the phone.
const APP_VER=(document.querySelector('meta[name="app-version"]')||{}).content||null;
const upd={latest:null,at:null,tag:null,checked:null,err:null,busy:false,lastCheck:0};
async function checkUpdate(manual){
  if(!manual&&Date.now()-upd.lastCheck<10000) return;
  upd.lastCheck=Date.now(); upd.busy=!!manual; if(manual&&view==='setup') render();
  try{ const v=await api('GET','/version'); Object.assign(upd,{latest:v.page,at:v.deployedAt,tag:v.tag,checked:Date.now(),err:null}) }
  catch(e){ upd.err=navigator.onLine===false?'Offline. Check again when you have signal.':'Couldn’t check for updates.' }
  upd.busy=false; showUpdate(); if(view==='setup') render();
}
function updateAvailable(){return !!(APP_VER&&upd.latest&&upd.latest!==APP_VER&&APP_VER!=='dev')}
function showUpdate(){
  const el=document.getElementById('upd'); el.hidden=!updateAvailable(); if(el.hidden) return;
  const t=upd.at?new Date(upd.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):null;
  el.querySelector('span').textContent='A new version of the app is ready'+(t?' (deployed '+t+').':'.');
}
function applyUpdate(){
  const go=()=>location.reload();
  try{ navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{}).finally(go) }catch(e){ go() }
}
document.getElementById('upd-go').addEventListener('click',applyUpdate);
document.getElementById('upd-what').addEventListener('click',()=>{view='releases';render();window.scrollTo(0,0)});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkUpdate(false) });
setInterval(()=>checkUpdate(false),30*60*1000);

// The account menu. Sign-out is a Cloudflare Access URL, not an API call: it drops the
// Access session cookie, so the next request lands on the login screen. Nothing local is
// cleared — a different person signing in on this phone is handled by switchUser().
const acctB=document.getElementById('acct'), acctM=document.getElementById('acct-m');
function initials(email){
  const at=String(email||'').split('@')[0];
  const parts=at.split(/[._\-+]/).filter(Boolean);
  const s=(parts.length>1?parts[0][0]+parts[1][0]:at.slice(0,2));
  return s?s.toUpperCase():'•';
}
function acctPaint(){
  document.getElementById('acct-i').textContent=me?initials(me):'•';
  document.getElementById('acct-e').textContent=me||'Not signed in';
  const out=document.getElementById('acct-out');
  out.textContent=signedOut?'Sign in':'Sign out';
  out.setAttribute('href',signedOut?'/':'/cdn-cgi/access/logout');
  // Below 520px the status line is hidden, so the dot is the only sync indicator.
  const st=document.getElementById('status'), t=st.textContent||'', err=st.className==='err';
  document.getElementById('acct-dot').className='acct-dot '+(err?'err':t==='Saved'?'ok':'wait');
  const line=document.getElementById('acct-st');
  line.textContent=t; line.className='acct-st'+(err?' err':'');
}
function acctOpen(on){
  acctM.hidden=!on;
  acctB.setAttribute('aria-expanded',on?'true':'false');
  if(on) acctPaint();
}
acctB.addEventListener('click',e=>{ e.stopPropagation(); acctOpen(acctM.hidden) });
// The menu sits in the header, outside #main, so its items cannot use the data-act
// delegation: they carry data-view and are routed here.
acctM.addEventListener('click',e=>{
  const it=e.target.closest('[role="menuitem"]'); if(!it) return;
  acctOpen(false);
  if(it.dataset.view) goView(it.dataset.view);
});
document.addEventListener('click',e=>{ if(!acctM.hidden&&!e.target.closest('#acct-m,#acct')) acctOpen(false) });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!acctM.hidden){acctOpen(false);acctB.focus()} });
acctPaint();

/* ---------- rest alerts (push) ---------- */
// When alerts are on for this device, every rest schedules a push for its end time on
// the server, so the phone is notified even when locked or in another app.
const alerts={msg:null,busy:false};
function alertsSupport(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios&&!navigator.standalone?'install':'unsupported';
  }
  if(Notification.permission==='denied') return 'denied';
  return 'ok';
}
function alertsOn(){return !!LS.get('ob.push')&&window.Notification&&Notification.permission==='granted'}
function b64uBytes(str){const b=str.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(str.length/4)*4,'=');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))}
// If this device thinks alerts are on but the server has no subscription for this
// person (e.g. after the move to per-user alert stores), quietly register it again.
async function healAlerts(){
  if(!alertsOn()) return;
  try{
    const st=await api('GET','/push/status'); if(st.devices) return;
    const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription();
    if(sub) await api('POST','/push/subscribe',{subscription:sub.toJSON()}); else LS.set('ob.push',null);
  }catch(e){}
}
async function enableAlerts(){
  alerts.busy=true; alerts.msg=null; render();
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){alerts.msg=perm==='denied'?'Notifications are blocked. Turn them on in iOS Settings → Notifications → Operator.':'Notifications weren’t allowed. Tap Turn on again to retry.';return}
    const reg=await navigator.serviceWorker.ready, {key}=await api('GET','/push/key');
    let sub=await reg.pushManager.getSubscription();
    try{ if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)}) }
    catch(e){ if(sub) await sub.unsubscribe(); sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)}) }
    await api('POST','/push/subscribe',{subscription:sub.toJSON()});
    LS.set('ob.push',sub.endpoint); alerts.msg='Rest alerts are on for this device.';
  }catch(e){ alerts.msg=e&&e.status?'The server refused the subscription ('+e.status+'). Try again.':'Couldn’t turn on alerts. Check your connection and try again.' }
  finally{ alerts.busy=false; render() }
}
async function disableAlerts(){
  alerts.busy=true; render();
  try{ const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription(); if(sub){ await api('POST','/push/unsubscribe',{endpoint:sub.endpoint}).catch(()=>{}); await sub.unsubscribe() } }catch(e){}
  LS.set('ob.push',null); alerts.msg='Rest alerts are off for this device.'; alerts.busy=false; render();
}
async function testAlert(){
  try{ await api('POST','/push/schedule',{at:Date.now()+8000,title:'Test alert',body:'Rest alerts work. This is what the end of a rest looks like.'}); alerts.msg='Test alert coming in 8 seconds. Lock your phone now to see it on the lock screen.' }
  catch(e){ alerts.msg='Couldn’t send the test. Check your connection.' }
  render();
}
let pushTimer=null;
function syncPush(){
  if(!alertsOn()) return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(()=>{
    if(rest&&!rest.done){
      const body=rest.next?'Next: '+rest.next.replace(/ · /g,', ')+'.':rest.lbl.replace(/^Rest · /,'')+' rest is over.';
      api('POST','/push/schedule',{at:rest.end,title:rest.lbl.startsWith('Rest before')?'Time for HIC':'Rest done',body}).catch(()=>{});
    } else api('POST','/push/cancel').catch(()=>{});
  },300);
}
function startHold(name,secs,sides,side){
  unlockAudio();
  rest={k:null,lbl:name,next:sides>1?(side<sides?'Switch sides':'Hold done'):'',end:Date.now()+secs*1000,dur:secs,done:false,hold:1,baseLbl:name,sides,side};
  LS.set('ob.rest',rest); syncScreen(); showRest(); syncPush();
}
function startRest(k,next,secs,lbl){
  secs=secs||restMins(k)*60;
  rest={k,lbl:lbl||'Rest · '+liftName(k),next,end:Date.now()+secs*1000,dur:secs,done:false};
  LS.set('ob.rest',rest); syncScreen(); showRest(); syncPush();
}
function stopRest(){const was=rest&&!rest.done;rest=null;LS.set('ob.rest',null);clearInterval(restTick);restTick=null;syncScreen();showRest();if(was)syncPush()}
function showRest(){
  const el=document.getElementById('rest');
  if(!rest){el.hidden=true;document.body.classList.remove('timing');return}
  el.hidden=false;document.body.classList.add('timing');
  document.getElementById('rest-lbl').textContent=rest.lbl+(rest.sides>1?' · side '+rest.side+' of '+rest.sides:'');
  if(!restTick) restTick=setInterval(tickRest,250);
  tickRest();
}
function tickRest(){
  if(!rest) return;
  const el=document.getElementById('rest'), leftMs=rest.end-Date.now(), left=Math.max(0,Math.ceil(leftMs/1000));
  document.getElementById('rest-time').textContent=Math.floor(left/60)+':'+pad(left%60);
  document.getElementById('rest-fill').style.width=Math.min(100,Math.max(0,100*(1-leftMs/(rest.dur*1000))))+'%';
  document.getElementById('rest-next').textContent=left>0?(rest.next?'Next: '+rest.next:''):(rest.next?'Go: '+rest.next:'Rest done');
  document.getElementById('rest-stop').textContent=left>0?'Skip':'Done';
  el.classList.toggle('done',left===0);
  if(left===10&&rest.dur>20&&!rest.said10){rest.said10=true;say('Ten seconds')}
  if(left===0&&!rest.done){
    rest.done=true;LS.set('ob.rest',rest);beep();syncScreen();
    if(rest.hold&&rest.sides>rest.side){ const r=rest; say('Switch sides'); setTimeout(()=>{ if(rest===r) startHold(r.baseLbl,r.dur,r.sides,r.side+1) },1200); }
    else setTimeout(()=>say(rest&&rest.hold?(rest.baseLbl+' done'):rest&&rest.next?'Rest over. '+rest.next.replace(' · ',', '):'Rest over.'),700);
  }
  // clear a finished timer after two minutes if nobody dismisses it
  if(left===0&&leftMs<-120000) stopRest();
}
document.getElementById('rest').addEventListener('click',e=>{
  const b=e.target.closest('[data-rest]'); if(!b||!rest) return; const v=b.dataset.rest;
  if(v==='stop') return stopRest();
  unlockAudio();
  rest.end=Math.max(Date.now()+1000,rest.end+(+v)*1000); if(rest.end>Date.now()) rest.done=false;
  rest.dur=Math.max(rest.dur,Math.round((rest.end-Date.now())/1000));
  LS.set('ob.rest',rest); syncScreen(); tickRest(); syncPush();
});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&rest){ syncScreen(); tickRest() } });
function nextAfterSet(k,sets){
  const wk=weekOf(sel), dp=dayPlan(sel); if(!wk||dp.t!=='lift') return null;
  const r=rx(wk,k), nSets=r.sMax;
  for(let i=0;i<nSets;i++) if(!sets[i]) return liftName(k)+' · set '+(i+1)+(i>=r.s?' (optional)':'');
  const li=dp.lifts.indexOf(k);
  for(let j=li+1;j<dp.lifts.length;j++){const s2=((lg(sel).lifts||{})[dp.lifts[j]]||{}).sets||[];if(!s2[0])return liftName(dp.lifts[j])+' · set 1'}
  return undefined; // nothing left: no rest needed
}

/* ---------- personal records ---------- */
// Lifetime bests across every program, computed from the log. Each record keeps the
// date it was set and the value it beat, so a new one can be called out on the day.
// Every record, across every log. It walks the whole history several times over, and
// one Today render used to ask for it eight times: weekRecap checks each of the week's
// seven days for a personal best, then prCard asks again. With a year of training that
// was 16 of the 19 ms it took to build the view, for a card of about a kilobyte.
// Cached against planV + logsV, the same way weeks() and maxFor() already are.
let prCache={v:null,list:null};
function prList(){
  const ver=planV+':'+logsV;
  if(prCache.v===ver) return prCache.list;
  const out=[], add=(key,label,unit,entries,fmt)=>{
    const xs=entries.filter(e=>e.v!=null&&!Number.isNaN(e.v)&&e.v>0).sort((a,b)=>a.d<b.d?-1:1);
    if(!xs.length) return;
    let best=null, prev=null;
    for(const e of xs){ if(!best||e.v>best.v){prev=best;best=e} }
    out.push({key,label,unit,value:best.v,date:best.d,prev:prev?prev.v:null,n:xs.length,fmt:fmt||(v=>n(v))});
  };
  // tested maxes, per lift
  for(const k of activeLifts()){
    const xs=[];
    for(const [d,L] of Object.entries(logs)){
      const t=(L.test||{})[k]; if(!t||t.w==null||t.w==='') continue;
      const e=estMax(k,t.w,t.r||(dayPlan(d).t==='rm5'?5:1),d);
      if(e!=null) xs.push({d,v:floorTo(e,plan.round[k])});
    }
    add('lift:'+k,esc(liftName(k))+' 1RM',u(),xs,v=>(isBW(k)?'+':'')+n(v));
  }
  add('pullups','Max pull-ups','reps',Object.entries(logs).map(([d,L])=>({d,v:+L.pullups})));
  for(const [f,lbl] of [['broad','Broad jump'],['vertical','Vertical jump'],['triple','Standing triple jump']]){
    add('jump:'+f,lbl,'in',Object.entries(logs).map(([d,L])=>({d,v:+((L.jumps||{})[f]||(f==='broad'?((L.plyo||{}).best||(L.plyo||{}).mark):0))})));
  }
  // conditioning: best per activity and format, hard sessions only
  const g={};
  for(const x of hicSessions(true)){ if(x.f==='liss'||x.v==null) continue; (g[x.mod+'|'+x.f]=g[x.mod+'|'+x.f]||[]).push({d:x.d,v:x.v,u:x.u}) }
  for(const key of Object.keys(g)){
    const [m,f]=key.split('|');
    add('hic:'+key,MOD[m].name+' · '+HIC[f].name,g[key][0].u,g[key]);
  }
  prCache={v:ver,list:out};
  return out;
}
// Records set on this date (the day something became a best, with a previous value to beat).
function prsOn(date){return prList().filter(r=>r.date===date&&r.prev!=null)}
function prCard(date){
  const hits=prsOn(date); if(!hits.length) return '';
  return `<div class="card pr"><div class="lift-h"><h3>New personal best${hits.length>1?'s':''}</h3><span class="chip light">PR</span></div>
  ${hits.map(r=>`<div class="pr-row"><span>${r.label}</span><span class="pr-v">${r.fmt(r.value)}<small> ${esc(r.unit)}</small></span><span class="small muted">was ${r.fmt(r.prev)}</span></div>`).join('')}</div>`;
}
// Where you are on the pull-up road, from the best set you have logged. Max-rep sets are
// logged on test days (`pullups`); weighted work shows up as the `wpu` max.
function pullupState(date){
  let best=null, xs=[];
  for(const [d,L] of Object.entries(logs)){
    if(d>date||!inProgram(d)||!L.pullups) continue;
    xs.push({d,v:+L.pullups});
    if(!best||+L.pullups>best.v||(+L.pullups===best.v&&d>best.d)) best={d,v:+L.pullups};
  }
  xs.sort((a0,b0)=>a0.d<b0.d?-1:1);
  const wpu=(plan.maxes||{}).wpu, bw=bwFor(date);
  const reps=best?best.v:0, i=pullupStage(reps), st=PULLUP[i], nextSt=PULLUP[i+1]||null;
  const togo=nextSt?Math.max(0,nextSt.at-reps):0;
  return {best,xs,stage:i,st,next:nextSt,togo,reps,wpu:wpu!=null&&wpu!==''?+wpu:null,bw,
    pct:bw&&wpu?Math.round(+wpu/bw*100):null};
}
function pullupCard(date){
  const p=pullupState(date);
  if(!p.best&&!p.wpu) return `<div class="card"><h3>Pull-ups</h3><p class="small muted" style="margin:0">Log one all-out set on a test day \u2014 full hang to chin over bar \u2014 and this maps out the road from there to a weighted pull-up.</p></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Pull-ups</h3><span class="chip ${p.stage>=3?'light':''}">${esc(p.st.name)}</span></div>`;
  h+=`<div class="miles"><div class="mile"><span class="l">Best set</span>${p.best?`<span class="big">${p.best.v}</span><span class="small muted">${fmtD(p.best.d,true)}</span>`:'<span class="small muted">Not tested yet</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Next rung</span>${p.next?`<span class="big">${p.next.at}</span><span class="small muted">${p.togo?`${p.togo} more rep${p.togo===1?'':'s'} \u00b7 ${esc(p.next.name.toLowerCase())}`:'reached \u2014 move up'}</span>`:'<span class="small muted">Top of the ladder</span>'}</div>`;
  if(p.wpu!=null) h+=`<div class="mile"><span class="l">Added weight</span><span class="big">+${n(p.wpu)}</span><span class="small muted">${u()}${p.pct?` \u00b7 ${p.pct}% of bodyweight`:''}</span></div>`;
  h+=`</div>`;
  h+=`<div class="small"><b>Now:</b> ${esc(p.st.work)}</div><div class="small muted">${esc(p.st.why)}</div>`;
  if(p.next) h+=`<div class="small muted"><b>Next:</b> ${esc(p.next.next===undefined?'':p.st.next)}</div>`;
  if(p.xs.length>=2) h+=lineChart(p.xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${x.v} reps`})),{label:'Max pull-ups',min:0,minStep:1,tick:fmtWhole});
  h+=`<details class="plain"><summary>The whole road</summary><div class="stack small" style="margin-top:8px">${PULLUP.map((s0,i)=>`<div class="${i===p.stage?'':'muted'}"><b>${i===p.stage?'\u2192 ':''}${esc(s0.name)}</b>${s0.at?` <span class="mono">${s0.at}+ reps</span>`:' <span class="mono">0 reps</span>'}<div>${esc(s0.work)}</div></div>`).join('')}</div></details>`;
  return h+`</div>`;
}
function prBoard(){
  const rs=prList();
  if(!rs.length) return `<div class="card"><h3>Personal records</h3><div class="empty">Nothing tested yet. Bests from test days, jumps, pull-ups and conditioning land here.</div></div>`;
  return `<div class="card"><div class="lift-h"><h3>Personal records</h3><span class="small muted">All programs</span></div>
  <div class="tbl-wrap"><table><thead><tr><th>Record</th><th class="n">Best</th><th class="n">Set</th><th class="n">Gain</th></tr></thead><tbody>
  ${rs.map(r=>`<tr><td>${r.label}</td><td class="n"><b>${r.fmt(r.value)}</b> <span class="muted">${esc(r.unit)}</span></td><td class="n small">${fmtD(r.date,true)}</td><td class="n small">${r.prev!=null?`<span class="chip light">+${n(Math.round((r.value-r.prev)*10)/10)}</span>`:'<span class="muted">first</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}

/* ---------- week summary ---------- */
// At the start of a new week: how last week went, then what this one holds. Shown until
// dismissed (plan.weekSeen keeps the last Monday that was cleared).
function weekRecap(mon){
  let done=0, tot=0; const prs=[], rd=[];
  for(let i=0;i<7;i++){
    const d=addDays(mon,i), p=dayPlan(d);
    if(!['off','pre','convert'].includes(p.t)){tot++; if(lg(d).done) done++}
    const r=readiness(ci(d)); if(r!=null) rd.push(r);
    prs.push(...prsOn(d));
  }
  const end=addDays(mon,6);
  const hics=hicSessions(true).filter(x=>x.d>=mon&&x.d<=end&&x.v!=null);
  const avg=rd.length?Math.round(rd.reduce((a,b)=>a+b,0)/rd.length):null;
  return {done,tot,prs,avg,hics,mon,end};
}
// The weekly check-in: measurements, once a week, at the start of the training week.
// They are a weekly number, so asking for them in the daily check-in made them easy to
// skip and easy to over-log. This stays up all week until it has been filled in.
function weeklyCard(){
  if(viewing||sel!==todayStr()) return '';
  const t=todayStr(), mon=mondayOf(t);
  if(!weekOf(mon)) return '';
  const unit=u()==='kg'?'cm':'in';
  // anything logged this week counts as done, whichever day it went in on
  let today=(lg(t).meas)||{}, thisWeek=null;
  for(let i=0;i<7;i++){const d=addDays(mon,i),L=lg(d);if(L.meas&&L.meas.waist&&L.meas.neck){thisWeek={d,m:L.meas};break}}
  const prev=measBefore(mon), bfNow=thisWeek?navyBf(thisWeek.m,thisWeek.d):null, bfPrev=prev?navyBf(prev.m,prev.d):null;
  const f=(k,l)=>`<label class="f">${l} <small>(${unit})</small>${numIn('meas.'+k,today[k],prev&&prev.m[k]!=null?String(prev.m[k]):'')}</label>`;
  const since=prev?Math.round((D(mon)-D(prev.d))/864e5):null;
  const body=()=>`<p class="small muted" style="margin:0">Measurements once a week, same time of day, relaxed: waist at the navel, neck below the larynx, hips at the widest point.</p>
  <div class="grid3">${f('neck','Neck')}${f('waist','Waist')}${f('hip','Hips')}</div>`
    +(navyBf(today,t)!=null?`<div class="small">That puts you at <b class="mono">${r1(navyBf(today,t))}%</b> body fat${bfPrev!=null?`, ${navyBf(today,t)<bfPrev?'down':navyBf(today,t)>bfPrev?'up':'level'} ${navyBf(today,t)===bfPrev?'':r1(Math.abs(navyBf(today,t)-bfPrev))+' points '}since ${fmtD(prev.d)}`:''}.</div>`
      :!plan.height||!plan.sex?`<div class="small muted">Add your height and sex in Setup \u2192 About you and these turn into a body-fat estimate. They are worth tracking either way.</div>`
      :today.waist||today.neck?`<div class="small muted">Neck and waist both needed for the estimate${plan.sex==='f'?', plus hips':''}.</div>`:'');

  // Done for the week: a header you can fold away. It opens by default on the day you
  // filled it in (openPx is seeded below while the form is still showing) and stays shut
  // once you close it, including on later days.
  if(thisWeek){
    const dw=bfNow!=null&&bfPrev!=null?bfNow-bfPrev:null, sameDay=thisWeek.d===t;
    return `<details class="plain card" data-px="wkmeas"${openPx.has('wkmeas')?' open':''}><summary><b>Weekly check-in</b> \u00b7 done ${fmtD(thisWeek.d,true)}${bfNow!=null?` \u00b7 ${r1(bfNow)}% body fat`:''}</summary>
    <div class="stack" style="gap:10px;margin-top:10px"><div class="small muted">Waist ${r1(thisWeek.m.waist)} ${unit}, neck ${r1(thisWeek.m.neck)}${thisWeek.m.hip?`, hips ${r1(thisWeek.m.hip)}`:''}.${dw!=null?` ${dw<0?'Down':dw>0?'Up':'Level'} ${dw?r1(Math.abs(dw))+' points':''} since ${fmtD(prev.d)}.`:''} Charts are on Status.</div>
    ${sameDay?body():`<div class="small muted">Logged ${fmtD(thisWeek.d,true)}. Measuring again today records a second set \u2014 the charts take them all.</div>${body()}`}</div></details>`;
  }
  openPx.add('wkmeas');          // so it is open at the moment it gets filled in
  return `<div class="card"><div class="lift-h"><h3>Weekly check-in</h3><span class="small muted">${prev?`last ${fmtD(prev.d,true)}${since?` \u00b7 ${since} days ago`:''}`:'first one'}</span></div>${body()}</div>`;
}
function weekSummaryCard(){
  if(viewing||sel!==todayStr()) return '';
  const mon=mondayOf(todayStr()), last=addDays(mon,-7);
  if((plan.weekSeen||'')===mon) return '';
  if(idxOf(last)<0) return '';                       // no previous week in this program
  const r=weekRecap(last);
  if(!r.tot&&!r.prs.length) return '';
  const wk=weekOf(mon), wt=wk?weekTitle(wk):null, lv=r.avg!=null?rLevel(r.avg):null;
  const ahead=[];
  if(wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy') ahead.push('A heavy week: singles or doubles near the top. Accessories are off.');
  if(wk&&wk.kind==='deload') ahead.push('A deload: easy lifting, steady conditioning, half the plyo contacts.');
  if(wk&&wk.kind==='test') ahead.push('Retest week: three easy days, then heavy singles.');
  if(wk&&wk.kind==='cycle') ahead.push('Plyos: '+plyoPhase(wk).name+'.');
  const nd=nextScheduled('deload'), nt=nextScheduled('test');
  let h=`<div class="card"><div class="lift-h"><h3>Your week</h3><button class="btn sm ghost" data-act="weekseen">Dismiss</button></div>
  <div class="small muted">Last week · ${fmtD(r.mon)}–${fmtD(r.end)}</div>
  <div class="miles"><div class="mile"><span class="l">Sessions</span><span class="big">${r.done}<small style="font-size:14px;color:var(--muted)">/${r.tot}</small></span><span class="small muted">${r.tot&&r.done===r.tot?'every one':r.tot?Math.round(100*r.done/r.tot)+'% done':'—'}</span></div>
  <div class="mile"><span class="l">Readiness</span>${r.avg!=null?`<span class="big">${r.avg}</span><span class="small"><span class="chip ${lv.cls}">${lv.t}</span></span>`:'<span class="small muted">No check-ins</span>'}</div>
  <div class="mile"><span class="l">Bests set</span><span class="big">${r.prs.length}</span><span class="small muted">${r.prs.length?r.prs.map(x=>x.label).join(', '):'none last week'}</span></div></div>`;
  if(r.hics.length) h+=`<div class="small muted">Conditioning: ${r.hics.map(x=>`${MOD[x.mod].name} ${HIC[x.f].name} ${n(x.v)} ${esc(x.u)}`).join(' · ')}</div>`;
  h+=`<div style="border-top:1px solid var(--line);padding-top:10px"><b>This week</b>${wt?` · ${esc(wt.t)} <span class="chip ${wt.cls}">${esc(wt.chip)}</span>`:''}</div>`;
  if(ahead.length) h+=`<ul class="tight small">${ahead.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  h+=`<div class="small muted">${esc(nd)} ${esc(nt)}</div></div>`;
  return h;
}

/* ---------- status dashboard ---------- */
function lineChart(pts,o){
  o=o||{};
  const W=300,H=118,L=36,R=40,T=10,B=22, iw=W-L-R, ih=H-T-B;
  const ys=pts.map(p=>p.y).concat(pts.filter(p=>p.y2!=null).map(p=>p.y2));
  let lo=o.min!=null?o.min:Math.min(...ys), hi=o.max!=null?o.max:Math.max(...ys);
  if(hi===lo){hi+=Math.max(1,Math.abs(hi)*.05);lo-=Math.max(1,Math.abs(lo)*.05)}
  if(o.min==null||o.max==null){const pad=(hi-lo)*.15;if(o.min==null)lo-=pad;if(o.max==null)hi+=pad}
  const step=Math.max(nice((hi-lo)/3),o.minStep||0); lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step;
  const x=i=>L+(pts.length===1?iw/2:i*iw/(pts.length-1)), y=v=>T+ih-(v-lo)/(hi-lo)*ih;
  let g='';
  const tk=o.tick||fmtTick;
  for(let v=lo;v<=hi+1e-9;v+=step){const yy=y(v).toFixed(1);g+=`<line class="ch-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="ch-ax" x="${L-6}" y="${(+yy+3.5).toFixed(1)}" text-anchor="end">${tk(v)}</text>`}
  const solid=pts.filter(p=>!p.hollow);
  const lastSolid=pts.length-1-[...pts].reverse().findIndex(p=>!p.hollow);
  const seg=(a,b)=>pts.slice(a,b+1).map((p,j)=>(j?'L':'M')+x(a+j).toFixed(1)+' '+y(p.y).toFixed(1)).join(' ');
  const path=seg(0,lastSolid), proj=lastSolid<pts.length-1?`<path class="ch-line" stroke-dasharray="4 4" d="${seg(lastSolid,pts.length-1)}"/>`:'';
  const area=solid.length>1?`<path class="ch-area" d="M${x(0).toFixed(1)} ${(T+ih)} ${pts.slice(0,lastSolid+1).map((p,i)=>'L'+x(i).toFixed(1)+' '+y(p.y).toFixed(1)).join(' ')} L${x(lastSolid).toFixed(1)} ${T+ih} Z"/>`:'';
  const xl=`<text class="ch-ax" x="${x(0)}" y="${H-5}" text-anchor="${pts.length===1?'middle':'start'}">${esc(pts[0].xl)}</text>`+(pts.length>1?`<text class="ch-ax" x="${x(pts.length-1)}" y="${H-5}" text-anchor="end">${esc(pts[pts.length-1].xl)}</text>`:'');
  const dense=pts.length>16;
  const dots=pts.map((p,i)=>dense&&i!==pts.length-1?'':`<circle class="ch-pt${p.hollow?' hollow':''}" cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="4"/>`).join('');
  const hits=pts.map((p,i)=>`<circle class="ch-hit" tabindex="0" cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="12" data-tip="${esc(p.tip)}"><title>${esc(p.tip)}</title></circle>`).join('');
  // the raw series, when there is one: faint dots behind the line they average into
  const has2=pts.some(p=>p.y2!=null);
  const raw2=has2?`<path class="ch-line2" d="${pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.y2!=null?p.y2:p.y).toFixed(1)).join(' ')}"/>`+pts.map((p,i)=>p.y2==null?'':`<circle class="ch-pt2" cx="${x(i).toFixed(1)}" cy="${y(p.y2).toFixed(1)}" r="${dense2(pts)}"/>`).join(''):'';
  const e=pts[pts.length-1], end=`<text class="ch-end" x="${(x(pts.length-1)+8).toFixed(1)}" y="${(y(e.y)+4).toFixed(1)}">${esc(o.endLabel?o.endLabel(e):tk(e.y))}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">${g}${area}${raw2}<path class="ch-line" d="${path}"/>${proj}${dots}${xl}${end}${hits}</svg>`;
}
function dense2(pts){return pts.length>40?1.4:pts.length>20?1.8:2.4}
function r1(v){return String(Math.round(v*10)/10)}
function nice(r){const e=Math.pow(10,Math.floor(Math.log10(r||1))),f=r/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function fmtTick(v){return Math.abs(v)>=1000?(Math.round(v/100)/10)+'k':String(Math.round(v*10)/10)}
function fmtWhole(v){return String(Math.round(v))}
function sessState(d,t){const p=dayPlan(d);if(['off','pre','convert'].includes(p.t))return 'rest';if(lg(d).done)return 'done';if(d<t)return 'missed';if(d===t)return 'today';return 'upcoming'}
// Minutes per conditioning session. Only LISS asks you for minutes, so for everything
// else this is the session the timer would run: warm-up, rounds, rest and cool-down.
function hicMinutes(x){
  if(x.min!=null&&x.min!=='') return {m:+x.min,logged:true};
  const o=ivOpts(x.d,x.f); return {m:Math.round(ivTotal(ivSegments(x.f,o))/60),logged:false};
}
// Conditioning minutes per week, oldest first, for the last n weeks up to this one.
function condWeeks(n0){
  const t=todayStr(), mon=mondayOf(t), start=mondayOf(plan.startMonday), by={};
  for(const x of hicSessions()){
    const m=mondayOf(x.d); if(!by[m]) by[m]={min:0,n:0,est:0};
    const r=hicMinutes(x); by[m].min+=r.m; by[m].n++; if(!r.logged) by[m].est++;
  }
  const out=[];
  for(let i=n0-1;i>=0;i--){ const m=addDays(mon,-7*i); if(m<start) continue; out.push(Object.assign({mon:m,min:0,n:0,est:0},by[m])) }
  return out;
}
// What a logged work set implies about the max. In Operator the weight is computed FROM
// the max, so a set done exactly as prescribed only restates it: this says something new
// when you logged a different weight, or when a heavy set ground.
function heavySet(k){
  let best=null;
  for(const [d,L] of progLogs()){
    const x=(L.lifts||{})[k]; if(!x||!Array.isArray(x.sets)||!x.sets.some(Boolean)) continue;
    const wk=weekOf(d); if(!wk||wk.kind!=='cycle') continue;
    const v=rx(wk,k); if(!v.m||v.p<85) continue;
    const used=x.used!=null&&x.used!==''?+x.used:loadFor(k,v.m.v,v.p,d);
    const e=estMax(k,used,v.r,d); if(e==null) continue;
    if(!best||e>best.e) best={e,w:used,r:v.r,p:v.p,d,max:v.m.v,grinder:!!x.grinder,off:x.used!=null&&x.used!==''};
  }
  return best;
}
// Twelve weeks of sessions as a grid: one row per week, one cell per day. The same
// states the week dots use, so a missed day looks the same in both places.
function heatmap(t,n0){
  const mon=mondayOf(t), start=mondayOf(plan.startMonday), rows=[];
  for(let i=n0-1;i>=0;i--){ const m=addDays(mon,-7*i); if(m>=start) rows.push(m) }
  if(!rows.length) return '';
  let h=`<div class="heat-h"><span class="small muted">Last ${rows.length} week${rows.length>1?'s':''}</span><span class="heat-key">${[['done','done'],['missed','missed'],['rest','rest day']].map(([c,l])=>`<span><i class="${c}"></i>${l}</span>`).join('')}</span></div><div class="heat" role="img" aria-label="Sessions over the last ${rows.length} weeks">`;
  h+=`<span></span>${DAYN.map(d=>`<span class="heat-d">${d[0]}</span>`).join('')}`;
  for(const m of rows){
    const wk=weekOf(m), lbl=wk?(wk.kind==='cycle'?'C'+wk.cycle+'W'+wk.w:wk.kind==='bridge'?'Br':wk.kind==='deload'?'DL':wk.kind==='test'?'RT':wk.kind==='travel'?'Tr':'Off'):'';
    h+=`<span class="heat-w">${esc(lbl)}</span>`;
    for(let i=0;i<7;i++){
      const d=addDays(m,i), st=d<start?'pre':sessState(d,t), p=dayPlan(d);
      h+=`<i class="${st}" title="${esc(fmtD(d,true)+' · '+(p.short||'')+' · '+(st==='pre'?'before the start':st))}"></i>`;
    }
  }
  return h+`</div>`;
}
// Bodyweight: every weigh-in, and the 7-day average they feed. The average is the line
// you act on — a single reading moves with water, food and the time of day — so it is the
// solid one and the weigh-ins sit behind it.
const BWR={30:'30 days',90:'90 days',all:'All'};
function bwRange(){const v=LS.get('ob.bwRange');return BWR[v]?v:90}
function bwSeries(t){
  const r=bwRange(), from=r==='all'?plan.startMonday:addDays(t,-(+r-1));
  const xs=progLogs().filter(([d,L])=>d>=from&&d<=t&&L.checkin&&L.checkin.bw!=null&&L.checkin.bw!=='')
    .map(([d,L])=>({d,raw:+L.checkin.bw})).sort((a,b)=>a.d<b.d?-1:1);
  return xs.map(x=>{const a=bwAvg(x.d,7);return {d:x.d,v:a?a.avg:x.raw,raw:x.raw,n:a?a.n:1}});
}
function bwCard(t){
  const xs=bwSeries(t), r=bwRange(), rate=bwRate(t,14);
  const seg=`<div class="restsel"><span>Range</span><div class="seg">${Object.entries(BWR).map(([k,l])=>`<button class="segb${k===r?' on':''}" data-act="bwrange" data-v="${k}" aria-pressed="${k===r}">${l}</button>`).join('')}</div></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Bodyweight</h3><span class="small muted">Every weigh-in, and the 7-day average</span></div>${seg}`;
  if(xs.length<2) return h+`<div class="none">${xs.length?'One weigh-in in this range. The average needs a few days.':'Log your weight in the daily check-in and it charts here.'}</div></div>`;
  const first=xs[0], last=xs[xs.length-1];
  const k0=Math.min(7,Math.floor(xs.length/2)), mean=a0=>a0.reduce((x,y)=>x+y.raw,0)/a0.length;
  const ch=k0>=2?mean(xs.slice(-k0))-mean(xs.slice(0,k0)):last.raw-first.raw;
  const days=Math.round((D(last.d)-D(first.d))/864e5)+1, logged=xs.length;
  h+=`<div class="miles"><div class="mile"><span class="l">7-day average</span><span class="big">${r1(last.v)}<small style="font-size:14px;color:var(--muted);margin-left:4px">${u()}</small></span><span class="small muted">latest weigh-in ${r1(last.raw)}</span></div>
  <div class="mile"><span class="l">Over this range</span><span class="big">${ch>0?'+':''}${r1(ch)}</span><span class="small muted">${fmtD(first.d)} to ${fmtD(last.d)}${k0>=2?` · first ${k0} vs last ${k0}`:''}</span></div>
  <div class="mile"><span class="l">Per week</span>${rate?`<span class="big">${rate.perWeek>0?'+':''}${r1(rate.perWeek)}</span><span class="small muted">last ${rate.back} days</span>`:'<span class="small muted">Needs two weeks of weigh-ins</span>'}</div></div>`;
  h+=lineChart(xs.map(x=>({y:x.v,y2:x.raw,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: weighed ${r1(x.raw)}, ${r1(x.v)} average${x.n>1?' of '+x.n:''}`})),{label:'Bodyweight, daily and 7-day average',minStep:1});
  h+=`<div class="small muted">Weighed on ${logged} of the last ${days} day${days===1?'':'s'}. The faint line is each weigh-in; the solid one is the 7-day average, which is what the protein target, the weighted pull-up loads and the trend advice use.</div>`;
  return h+`</div>`;
}
// What you burn and what you are made of. The measured number comes from your own
// intake and scale trend; the formula is only there until that exists.
function energyCard(t){
  const est=tdeeOn(t), pred=est&&est.predicted, meas=est&&est.measured, ts=tdeeSeries(t,12);
  const bf=bfSeries(t), last=bf[bf.length-1];
  const kc=[]; for(let i=27;i>=0;i--){const v=kcalOn(addDays(t,-i));if(v)kc.push(v)}
  if(!meas&&!pred&&!bf.length) return `<div class="card"><h3>Energy and composition</h3><p class="small muted" style="margin:0">Log calories in the daily check-in, add your height, sex and birth year in Setup, and take neck and waist measurements weekly. Then this card estimates what you burn and what you are made of.</p></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Energy and composition</h3><span class="small muted">Estimates, not measurements</span></div>`;
  h+=`<div class="miles">`;
  h+=`<div class="mile"><span class="l">Burn per day</span>${est?`<span class="big">${n(est.tdee)}</span><span class="small muted">${meas?`${Math.round(est.w*100)}% your own data${pred?`, rest the formula (${n(pred)})`:''}`:`the formula only · Mifflin-St Jeor × ${actFactor()}`}</span>`:'<span class="small muted">Needs height, sex and birth year</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Eaten per day</span>${kc.length?`<span class="big">${n(Math.round(kc.reduce((a,b)=>a+b,0)/kc.length))}</span><span class="small muted">${kc.length} of the last 28 days logged</span>`:'<span class="small muted">Log calories in the check-in</span>'}</div>`;
  h+=`<div class="mile"><span class="l">Body fat</span>${last?`<span class="big">${r1(last.bf)}<small style="font-size:14px;color:var(--muted);margin-left:2px">%</small></span><span class="small muted">${fmtD(last.d,true)}${bf.length>1?` · ${last.bf>bf[0].bf?'+':''}${r1(last.bf-bf[0].bf)} since ${fmtD(bf[0].d)}`:''}</span>`:'<span class="small muted">Needs neck and waist</span>'}</div></div>`;
  if(meas){
    const rt=meas.dw/meas.gap*7, own=meas.tdee-meas.mean;
    h+=`<div class="small">Over the last ${meas.days} days you ate <b class="mono">${n(meas.mean)}</b> a day and your weight trend ${Math.abs(rt)<.05?'held flat':`moved ${rt>0?'+':'−'}${r1(Math.abs(rt))} ${u()} a week`}. On its own that puts your burn at <b class="mono">${n(meas.tdee)}</b>, a ${own>0?'deficit':'surplus'} of <b class="mono">${n(Math.abs(own))}</b> a day.${est.w<.95&&pred?` The number above still leans ${Math.round((1-est.w)*100)}% on the formula while your history builds — ${Math.ceil((42-tdeeHistory(t))/7)} more week${Math.ceil((42-tdeeHistory(t))/7)===1?'':'s'} of logging both and it is all yours.`:''}</div>`;
    const goal=plan.goal, tgt=goal==='lose'?est.tdee-Math.round(est.tdee*.18/10)*10:goal==='gain'?est.tdee+250:est.tdee;
    if(goal&&goal!=='maintain') h+=`<div class="small muted">Your goal is set to ${goal==='lose'?'lose fat':'build'}. About <b class="mono">${n(tgt)}</b> a day would ${goal==='lose'?'take off roughly 1% of bodyweight a month without wrecking the lifting':'add weight slowly enough to stay mostly lean'}. Protein target is on the Today card.</div>`;
  } else if(pred){
    h+=`<div class="small muted">That is the formula's guess from your height, weight, age and activity. Log calories for ${28} days alongside your weigh-ins and this switches to your own numbers, which are the only ones that count.</div>`;
  }
  if(ts.length>=2){
    const a0=ts[0], b0=ts[ts.length-1], dr=b0.v-a0.v;
    h+=`<div class="sm" style="margin-top:12px"><div class="sm-h"><b>Burn over time</b><span class="v">${n(b0.v)}<small>${dr>0?'+':''}${n(dr)} since ${fmtD(a0.d)}</small></span></div>`;
    h+=lineChart(ts.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: about ${n(x.v)} a day, ${Math.round(x.w*100)}% from your own data`})),{label:'Estimated daily burn',minStep:25,tick:fmtWhole});
    h+=`<div class="small muted">Each point is the 28 days ending that week, so it follows you rather than holding a number set on day one.${Math.abs(dr)>=100?(dr<0?` It has come down about ${n(-dr)} since ${fmtD(a0.d)} — normal in a long deficit, and a reason to take a maintenance break rather than cut harder.`:` It has risen about ${n(dr)} since ${fmtD(a0.d)}.`):''}</div></div>`;
  }
  if(bf.length>=2){
    const w=bf.map(x=>({d:x.d,v:+x.m.waist}));
    h+=`<div class="sm-grid" style="margin-top:12px">`;
    h+=`<div class="sm"><div class="sm-h"><b>Body fat</b><span class="v">${r1(last.bf)}<small>%</small></span></div>${lineChart(bf.map(x=>({y:x.bf,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.bf)}%`})),{label:'Body fat estimate',minStep:.5})}</div>`;
    h+=`<div class="sm"><div class="sm-h"><b>Waist</b><span class="v">${r1(w[w.length-1].v)}<small>${u()==='kg'?'cm':'in'}</small></span></div>${lineChart(w.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} ${u()==='kg'?'cm':'in'}`})),{label:'Waist',minStep:.5})}</div>`;
    h+=`</div>`;
  }
  h+=`<div class="small muted">The body-fat estimate is the US Navy tape method: typically within 3–4 points, and more useful as a direction than a number. Measure at the same time of day, relaxed.</div>`;
  return h+`</div>`;
}
function vStatus(){
  const t=todayStr(), wk=weekOf(t);
  if(!wk) return `<div class="card"><h2>Status</h2><p class="muted" style="margin:0">The program starts the week of ${fmtLong(plan.startMonday)}.</p></div>`;
  const list=weeks(), ci0=wk.idx;
  let h='';
  // --- where you are
  const wt=weekTitle(wk);
  h+=`<div class="card"><div class="lift-h"><h2>${wt.t}</h2><span class="chip ${wt.cls}">${wt.chip}</span></div>`;
  if(wk.kind==='cycle'){
    const first=ci0-(wk.w-1);
    h+=`<div class="cyc" aria-label="Cycle ${wk.cycle} progress">${plan.wave.map((v,i)=>{const cls=tier(+v.p);return `<div class="chip ${cls}${i<wk.w-1?' past':''}${i===wk.w-1?' now':''}" style="border-radius:6px">W${i+1}<small>${v.s}×${v.r} ${v.p}%</small></div>`}).join('')}</div>`;
    h+=`<div class="small muted">Day ${dow(t)+1} of week ${wk.w}. Cycle ${wk.cycle} ends ${fmtD(addDays(list[first+5].monday,4),true)}.</div>`;
  }
  const nextOf=kind=>{for(let i=ci0+1;i<list.length;i++){if(kind==='cycle'?(list[i].kind==='cycle'&&list[i].w===1):list[i].kind===kind)return list[i]}return null};
  const days=w=>w?Math.round((D(w.monday)-D(t))/864e5):null;
  const nd=nextOf('deload'), nt=nextOf('test'), nc=nextOf('cycle');
  const mile=(l,w,sub)=>`<div class="mile"><span class="l">${l}</span>${w?`<span class="big">${days(w)}<small style="font-size:14px;color:var(--muted);margin-left:4px">days</small></span><span class="small muted">${sub(w)}</span>`:'<span class="small muted">Not scheduled</span>'}</div>`;
  h+=`<div class="miles">${mile('Next cycle',nc,w=>'Cycle '+w.cycle+' · '+fmtD(w.monday,true))}${mile('Next deload',nd,w=>fmtD(w.monday,true))}${mile('Next retest',nt,w=>fmtD(w.monday,true))}</div>`;
  const trained=list.slice(0,ci0).filter(w=>w.kind==='cycle').length;
  h+=`<div class="small muted">${trained} training week${trained===1?'':'s'} completed since ${fmtD(plan.startMonday)}.</div></div>`;
  // --- this week + adherence
  const mon=mondayOf(t);
  let wd='';for(let i=0;i<7;i++){const d=addDays(mon,i),st=sessState(d,t),p=dayPlan(d);wd+=`<div><i class="${st}" aria-label="${DAYN[i]}: ${st}">${st==='done'?'✓':st==='missed'?'✕':st==='rest'?'–':'•'}</i>${DAYN[i]}<span style="font-size:10px">${esc(p.short||'')}</span></div>`}
  const adh=(from,to)=>{let d0=0,n0=0;for(let d=from;d<=to;d=addDays(d,1)){if(d<plan.startMonday)continue;const st=sessState(d,t);if(st==='rest'||st==='upcoming'||st==='today')continue;n0++;if(st==='done')d0++}return {d:d0,n:n0}};
  const yest=addDays(t,-1), wkA=adh(mon,yest), a4=adh(addDays(mon,-28),yest), all=adh(plan.startMonday,yest);
  let tw=0,td=0;for(let i=0;i<7;i++){const d=addDays(mon,i),st=sessState(d,t);if(st!=='rest'){tw++;if(st==='done')td++}}
  const pct=a=>a.n?Math.round(a.d/a.n*100)+'%':'—';
  h+=`<div class="card"><div class="lift-h"><h3>This week</h3><span class="small muted mono">${td}/${tw} sessions</span></div><div class="wkdots">${wd}</div>
  <div class="miles"><div class="mile"><span class="l">Last 4 weeks</span><span class="big">${pct(a4)}</span><span class="small muted">${a4.d} of ${a4.n} sessions done</span></div><div class="mile"><span class="l">All time</span><span class="big">${pct(all)}</span><span class="small muted">${all.d} of ${all.n} sessions done</span></div><div class="mile"><span class="l">Readiness · 7 days</span>${(()=>{const xs=[];for(let i=0;i<7;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)xs.push(r)}if(!xs.length)return '<span class="small muted">No check-ins yet</span>';const av=Math.round(xs.reduce((a,b)=>a+b,0)/xs.length),lv=rLevel(av);return `<span class="big">${av}</span><span><span class="chip ${lv.cls}">${lv.t}</span> <span class="small muted">${xs.length} check-in${xs.length>1?'s':''}</span></span>`})()}</div></div>${heatmap(t,12)}</div>`;
  // --- strength
  const curC=wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle);
  h+=`<div class="card"><div class="lift-h"><h3>Strength</h3><span class="small muted">Max by cycle · hollow = next cycle, projected</span></div><div class="sm-grid">`;
  for(const k of activeLifts()){
    const pts=[];for(let c=1;c<=curC+(viewing?0:1);c++){const m=maxFor(c)[k];if(m)pts.push({y:m.v,xl:'C'+c,hollow:c>curC,tip:`Cycle ${c}: ${n(m.v)} ${u()}${m.src==='set'?' (tested/set)':m.src==='proj'?' (projected)':''}`})}
    const cur=maxFor(curC)[k], base=maxFor(1)[k];
    h+=`<div class="sm"><div class="sm-h"><b>${esc(liftName(k))}</b>${cur?`<span class="v">${n(cur.v)}<small>${u()}${base&&cur.v!==base.v?` · ${cur.v>base.v?'+':''}${n(cur.v-base.v)} since C1`:''}</small></span>`:''}</div>${pts.length?lineChart(pts,{label:liftName(k)+' max by cycle',minStep:+plan.round[k]||5}):'<div class="none">No max entered yet.</div>'}${(()=>{
      const hv=heavySet(k); if(!hv) return '';
      let say='';
      if(hv.off){ const d=Math.round(hv.e-hv.max);
        say=` You logged your own weight, which implies <b class="mono">${n(Math.round(hv.e))}</b> \u2014 ${d===0?'the max it replaced':(d>0?n(d)+' '+u()+' above':n(-d)+' '+u()+' below')+' the max for that cycle'}.`; }
      else if(hv.grinder) say=' It ground, which is what the end-of-cycle review reads.';
      return `<div class="small muted">Heaviest set completed: <b class="mono">${fmtLoad(k,hv.w)} \u00d7 ${hv.r}</b> at ${hv.p}% on ${fmtD(hv.d,true)}.${say}</div>`;
    })()}</div>`;
  }
  h+=`</div></div>`;
  // --- conditioning
  {
    const all=hicSessions(), hs=all.filter(x=>x.f!=='liss'&&x.v!=null), groups={};
    for(const x of hs)(groups[x.mod+'|'+x.f]=groups[x.mod+'|'+x.f]||[]).push(x);
    const keys=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).slice(0,6);
    const since=addDays(t,-27), mix={}; for(const x of all) if(x.d>=since) mix[x.mod]=(mix[x.mod]||0)+1;
    h+=`<div class="card"><div class="lift-h"><h3>Conditioning</h3><span class="small muted">Volume per week, then results per activity</span></div>`;
    h+=Object.keys(mix).length?`<div class="row" style="gap:6px"><span class="small muted">Last 4 weeks:</span>${Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([m,c])=>`<span class="chip">${MOD[m].name} · ${c}</span>`).join('')}</div>`:'';
    {
      // climbing: what the hills actually added up to
      const wkStart=mondayOf(t);
      const gain=(from)=>all.reduce((a,x)=>a+(x.d>=from&&x.elev?+x.elev:0),0);
      const thisWeek=gain(wkStart), fourWeeks=gain(since), prevFour=all.reduce((a,x)=>a+(x.d>=addDays(since,-28)&&x.d<since&&x.elev?+x.elev:0),0);
      if(fourWeeks||thisWeek) h+=`<div class="miles"><div class="mile"><span class="l">Climbing this week</span><span class="big">${n(thisWeek)}<small style="font-size:14px;color:var(--muted);margin-left:4px">${elevUnit()}</small></span><span class="small muted">${n(Math.round(thisWeek/elevPerDist()*10)/10)} ${u()==='kg'?'km':'mi'} of flat walking</span></div><div class="mile"><span class="l">Last 4 weeks</span><span class="big">${n(fourWeeks)}<small style="font-size:14px;color:var(--muted);margin-left:4px">${elevUnit()}</small></span><span class="small muted">${prevFour?(fourWeeks>=prevFour?'up from ':'down from ')+n(prevFour)+' the 4 before':'first four weeks logged'}</span></div></div>`;
    }
    {
      const cw=condWeeks(12), tot=cw.reduce((a,x)=>a+x.min,0), thisWk=mondayOf(t);
      // this week is still running, so it is drawn hollow and left out of the average
      const full=cw.filter(x=>x.mon!==thisWk), last4=full.slice(-4);
      const av=last4.length?Math.round(last4.reduce((a,x)=>a+x.min,0)/last4.length):0;
      const anyEst=cw.some(x=>x.est>0);
      const now=cw.find(x=>x.mon===thisWk);
      h+=`<div class="sm"><div class="sm-h"><b>Minutes per week</b>${last4.length?`<span class="v">${av}<small>min / week, last ${last4.length}</small></span>`:now&&now.n?`<span class="v">${now.min}<small>min this week so far</small></span>`:''}</div>`;
      h+=cw.length>=2&&tot?lineChart(cw.map(x=>({y:x.min,xl:fmtD(x.mon),hollow:x.mon===thisWk,tip:`Week of ${fmtD(x.mon,true)}: ${x.min} min across ${x.n} session${x.n===1?'':'s'}${x.mon===thisWk?' so far':''}`})),{min:0,minStep:10,label:'Conditioning minutes per week'}):`<div class="none">${tot?`${now&&now.n===1?'One session':`${now?now.n:0} sessions`} this week. The trend starts once a second week has sessions in it.`:'Log a conditioning session and this fills in.'}</div>`;
      const drew=cw.length>=2&&tot;
      if(tot&&(drew||anyEst)) h+=`<div class="small muted">${drew?'This week is dashed: it is still running.':''}${anyEst?`${drew?' ':''}Sessions where you did not log minutes count the planned length of that format, warm-up and cool-down included \u2014 log the real number on the day\u2019s card and it uses that instead.`:''}</div>`;
      h+=`</div>`;
    }
    {
      const bm=benchmarkState(t);
      if(bm&&bm.xs.length){
        const dir=bm.xs.length>1?bm.last.v-bm.first.v:null;
        h+=`<div class="sm"><div class="sm-h"><b>Benchmark \u00b7 ${MOD[bm.mod].name} ${HIC[bm.fmt].name}</b><span class="v">${n(bm.best)}<small>${esc(bm.last.u)} best</small></span></div>`;
        h+=bm.xs.length>=2?lineChart(bm.xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${n(x.v)} ${x.u}`})),{label:'Benchmark session',minStep:1}):'<div class="none">One so far. Repeat it and this becomes the line worth watching.</div>';
        h+=`<div class="small muted">${bm.auto?'Picked automatically as the hard session you repeat most. ':''}${bm.due?`<b>Due:</b> ${bm.days==null?'never run':bm.days+' days since the last one'}. Run the same activity and format to compare like with like.`:`Last run ${fmtD(bm.last.d,true)}, ${bm.days} days ago. Due again around day ${bm.every}.`}${dir!=null?` ${dir>0?'Up':dir<0?'Down':'Level'} ${dir?n(Math.abs(dir))+' '+bm.last.u:''} since ${fmtD(bm.first.d)}.`:''}</div></div>`;
      }
    }
    if(!keys.length) h+=`<div class="sm"><div class="none">No HIC results logged yet. Results you log on HIC days show up here.</div></div>`;
    else{
      h+=`<div class="sm-grid">`;
      for(const key of keys){const xs=groups[key].slice(-24),[m,f]=key.split('|'),best=xs.reduce((a,x)=>Math.max(a,x.v),0),un=xs[xs.length-1].u;
        h+=`<div class="sm"><div class="sm-h"><b>${MOD[m].name} · ${HIC[f].name}</b><span class="v">${n(best)}<small>${esc(un)} best</small></span></div>${xs.length>=2?lineChart(xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${n(x.v)} ${x.u}`})),{label:MOD[m].name+' '+HIC[f].name,minStep:1}):'<div class="none">One session logged. The trend appears after the second.</div>'}</div>`}
      h+=`</div>`;
    }
    h+=`</div>`;
  }
  // --- body + recovery
  const rd=[];for(let i=27;i>=0;i--){const d=addDays(t,-i),r=readiness(ci(d));if(r!=null)rd.push({d,r})}
  const jm=progLogs().map(([d,L])=>({d,v:+((L.jumps&&L.jumps.broad)||(L.plyo&&(L.plyo.best||L.plyo.mark))||0)})).filter(x=>x.v).sort((a,b)=>a.d<b.d?-1:1).slice(-24);
  {
    const since=addDays(t,-27), flags=progLogs().filter(([d,L])=>d>=since&&d<=t&&(L.pain==='sharp'||L.pain==='niggle'));
    if(flags.length){
      const sharp=flags.filter(([,L])=>L.pain==='sharp').length, where={};
      for(const [,L] of flags) for(const w of painAt(L)) where[w]=(where[w]||0)+1;
      const spots=Object.entries(where).sort((a,b)=>b[1]-a[1]).map(([k,c])=>((PAIN_AT[k]||{}).name||k)+' ×'+c).join(' · ');
      h+=`<div class="banner ${sharp?'alert':'warn'}"><div class="small"><b>${flags.length} session${flags.length===1?'':'s'} with something hurting</b> in the last 4 weeks${sharp?`, ${sharp} of them sharp`:''}.${spots?' '+esc(spots)+'.':''} ${sharp?'Sharp pain holds that lift back at the end of the cycle.':'Noted, not acted on — worth watching if it keeps appearing.'}</div></div>`;
    }
  }
  h+=`<div class="card"><h3>Body and recovery</h3><div class="sm-grid">`;
  h+=`<div class="sm"><div class="sm-h"><b>Readiness · 28 days</b>${rd.length?`<span class="v">${rd[rd.length-1].r}<small>latest</small></span>`:''}</div>${rd.length>=2?lineChart(rd.map(x=>({y:x.r,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: readiness ${x.r}`})),{min:0,max:100,label:'Readiness'}):'<div class="none">Check in on the Today tab to build this trend.</div>'}</div>`;
  h+=`<div class="sm"><div class="sm-h"><b>Broad jump</b>${jm.length?`<span class="v">${r1(Math.max(...jm.map(x=>x.v)))}<small>in best</small></span>`:''}</div>${jm.length>=2?lineChart(jm.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} in`})),{label:'Broad jump',minStep:1}):'<div class="none">Thursday’s first broad jump builds this trend.</div>'}</div>`;
  h+=`</div><div class="row"><button class="btn sm" data-act="view" data-view="history">See full tables in History</button></div></div>`;
  h+=bwCard(t);
  h+=energyCard(t);
  h+=pullupCard(t);
  h+=prBoard();
  return h;
}

/* ---------- CSV export ---------- */
// Built on the phone because that's where the plan logic lives, so rows carry the
// computed week, session and prescription, not just raw entries. Covers every program:
// each date is evaluated against the plan of the program it belongs to.
function csvCell(v){if(v==null)return '';const s=String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function csvText(rows){return '﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n'}
function programFor(d,cur){
  cur=cur||(stash?stash.plan:plan);
  if(d>=cur.startMonday) return {name:progName(cur),plan:cur,end:null};
  const p=Object.values(programs).find(x=>d>=x.startMonday&&d<=x.end);
  return p?{name:p.name,plan:p.plan,end:p.end}:null;
}
// Evaluate fn(date) under the plan of the program each date belongs to, then restore.
function eachDateInPrograms(fn){
  const savedPlan=plan, savedViewing=viewing, savedSel=sel, dates=Object.keys(logs).sort();
  const current=stash?stash.plan:plan; // captured before the loop swaps `plan`
  try{
    for(const d of dates){
      const pr=programFor(d,current);
      plan=pr?deepMerge(clone(DEF),pr.plan):savedPlan; viewing=pr&&pr.end?{end:pr.end}:null; planV++; sel=d;
      fn(d,pr?pr.name:'');
    }
  } finally { plan=savedPlan; viewing=savedViewing; sel=savedSel; planV++; }
}
function sessionsCsv(){
  const U=u(), rows=[['date','program','week','session','done','session_rpe','readiness','sleep_h','sleep_quality','energy','soreness','stress','protein','fuel','water','alcohol','calories','bodyweight_'+U,'neck','waist','hip','bodyfat_pct','hic_format','activity','result','result_unit','minutes','rounds','ruck_load_'+U,'elevation_gain_'+elevUnit(),'warmup_done','mobility_done','plyo_phase','plyo_contacts','broad_first_in','broad_best_in','test_broad_in','test_vertical_in','test_triple_in','pullups','notes']];
  eachDateInPrograms((d,prog)=>{
    const L=logs[d], wk=weekOf(d), dp=dayPlan(d), c=L.checkin||{}, H=L.hic||{}, P=L.plyo||{}, J=L.jumps||{};
    const hasHic=dp.t==='hic'||dp.t==='plyohic'||L.hic, f=hasHic?effFmt(d):null, mod=hasHic?modOf(d):null, met=f&&mod?metricFor(mod,f):null;
    rows.push([d,prog,wk?weekTitle(wk).t:'',dp.short||'',L.done?'yes':'',L.rpe??'',readiness(c)??'',c.sleepH??'',c.sleepQ??'',c.energy??'',c.soreness??'',c.stress??'',c.protein??'',c.fuel??'',c.water??'',c.alcohol??'',c.kcal??'',c.bw??'',(L.meas||{}).neck??'',(L.meas||{}).waist??'',(L.meas||{}).hip??'',(L.meas&&navyBf(L.meas,d))??'',
      f?HIC[f].name:'',mod?(mod==='other'&&H.what?H.what:MOD[mod].name):'',met?(H[met[0]]??''):'',met&&H[met[0]]!=null?met[1]:'',H.min??'',H.rounds??'',H.load??'',H.elev??'',
      (L.warmup||[]).filter(Boolean).length||'',(L.mobility||[]).filter(Boolean).length||'',
      dp.t==='plyohic'&&wk?plyoPhase(wk).name:'',P.contacts??'',P.mark??'',P.best??'',J.broad??'',J.vertical??'',J.triple??'',L.pullups??'',L.notes??'']);
  });
  return csvText(rows);
}
function liftsCsv(){
  const U=u(), rows=[['date','program','week','session','lift','variant','kind','sets_prescribed','reps','pct','prescribed_'+U,'working_'+U,'sets_done','grinder','test_weight_'+U,'test_reps','est_1rm_'+U,'warmups']];
  eachDateInPrograms((d,prog)=>{
    const L=logs[d], wk=weekOf(d), dp=dayPlan(d), week=wk?weekTitle(wk).t:'';
    if(dp.t==='lift'&&wk) for(const k of dp.lifts){
      const x=(L.lifts||{})[k]; if(!x) continue;
      const r=rx(wk,k,d), sets=Array.isArray(x.sets)?x.sets:[], wu=(Array.isArray(x.warmup)?x.warmup:[]).filter(w=>w&&w.w!=null&&w.w!=='');
      const used=x.used!=null&&x.used!==''?+x.used:r.w;
      rows.push([d,prog,week,dp.short,liftName(k,d),VARS[k]?varOf(k,d):'','working',r.sMax>r.s?r.s+'-'+r.sMax:r.s,r.r,r.p,r.w??'',used??'',sets.filter(Boolean).length,x.grinder?'yes':'','','','',wu.map(w=>(isBW(k)?fmtLoad(k,+w.w):n(w.w))+'x'+(w.r??'')).join('; ')]);
    }
    for(const [k,t] of Object.entries(L.test||{})){
      if(!t||t.w==null||t.w==='') continue;
      const reps=t.r||(dp.t==='rm5'?5:1), e=estMax(k,t.w,reps,d);
      rows.push([d,prog,week,dp.short||'',liftName(k,d),VARS[k]?varRef(k):'',dp.t==='rm5'?'5RM test':'test','',reps,'','','','','',t.w,reps,e!=null?Math.round(e*10)/10:'','']);
    }
  });
  return csvText(rows);
}
async function exportCsv(which){
  const text=which==='lifts'?liftsCsv():sessionsCsv(), name=`operator-black-${which}-${realToday()}.csv`;
  const blob=new Blob([text],{type:'text/csv'});
  try{
    const file=new File([blob],name,{type:'text/csv'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:name}); return }
  }catch(e){ if(e&&e.name==='AbortError') return }
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}

/* ---------- programs: archive and start over ---------- */
// Logs are stored by date and programs never overlap, so a program is just a start
// date plus its plan. Archiving copies the current plan (frozen weeks, maxes, reviews
// included) into programs/<id> with an end date; nothing about the logs changes.
const PREF_KEYS=['unit','bar','bodyweight','lift3Name','machineNote','l3','acc','basis','tmPct','round','wave','inc','deloadEvery','testEvery','deload','goal','sleepTarget','proteinPerLb','rest','cardio','ivRounds','cal','accSlots','accPick','accCustom'];
let newProg=null;
// "Next deload: Mon 12/28 (after Cycle 2)" from the live calendar
function nextScheduled(kind){
  const t=realToday(), list=weeks();
  const w=list.find(x=>x.kind===kind&&addDays(x.monday,6)>=t);
  const label=kind==='deload'?'deload':'retest';
  if(!w) return 'No '+label+' weeks scheduled.';
  return 'Next '+label+': '+fmtD(w.monday,true)+(w.after?' (after Cycle '+w.after+')':'')+(w.inserted?' (added from Plan)':'')+'.';
}
function progName(p){p=p||plan;return p.programName||('Block '+(p.programSeq||1))}
function archiveList(){return Object.values(programs).sort((a,b)=>a.startMonday<b.startMonday?1:-1)}
function enterArchive(id){
  const p=programs[id]; if(!p) return;
  if(!stash) stash={plan,sel};
  plan=deepMerge(clone(DEF),p.plan); viewing=p; planV++;
  if(sel>p.end||sel<p.startMonday) sel=p.end;
  openWarm.clear(); openPx.clear(); render(); window.scrollTo(0,0);
}
function exitArchive(){
  if(!stash){render();return}
  plan=stash.plan; sel=realToday(); stash=null; viewing=null; planV++;
  render(); window.scrollTo(0,0);
}
// Days this device kept its own version of while the server had a different one.
function syncCard(){
  const list=conflicts(); if(!list.length) return '';
  const label=p=>p.startsWith('logs/')?fmtLong(p.slice(5)):p.startsWith('programs/')?'an archived program':p;
  return `<div class="card"><div class="lift-h"><h2>Changes that crossed</h2><span class="chip">${list.length}</span></div>
  <p class="small muted" style="margin:0">These days were changed on another device while this one still had changes of its own waiting to send. <b>This device\u2019s version was kept</b> and the other was dropped. That is usually what you want, but it is worth a look if something reads wrong.</p>
  <div class="stack">${list.map(c=>`<div class="banner"><div class="small"><b>${esc(label(c.path))}</b><div class="muted">noticed ${esc(fmtD(c.at.slice(0,10),true))} ${esc(c.at.slice(11,16))}</div></div></div>`).join('')}</div>
  <div class="row"><button class="btn ghost" data-act="syncclear">Dismiss</button></div>
  <div class="small muted">Only ever caused by using the app on two devices at once while one of them is offline. Noted on this device only.</div></div>`;
}

// Accessories in Setup: which jobs each day covers, what is doing each job this block
// and next, and your own additions. The picks are per cycle on purpose \u2014 they are
// programme choices, like the cluster lifts, not something to re-decide every session.
let accNew={name:'',slot:'hpull',gear:''}, accLater=false;
function accSetupCard(){
  const cyc=accCycleOf(todayStr()), all=accAll();
  const days=[['mon','Operator 1 \u00b7 Monday'],['wed','Operator 2 \u00b7 Wednesday'],['fri','Operator 3 \u00b7 Friday']];
  const later=accLater||cyc==null;              // with no cycle running there is only "later"
  let h=`<div class="card"><h2>Accessories</h2>
  <p class="small muted" style="margin:0">Each lifting day covers a few jobs and you choose what does each one. The same job can appear on more than one day with a different movement on each. Skipped automatically on heavy weeks and deloads. To change one movement for a single session, use the picker on that day\u2019s card instead.</p>`;
  if(cyc!=null) h+=`<div class="restsel"><span>Editing</span><div class="seg"><button class="segb${later?'':' on'}" data-act="acclater" data-v="0" aria-pressed="${!later}">Cycle ${cyc} (now)</button><button class="segb${later?' on':''}" data-act="acclater" data-v="1" aria-pressed="${later}">Later cycles</button></div></div>
  <div class="small muted">${later?'What a new cycle starts on. Your current block is untouched.':'This block only. Later cycles keep their own choices.'}</div>`;

  for(const [d,label] of days){
    const sl=accSlots(d), spare=Object.keys(ASLOT).filter(k=>!sl.includes(k));
    h+=`<div style="border-top:1px solid var(--line);padding-top:10px"><div class="small" style="font-weight:650">${label}</div>`;
    if(!sl.length) h+=`<div class="small muted" style="margin-top:4px">Nothing on this day.</div>`;
    for(const k of sl){
      const pick=accPickFor(d,k,later?null:cyc), list=accFor(k);
      h+=`<div style="margin-top:8px"><div class="row between" style="gap:8px"><span class="acc-role">${esc(ASLOT[k].name)}</span><button class="btn sm ghost" data-act="accslotrm" data-day="${d}" data-slot="${k}">Remove</button></div>
      <select data-act-accpick="${d}:${k}" aria-label="${esc(ASLOT[k].name)} on ${esc(label)}">${list.map(x=>`<option value="${x}"${x===pick?' selected':''}>${esc(all[x].name)}${all[x].gear?' \u00b7 '+esc(all[x].gear):''}</option>`).join('')}</select></div>`;
    }
    if(spare.length) h+=`<label class="f" style="margin-top:8px">Add a job<select data-act-accadd="${d}"><option value="">Choose\u2026</option>${spare.map(k=>`<option value="${k}">${esc(ASLOT[k].name)}</option>`).join('')}</select></label>`;
    h+=`</div>`;
  }

  const mine=accCustom();
  h+=`<div style="border-top:1px solid var(--line);padding-top:12px"><div class="small" style="font-weight:650">Your own</div>
  <p class="small muted" style="margin:2px 0 0">Anything the list is missing. It appears everywhere the built-in ones do, and syncs to your other devices.</p>
  ${mine.length?`<div class="stack" style="gap:6px;margin-top:6px">${mine.map(x=>`<div class="row between"><span class="small">${esc(x.name)} <span class="muted">\u00b7 ${esc((ASLOT[x.slot]||{}).name||x.slot)}${x.gear?' \u00b7 '+esc(x.gear):''}</span></span><button class="btn sm ghost" data-act="accmineRm" data-id="${esc(x.id)}">Remove</button></div>`).join('')}</div>`:''}
  <div class="grid3" style="margin-top:8px"><label class="f">Name<input type="text" data-accnew="name" value="${esc(accNew.name)}" placeholder="e.g. Spider curl"></label>
  <label class="f">Job<select data-accnew="slot">${Object.entries(ASLOT).map(([k,v])=>`<option value="${k}"${k===accNew.slot?' selected':''}>${esc(v.name)}</option>`).join('')}</select></label>
  <label class="f">Kit<input type="text" data-accnew="gear" value="${esc(accNew.gear)}" placeholder="e.g. EZ bar"></label></div>
  <div class="row"><button class="btn" data-act="accmineAdd"${accNew.name.trim()?'':' disabled'}>Add it</button></div></div>`;

  const legacy=Object.values(plan.acc||{}).some(a=>Array.isArray(a)&&a.length);
  if(legacy) h+=`<div class="banner info"><div class="small">Your old typed-in accessory lists have been replaced by the jobs above. Nothing was lost \u2014 they are still in your plan, and what you ticked on past days still shows on those days.</div></div>`;
  return h+`</div>`;
}

function archiveBanner(){
  if(schemaAhead) return `<div class="banner alert"><div><b>This copy of the app is out of date.</b> Your training data was last saved by a newer version, and writing to it from here could undo something. Nothing will be saved until you reload. If reloading does not help, close the app and open it again.</div><div><button class="btn sm primary" data-act="reload">Reload</button></div></div>`;
  if(!viewing) return '';
  return `<div class="banner info"><div><b>Viewing ${esc(viewing.name)}</b> · ${fmtD(viewing.startMonday)} – ${fmtD(viewing.end)} · archived, read-only</div><div><button class="btn sm primary" data-act="progexit">Back to current program</button></div></div>`;
}
function programPicker(){
  const list=archiveList(); if(!list.length) return '';
  const cur=stash?stash.plan:plan;
  return `<div class="restsel"><span>Program</span><div class="seg"><button class="segb pv${!viewing?' on':''}" data-act="progexit">${esc(progName(cur))} (current)</button>${list.map(p=>`<button class="segb pv${viewing&&viewing.id===p.id?' on':''}" data-act="progview" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>`;
}
// Maxes to carry into a new program: next cycle's if a review or retest already set
// them, otherwise the current cycle's.
function carryMaxes(){
  const wk=weekOf(realToday()); let c=1;
  if(wk) c=wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle||1);
  const cur=maxFor(c), nx=maxFor(c+1), out={};
  for(const k of LK){const pick=nx[k]&&nx[k].src==='set'?nx[k]:cur[k]; if(pick) out[k]=pick.v}
  return out;
}
function programsCard(){
  if(viewing) return '';
  const list=archiveList(), cm=carryMaxes();
  let h=`<div class="card"><h2>Programs</h2><div class="grid2"><label class="f">Current program<input type="text" id="p-pname" data-pbind="programName" value="${esc(plan.programName||'')}" placeholder="${esc(progName())}"></label><label class="f">Started<input type="text" value="${fmtLong(plan.startMonday)}" disabled></label></div>`;
  if(list.length) h+=`<div class="stack small">${list.map(p=>`<div class="row between"><span><b>${esc(p.name)}</b> <span class="muted">${fmtD(p.startMonday)}–${fmtD(p.end)}</span></span><button class="btn sm" data-act="progview" data-id="${p.id}">View</button></div>`).join('')}</div>`;
  if(!newProg) h+=`<div class="row"><button class="btn" data-act="prognew">Start a new program…</button><button class="btn ghost" data-act="wzrerun">Run welcome setup again</button></div>`;
  else {
    const carried=activeLifts().filter(k=>cm[k]!=null).map(k=>esc(liftName(k))+' '+(isBW(k)?'+':'')+n(cm[k])).join(' · ')||'no maxes yet';
    h+=`<div class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px">
    <div class="grid2"><label class="f">New program name<input type="text" id="np-name" data-np="name" value="${esc(newProg.name)}"></label><label class="f">Starts (week of)<input type="date" id="np-start" data-np="start" value="${newProg.start}"></label></div>
    <label class="check"><input type="radio" name="np-mode" id="np-carry" data-np="mode" value="carry" ${newProg.mode==='carry'?'checked':''}> <span>Carry my maxes forward <span class="small muted">(${carried})</span></span></label>
    <label class="check"><input type="radio" name="np-mode" id="np-bridge" data-np="mode" value="bridge" ${newProg.mode==='bridge'?'checked':''}> <span>Start with a bridge week and re-test <span class="small muted">(your current maxes show on test days for reference)</span></span></label>
    <p class="small muted" style="margin:0">${esc(progName())} will be archived. Its calendar, maxes, reviews and every logged session stay viewable here and from History, Status and Plan. Your settings (Lift 3, accessories, rest times, conditioning, wave and deload rules) carry over.</p>
    ${newProg.err?`<div class="banner warn"><div class="small">${esc(newProg.err)}</div></div>`:''}
    <div class="row"><button class="btn primary" data-act="progstart">${newProg.arm?'Tap again to confirm':'Archive and start '+esc(newProg.name||'new program')}</button><button class="btn ghost" data-act="progcancel">Cancel</button></div></div>`;
  }
  return h+`</div>`;
}
function startProgram(){
  const np=newProg, start=mondayOf(np.start||realToday());
  if(start<=plan.startMonday){np.err='The new program has to start after '+fmtLong(plan.startMonday)+'.';np.arm=false;render();return}
  if(start<mondayOf(realToday())){np.err='Pick this week or a later one. Past weeks belong to the current program.';np.arm=false;render();return}
  const end=addDays(start,-1), oldName=progName();
  // Stamp format and activity on this program's conditioning entries so they keep
  // their meaning once the plan that implied them is archived.
  for(const [d,L] of Object.entries(logs)) if(d>=plan.startMonday&&d<=end&&L.hic){const f=effFmt(d);if(f&&!L.hic.format)setLog(d,'hic.format',f);if(!L.hic.mod)setLog(d,'hic.mod',modOf(d))}
  let id='p-'+plan.startMonday.replace(/-/g,''); while(programs[id]) id+='b';
  programs[id]={id,name:oldName,startMonday:plan.startMonday,end,archivedAt:realToday(),plan:clone(plan)};
  queueWrite('programs/'+id,()=>programs[id]);
  const cm=carryMaxes(), keep={}; for(const k of PREF_KEYS) if(plan[k]!==undefined) keep[k]=clone(plan[k]);
  const next=deepMerge(clone(DEF),keep);
  next.startMonday=start; next.programName=np.name||('Block '+((plan.programSeq||1)+1)); next.programSeq=(plan.programSeq||1)+1;
  if(np.mode==='carry'){next.bridge=false;next.maxes=Object.assign({},clone(DEF.maxes),cm)}
  else {next.bridge=true;next.maxes=clone(DEF.maxes);next.prevMaxes=cm}
  plan=next; planV++; queueWrite('plan/main',()=>plan);
  newProg=null; sel=realToday(); view='today'; render(); window.scrollTo(0,0);
}

// Rearranging in the calendar: tap a session, tap the day to move it to, see the
// whole week previewed, then apply. calMove = {from, to, ord, moved}.
let calRe=false, calMove=null;
function calOrd(mon){return calMove&&calMove.ord&&mondayOf(calMove.from)===mon?calMove.ord:dayOrder(mon)}
function calCard(){
  const t=realToday(), thisMon=mondayOf(t);
  if(!calMonth) calMonth=(viewing?viewing.end:(sel||t)).slice(0,7);
  const y=+calMonth.slice(0,4), m=+calMonth.slice(5,7);
  const first=S(Date.UTC(y,m-1,1)), last=S(Date.UTC(y,m,0)), start=mondayOf(first);
  const rows=Math.round(((D(mondayOf(last))-D(start))/864e5)/7)+1;
  const re=calRe&&!viewing;
  let h=`<div class="card"><div class="dnav"><button class="btn sm ghost" data-act="calm" data-v="-1" aria-label="Previous month">‹</button><h2 style="flex:1;text-align:center">${MON[m-1]} ${y}</h2><button class="btn sm ghost" data-act="calm" data-v="1" aria-label="Next month">›</button></div>`;
  if(!viewing) h+=`<div class="row between"><button class="btn sm${re?' primary':''}" data-act="calre">${re?'✓ Rearranging':'Rearrange days'}</button>${calMonth!==t.slice(0,7)?`<button class="btn sm ghost" data-act="calm" data-v="0">This month</button>`:''}</div>`;
  if(re) h+=`<div class="banner info"><div class="small">${calMove?(calMove.ord?`<b>${esc(dayPlanSlot(calMove.from,slotOf(calMove.from)).short||'Session')}</b> moves to ${fmtD(calMove.to,true)}${calMove.moved>1?`, and ${calMove.moved-1} other day${calMove.moved>2?'s':''} shift`:' with no other changes'}. The preview is below.`:`Tap the day to move <b>${esc(dayPlanSlot(calMove.from,slotOf(calMove.from)).short||'')}</b> to. Greyed days can’t take it without doubling up strength or hard conditioning.`):'Tap a session, then tap the day you want to do it on. The week keeps all seven sessions and never lands two strength days or two hard conditioning days together.'}</div>${calMove?`<div class="row">${calMove.ord?`<button class="btn sm primary" data-act="calapply">Apply</button>`:''}<button class="btn sm ghost" data-act="calcancel">Cancel</button></div>`:''}</div>`;
  h+=`<div class="cal"><div class="cal-h">${DAYN.map(d=>`<span>${d[0]}</span>`).join('')}</div>`;
  for(let r=0;r<rows;r++){
    const mon=addDays(start,r*7), wk=weekOf(mon), wt=wk?weekTitle(wk):null;
    const cur=dayOrder(mon), ord=calOrd(mon), editable=re&&wk&&mon>=thisMon;
    h+=`<div class="cal-w">${wt?`<b>${esc(wt.t)}</b><span class="chip ${wt.cls}">${esc(wt.chip)}</span>${isReordered(mon)?'<span class="chip blue">days moved</span>':''}`:'<span class="muted">Before the program starts</span>'}</div>`;
    for(let i=0;i<7;i++){
      const d=addDays(mon,i), dp=dayPlanSlot(d,ord[i]), out=d<first||d>last, st=sessState(d,t);
      const gone=mon===thisMon&&i<dow(t), picked=calMove&&calMove.from===d, shifted=ord[i]!==cur[i];
      let cls='', act='open', dis='';
      if(re){
        if(!editable||gone){cls=' dim';dis='disabled'}
        else if(calMove&&!calMove.ord){ const ok=bestOrder(mon,i,slotOf(calMove.from));
          if(mondayOf(calMove.from)!==mon||(!ok&&!picked)){cls=' dim';dis='disabled'} }
        act='calpick';
      }
      h+=`<button class="cal-d${out?' out':''}${d===t?' today':''}${d===sel&&!re?' sel':''}${picked?' picked':''}${shifted?' shifted':''}${cls}" data-act="${act}" data-date="${d}" ${dis} aria-label="${fmtLong(d)} ${esc(dp.short||'')}"><span class="n">${+d.slice(8)}</span><span class="l">${esc(dp.short||'')}</span><span class="dot ${re?'':st}"></span></button>`;
    }
  }
  h+=`</div>`;
  if(!re) h+=`<div class="row small muted" style="gap:12px"><span><i class="lg done"></i>done</span><span><i class="lg missed"></i>missed</span></div>`;
  return h+`</div>`;
}
function vPlan(){
  const head=`<div class="card" style="padding:10px 12px"><div class="seg">${[['list','Weeks'],['cal','Calendar']].map(([v,l])=>`<button class="segb${planMode===v?' on':''}" data-act="planmode" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  return head+(planMode==='cal'?calCard():vPlanList());
}
function vPlanList(){
  const t=todayStr(), ti=Math.max(0,idxOf(t)), list=weeks(ti+planShow+2), from=Math.max(0,ti-4), to=ti+planShow;
  let h=`<div class="card" style="gap:6px"><h2>Plan</h2><p class="small muted" style="margin:0">Cycles run back to back forever. Deload every ${+plan.deloadEvery?plan.deloadEvery+' cycle'+(plan.deloadEvery>1?'s':''):'— (off)'} · retest every ${+plan.testEvery?plan.testEvery+' cycle'+(plan.testEvery>1?'s':''):'— (off)'}. Add a deload, retest or off week anywhere; everything after it shifts back a week.</p></div><div class="card" style="gap:0;padding-block:4px">`;
  for(let i=from;i<=to&&i<list.length;i++){
    const wk=list[i], wt=weekTitle(wk), past=wk.idx<ti, cur=wk.idx===ti;
    let done=0,tot=0; for(let d=0;d<7;d++){const dd=addDays(wk.monday,d),p=dayPlan(dd); if(p.t!=='off'){tot++; if(lg(dd).done) done++}}
    const hol=[];for(let d=0;d<7;d++){const dd=addDays(wk.monday,d),x=holidayOn(dd);if(x)hol.push(x)}
    let sub=[];
    if(wk.kind==='cycle') sub.push('Plyo: '+plyoPhase(wk).name);
    if(wk.kind==='cycle'&&wk.w===1){const m=maxFor(wk.cycle);sub.push(activeLifts().map(k=>m[k]?n(m[k].v):'—').join(' / '))}
    if(hol.length) sub.push('⚑ '+hol.join(', '));
    let menu='';
    if(!past){
      const opts=[];
      if(wk.kind==='bb') opts.push(`<button class="btn sm" data-act="bbremove" data-monday="${wk.monday}">Remove the whole block</button>`);
      else if(wk.inserted) opts.push(`<button class="btn sm" data-act="uninsert" data-monday="${wk.monday}">Remove this week</button>`);
      else if(wk.rule) opts.push(`<button class="btn sm" data-act="skip" data-rule="${wk.rule}">Skip this ${wk.kind==='test'?'retest':'deload'}</button>`);
      if(!wk.inserted) opts.push(`<span class="lbl">Start here instead</span><button class="btn sm" data-act="bbadd" data-monday="${wk.monday}" data-ver="standard">Base Building · 8 weeks</button><button class="btn sm ghost" data-act="bbadd" data-monday="${wk.monday}" data-ver="strength">Base Building · strength-first</button>`);
      if(!wk.inserted) opts.push(`<span class="lbl">Insert this week</span>${['deload','test','travel','off'].map(k=>`<button class="btn sm" data-act="insert" data-kind="${k}" data-monday="${wk.monday}">${{deload:'Deload',test:'Retest',travel:'Travel',off:'Off week'}[k]}</button>`).join('')}`);
      menu=`<details class="menu"><summary>Change</summary><div class="pop">${opts.join('')}</div></details>`;
    }
    h+=`<div class="wk-row${cur?' cur':''}${past?' past':''}"><div class="wk-date">${fmtD(wk.monday)}–${fmtD(addDays(wk.monday,6))}</div><div class="wk-main"><div class="row" style="gap:8px"><span class="t">${wt.t}</span><span class="chip ${wt.cls}">${wt.chip}</span>${wk.inserted?'<span class="chip">Added</span>':''}</div>${sub.length?`<div class="small muted">${esc(sub.join(' · '))}</div>`:''}</div><div class="row" style="gap:6px;justify-content:flex-end">${done?`<span class="small mono muted">${done}/${tot}</span>`:''}${menu}</div></div>`;
  }
  h+=`</div><div class="row"><button class="btn" data-act="more">Show 26 more weeks</button></div>`;
  const sk=Object.keys(plan.skips||{}).filter(k=>plan.skips[k]);
  if(sk.length) h+=`<div class="card"><h3>Skipped</h3><div class="row">${sk.map(k=>{const [kind,c]=k.split('@');return `<button class="btn sm" data-act="unskip" data-rule="${k}">Restore ${kind==='test'?'retest':'deload'} after Cycle ${c}</button>`}).join('')}</div></div>`;
  return h;
}

function vHistory(){
  const t=todayStr(), wk=weekOf(t), curC=wk?(wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle)):1;
  const list=weeks(), range={};
  for(const w of list){ if(w.kind==='cycle'){ (range[w.cycle]||(range[w.cycle]={a:w.monday,b:w.monday})).b=w.monday } }
  let h=`<div class="card"><h2>Maxes by cycle</h2><p class="small muted" style="margin:0">Type a number to override a cycle. Blank cells follow the previous cycle plus the increment. Later cycles update automatically.</p><div class="tbl-wrap"><table><thead><tr><th>Cycle</th><th>Dates</th>${activeLifts().map(k=>`<th class="n">${esc(liftName(k))}</th>`).join('')}</tr></thead><tbody>`;
  for(let c=1;c<=curC+(viewing?0:2);c++){
    const m=maxFor(c), r=range[c], o=plan.cycleMaxes[c]||{};
    h+=`<tr class="${c===curC?'cur':c<curC?'past':''}"><td><b>${c}</b></td><td class="small mono">${r?fmtD(r.a)+'–'+fmtD(addDays(r.b,4)):''}</td>${activeLifts().map(k=>c===1&&(o[k]==null||o[k]==='')?`<td class="n"><span title="Set in Setup">${m[k]?n(m[k].v):'—'}</span></td>`:`<td class="n"><input type="number" inputmode="decimal" step="any" id="cm-${c}-${k}" data-cmax="${c}.${k}" value="${o[k]??''}" placeholder="${m[k]?n(m[k].v):''}" aria-label="Cycle ${c} ${esc(liftName(k))}"></td>`).join('')}</tr>`;
  }
  h+=`</tbody></table></div></div>`;
  // Recovery
  const cis=progLogs().filter(([d,L])=>L.checkin&&readiness(L.checkin)!=null).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,14);
  h+=`<div class="card"><h2>Recovery</h2>`;
  if(!cis.length) h+=`<div class="empty">No check-ins yet. Answer the daily check-in on the Today tab and your readiness trend shows up here.</div>`;
  else{
    const avg=(f)=>{const xs=cis.slice(0,7).map(([d,L])=>L.checkin[f]).filter(v=>v!=null&&v!=='').map(Number);return xs.length?(xs.reduce((a,b)=>a+b,0)/xs.length):null};
    const ar=cis.slice(0,7).map(([d,L])=>readiness(L.checkin));const ra=ar.reduce((a,b)=>a+b,0)/ar.length;
    h+=`<div class="grid3"><div class="stack" style="gap:2px"><span class="small muted">Readiness · last 7</span><span class="big" style="font-size:32px">${Math.round(ra)}</span></div><div class="stack" style="gap:2px"><span class="small muted">Sleep · last 7</span><span class="big" style="font-size:32px">${avg('sleepH')!=null?avg('sleepH').toFixed(1):'—'}<small>h</small></span></div><div class="stack" style="gap:2px"><span class="small muted">Bodyweight</span><span class="big" style="font-size:32px">${latestBw(todayStr())?n(latestBw(todayStr())):'—'}<small>${u()}</small></span></div></div>`;
    h+=`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Ready</th><th class="n">Sleep</th><th class="n">Energy</th><th class="n">Sore</th><th class="n">BW</th></tr></thead><tbody>${cis.map(([d,L])=>{const c=L.checkin,r=readiness(c),lv=rLevel(r);return `<tr><td>${fmtD(d,true)}</td><td class="n"><span class="chip ${lv.cls}">${r}</span></td><td class="n">${c.sleepH!=null&&c.sleepH!==''?n(c.sleepH):'—'}</td><td class="n">${c.energy||'—'}</td><td class="n">${c.soreness||'—'}</td><td class="n">${c.bw?n(c.bw):'—'}</td></tr>`}).join('')}</tbody></table></div>`;
  }
  h+=`</div>`;
  // HIC
  const hic=hicSessions().reverse();
  h+=`<div class="card"><h2>Conditioning</h2>`;
  if(!hic.length) h+=`<div class="empty">No conditioning logged yet. Results you enter on HIC and LISS days show up here.</div>`;
  else{
    const groups={};for(const x of hic) if(x.f!=='liss'&&x.v!=null)(groups[x.mod+'|'+x.f]=groups[x.mod+'|'+x.f]||[]).push(x);
    const top=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).slice(0,4);
    if(top.length) h+=`<div class="grid4">${top.map(key=>{const xs=groups[key],[m,f]=key.split('|'),b=xs.reduce((a,x)=>Math.max(a,x.v),0);return `<div class="stack" style="gap:2px"><span class="small muted">${MOD[m].name} · ${HIC[f].name}</span><span class="big" style="font-size:32px">${n(b)}<small style="font-size:13px;color:var(--muted);margin-left:3px">${esc(xs[0].u)}</small></span><span class="small muted">best · ${xs.length} logged</span></div>`}).join('')}</div>`;
    h+=`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Format</th><th>Activity</th><th class="n">Result</th></tr></thead><tbody>${hic.slice(0,20).map(x=>`<tr><td>${fmtD(x.d,true)}</td><td>${HIC[x.f].name}</td><td>${esc(x.mod==='other'&&x.what?x.what:MOD[x.mod].name)}${x.load?` <span class="small muted">(${n(x.load)} ${u()})</span>`:''}</td><td class="n">${[x.v!=null?n(x.v)+' '+x.u:'',x.min?x.min+' min':'',x.elev?'↑'+n(x.elev)+' '+elevUnit():'',flatEquiv(x)!=null?'≈ '+n(flatEquiv(x))+' '+x.u+' flat':''].filter(Boolean).join(' · ')||'—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  h+=`</div>`;
  // Jumps
  const jm=progLogs().filter(([d,L])=>(L.plyo&&(L.plyo.best||L.plyo.mark))||(L.jumps&&(L.jumps.broad||L.jumps.vertical))).sort((a,b)=>a[0]<b[0]?1:-1);
  h+=`<div class="card"><h2>Jumps</h2>`;
  h+=jm.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Broad</th><th class="n">Vertical</th><th class="n">Triple</th></tr></thead><tbody>${jm.slice(0,15).map(([d,L])=>`<tr><td>${fmtD(d,true)}</td><td class="n">${n((L.jumps&&L.jumps.broad)||(L.plyo&&(L.plyo.best||L.plyo.mark)))}</td><td class="n">${n(L.jumps&&L.jumps.vertical)}</td><td class="n">${n(L.jumps&&L.jumps.triple)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No jumps yet. Log Thursday's first broad jump on the plyo card, or a full set on a test day.</div>`;
  h+=`</div>`;
  // Sessions
  const ss=progLogs().filter(([d,L])=>L.done||L.notes).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,20);
  h+=`<div class="card"><h2>Recent sessions</h2>`+(ss.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Session</th><th class="n">RPE</th><th>Notes</th></tr></thead><tbody>${ss.map(([d,L])=>`<tr><td><button class="btn sm ghost" data-act="open" data-date="${d}">${fmtD(d,true)}</button></td><td>${esc(dayPlan(d).short||'')}</td><td class="n">${L.rpe||'—'}</td><td class="small">${esc((L.notes||'').slice(0,80))}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">Nothing logged yet. Mark a session done on Today and it appears here with its RPE and notes.</div>`)+`</div>`;
  return h;
}

function pIn(path,val,attrs){return `<input type="number" inputmode="decimal" step="any" id="p-${path.replace(/\./g,'-')}" data-pbind="${path}" data-type="num" value="${val??''}" ${attrs||''}>`+oddNote(path,val)}
function vSetup(){
  let h=`<div class="card" id="account"><h2>Account</h2><dl class="kv"><dt>Signed in</dt><dd>${esc(me||'Not signed in')}</dd></dl>
  <p class="small muted" style="margin:0">Sign-in goes through Cloudflare Access, and everything you log — plan, sessions, archived programs and backups — belongs to this address alone. Signing out leaves this phone’s copy in place; it syncs again the moment you sign back in.</p>
  <div class="row"><a class="btn" href="${signedOut?'/':'/cdn-cgi/access/logout'}">${signedOut?'Sign in':'Sign out'}</a><button class="btn ghost" data-act="view" data-view="guide">Guide</button></div></div>
  <div class="card"><h2>Maxes</h2><p class="small muted" style="margin:0">True 1RM for Cycle 1. Later cycles add the increment below unless a retest or a manual override replaces it.</p>
  <div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k,todayStr()))} 1RM${isBW(k)?' (added)':''}${pIn('maxes.'+k,plan.maxes[k])}</label>`).join('')}</div>
  <details class="plain"><summary>Have a 5RM instead?</summary><div class="stack" style="margin-top:8px"><p class="small muted" style="margin:0">Enter a clean 5RM. The 1RM is the 5RM ÷ 0.87, rounded down.</p><div class="grid4">${activeLifts().filter(k=>!isBW(k)).map(k=>`<label class="f">${esc(liftName(k))} 5RM<input type="number" inputmode="decimal" step="any" id="c5-${k}" data-calc="${k}" value="${calc5[k]??''}"><span class="mono small">${calc5[k]?'→ '+n(floorTo(calc5[k]/.87,plan.round[k])):''}</span></label>`).join('')}</div><div><button class="btn sm" data-act="calc5">Use these as maxes</button></div></div></details></div>`;
  {
    const t=themePref();
    h+=`<div class="card"><h2>Appearance</h2><p class="small muted" style="margin:0">Set per device, so your phone and laptop can differ.</p>
    <label class="f">Theme<div class="seg">${[['auto','Match device'],['light','Light'],['dark','Dark']].map(([v,l])=>`<button class="segb${t===v?' on':''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div></label>
    <label class="check"><input type="checkbox" id="p-gym" data-act="gym" ${gymOn()?'checked':''}> <span>Gym mode: bigger buttons and stronger contrast for sweaty hands</span></label></div>`;
  }
  h+=programsCard();
  h+=`<div class="card"><h2>Program</h2><div class="grid2"><label class="f">Start (Monday of first week)<input type="date" id="p-start" data-pbind="startMonday" value="${plan.startMonday}"></label></div>
  <label class="check"><input type="checkbox" id="p-bridge" data-pbind="bridge" ${plan.bridge?'checked':''}> Begin with the bridge (calibration) week</label>
  <div class="grid4"><label class="f">Units<select id="p-unit" data-pbind="unit"><option value="lb"${u()==='lb'?' selected':''}>lb</option><option value="kg"${u()==='kg'?' selected':''}>kg</option></select></label><label class="f">Bar weight${pIn('bar',plan.bar)}</label><label class="f">Bodyweight${pIn('bodyweight',plan.bodyweight)}</label><label class="f">Percent of<select id="p-basis" data-pbind="basis"><option value="1rm"${plan.basis!=='tm'?' selected':''}>True 1RM</option><option value="tm"${plan.basis==='tm'?' selected':''}>Training max</option></select></label></div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Plates your gym has (${u()})</div><div class="seg">${ALL_PLATES[u()].map(v=>`<button class="segb${plateSet().includes(v)?' on':''}" data-act="platetoggle" data-v="${v}" aria-pressed="${plateSet().includes(v)}">${n(v)}</button>`).join('')}</div><div class="small muted">Plate math only uses these. If a weight can’t be loaded exactly, the lift card says so and shows the nearest you can load.</div></div>
  ${plan.basis==='tm'?`<label class="f" style="max-width:200px">Training max % of 1RM${pIn('tmPct',plan.tmPct)}</label>`:''}
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Round working weights to</div><div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k))}${pIn('round.'+k,plan.round[k])}</label>`).join('')}</div></div></div>`;
  const on=l3On(), L3=plan.l3||{};
  h+=`<div class="card"><h2>Lift 3</h2><p class="small muted" style="margin:0">Pick the variants you use on Mondays and Wednesdays. Each keeps its own max. With more than one, choose how they rotate. You can also swap on any day from the lift card.</p>
  <div class="stack">${L3K.map(k=>`<label class="check"><input type="checkbox" id="l3-${k}" data-pbind="l3.on.${k}" ${on.includes(k)&&(L3.on||{})[k]?'checked':''}> ${esc(liftName(k))}${k==='wpu'?' <span class="small muted">(percentages use bodyweight + added weight)</span>':''}</label>`).join('')}</div>
  ${on.length>1?`<div class="grid2"><label class="f">Rotation<select id="l3-mode" data-pbind="l3.mode">${[['same','Same every session'],['alt-day','Alternate Monday ↔ Wednesday'],['alt-week','Alternate each week'],['alt-cycle','Alternate each cycle']].map(([v,l])=>`<option value="${v}"${L3.mode===v?' selected':''}>${l}</option>`).join('')}</select></label>${L3.mode==='same'||!L3.mode?`<label class="f">Default<select id="l3-primary" data-pbind="l3.primary">${on.map(k=>`<option value="${k}"${L3.primary===k?' selected':''}>${esc(liftName(k))}</option>`).join('')}</select></label>`:''}</div>`:''}
  ${on.includes('pull')?`<div class="grid2"><label class="f">Pulldown name<input type="text" id="p-l3" data-pbind="lift3Name" value="${esc(plan.lift3Name)}"></label><label class="f">Machine and pin setting<input type="text" id="p-mn" data-pbind="machineNote" value="${esc(plan.machineNote)}" placeholder="e.g. Hammer Strength pulldown, seat 4"></label></div>`:''}
  ${on.some(k=>plan.maxes[k]==null||plan.maxes[k]==='')?`<div class="banner warn"><div class="small">Add a 1RM above for ${on.filter(k=>plan.maxes[k]==null||plan.maxes[k]==='').map(liftName).join(' and ')}. Until then its sessions show no working weight.</div></div>`:''}</div>`;
  {
    const sup=alertsSupport(), on=alertsOn();
    h+=`<div class="card"><div class="lift-h"><h2>Rest alerts</h2>${on?'<span class="chip light">On</span>':'<span class="chip">Off</span>'}</div><p class="small muted" style="margin:0">A notification when each rest ends, even with the phone locked or another app open. Set per device.</p>`;
    if(sup==='install') h+=`<div class="banner info"><div class="small">On iPhone, alerts only work in the home-screen app. In Safari tap <b>Share → Add to Home Screen</b>, open Operator from there, then turn alerts on. Needs iOS 16.4 or later.</div></div>`;
    else if(sup==='unsupported') h+=`<div class="small muted">This browser can’t receive push notifications.</div>`;
    else if(sup==='denied') h+=`<div class="banner warn"><div class="small">Notifications are blocked for this app. Turn them on in iOS Settings → Notifications → Operator, then come back here.</div></div>`;
    else h+=`<div class="row">${on?`<button class="btn" data-act="alerttest" ${alerts.busy?'disabled':''}>Send a test</button><button class="btn ghost" data-act="alertoff" ${alerts.busy?'disabled':''}>Turn off</button>`:`<button class="btn primary" data-act="alerton" ${alerts.busy?'disabled':''}>${alerts.busy?'Turning on…':'Turn on rest alerts'}</button>`}</div>`;
    if(alerts.msg) h+=`<div class="small">${esc(alerts.msg)}</div>`;
    h+=`<div class="small muted">Alerts use the standard notification sound. Silent mode and Focus apply, and they also show on a paired Apple Watch. With the app open you’ll get both the in-app beep and the notification.</div></div>`;
  }
  {
    const q=!!plan.quietTimer;
    h+=`<div class="card"><div class="lift-h"><h2>Sound</h2>${q?'<span class="chip">Silent</span>':'<span class="chip light">Beeps on</span>'}</div>
    <p class="small muted" style="margin:0">On iPhone, a web app that makes any sound takes over the audio session and pauses whatever you were listening to. If the timer keeps stopping your music, this is why.</p>
    <label class="check"><input type="checkbox" id="p-quiet" data-pbind="quietTimer" ${q?'checked':''}> Silent timers \u2014 keep my music playing</label>
    <div class="small muted">Silent turns off the beeps and the spoken cues for rests and intervals. The countdown, the vibration and the screen still work, and rest alerts still arrive as notifications, which do not touch your music.</div></div>`;
  }
  {
    const v=!!plan.voice&&!plan.quietTimer;
    h+=`<div class="card"><div class="lift-h"><h2>Spoken cues</h2>${v?'<span class="chip light">On</span>':'<span class="chip">Off</span>'}</div>
    <p class="small muted" style="margin:0">The app’s own voice, separate from notifications. It reads interval changes (“Round 3 of 8. Go hard.”), ten seconds left in a rest, and what’s next when one ends.</p>
    <label class="check"><input type="checkbox" id="p-voice" data-pbind="voice" ${v?'checked':''}> Speak cues while the app is on screen</label>
    ${plan.quietTimer?`<div class="small" style="color:var(--muted)">Silent timers are on, so cues stay quiet whatever this says.</div>`:''}
    ${v?`<div><button class="btn" data-act="voicetest">Try a cue</button></div>`:''}
    <div class="small muted">Only while the app is on screen — iOS silences a web app the moment the phone locks. For a whole session, set Auto-Lock to Never. The <b>Send a test</b> button above is a notification, not speech: it will never be read aloud.</div></div>`;
  }
  {
    const fmtAt=t=>{if(!t)return '';const d=new Date(t);return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+', '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
    const status=!APP_VER||APP_VER==='dev'?'Version unknown in this preview.':!upd.latest?(upd.err||'Not checked yet.'):updateAvailable()?'A newer version is available.':'You’re on the latest version.';
    const latestV=tagVersion(upd.tag), rel=RELEASES[0];
    h+=`<div class="card"><h2>About this app</h2><dl class="kv">
    <dt>This app</dt><dd><b>${esc(APP_VERSION)}</b> · ${esc(rel.title)} <span class="small muted">(${esc((APP_VER||'—').slice(0,8))})</span></dd>
    <dt>Latest</dt><dd>${latestV?`<b>${esc(latestV)}</b> `:''}<span class="small muted">${upd.latest?esc(upd.latest.slice(0,8)):'—'}${upd.at?` · deployed ${esc(fmtAt(upd.at))}`:''}</span></dd></dl>
    <div class="small">${esc(status)}${upd.checked?` <span class="muted">Last checked ${esc(new Date(upd.checked).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}.</span>`:''}</div>
    <div class="row">${updateAvailable()?'<button class="btn primary" data-act="updnow">Reload to update</button>':''}<button class="btn" data-act="updcheck" ${upd.busy?'disabled':''}>${upd.busy?'Checking…':'Check for updates'}</button></div>
    <div class="small muted">The app checks on its own whenever you open it or come back to it. If a new version is ready, a banner appears at the top.</div>
    <div><button class="btn" data-act="view" data-view="releases">What’s new in each release</button></div></div>`;
  }
  {
    const key=((plan.se||{}).cluster)in SE_CLUSTERS?plan.se.cluster:'bw';
    h+=`<div class="card"><h2>Strength-endurance</h2><p class="small muted" style="margin:0">Circuits of five to eight exercises covering the whole body, light and high-rep. Used by Base Building, and you can pick a different cluster on any single day.</p>
    <div class="restsel"><span>Default cluster</span><div class="seg">${Object.entries(SE_CLUSTERS).map(([k,c])=>`<button class="segb${key===k?' on':''}" data-act="sedef" data-v="${k}">${c.name}</button>`).join('')}</div></div>
    <label class="f">My own cluster<textarea id="se-mine" data-seMine rows="7" placeholder="One exercise per line, five to eight of them">${esc(((plan.se||{}).custom||[]).join('\n'))}</textarea></label>
    <div class="small muted">Pick movements you can get to without queueing, since the short rests are the point. Anything one arm or one leg at a time splits the reps. With barbells or dumbbells use roughly 15–30% of your one-rep max.</div></div>`;
  }
  const mobs=plan.mob||{};
  h+=`<div class="card"><h2>Mobility</h2><p class="small muted" style="margin:0">The block at the end of each session, matched to what that day loaded. One movement per line; add the dose after a comma.</p><div class="grid3">${[['lift','After lifting'],['dead','After deadlift day'],['hic','After conditioning'],['plyo','After plyos'],['off','Rest days']].map(([k,l])=>`<label class="f">${l}<textarea id="mob-${k}" data-mobday="${k}" rows="6">${esc(mobList(k).map(([n,d])=>d?n+', '+d:n).join('\n'))}</textarea></label>`).join('')}</div></div>`;
  h+=`<div class="card"><h2>Travel week</h2><p class="small muted" style="margin:0">What you do on a week away from the barbell. Add a travel week from the Plan tab: the cycle pauses and picks up after it, and the week stays out of the end-of-cycle review. One movement per line, dose after a comma.</p><div class="grid3">${['day1','day2','day3'].map(k=>`<label class="f">${esc(TRAVEL[k].name)}<textarea id="trv-${k}" data-trvday="${k}" rows="5">${esc(travelList(k).map(([n,d])=>d?n+', '+d:n).join('\n'))}</textarea></label>`).join('')}</div></div>`;
  const accs=plan.acc||{};
  h+=accSetupCard();
  h+=`<div class="card"><h2>Conditioning</h2><p class="small muted" style="margin:0">Your main tool for HIC and LISS days. You can switch activity on any session from its card.</p><label class="f" style="max-width:260px">Climbing counts as distance<div class="row" style="align-items:center;gap:8px">${pIn('elevPer.'+u(),elevPerDist(),'style="max-width:110px"')}<span class="small muted">${elevUnit()} of gain = 1 ${u()==='kg'?'km':'mi'}</span></div></label>
  <label class="f" style="max-width:260px">Default activity<select id="p-cardio" data-pbind="cardio.def">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<option value="${k}"${defMod()===k?' selected':''}>${x.name}</option>`).join('')}</select></label>
  ${(()=>{const b=benchmark()||{};return `<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px"><div class="small muted" style="font-weight:650">Benchmark session</div>
  <p class="small muted" style="margin:4px 0 0">One hard session you repeat to compare against itself. Results only compare within an activity and a format, so if the rest of your conditioning moves around, this is the line worth watching.${b.auto?' Picked for you from what you repeat most — choosing here pins it.':''}</p>
  <div class="grid3"><label class="f">Activity<select id="p-bmod" data-pbind="benchmark.mod">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<option value="${k}"${b.mod===k?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
  <label class="f">Format<select id="p-bfmt" data-pbind="benchmark.fmt">${Object.entries(HIC).filter(([k,x])=>k!=='liss'&&!x.noMetric).map(([k,x])=>`<option value="${k}"${b.fmt===k?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
  <label class="f">Repeat every (days)${pIn('benchEvery',plan.benchEvery)}</label></div></div>`})()}</div>`;
  const ptS=proteinTarget(todayStr());
  {
    const wk=weekOf(todayStr()), cyc=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):null;
    h+=`<div class="card"><h2>Lift variants</h2><p class="small muted" style="margin:0">Which squat and which deadlift this program runs on. Tactical Barbell picks its cluster lifts for a block and keeps them for the block, so this is a per-cycle choice \u2014 and the max you enter above is that lift\u2019s max, used as it stands with no conversion.</p>`;
    for(const k of ['squat','dead']){
      const V=varsOf(k), bv=blockVar(k,todayStr()), def=varDefault(k), m=cyc?maxFor(cyc)[k]:null;
      h+=`<div class="stack" style="gap:8px;margin-top:14px"><div class="small muted" style="font-weight:650">${esc(k==='squat'?'Squat':'Deadlift')}</div>
      <div class="grid2">${cyc?`<label class="f">Cycle ${cyc} (now)<select id="p-cv-${k}" data-pbind="cycleVar.${cyc}.${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===bv?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`:''}
      <label class="f">Later cycles<select id="p-var-${k}" data-pbind="liftVar.${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===def?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>
      <div class="small muted">${esc(V[bv].note)}</div>`;
      if(m) h+=`<div class="small muted">Your ${n(m.v)} ${u()} max is read as a <b>${esc(V[bv].name.toLowerCase())}</b> max.${bv!==varRef(k)?` If that number came from a ${esc(V[varRef(k)].name.toLowerCase())}, the usual equivalent is about <b class="mono">${n(rnd(m.v*V[bv].r,plan.round[k]))}</b> \u2014 change it in Maxes if so.`:''}</div>`;
      const mine=((plan.customVar||{})[k])||[];
      h+=`<details class="plain"><summary>Your own variants <small class="muted">\u00b7 ${mine.length||'none'}</small></summary>
      <p class="small muted" style="margin:8px 0 0">Anything the list is missing: a bar, a tempo, a stance. Give it a name and what share of your ${esc(V[varRef(k)].name.toLowerCase())} it carries \u2014 that is all the program needs to work out the weight. Not sure? Use what you can actually lift on it against what you lift on the ${esc(V[varRef(k)].short.toLowerCase())}.</p>
      ${mine.length?`<div class="stack" style="gap:6px;margin-top:8px">${mine.map((c,i)=>`<div class="row between"><span>${esc(c.name)} <span class="small muted mono">${Math.round(+c.r*100)}%</span>${bv===c.id||def===c.id?' <span class="chip">in use</span>':''}</span><button class="btn sm ghost" data-act="vardel" data-k="${k}" data-i="${i}">Remove</button></div>`).join('')}</div>`:''}
      <div class="grid3" style="margin-top:8px"><label class="f">Name<input type="text" id="cv-name-${k}" placeholder="e.g. Pin squat"></label><label class="f">% of ${esc(V[varRef(k)].short)}<input type="number" inputmode="decimal" id="cv-pct-${k}" placeholder="85"></label><div style="display:flex;align-items:flex-end"><button class="btn" data-act="varadd" data-k="${k}">Add</button></div></div>
      ${cvErr[k]?`<div class="small" style="color:var(--red)">${esc(cvErr[k])}</div>`:''}</details>`;
      h+=`</div>`;
    }
    h+=`<div class="small muted" style="margin-top:14px">Changing the lift mid-cycle is a deviation from the template: the wave builds to heavy weeks on a max you set for a particular lift. For one session \u2014 a taken rack, a sore back \u2014 swap it on the lift\u2019s card on Today instead, and the weight is scaled for you.</div></div>`;
  }
  h+=`<div class="card"><h2>About you</h2><p class="small muted" style="margin:0">Only used for the energy and body-fat estimates on Status. Nothing else in the app reads them, and leaving them blank just hides those estimates.</p>
  <div class="grid4"><label class="f">Sex<select id="p-sex" data-pbind="sex"><option value=""${!plan.sex?' selected':''}>—</option><option value="m"${plan.sex==='m'?' selected':''}>Male</option><option value="f"${plan.sex==='f'?' selected':''}>Female</option></select></label>
  <label class="f">Height (${u()==='kg'?'cm':'in'})${pIn('height',plan.height)}</label>
  <label class="f">Birth year${pIn('birthYear',plan.birthYear)}</label>
  <label class="f">Daily activity<select id="p-act" data-pbind="activity">${ACT.map(([v,l])=>`<option value="${v}"${actFactor()===v?' selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
  <div class="small muted">The formulas: Mifflin-St Jeor for the predicted burn, the US Navy circumference method for body fat. Both are estimates — once you have logged calories and weigh-ins for a few weeks, Status uses your own numbers instead.</div></div>
  <div class="card"><h2>Recovery and nutrition</h2><p class="small muted" style="margin:0">Used by the daily check-in to tailor suggestions.</p><div class="grid3"><label class="f">Goal<select id="p-goal" data-pbind="goal"><option value="lose"${plan.goal==='lose'?' selected':''}>Lose fat</option><option value="maintain"${plan.goal==='maintain'?' selected':''}>Maintain</option><option value="gain"${plan.goal==='gain'?' selected':''}>Build</option></select></label><label class="f">Sleep target (h)${pIn('sleepTarget',plan.sleepTarget)}</label><label class="f">Protein (g per lb)${pIn('proteinPerLb',plan.proteinPerLb)}</label></div><div class="small muted">${ptS?`Daily protein target: <b class="mono">${ptS} g</b> from ${r1(bwFor(todayStr()))} ${u()} bodyweight${(bwAvg(todayStr(),7)||{}).n>1?' (7-day average)':''}.`:'Enter your bodyweight above (or in a check-in) to get a protein target.'} 0.7–1.0 g per lb covers most people training this hard.</div></div>`;
  h+=`<div class="card"><h2>The wave</h2><p class="small muted" style="margin:0">Six weeks, repeating. Sources disagree on weeks 5–6 (some use 3×3 @ 85% and 3×1 @ 95%). Check your copy of the book.</p>
  <p class="small muted" style="margin:0"><b>Up to</b> sets a standing ceiling for a week, and is optional twice over: you can also just tap <b>+</b> on any lift card to add a set on the day. Leave this blank and the week is exactly the sets prescribed. Set it higher and the extra sets show on the lift card as dashed buttons you can take or leave — this is the Operator I/A idea, where you decide the volume session by session. <i>Ageless Athlete</i> allows as many as ten sets per lift, and calls a couple of extra sets the gentlest way to add size. The two-minute rest rule still applies to every set.</p><div class="tbl-wrap"><table class="wavetbl"><thead><tr><th>Week</th><th class="n">Sets</th><th class="n">Up to</th><th class="n">Reps</th><th class="n">%</th><th></th></tr></thead><tbody>${(Array.isArray(plan.wave)?plan.wave:[]).map((v,i)=>`<tr><td><b>${i+1}</b></td><td class="n">${pIn('wave.'+i+'.s',v.s)}</td><td class="n">${pIn('wave.'+i+'.sMax',v.sMax,'placeholder="'+v.s+'"')}</td><td class="n">${pIn('wave.'+i+'.r',v.r)}</td><td class="n">${pIn('wave.'+i+'.p',v.p)}</td><td><span class="chip ${tier(+v.p)}">${{light:'Light',mid:'Medium',heavy:'Heavy'}[tier(+v.p)]}</span></td></tr>`).join('')}</tbody></table></div></div>`;
  {
    const byBook=(+plan.testEvery||0)===2&&(+plan.deloadEvery||0)===0;
    h+=`<div class="card"><h2>Cycles, deloads and retests</h2>
    <div class="row between" style="align-items:center"><span class="small muted">${byBook?'Running the book\u2019s cadence: two cycles, then retest, no scheduled deload.':'Your cadence differs from the book\u2019s.'}</span>${byBook?'<span class="chip light">By the book</span>':'<button class="btn sm" data-act="bookcadence">Match the book</button>'}</div>`;
  }
  h+=`
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Added to the max each new cycle</div><div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k))}${pIn('inc.'+k,plan.inc[k])}</label>`).join('')}</div></div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Scheduled deload week <span style="font-weight:400">\u00b7 not in the book</span></div><p class="small muted" style="margin:0 0 2px">Operator runs its cycles back to back and retests; there is no deload week in it. What the book does prescribe is a full week or more off every three to six months \u2014 add that from the Plan tab when you want it. A scheduled light week is our addition, off by default, and worth having if you are running this year-round.</p><div class="seg">${[[0,'As needed'],[1,'After every cycle'],[2,'After every 2 cycles']].map(([v,l])=>`<button class="segb${(+plan.deloadEvery||0)===v?' on':''}" data-act="deloadevery" data-v="${v}" aria-pressed="${(+plan.deloadEvery||0)===v}">${l}</button>`).join('')}${[0,1,2].includes(+plan.deloadEvery||0)?'':`<button class="segb on" aria-pressed="true">Every ${+plan.deloadEvery} cycles</button>`}</div><div class="small muted">${nextScheduled('deload')}${(+plan.deloadEvery||0)===0?' The app still offers a one-tap deload when readiness is low or sessions run hard, and you can add one from Plan anytime.':''}</div>
  <label class="check"><input type="checkbox" id="p-askdl" data-pbind="askDeload" ${plan.askDeload!==false?'checked':''}> Ask me to confirm this every 2 cycles (weeks 5–6 of cycles 2, 4, 6…)</label></div>
  <label class="f" style="max-width:260px">Retest after every N cycles (0 = never)${pIn('testEvery',plan.testEvery)}</label>
  <p class="small muted" style="margin:0"><b>2 is the book\u2019s recommendation</b> \u2014 two six-week blocks, so twelve weeks between tests, which it calls the optimal length of a strength phase. 1 (six weeks) is the minimum and is offered to experienced lifters who respond better to testing often. Going longer is explicitly fine: if the loads still feel heavy, stay on your current numbers and test when they feel solid.</p>
  <p class="small muted" style="margin:0">A retest week doubles as a deload: 3 easy days, then heavy singles. When both land on the same cycle, the retest wins.</p>
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Deload week lifting</div><div class="grid3"><label class="f">Sets${pIn('deload.s',plan.deload.s)}</label><label class="f">Reps${pIn('deload.r',plan.deload.r)}</label><label class="f">% of max${pIn('deload.p',plan.deload.p)}</label></div></div>
  <div class="banner"><div class="small">Past weeks are locked: changing these rules, the wave or maxes only re-plans from the current week on. Changing the start date or the bridge week re-plans everything, locked weeks included.</div></div></div>`;
  const bk=backups.list;
  h+=syncCard();
  h+=crashCard();
  h+=calFeedCard();
  h+=`<div class="card"><h2>Backups</h2><p class="small muted" style="margin:0">A full copy of your plan and every logged session is saved automatically every Sunday. The last 26 of those are kept, so about six months, and your own backups are counted separately: the newest six you take by hand and the newest six taken before a restore. Taking a few by hand can’t push out the weekly history.</p>
  ${backups.err?`<div class="small muted">${esc(backups.err)}</div>`:!bk?'<div class="small muted">Loading backups…</div>':bk.length?`<div class="tbl-wrap"><table><thead><tr><th>Backup</th><th class="n">Sessions</th><th class="n">Size</th><th></th></tr></thead><tbody>${bk.slice(0,6).map(x=>`<tr><td>${esc(x.name.replace(/-(manual|before-restore(-\d{6})?)$/,''))}${x.name.endsWith('-manual')?' <span class="chip">manual</span>':''}${x.name.includes('-before-restore')?' <span class="chip">before restore</span>':''}</td><td class="n">${x.logs??'—'}</td><td class="n">${x.bytes?Math.max(1,Math.round(x.bytes/1024))+' KB':'—'}</td><td class="n" style="white-space:nowrap"><a class="btn sm ghost" href="/api/backups/${encodeURIComponent(x.name)}">Download</a><button class="btn sm ghost" data-act="restore" data-name="${esc(x.name)}" ${restoreState.busy?'disabled':''}>${restoreState.arm===x.name?'Tap again':'Restore'}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="small muted">No backups yet. The first automatic one runs Sunday.</div>'}
  <div class="row"><button class="btn" data-act="backupnow" ${backups.busy?'disabled':''}>${backups.busy?'Backing up…':'Back up now'}</button><a class="btn ghost" href="/api/export">Download current data</a><label class="btn ghost" for="restore-file">Restore from a file…</label><input type="file" id="restore-file" accept="application/json,.json" hidden></div>
  ${restoreState.file?`<div class="banner warn"><div class="small"><b>Restore ${esc(restoreState.file.name)}?</b> It holds ${restoreState.file.logs} logged day${restoreState.file.logs===1?'':'s'}${restoreState.file.from?' from '+esc(fmtLong(restoreState.file.from.slice(0,10))):''}${restoreState.file.user&&me&&restoreState.file.user!==me?`, saved by <b>${esc(restoreState.file.user)}</b>, not you`:''}. This replaces everything in your account. A safety backup is taken first.</div><div class="row"><button class="btn sm primary" data-act="restorefile" ${restoreState.busy?'disabled':''}>Replace my data with this file</button><button class="btn sm ghost" data-act="restorecancel">Cancel</button></div></div>`:''}
  ${restoreState.msg?`<div class="small">${esc(restoreState.msg)}</div>`:''}
  ${backupCheckLine()}
  <div class="small muted">Restoring replaces your plan, every logged day and archived programs with the backup’s. A “before restore” backup of your current data is saved first, so a restore can be undone.</div></div>`;
  h+=`<div class="card"><h2>Export to a spreadsheet</h2><p class="small muted" style="margin:0">CSV files for Numbers, Excel or Google Sheets, covering every program. <b>Sessions</b>: one row per day (check-in, conditioning, plyos, jumps, notes). <b>Lifts</b>: one row per lift per session (prescribed vs working weight, sets done, grinders, warm-ups, test results).</p><div class="row"><button class="btn" data-act="csv" data-v="sessions">Export sessions</button><button class="btn" data-act="csv" data-v="lifts">Export lifts</button></div></div>`;
  if(!backups.list&&!backups.busy&&!backups.err&&!backups.loading) loadBackups();
  return h;
}
let calc5={};
// Restore: from a listed backup (two taps) or a chosen file (confirm banner).
const restoreState={arm:null,busy:false,msg:null,file:null};
async function doRestore(path,body){
  restoreState.busy=true; restoreState.msg='Restoring…'; render();
  try{
    const r=await api('POST',path,body);
    // Drop anything unsent: it belongs to the data being replaced.
    for(const w of Object.values(writers)) clearTimeout(w.timer);
    for(const k of Object.keys(writers)) delete writers[k];
    outbox={}; saveOutbox();
    const st=await api('GET','/state');
    if(stash){stash=null;viewing=null}
    plan=st.plan?deepMerge(clone(DEF),st.plan):clone(DEF); logs=st.logs||{}; programs=st.programs||{}; planV++; saveCache();
    restoreState.msg=`Restored ${r.restored.logs} logged day${r.restored.logs===1?'':'s'}${r.restored.programs?' and '+r.restored.programs+' archived program'+(r.restored.programs===1?'':'s'):''}${r.from?' from '+fmtLong(String(r.from).slice(0,10)):''}. Your previous data was saved as backup “${r.safetyBackup}”.`;
    restoreState.file=null; backups.list=null; loadBackups();
  }catch(e){ restoreState.msg=e&&e.status===413?'That file is too large to restore.':e&&e.status===400?'That file isn’t a backup this app can restore.':'Restore failed. Check your connection and try again. Nothing was changed.' }
  restoreState.busy=false; restoreState.arm=null; render();
}
document.addEventListener('change',e=>{
  const t=e.target; if(t.id!=='restore-file'||!t.files||!t.files[0]) return;
  const f=t.files[0], rd=new FileReader();
  rd.onload=()=>{ try{ const d=JSON.parse(rd.result); if(!d||typeof d.logs!=='object') throw 0;
      restoreState.file={name:f.name,data:d,logs:Object.keys(d.logs).length,from:d.backedUpAt||d.exportedAt||null,user:d.user||null}; restoreState.msg=null }
    catch(err){ restoreState.file=null; restoreState.msg='That file isn’t a backup this app can restore.' }
    t.value=''; render(); };
  rd.readAsText(f);
});
const backups={list:null,err:null,busy:false,loading:false};
// Every backup is read straight back after it is written and checked against what was
// meant to be stored. "There are backups" and "the backups are good" are different
// claims; this is the second one, and it is worth saying out loud either way.
function backupCheckLine(){
  const c=backups.check;
  if(!c) return '';
  const when=c.at?fmtD(String(c.at).slice(0,10),true):'';
  if(c.ok) return `<div class="small muted">\u2713 Checked ${esc(when)}: the newest backup was read back and matched what it should hold${c.logs!=null?' ('+c.logs+' logged day'+(c.logs===1?'':'s')+')':''}.</div>`;
  return `<div class="banner alert"><div><b>The last backup did not verify.</b> It was written on ${esc(when)} but did not read back as what it should hold. Take one now, and if this keeps happening do not rely on these backups \u2014 use <b>Download current data</b> instead.</div><div><button class="btn sm primary" data-act="backupnow">Back up now</button></div></div>`;
}

async function loadBackups(){
  backups.loading=true;
  try{const r=await api('GET','/backups');backups.list=r.backups;backups.check=r.check||null;backups.err=null}
  catch(e){backups.err=e&&(e.status===401||e.status===403)?'Sign in again to see backups.':navigator.onLine===false?'Backups need a connection.':'Couldn’t load backups.'}
  backups.loading=false; if(view==='setup') render();
}

function vGuide(){
  return `<div class="card guide"><h2>How the week works</h2><p>Operator keeps strength work minimal and sub-maximal so conditioning can carry the real weekly load. Three lifts, three sets, never near failure.</p>
  <dl class="kv"><dt>Mon</dt><dd>Operator Day 1: squat, bench, Lift 3 + accessories</dd><dt>Tue</dt><dd>HIC: MAP</dd><dt>Wed</dt><dd>Operator Day 2: squat, bench, Lift 3 + accessories</dd><dt>Thu</dt><dd>Plyos first, rest 10 min, then HIC: Anaerobic</dd><dt>Fri</dt><dd>Operator Day 3: squat, bench, deadlift + accessories</dd><dt>Sat</dt><dd>HIC: Threshold / Long HIC alternating, or LISS after a heavy week</dd><dt>Sun</dt><dd>Off</dd></dl></div>
  <div class="card guide"><h3>Strength rules</h3><ul class="tight"><li>Sets can range 3–5 depending on what you can handle. Deadlift stays 1–3 sets.</li><li>Minimum 2 min rest between sets; 5 min on heavy squat and deadlift weeks.</li><li>If a set grinds at 70–80%, your max is too high. Lower it rather than pushing through.</li><li>Ramp: skip the 85% single on light weeks; add a 90% single on heavy weeks. Deadlift needs only 2–3 ramp sets; Lift 3 needs one light set of 10 and one at 70%.</li></ul></div>
  <div class="card guide"><h3>Conditioning: Black</h3><div class="tbl-wrap"><table><thead><tr><th>Format</th><th>Session</th><th>System</th></tr></thead><tbody>${Object.values(HIC).map(x=>`<tr><td><b>${x.name}</b></td><td>${x.sess}</td><td class="small muted">${x.sys}</td></tr>`).join('')}</tbody></table></div><ul class="tight"><li>Black sets the dose, not the tool. The ${MOD[defMod()].name.toLowerCase()} is your default; switch activity on any HIC or LISS day (sprints, rower, cycling, ruck, swim and more).</li><li>Keep the format and activity fixed to track progress. Results only compare within the same activity.</li><li>If most sessions are on a bike, watch hip flexors and saddle position: it compounds with squats and deadlifts.</li><li>Running and rucking add impact and back load. On Thursdays, plyos come first, so keep sprint volume low that day.</li></ul>
  <p><b>Optional sets (Operator I/A).</b> K. Black's intermediate/advanced take on Operator hands you the volume decision: rather than a fixed three sets, you work somewhere in a range and choose on the day. Tap <b>+</b> at the end of the sets on any lift card and you get another one, for that lift on that day only — the program is not touched and tomorrow is back to normal. If you want the room there every week instead, give the week an <b>Up to</b> value in Setup. Either way the surplus sets show dashed, and nothing is counted as missed if you skip them. In <i>Ageless Athlete</i> Jim Madden calls this the part of I/A he considers essential, and a few extra sets on weighted pull-ups his favourite way to add upper-body size without derailing recovery. Deadlift has always worked this way here: one set required, up to three.</p>
  <p><b>What this is not.</b> Full Operator I/A also floats your lifting days 48 to 72 hours apart, so the wave advances by session rather than by week. This app runs on a calendar, so it does not do that — and Madden says he mostly keeps a fixed three-sessions-a-week schedule himself, taking his variability in sets and intensity instead. That is the part you have here.</p>
  <p><b>Easy week.</b> Every third week the conditioning load comes down, and it is meant to land on the wave's 90% and 95% weeks so the heavy lifting gets the energy. The app does this for you: fewer rounds, shorter LISS, on weeks 3 and 6 of each cycle. It is not a week you have missed.</p>
  <p><b>FOBBITs.</b> Named for the soldier who never leaves the forward operating base — the session you can run with no ground to cover and barely any kit. You keep moving on an easy base — a pace just under a jog — and step off every two minutes for a set of reps, alternating two movements: twenty kettlebell swings, then ten snatches per arm. Twenty minutes of base is the standard dose; fifteen is the easy version with the reps halved, thirty the hard one. The sets are not on the clock, so the session runs longer than its name. It is an aerobic-based HIC, so it earns its place on a hard day, with one catch worth knowing: <b>run it past 30 minutes and it stops counting as a HIC</b> and becomes an easy session instead, because the intensity is not high enough to hold for that long.</p>
  <p class="small muted">Good for weather, for a hotel, for a day when the bike is taken, and for keeping impact off the legs the day before a heavy squat.</p></div>
  <div class="card guide"><h3>Plyometrics</h3><p>A nervous-system stimulus, not a workout. Quality of each rep matters far more than how many you do: 15 to 20 minutes of actual work, once a week, before HIC and never after. Phases rotate every 3 training weeks. Deload weeks use the extensive session at half volume.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Phase</th><th>Exercise</th><th>Sets × reps</th><th class="n">Contacts</th><th class="n">Rest</th></tr></thead><tbody>${PLYO.map(ph=>ph.ex.map((e,i)=>`<tr><td>${i?'':`<b>${ph.name}</b><br><span class="small muted">~${ph.target}</span>`}</td><td>${esc(e.label)}</td><td class="mono small">${e.s} × ${esc(e.r)}</td><td class="n">${e.c}</td><td class="n">${e.rest>=120?e.rest/60+' min':e.rest+' s'}</td></tr>`).join('')).join('')}</tbody></table></div>
  <ul class="tight"><li><b>Watch distance, not set count.</b> If any jump drops more than ~5% off your first broad jump, the session is over.</li><li><b>Every rep maximal or near it.</b> If you’re breathing hard, you’re doing conditioning.</li><li><b>Cut, don’t skip.</b> After a hard lifting week, halve the contacts.</li><li><b>Counting contacts:</b> one landing = one contact, even on two feet. The volumes are calibrated that way.</li></ul>
  <p><b>Progressing between blocks.</b> Add contacts before you add intensity. Raise intensity by shortening ground contact time, not by jumping higher or adding box height. If your broad jump hasn’t moved after two full blocks, the limiter is usually recovery or strength, not jump volume.</p></div>
  <div class="card guide"><h3>Plyo exercise library</h3><p class="small muted">Setup, execution, cues and the errors that matter. Tap an exercise to open it. The same entries open from Thursday’s card.</p>
  <div class="stack" style="gap:10px">${[['Warm-up drills',['pogo','askip']],['Jump tests',['broad','vertj','triple']],['Extensive',['broad','box','lbound']],['Unilateral + reactive',['cbroad','slhop','bdist','hurdle']],['Elastic',['depth','sllat','bheight']],['Upper body (optional)',['slam','scoop','dbsnatch','highpull','chestpass','plyopush','plyopushbox','speedpress','explpull','bandrow','rotthrow','bandrot']]].map(([g,ids])=>`<div class="stack" style="gap:6px"><h4 style="margin:6px 0 0;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${g}</h4>${ids.map(id=>`<details class="px"><summary><span>${esc(PLIB[id].name)}</span></summary>${plyoEntry(id)}</details>`).join('')}</div>`).join('')}</div></div>
  <div class="card guide"><h3>Base Building</h3><p>Tactical Barbell II's Block I: eight weeks of aerobic base and strength-endurance before you go back to heavy barbell work. Add it from the Plan tab and it runs in place of your next cycle; Operator picks up where it left off afterwards, at the same maxes.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Day</th>${[1,2,3,4,5,6,7,8].map(w=>`<th>W${w}</th>`).join('')}</tr></thead><tbody>${[0,1,2,3,4,5,6].map(d=>`<tr><td>${d+1}</td>${[1,2,3,4,5,6,7,8].map(w=>{const r=BB_WEEKS[w-1][d],k=r[0];return `<td class="small">${k==='se'?'SE '+r[1]+'×'+r[2]:k==='e'?'E '+r[1]+(r[2]?'–'+r[2]:'')+'M':k==='ms'?'Strength':k==='hic'?'HIC':k==='rec'?'Recovery':'Rest'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>
  <ul class="tight"><li>Weeks 1–5 are endurance and strength-endurance dense, with no barbell work at all. That is deliberate: it frees the energy for the long sessions and gives tendons and joints a break before heavy lifting returns.</li><li>Weeks 6–8 taper the long work and bring back two strength days and the aerobic-leaning HIC sessions.</li><li>Every E session is a minimum of 30 minutes. Day 6 is the long one, with a recovery day before it and a rest day after, so push the duration there.</li><li>Recovery days are movement drills, mobility, an easy swim or bike, a walk, yoga, or nothing at all.</li><li>At least one completely free day a week. Walking and pick-up sport are fine.</li><li>Eat for it. The book asks for 1–2 g of protein per pound of bodyweight through the block and is firmly against going low-carb while the volume is up.</li><li><b>Strength-first</b> reverses it: lift for the first five weeks, strength-endurance for the last three. The book doesn't give rep numbers for those late SE weeks, so the app ramps 3×30, 3×40, 3×50.</li></ul></div>
  <div class="card guide"><h3>Strength-endurance circuits</h3><p>Five to eight exercises covering the whole body, done one after another. Do your reps, take a short rest, move to the next. After a full circuit, rest two minutes and go again. The shorter you can make the rests, the better — down to none if you can hold it together.</p>
  <ul class="tight"><li>Reps run 20 to 50. If you can't get them all in one go, rest-pause until they're done, then move on. Failing at 25 now and hitting 40 later is the whole point.</li><li>Barbells and dumbbells: roughly <b>15–30% of your one-rep max</b>. Don't test for it. Too heavy, take weight off.</li><li>Pick movements you can reach without queueing. A busy bench breaks the rests that make this work.</li><li>Avoid anything you can't do for high reps. A rule of thumb: be good for 15–20 reps before putting a movement in. Pull-ups, pistols and one-arm push-ups sit in that grey area.</li><li>One arm or one leg at a time splits the reps: 30 means 15 a side.</li></ul>
  <div class="sm-grid">${Object.entries(SE_CLUSTERS).filter(([k])=>k!=='mine').map(([k,c])=>`<div class="sm"><div class="sm-h"><b>${c.name}</b></div><ul class="tight">${c.ex.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><div class="small muted">${esc(c.note)}</div></div>`).join('')}</div>
  <p class="small muted">Set your own in Setup → Strength-endurance, or switch cluster on any single SE day from the session card.</p></div>
  <div class="card guide"><h3>Accessories</h3>
  <p><b>Jobs, not a list.</b> Each lifting day covers a few jobs — a horizontal pull, some core, a carry, arms — and you choose what does each one. Setup → Accessories sets which jobs a day covers and what fills them. The choice is per cycle, like your cluster lifts, because that is what it is: a programme decision, not something to re-make every session. It is also per day, so a job that comes round three times a week can be a different movement each time.</p>
  <p><b>Swapping on the day.</b> If your biceps slot is barbell curls and the bar is taken, change it on the day’s card. That session uses what you picked and is logged as it, the block’s choice is untouched, and the card marks it <b>today only</b> so you can see at a glance that it was a substitution.</p>
  <p><b>Logging.</b> Sets, weight and reps, like the main lifts, or just <b>Mark done</b> if you would rather not count. Everything is recorded against the job and against the exercise, so a year later the log still says it was hammer curls and not what happens to be in that slot now.</p>
  <p><b>Missing a movement?</b> Setup → Accessories → Your own takes a name, the job it does and the kit it needs. It then appears everywhere the built-in ones do and follows you to your other devices.</p>
  <ul class="tight"><li>After the main lifts, never before. Two or three sets of each job, a couple of reps short of failure.</li><li>Skip entirely on heavy weeks and deloads.</li><li>Legs need almost nothing. Keep the pull-up progression in.</li></ul></div>
  <div class="card guide"><h3>Deloads and retests</h3>
  <p><b>What the book does.</b> Operator runs six-week blocks back to back and retests after two of them — twelve weeks, which it calls the optimal length of a strength phase. Six weeks is the minimum between tests and suits experienced lifters; waiting longer is fine, and if the loads still feel heavy the advice is to keep your current numbers rather than test on schedule. There is no deload week: the recovery it prescribes is a full week or more off every three to six months. Rest two to three days before a test day, ramp up, and take a 3–5 rep max rather than a true single if you prefer — the calculator does the rest.</p>
  <p><b>What we add.</b> An optional scheduled deload, off by default, because a light week every few cycles suits running this year-round outside a unit. Turn it on in Setup if you want it.</p>
  <p>Deload weeks drop to ${plan.deload.s}×${plan.deload.r} @ ${plan.deload.p}% (deadlift 1 set), swap all HIC to LISS, halve plyos and drop accessories. Retest weeks take three easy days, then heavy singles split across Thursday (squat, bench, jumps) and Saturday (deadlift, Lift 3, max pull-ups). Saturday's card feeds results into the next cycle.</p><p>Need a deload sooner? Add one from the Plan tab, or from the warning on Today after repeated hard sessions.</p></div>
  <div class="card guide"><h3>Calendar feed</h3>
  <p>Your plan, subscribed to in the calendar app you already use. Every training day turns up as an all-day entry with the session on it: which lifts, the sets and reps, the percentage and the actual weight to put on the bar. Rest days are left out. It covers eighteen weeks ahead and a fortnight behind, and it is read-only, so nothing you do in your calendar changes your training.</p>
  <p><b>Turning it on.</b> Setup &rarr; Calendar feed &rarr; <b>Turn on the feed</b>. You get a private web address ending in <code>.ics</code>. That address is all anyone needs to read your schedule, so treat it like a password: don\u2019t post it anywhere, and don\u2019t let it into a shared document.</p>
  <p><b>On iPhone or iPad.</b> The quickest way is the <b>Add to iPhone</b> button on that card, which opens Calendar with the address already filled in. Tap Subscribe, then Add. If the button does nothing, copy the address and go to Settings &rarr; Apps &rarr; Calendar &rarr; Calendar Accounts &rarr; Add Account &rarr; Other &rarr; Add Subscribed Calendar, and paste it there. On older versions of iOS the same screen is at Settings &rarr; Calendar &rarr; Accounts.</p>
  <p><b>On Android.</b> Google Calendar can only add a subscription on a computer, not in the phone app. Open <b>calendar.google.com</b>, find <b>Other calendars</b> in the left column, press <b>+</b>, choose <b>From URL</b>, paste the address and press Add calendar. Then open Google Calendar on the phone, go to the menu &rarr; Settings, find the new calendar in the list and turn <b>Sync</b> on. That last step catches people out: until you do it the calendar exists on your account but never appears on the phone.</p>
  <p><b>Putting it at the time you train.</b> By default every session is an all-day entry, which sits at the top of the day and blocks nothing out. On the same Setup card, switch <b>In the calendar</b> to <b>At a set time</b> and give it your usual training time, and each session is booked properly instead: 75 minutes for a lifting day, 90 for a retest, and for conditioning however long the timer says that format actually runs, so a 23-minute MAP session books 23 minutes. If you train later at weekends, put that time in the <b>Saturdays and Sundays</b> box; leave it empty to use the same time all week.</p>
  <p>The time is read as the local time wherever you are. Set 6am and it stays 6am in another country, rather than sliding to 1am because of the time difference. That is what you want for a training time, and it is why the entries carry no timezone.</p>
  <p><b>Reminders.</b> Pick one under <b>Reminder</b> and every session gets an alert: at the start, or 15 minutes, half an hour, one hour or two hours before. The reminder hangs off the session time, so it needs <b>At a set time</b> to mean anything precise. If you would rather keep all-day entries, the one reminder on offer there is <b>8pm the night before</b>, which is the useful one anyway for packing a bag. Reminders are off until you choose one.</p>
  <p><b>How often it updates.</b> The app writes the calendar, not the server, because the schedule is worked out on your phone and a second copy on the server would eventually disagree with it. So the feed is as fresh as the last time you opened the app. Move a week, change a max, swap a lift: open the app once and the calendar follows. Your calendar app then picks the change up on its own schedule. iPhone usually does that within a few hours, and you can force it by pulling down in Calendar. <b>Google is slow</b> and can take most of a day for the first sync and for later changes. That is Google\u2019s refresh interval, not something this app can hurry.</p>
  <p><b>What is in it, and what is not.</b> The feed carries the schedule only: dates, session types, lifts, prescriptions and working weights. It does not carry what you logged, your maxes, bodyweight, measurements, readiness scores or anything about your account. Someone who found the address would learn what you are planning to lift, and nothing else.</p>
  <p><b>If you need to revoke it.</b> <b>New address</b> on the same card issues a fresh one and stops the old address working immediately. Use it if the link gets out. You then have to re-subscribe on your devices, because the old subscription is pointing at an address that no longer exists. <b>Turn off</b> removes the feed entirely.</p>
  <p><b>If the calendar says it cannot connect.</b> Check the address is the current one, since <b>New address</b> invalidates the previous link. If it is right and it still fails, open this app once to make sure the feed has been written, then try again.</p></div>
  <div class="card guide"><h3>Warm-up</h3>${warmupShort()}</div>
  <div class="card guide"><h3>Warm-up and mobility library</h3><p class="small muted">Every movement in the warm-up and the mobility blocks, with what it is for and the ways it usually goes wrong. The same entries open from the checklists on the day.</p>
  <div class="stack" style="gap:10px">${[
    ['Raise and reset',['raise','breath9090','catcow','breathwall']],
    ['Spine and t-spine',['thread','openbook','quadtspine','foamtspine','childlat','deadhang']],
    ['Hips',['hip9090','lean9090','couch','frog','wgs','fig4','pigeon','quadstand']],
    ['Hamstrings and posterior chain',['fold','seatedfold','hamstring']],
    ['Ankles and feet',['calfstraight','calfbent','kneewall','footroll']],
    ['Activation',['legswing','bandpull','glutebridge']]
  ].map(([g,ids])=>`<div><h4 class="sub-h">${esc(g)}</h4><div class="stack" style="gap:6px;margin-top:6px">${ids.map(id=>`<details class="px" data-px="ml-${id}"${openPx.has('ml-'+id)?' open':''}><summary><span>${esc(MLIB[id].name)}</span></summary>${libBody(MLIB[id])}</details>`).join('')}</div></div>`).join('')}</div></div>`;
}

/* ---------------- calendar feed ----------------
A subscribable .ics of the plan, for iPhone Calendar, Google Calendar or anything else
that reads a URL.

The schedule only exists in this file's neighbours -- weeks(), dayPlan(), rx() -- so the
app generates the calendar and the Worker stores and serves the text verbatim. That keeps
one implementation of the programme instead of a second one on the server that could
drift. The cost is that the feed is as fresh as the last time the app was opened, which
for a plan that changes a few times a cycle is no cost at all.

Subscribers cannot sign in, so the feed is addressed by an unguessable token and sits on
the one path that Cloudflare Access has to let through. */

const CAL_BACK = 2, CAL_AHEAD = 18;   // weeks either side of today

function icsEsc(s){return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
// RFC 5545 wants lines folded at 75 octets, continued with a leading space.
function icsFold(line){
  const b=[...line].reduce((a,ch)=>{const w=new TextEncoder().encode(ch).length;const last=a[a.length-1];
    if(last.n+w>74){a.push({s:ch,n:w+1})}else{last.s+=ch;last.n+=w}return a},[{s:'',n:0}]);
  return b.map((x,i)=>i?' '+x.s:x.s).join('\r\n');
}
function icsDate(d){return d.replace(/-/g,'')}
// Floating local time: no Z and no TZID, so 06:00 means 06:00 wherever you happen to be.
// That is what "my usual gym time" means, and it avoids shipping a VTIMEZONE block.
function icsLocal(d,min){const h=Math.floor(min/60),m=min%60;return icsDate(d)+'T'+pad(h)+pad(m)+'00'}
function hhmm(v){const m=/^(\d{1,2}):(\d{2})$/.exec(String(v||''));if(!m)return null;
  const h=+m[1],mi=+m[2];return h<24&&mi<60?h*60+mi:null}
function icsTrigger(min){ if(!min) return '-PT0S'; return min%60===0?'-PT'+(min/60)+'H':'-PT'+min+'M' }

// The feed's timing settings, with anything missing or malformed falling back to sane.
function calOpts(){
  const c=plan.cal||{};
  const alarm=c.alarm==null||c.alarm===''?null:Math.max(0,+c.alarm||0);
  return {timed:c.mode==='timed',start:hhmm(c.time)??360,weekend:hhmm(c.weekend),alarm};
}
// How long to block out. Conditioning asks the interval timer, so the calendar agrees
// with the session card instead of guessing.
function calMins(dp,date){
  if(dp.t==='lift') return 75;
  if(dp.t==='test'||dp.t==='rm5') return 90;
  if(dp.t==='se') return 45;
  let m=0; if(dp.fmt){ try{ m=ivPartsLabel(dp.fmt,ivOpts(date,dp.fmt)).total||0 }catch(e){} }
  if(dp.t==='plyohic') return (m||40)+20;   // plyos first, rest, then the HIC
  return m||45;
}

// One line per lift: what it is, the prescription, and the weight to put on the bar.
function calLiftLines(wk,dp,date){
  const out=[];
  for(const k of dp.lifts||[]){
    const r=rx(wk,k,date);
    const sets=r.sMax>r.s?r.s+'\u2013'+r.sMax:r.s;
    const w=r.w!=null?(isBW(k)?fmtLoad(k,r.w):n(r.w)+' '+u()):null;
    out.push(`${liftName(k,date)} \u2014 ${sets} \u00d7 ${r.r} @ ${r.p}%${w?' \u2014 '+w:''}`);
  }
  return out;
}

// Short labels for the title. liftName gives the variant in full ("High-bar back squat"),
// which is what the description wants and what a phone calendar truncates.
const CAL_SHORT={squat:'Squat',bench:'Bench',dead:'Deadlift',ohp:'Press',pull:'Pulldown',wpu:'Weighted pull-up'};
// What a day is, in a few words, for the event title.
function calTitle(wk,dp,date){
  if(dp.t==='lift'||dp.t==='test'||dp.t==='rm5')
    return `${dp.short} \u00b7 ${(dp.lifts||[]).map(k=>CAL_SHORT[k]||liftName(k,date)).join(', ')}`;
  const fmt=dp.fmt&&HIC[dp.fmt]?HIC[dp.fmt].name:null;
  return fmt?`${dp.short} \u00b7 ${fmt}`:dp.short||'Training';
}

function calEvent(date){
  const wk=weekOf(date); if(!wk) return null;
  const dp=dayPlan(date);
  if(!dp||dp.t==='off'||dp.t==='pre') return null;
  const body=[];
  const wt=weekTitle(wk); if(wt&&wt.t) body.push(wt.t);
  if(dp.t==='lift'||dp.t==='test'||dp.t==='rm5') body.push(...calLiftLines(wk,dp,date));
  if(dp.fmt&&HIC[dp.fmt]) body.push(`${HIC[dp.fmt].name} \u2014 ${HIC[dp.fmt].sess}`);
  if(dp.t==='se'){ const ex=seDayList(date); if(ex&&ex.length) body.push('Circuit: '+ex.join(', ')) }
  if(dp.acc) body.push('Accessories: '+accList(dp.acc).join(', '));
  if(dp.note) body.push(dp.note);
  body.push('operatorblack.com');
  return {date,dp,summary:calTitle(wk,dp,date),desc:body.filter(Boolean).join('\n')};
}

function icsFeed(){
  const mon=mondayOf(todayStr());
  const from=addDays(mon,-7*CAL_BACK), to=addDays(mon,7*CAL_AHEAD);
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Operator + Black//Training plan//EN',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEsc(progName()),
    'X-WR-CALDESC:'+icsEsc('Your Operator + Black plan. Updates when you open the app.'),
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H','X-PUBLISHED-TTL:PT6H'];
  const o=calOpts();
  for(let d=from;d<=to;d=addDays(d,1)){
    const e=calEvent(d); if(!e) continue;
    L.push('BEGIN:VEVENT',
      // Stable per day, so a refresh updates the event instead of adding a second one.
      'UID:ob-'+e.date+'@operatorblack.com',
      'DTSTAMP:'+stamp);
    if(o.timed){
      const wknd=dow(d)>=5&&o.weekend!=null, st=wknd?o.weekend:o.start;
      const end=st+calMins(e.dp,d);
      L.push('DTSTART:'+icsLocal(d,st),
        // Past midnight is possible with a late start, so the end rolls into the next day.
        'DTEND:'+icsLocal(addDays(d,Math.floor(end/1440)),end%1440),
        'TRANSP:OPAQUE');
    } else {
      L.push('DTSTART;VALUE=DATE:'+icsDate(e.date),
        'DTEND;VALUE=DATE:'+icsDate(addDays(e.date,1)),
        'TRANSP:TRANSPARENT');
    }
    L.push('SUMMARY:'+icsEsc(e.summary),'DESCRIPTION:'+icsEsc(e.desc));
    if(o.alarm!=null) L.push('BEGIN:VALARM','ACTION:DISPLAY',
      'DESCRIPTION:'+icsEsc(e.summary),'TRIGGER:'+icsTrigger(o.alarm),'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n')+'\r\n';
}

/* ---------------- talking to the server ---------------- */

let calFeed=null, calBusy=false, calTimer=null;

async function calLoad(){
  try{
    const r=await fetch('/api/calendar',{headers:{accept:'application/json'}});
    if(r.ok){ calFeed=await r.json(); calPush() }
    // The feed needs its own table. If the migration has not been run against the live
    // database this is where it shows up, so say that rather than spinning forever.
    else calFeed={enabled:false,broken:r.status>=500?'db':'http '+r.status};
  }catch(e){ calFeed={enabled:false,broken:'offline'} }
  if(view==='setup') render();
}
async function calSet(op){
  if(calBusy) return; calBusy=true; render();
  try{ const r=await fetch('/api/calendar/'+op,{method:'POST'});
    if(r.ok){ calFeed=await r.json(); LS.set('ob.ics',null) } }
  catch(e){ setStatus('Could not reach the server',true) }
  calBusy=false; render();
  // No debounce here: the card shows the address the moment it exists, so the body has to
  // be there before someone can paste it into a calendar app.
  calPush(true);
}
// Upload the feed only when it has actually changed. The plan moves a few times a cycle
// and the window shifts once a day, so this is normally a no-op.
function calPush(now){
  if(!calFeed||!calFeed.enabled||viewing||schemaAhead) return;
  clearTimeout(calTimer);
  calTimer=setTimeout(async()=>{
    let text; try{ text=icsFeed() }catch(e){ return }
    // DTSTAMP is the time of generation and differs on every call, so compare without it
    // or this would upload an identical calendar every time the app opened.
    const key=icsKey(text);
    if(LS.get('ob.ics')===key) return;
    try{ const r=await fetch('/api/calendar/ics',{method:'PUT',headers:{'content-type':'text/calendar'},body:text});
      if(r.ok) LS.set('ob.ics',key) }catch(e){}
  },now?0:4000);
}

function icsKey(t){return t.replace(/^DTSTAMP:.*$/gm,'')}
function calCount(){ try{ return (icsFeed().match(/BEGIN:VEVENT/g)||[]).length }catch(e){ return 0 } }

function calFeedCard(){
  const f=calFeed;
  let h=`<div class="card"><h2>Calendar feed</h2>
  <p class="small muted" style="margin:0">Put the plan in your phone's calendar: every session with the lifts and the weights on it, either as an all-day entry or booked at the time you usually train. It is read-only and it refreshes on its own, so moving a week here moves it there.</p>`;
  if(!f) return h+`<div class="muted small">Checking\u2026</div></div>`;
  if(f.broken) return h+`<div class="banner warn"><div>${f.broken==='offline'?'Could not reach the server. The feed will show up when you are back online.':'The server could not answer. If this site was just updated, the calendar table may not exist yet \u2014 run <code>npm run db:migrate:remote</code>.'}</div></div></div>`;
  if(!f.enabled){
    h+=`<div class="row"><button class="btn primary" data-act="calon"${calBusy?' disabled':''}>${calBusy?'Working\u2026':'Turn on the feed'}</button></div>
    <div class="small muted">This creates a private web address for your plan. Anyone with the address can read your schedule \u2014 not your logs, maxes or anything else \u2014 so treat it like a password and use <b>New address</b> below if you ever share it by accident.</div></div>`;
    return h;
  }
  const web=f.url.replace(/^https?:/,'webcal:');
  h+=`<label class="f">Your feed address<input type="text" id="cal-url" value="${esc(f.url)}" readonly onclick="this.select()"></label>
  <div class="row"><a class="btn primary" href="${esc(web)}">Add to iPhone</a><button class="btn" data-act="calcopy">Copy address</button></div>
  <div class="small muted"><b>iPhone:</b> tap Add to iPhone above, or Settings \u2192 Apps \u2192 Calendar \u2192 Accounts \u2192 Add Account \u2192 Other \u2192 Add Subscribed Calendar, and paste the address.
  <b>Android:</b> on a computer open Google Calendar \u2192 Other calendars \u2192 + \u2192 From URL, and paste it there. It then syncs to the phone. Google refreshes subscribed calendars on its own schedule, which can take a day.</div>
  ${calTimeFields()}
  <div class="small muted">${calCount()} sessions, ${CAL_BACK} weeks back and ${CAL_AHEAD} ahead. It is rewritten whenever you open the app and something has changed.</div>
  <div class="row"><button class="btn sm ghost" data-act="calrotate"${calBusy?' disabled':''}>New address</button><button class="btn sm ghost" data-act="caloff"${calBusy?' disabled':''}>Turn off</button></div>
  <div class="small muted">New address stops the old one working, for a link you shared and want back.</div></div>`;
  return h;
}

// When the sessions land, and whether they nudge you. Bound straight to the plan, so a
// change syncs to your other devices and queues a fresh upload like any other plan edit.
function calTimeFields(){
  const c=plan.cal||{}, o=calOpts();
  const al=o.alarm==null?'':String(o.alarm);
  const opts=o.timed
    ? [['','No reminder'],['0','At the start'],['15','15 min before'],['30','30 min before'],['60','1 hour before'],['120','2 hours before']]
    : [['','No reminder'],['240','8pm the night before']];
  let h=`<div class="grid2"><label class="f">In the calendar<select id="cal-mode" data-pbind="cal.mode">
    <option value="allday"${o.timed?'':' selected'}>All-day entries</option>
    <option value="timed"${o.timed?' selected':''}>At a set time</option></select></label>`;
  h+=o.timed?`<label class="f">Usual training time<input type="time" id="cal-time" data-pbind="cal.time" value="${esc(c.time||'06:00')}"></label></div>
    <div class="grid2"><label class="f">Saturdays and Sundays<input type="time" id="cal-wk" data-pbind="cal.weekend" value="${esc(c.weekend||'')}" placeholder="same"></label>`
    :'</div><div class="grid2">';
  h+=`<label class="f">Reminder<select id="cal-alarm" data-pbind="cal.alarm" data-type="num">${opts.map(([v,l])=>`<option value="${v}"${v===al?' selected':''}>${l}</option>`).join('')}</select></label></div>`;
  h+=o.timed
    ? `<div class="small muted">Sessions are booked from that time for as long as each one takes: 75 minutes for a lifting day, 90 for a retest, and for conditioning whatever the timer says that format runs to. Leave the weekend box empty to use the same time every day. The time is read as the local time wherever you are, so it stays at ${esc(c.time||'06:00')} when you travel rather than shifting with the clocks.</div>`
    : `<div class="small muted">All-day entries sit at the top of the day and don't block out any time. Switch to <b>At a set time</b> if you want the session in your day properly, or a reminder closer to it than the evening before.</div>`;
  return h;
}

/* ---------------- events ---------------- */
function val(t){ if(t.type==='checkbox') return t.checked; if(t.dataset.type==='num'||t.type==='number') return t.value===''?null:+t.value; return t.value; }
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.accnew){ accNew[t.dataset.accnew]=t.value; return; }
  if(t.dataset.wz&&wz){ const k=t.dataset.wz; if(k.startsWith('maxes.')) wz.maxes[k.slice(6)]=t.value; else wz[k]=k==='start'?(t.value||wz.start):t.value; return; }
  if(t.dataset.np&&newProg){ const k=t.dataset.np; newProg[k]=k==='start'?(t.value?mondayOf(t.value):newProg.start):t.value; newProg.arm=false; newProg.err=null; if(k==='mode') render(); return; }
  if(viewing&&(t.dataset.bind||t.dataset.pbind||t.dataset.cmax||t.dataset.accday)){ readOnly(); return; }
  if(t.dataset.bind){ if(t.dataset.bind.startsWith('hic.')&&!(lg(sel).hic||{}).mod) setPath(logs[sel]||(logs[sel]={date:sel}),'hic.mod',modOf(sel)); setLog(sel,t.dataset.bind,val(t)); }
  else if(t.dataset.pbind){
    let v=val(t);
    if(t.dataset.pbind==='startMonday'){ if(!v) return; v=mondayOf(v); }
    if(t.dataset.pbind==='startMonday'||t.dataset.pbind==='bridge'){ plan.frozen={}; plan.lockedMax={}; plan.order={}; }
    setPlan(t.dataset.pbind,v);
  }
  else if(t.dataset.cmax){ const [c,k]=t.dataset.cmax.split('.'); const v=val(t); plan.cycleMaxes[c]=plan.cycleMaxes[c]||{}; if(v==null) delete plan.cycleMaxes[c][k]; else plan.cycleMaxes[c][k]=v; if(!Object.keys(plan.cycleMaxes[c]).length) delete plan.cycleMaxes[c]; planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.calc){ calc5[t.dataset.calc]=val(t); }
  else if(t.dataset.trvday){ const d=t.dataset.trvday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.lastIndexOf(', ');return i>0?[x.slice(0,i),x.slice(i+2)]:[x,'']}); plan.travel=Object.assign({},plan.travel||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.seex!=null){ const i=+t.dataset.seex, ex=seDayList(sel).slice(); ex[i]=t.value; setLog(sel,'se.ex',ex); }
  else if(t.hasAttribute&&t.hasAttribute('data-seMine')){ const xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean); plan.se=Object.assign({},plan.se,{custom:xs}); planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.mobday){ const d=t.dataset.mobday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.lastIndexOf(', ');return i>0?[x.slice(0,i),x.slice(i+2)]:[x,'']}); plan.mob=Object.assign({},plan.mob||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.accday){ const d=t.dataset.accday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean); plan.acc=Object.assign({},plan.acc||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
});
(function(){
  const tip=document.getElementById('tip');
  const show=el=>{const r=el.getBoundingClientRect();tip.textContent=el.dataset.tip;tip.style.left=(r.left+r.width/2)+'px';tip.style.top=(r.top)+'px';tip.hidden=false};
  const hide=()=>{tip.hidden=true};
  document.addEventListener('pointerover',e=>{const el=e.target.closest&&e.target.closest('.ch-hit');el?show(el):hide()});
  document.addEventListener('focusin',e=>{const el=e.target.closest&&e.target.closest('.ch-hit');el?show(el):hide()});
  window.addEventListener('scroll',hide,{passive:true});
})();
document.addEventListener('toggle',e=>{const d=e.target;if(!d.matches)return;if(d.dataset&&d.dataset.px){d.open?openPx.add(d.dataset.px):openPx.delete(d.dataset.px);return}if(d.matches('details.wu')){d.open?openWarm.add(d.dataset.lift):openWarm.delete(d.dataset.lift)}else if(d.id&&d.id.startsWith('ci-')){const k=d.id.slice(3);d.open?openCI.add(k):openCI.delete(k)}},true);
document.addEventListener('change',e=>{ const t=e.target;
  if(t.dataset&&t.dataset.actAccadd){
    const d=t.dataset.actAccadd, k=t.value; if(!k||!ASLOT[k]) return;
    mutatePlan(p=>{p.accSlots=Object.assign({},p.accSlots||{},{[d]:[...accSlots(d),k]})});
    return;
  }
  if(t.dataset&&t.dataset.actAccpick){
    const [day,sl]=t.dataset.actAccpick.split(':'), cyc=accCycleOf(todayStr());
    if(accLater||cyc==null){ setPlan('accPick.'+day+'.'+sl,t.value); render(); return }
    mutatePlan(p=>{const c=Object.assign({},p.accCycle||{});
      c[cyc]=Object.assign({},c[cyc]||{},{[day]:Object.assign({},(c[cyc]||{})[day]||{},{[sl]:t.value})});
      p.accCycle=c});
    return;
  }
  if(t.dataset&&t.dataset.actAcc){
    const sl=t.dataset.actAcc, v=t.value;
    // Only a real difference from the block's choice is worth storing as a swap.
    setLog(sel,'acc.ex.'+sl, v===accPickFor(accDayOf(sel),sl,accCycleOf(sel))?null:v);
    render(); return;
  }
  if(t.dataset&&t.dataset.actVar){ const k=t.dataset.actVar,v=t.value; if(v!==varOf(k,sel)){ const cur=(lg(sel).var)||{}; setLog(sel,'var',Object.assign({},cur,{[k]:v===varDefault(k)?null:v})); openWarm.clear(); } render(); return; } });
document.addEventListener('change',e=>{ const t0=e.target; if(t0.dataset&&t0.dataset.actChange){ setLog(sel,'hic.iv.'+(t0.dataset.actChange==='ivwarm'?'warm':'cool'),t0.checked); render(); return; } });
document.addEventListener('change',e=>{ const t=e.target; if(t.dataset.bind||t.dataset.pbind||t.dataset.cmax||t.dataset.calc||t.dataset.accday||t.dataset.mobday||t.dataset.trvday||t.dataset.np) render(); });
// Top-level navigation: the tabs and the account menu. Remembers the tab across loads.
function goView(v){view=v;try{localStorage.setItem('ob.view',view)}catch(err){}render();window.scrollTo(0,0)}
document.getElementById('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(!b)return;goView(b.dataset.view)});
document.getElementById('main').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act;
  if(a==='progview'){enterArchive(b.dataset.id);return}
  if(a==='progexit'){exitArchive();return}
  // an archived program is read-only: only navigation works
  if(a==='csv'){exportCsv(b.dataset.v);return}
  if(a==='dlcheck'){const wk=weekOf(sel),c=wk&&wk.cycle,v=b.dataset.v;if(!c)return;replan(v==='keep'?'Deload setting kept':'Deload every '+v+' cycles',p=>{if(v!=='keep')p.deloadEvery=+v;p.deloadChecks=Object.assign({},p.deloadChecks||{},{[c]:{at:realToday(),choice:v==='keep'?+p.deloadEvery||0:+v}})});return}
  if(a==='platetoggle'){const v=+b.dataset.v,cur=plateSet();const next=cur.includes(v)?cur.filter(x=>x!==v):[...cur,v];if(!next.length)return;mutatePlan(p=>{p.plates=Object.assign({},p.plates||{},{[u()]:next.sort((a,b)=>b-a)})});return}
  if(a==='bookcadence'&&!viewing){replan('Set to the book\u2019s cadence',p=>{p.testEvery=2;p.deloadEvery=0});return}
  if(a==='deloadevery'&&!viewing){const v=+b.dataset.v;if((+plan.deloadEvery||0)===v)return;replan(v?'Deload every '+v+' cycles':'Deloads off',p=>{p.deloadEvery=v});return}
  if(viewing&&!['go','open','view','more','updcheck','updnow','rvsel'].includes(a)){readOnly();return}
  if(a==='prognew'){newProg={name:'Block '+((plan.programSeq||1)+1),start:addDays(mondayOf(realToday()),7),mode:'carry'};render();return}
  if(a==='progcancel'){newProg=null;render();return}
  if(a==='progstart'){if(!newProg.arm){newProg.arm=true;newProg.err=null;render();setTimeout(()=>{if(newProg&&newProg.arm){newProg.arm=false;render()}},4000);return} startProgram();return}
  if(a==='go'){sel=b.dataset.date;openWarm.clear();openPx.clear();render();return}
  if(a==='open'){sel=b.dataset.date;view='today';render();window.scrollTo(0,0);return}
  if(a==='bwrange'){LS.set('ob.bwRange',b.dataset.v);render();return}
  if(a==='view'){view=b.dataset.view;render();window.scrollTo(0,0);return}
  if(a==='ci'){const f=b.dataset.f,raw=b.dataset.v,v=/^\d+(\.\d+)?$/.test(raw)?+raw:raw;setLog(sel,'checkin.'+f,ci(sel)[f]==v?null:v);render();return}
  if(a==='wu'||a==='wurm'||a==='wuadd'){
    const k=b.dataset.lift,i=+b.dataset.i,W=wuList(k).map(x=>x?Object.assign({},x):{});
    if(a==='wuadd') W.push({});
    else if(a==='wurm') W.splice(i,1);
    else {
      const x=W[i]||(W[i]={}); x.done=!x.done;
      // logging a set as suggested stores the suggested numbers, so history shows real weights
      if(x.done){const ins=b.parentNode.querySelectorAll('input');if(x.w==null||x.w==='')x.w=ins[0].placeholder!==u()&&ins[0].placeholder!==''?+ins[0].placeholder:null;if(x.r==null||x.r==='')x.r=ins[1].placeholder!=='reps'?+ins[1].placeholder:null}
    }
    for(let j=0;j<W.length;j++) if(!W[j]) W[j]={};
    openWarm.add(k); setLog(sel,'lifts.'+k+'.warmup',W); render(); return}
  if(a==='set'){const k=b.dataset.lift,i=+b.dataset.i;const L=lg(sel);const arr=((L.lifts||{})[k]||{}).sets?[...L.lifts[k].sets]:[];
    offerUndo((arr[i]?'Set unticked':'Set ticked')+' · '+liftName(k),snapLog(sel));
    arr[i]=!arr[i];for(let j=0;j<arr.length;j++)if(arr[j]==null)arr[j]=false;setLog(sel,'lifts.'+k+'.sets',arr);
    if(arr[i]){popKey=k+':'+i;setTimeout(()=>{popKey=null},400)}
    if(arr[i]&&sel===todayStr()){unlockAudio();const nx=nextAfterSet(k,arr);if(nx!==undefined)startRest(k,nx);else stopRest()}
    render();return}
  if(a==='addset'||a==='rmset'){
    const k=b.dataset.lift, snap=snapLog(sel);
    if(addSet(k,a==='addset'?1:-1)){ offerUndo((a==='addset'?'Set added · ':'Set removed · ')+liftName(k),snap); render() }
    return}
  if(a==='reload'){ location.reload(); return }
  if(a==='errclear'){ crashClear(); return }
  if(a==='syncclear'){ clearConflicts(); return }
  if(a==='accadd'||a==='accrm'){
    const sl=b.dataset.slot, cur=accSets(sel,sl).slice();
    if(a==='accadd') cur.push({}); else cur.splice(+b.dataset.i,1);
    setLog(sel,'acc.sets.'+sl,cur);
    // Logging a set is itself the record that it happened; drop the manual tick.
    if(cur.length) setLog(sel,'acc.done.'+sl,null);
    render();return}
  if(a==='acclater'){ accLater=b.dataset.v==='1'; render(); return }
  if(a==='accslotrm'){
    const d=b.dataset.day, cur=accSlots(d).filter(x=>x!==b.dataset.slot);
    mutatePlan(p=>{p.accSlots=Object.assign({},p.accSlots||{},{[d]:cur})});
    return}
  if(a==='accmineAdd'){
    const name=(accNew.name||'').trim(); if(!name) return;
    const id='mine-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)+'-'+Math.random().toString(36).slice(2,6);
    mutatePlan(p=>{p.accCustom=[...(Array.isArray(p.accCustom)?p.accCustom:[]),{id,slot:accNew.slot,name,gear:(accNew.gear||'').trim()}]});
    accNew={name:'',slot:accNew.slot,gear:''}; render();
    return}
  if(a==='accmineRm'){
    const id=b.dataset.id;
    mutatePlan(p=>{p.accCustom=(Array.isArray(p.accCustom)?p.accCustom:[]).filter(x=>x&&x.id!==id)});
    return}
  if(a==='accdone'){
    const sl=b.dataset.slot;
    setLog(sel,'acc.done.'+sl,accDone(sel,sl)?null:true);
    render();return}
  if(a==='errcopy'){
    const text=crashReport();
    const done=()=>{ b.textContent='Copied'; setTimeout(()=>{b.textContent='Copy all details'},1500) };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done,()=>{});
    return}
  if(a==='calon'||a==='caloff'||a==='calrotate'){ calSet(a==='calon'?'on':a==='caloff'?'off':'rotate'); return }
  if(a==='calcopy'){
    const el=document.getElementById('cal-url'); if(!el) return;
    const done=()=>{ b.textContent='Copied'; setTimeout(()=>{b.textContent='Copy address'},1500) };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done,()=>{el.select()});
    else { el.select(); try{document.execCommand('copy');done()}catch(e){} }
    return}
  if(a==='rvsel'){reviewSel[b.dataset.lift]=b.dataset.v;render();return}
  if(a==='rvapply'||a==='rvdismiss'){
    const c=+b.dataset.c;
    if(a==='rvapply'){
      const {stats,readiness:rdAvg}=cycleStats(c), mx=maxFor(c), chosen={};
      offerUndo('Cycle review applied',snapPlan());
      for(const k of activeLifts()){ if(!mx[k]) continue; const ch=reviewSel[k]||((((plan.cycleMaxes||{})[c+1]||{})[k]!=null)?'keep':recommend(stats[k],rdAvg)[0]); if(ch!=='keep') chosen[k]=reviewOptions(k,mx[k].v)[ch]; }
      mutatePlan(p=>{p.cycleMaxes[c+1]=Object.assign({},p.cycleMaxes[c+1]||{},chosen);p.reviews=Object.assign({},p.reviews||{},{[c]:{at:todayStr(),set:chosen}})});
    } else mutatePlan(p=>{p.reviews=Object.assign({},p.reviews||{},{[c]:{at:todayStr(),dismissed:true}})});
    reviewSel={}; return}
  if(a==='updcheck'){checkUpdate(true);return}
  if(a==='updnow'){applyUpdate();return}
  if(a==='alerton'){enableAlerts();return}
  if(a==='alertoff'){disableAlerts();return}
  if(a==='alerttest'){testAlert();return}
  if(a==='voicetest'){unlockAudio();setTimeout(()=>say('Rest over. Next: squat, set two.'),120);return}
  if(a==='restore'){const nm=b.dataset.name;if(restoreState.arm!==nm){restoreState.arm=nm;restoreState.msg=null;render();setTimeout(()=>{if(restoreState.arm===nm){restoreState.arm=null;render()}},4000);return}doRestore('/backups/'+encodeURIComponent(nm)+'/restore');return}
  if(a==='restorefile'){if(restoreState.file) doRestore('/restore',restoreState.file.data);return}
  if(a==='restorecancel'){restoreState.file=null;render();return}
  if(a==='backupnow'){backups.busy=true;render();api('POST','/backups').then(()=>{backups.busy=false;backups.list=null;loadBackups()}).catch(()=>{backups.busy=false;backups.err='Backup failed. Check your connection and try again.';render()});return}
  if(a==='lsstart'){lsStart();return}
  if(a==='wzset'){const k=b.dataset.k,v=b.dataset.v;wz[k]=(k==='deload'||k==='test')?+v:v;render();return}
  if(a==='wzl3'){const k=b.dataset.v;wz.l3[k]=!wz.l3[k];if(!L3K.some(x=>wz.l3[x]))wz.l3.pull=true;render();return}
  if(a==='wznext'){wz.step=Math.min(WZ_STEPS.length-1,wz.step+1);render();window.scrollTo(0,0);return}
  if(a==='wzback'){wz.step=Math.max(0,wz.step-1);render();return}
  if(a==='wzdone'){wzFinish();return}
  if(a==='wzcancel'){wz=null;render();return}
  if(a==='wzskip'){mutatePlan(p=>{p.onboarded=true;if(!st0Saved())p.startMonday=nextMonday()});wz=null;render();return}
  if(a==='wzrerun'){wz=wzNew(true);render();window.scrollTo(0,0);return}
  if(a==='ivopt'){if(ivOpts(sel,effFmt(sel))[b.dataset.k]===+b.dataset.v)return;setLog(sel,'hic.iv.'+b.dataset.k,+b.dataset.v);render();return}
  if(a==='ivstart'){ivStart(b.dataset.f);render();return}
  if(a==='mod'){if(modOf(sel)===b.dataset.v)return;setLog(sel,'hic.mod',b.dataset.v);render();return}
  // choices that are already selected save nothing (no empty log entries)
  if(a==='mlib'){const k=b.dataset.k;openPx.has(k)?openPx.delete(k):openPx.add(k);render();return}
  if(a==='minplan'){setLog(sel,'hic.min',+b.dataset.v);render();return}
  if(a==='varadd'){
    const k=b.dataset.k, nm=(document.getElementById('cv-name-'+k)||{}).value, pct=+(document.getElementById('cv-pct-'+k)||{}).value;
    const name=(nm||'').trim();
    cvErr[k]=!name?'Give it a name.':!(pct>=25&&pct<=150)?'The percentage should be between 25 and 150.':
      Object.values(varsOf(k)).some(x=>x.name.toLowerCase()===name.toLowerCase())?'There is already a variant with that name.':'';
    if(!cvErr[k]){
      const id='c'+Date.now().toString(36);
      mutatePlan(p=>{p.customVar=Object.assign({},p.customVar||{});p.customVar[k]=[...(p.customVar[k]||[]),{id,name,short:name.length>12?name.slice(0,11)+'\u2026':name,r:pct/100}]});
      const el=document.getElementById('cv-name-'+k); if(el) el.value='';
      const el2=document.getElementById('cv-pct-'+k); if(el2) el2.value='';
    }
    render(); return;
  }
  if(a==='vardel'){
    const k=b.dataset.k, i=+b.dataset.i, gone=(((plan.customVar||{})[k])||[])[i];
    if(!gone) return;
    offerUndo('Removed '+gone.name,snapPlan());
    mutatePlan(p=>{
      p.customVar=Object.assign({},p.customVar||{});
      p.customVar[k]=(p.customVar[k]||[]).filter((_,j)=>j!==i);
      if((p.liftVar||{})[k]===gone.id) p.liftVar=Object.assign({},p.liftVar,{[k]:null});
      for(const c of Object.keys(p.cycleVar||{})) if((p.cycleVar[c]||{})[k]===gone.id) p.cycleVar[c]=Object.assign({},p.cycleVar[c],{[k]:null});
    });
    return;
  }
  if(a==='varswap'){const k=b.dataset.k,v=b.dataset.v;if(v===varOf(k,sel))return;const cur=(lg(sel).var)||{};setLog(sel,'var',Object.assign({},cur,{[k]:v===varDefault(k)?null:v}));openWarm.clear();render();return}
  if(a==='l3swap'){const v=b.dataset.v;if(v===l3For(sel))return;setLog(sel,'l3',v===l3Auto(sel)?null:v);openWarm.clear();render();return}
  if(a==='planmode'){planMode=b.dataset.v;try{localStorage.setItem('ob.planmode',planMode)}catch(e){}render();window.scrollTo(0,0);return}
  if(a==='calre'){calRe=!calRe;calMove=null;render();return}
  if(a==='calcancel'){calMove=null;render();return}
  if(a==='calpick'){
    const d=b.dataset.date, mon=mondayOf(d);
    if(!calMove||calMove.ord){calMove={from:d};render();return}
    if(calMove.from===d){calMove=null;render();return}
    if(mondayOf(calMove.from)!==mon) return;
    const r=bestOrder(mon,dow(d),slotOf(calMove.from));
    if(!r) return;
    calMove={from:calMove.from,to:d,ord:r.ord,moved:r.moved};
    render(); return;
  }
  if(a==='calapply'){
    if(!calMove||!calMove.ord) return;
    const mon=mondayOf(calMove.from), ord=calMove.ord;
    offerUndo('Days moved',snapPlan());
    mutatePlan(p=>{p.order=Object.assign({},p.order||{},{[mon]:ord})});
    calMove=null; openWarm.clear(); openPx.clear(); render(); return;
  }
  if(a==='calm'){const v=+b.dataset.v;if(!v)calMonth=realToday().slice(0,7);else{const y=+calMonth.slice(0,4),m=+calMonth.slice(5,7)+v;calMonth=S(Date.UTC(y,m-1,1)).slice(0,7)}render();return}
  if(a==='move'){moveOpen=!moveOpen;render();return}
  if(a==='movex'){moveOpen=false;render();return}
  if(a==='swap'){
    const mon=mondayOf(sel), r=bestOrder(mon,dow(sel),+b.dataset.sl); if(!r) return;
    offerUndo('Days moved',snapPlan());
    mutatePlan(p=>{p.order=Object.assign({},p.order||{},{[mon]:r.ord})});
    moveOpen=false; openWarm.clear(); openPx.clear(); render(); return;
  }
  if(a==='ordreset'){const mon=mondayOf(sel);offerUndo('Week order reset',snapPlan());mutatePlan(p=>{const o=Object.assign({},p.order||{});delete o[mon];p.order=o});moveOpen=false;render();return}
  if(a==='guide'){gdStart(b.dataset.k);return}
  if(a==='theme'){LS.set('ob.theme',b.dataset.v);applyTheme();render();return}
  if(a==='gym'){LS.set('ob.gym',!gymOn());applyTheme();render();return}
  if(a==='weekseen'){mutatePlan(p=>{p.weekSeen=mondayOf(todayStr())});return}
  if(a==='hold'){startHold(b.dataset.n,+b.dataset.s,+b.dataset.sides||1,1);render();return}
  if(a==='wshort'){const v=b.dataset.v==='1';if(!!lg(sel).warmShort===v)return;setLog(sel,'warmShort',v);render();return}
  if(a==='wclear'){offerUndo('Warm-up cleared',snapLog(sel));setLog(sel,'warmup',[]);render();return}
  if(a==='mclear'){offerUndo('Mobility cleared',snapLog(sel));setLog(sel,'mobility',[]);render();return}
  if(a==='pwu'){const i=+b.dataset.i,arr=[...((lg(sel).plyo||{}).warm||[])];arr[i]=!arr[i];for(let j=0;j<arr.length;j++)if(arr[j]==null)arr[j]=false;setLog(sel,'plyo.warm',arr);render();return}
  if(a==='plyoupper'){mutatePlan(p=>{p.plyoUpper=!p.plyoUpper});return}
  if(a==='upset'){
    const i=+b.dataset.i,j=+b.dataset.j, L=(lg(sel).plyo||{}).up||{}, arr=[...((L[i])||[])];
    arr[j]=!arr[j]; for(let x=0;x<arr.length;x++) if(arr[x]==null) arr[x]=false;
    offerUndo('Throw set '+(arr[j]?'ticked':'unticked'),snapLog(sel));
    setLog(sel,'plyo.up.'+i,arr);
    if(arr[j]&&sel===todayStr()){const wk=weekOf(sel),e=plyoUpperEx(plyoUpperPhase(wk))[i];unlockAudio();startRest(null,null,e.rest,'Rest · '+e.label)}
    render();return}
  if(a==='pset'){
    const i=+b.dataset.i,j=+b.dataset.j, wk=weekOf(sel), dp=dayPlan(sel), ph=plyoPhase(wk), L=lg(sel).plyo||{}, cut=!!(dp.plyoCut||L.cut);
    const arr=[...(((L.sets||[])[i])||[])]; arr[j]=!arr[j]; for(let x=0;x<arr.length;x++) if(arr[x]==null) arr[x]=false;
    setLog(sel,'plyo.sets.'+i,arr);
    if(arr[j]&&sel===todayStr()){
      unlockAudio(); const e=ph.ex[i]; let next=null;
      const firstOpen=a=>{for(let x=0;x<plyoSets(ph.ex[a],cut);x++) if(!(((lg(sel).plyo||{}).sets||[])[a]||[])[x]) return x; return -1};
      const fo=firstOpen(i); if(fo>=0) next=e.label+' · set '+(fo+1);
      else for(let a2=i+1;a2<ph.ex.length;a2++){const f2=firstOpen(a2);if(f2>=0){next=ph.ex[a2].label+' · set '+(f2+1);break}}
      if(next) startRest(null,next,e.rest,'Rest · '+e.label);
      else startRest(null,'HIC: '+HIC[effFmt(sel)].name,600,'Rest before HIC');
    }
    render();return}
  if(a==='warmrest'){const k=b.dataset.lift,v=+b.dataset.v;if(warmRestSecs(k)===v)return;mutatePlan(p=>{p.warmRest=Object.assign({},p.warmRest,{[k]:v})});
    if(rest&&rest.ramp&&rest.k===k&&!rest.done){const el=Date.now()-(rest.end-rest.dur*1000);rest.dur=v;rest.end=Date.now()-el+rest.dur*1000;LS.set('ob.rest',rest);tickRest();syncPush()}
    return}
  if(a==='sfeel'){const v=b.dataset.v;setLog(sel,'feel',lg(sel).feel===v?null:v);render();return}
  if(a==='spain'){const v=b.dataset.v,same=lg(sel).pain===v;setLog(sel,'pain',same?null:v);if(!same&&v==='none')setLog(sel,'painAt',[]);render();return}
  if(a==='spainat'){const k=b.dataset.v,cur=painAt(lg(sel));setLog(sel,'painAt',cur.includes(k)?cur.filter(x=>x!==k):[...cur,k]);render();return}
  if(a==='bbadd'){
    const mon=b.dataset.monday, ver=b.dataset.ver==='strength'?'strength':'standard';
    if(mon<mondayOf(realToday())) return;
    offerUndo('Base Building added · 8 weeks from '+fmtD(mon),snapPlan());
    mutatePlan(p=>{p.inserts=Object.assign({},p.inserts,{[mon]:'bb'});p.bbVer=Object.assign({},p.bbVer,{[mon]:ver})});
    return}
  if(a==='bbremove'){
    // find the block's first week, then drop the insert that starts it
    const list=weeks(), i=list.findIndex(w=>w.monday===b.dataset.monday);
    let s=i; while(s>0&&list[s-1].kind==='bb'&&list[s].w>1) s--;
    const mon=list[s].monday;
    offerUndo('Base Building removed',snapPlan());
    mutatePlan(p=>{const ins=Object.assign({},p.inserts),v=Object.assign({},p.bbVer);delete ins[mon];delete v[mon];p.inserts=ins;p.bbVer=v});
    return}
  if(a==='sedef'){const v=b.dataset.v;mutatePlan(p=>{p.se=Object.assign({},p.se,{cluster:v})});return}
  if(a==='secl'){const v=b.dataset.v;if(seCluster(sel)===v&&!seEdited(sel))return;seEdit=null;setLog(sel,'se.cluster',v);setLog(sel,'se.ex',null);render();return}
  if(a==='serest'){const v=+b.dataset.v;if(seRestSecs()===v)return;mutatePlan(p=>{p.se=Object.assign({},p.se,{rest:v})});return}
  if(a==='seedit'){const i=+b.dataset.i;seEdit=seEdit===i?null:i;render();return}
  if(a==='seput'||a==='serm'||a==='seadd'){
    const i=+b.dataset.i, ex=seDayList(sel).slice(), done=seDone(sel).map(r=>Array.isArray(r)?r.slice():[]);
    if(a==='seput') ex[i]=b.dataset.v;
    else if(a==='serm'){ ex.splice(i,1); done.splice(i,1); seEdit=null; }
    else { ex.push('New exercise'); seEdit=ex.length-1; }
    setLog(sel,'se.ex',ex); setLog(sel,'se.done',done);
    if(a==='seput') seEdit=null;
    render();return}
  if(a==='sereset'){seEdit=null;setLog(sel,'se.ex',null);render();return}
  if(a==='setick'){
    const i=+b.dataset.i,j=+b.dataset.j,dp=dayPlan(sel),ex=seList(seCluster(sel));
    const done=seDone(sel).map(r=>Array.isArray(r)?r.slice():[]);
    while(done.length<ex.length) done.push([]);
    const row=done[i]; while(row.length<dp.circuits) row.push(false);
    row[j]=!row[j]; setLog(sel,'se.done',done);
    if(row[j]&&sel===todayStr()){
      unlockAudio();
      const last=i===ex.length-1, nextName=last?ex[0]:ex[i+1];
      if(last&&j+1<dp.circuits) startRest(null,'Circuit '+(j+2)+' · '+nextName,120,'Rest · circuit done');
      else if(!last&&seRestSecs()) startRest(null,nextName,seRestSecs(),'Rest · '+ex[i]);
      else if(last) stopRest();
    }
    render();return}
  if(a==='restmin'){const k=b.dataset.lift,m=+b.dataset.v;if(restMins(k)===m)return;mutatePlan(p=>{p.rest=Object.assign({},p.rest,{[k]:m})});
    if(rest&&rest.k===k&&!rest.done){const el=Date.now()-(rest.end-rest.dur*1000);rest.dur=m*60;rest.end=Date.now()-el+rest.dur*1000;LS.set('ob.rest',rest);tickRest();syncPush()}
    return}
  if(a==='done'){offerUndo(lg(sel).done?'Session reopened':'Session marked done',snapLog(sel));setLog(sel,'done',!lg(sel).done);render();return}
  if(a==='lower'){const k=b.dataset.lift,c=b.dataset.c;const m=maxFor(+c)[k];if(!m)return;offerUndo('Lowered the '+liftName(k)+' max',snapPlan());mutatePlan(p=>{p.cycleMaxes[c]=p.cycleMaxes[c]||{};p.cycleMaxes[c][k]=floorTo(m.v*.95,p.round[k])});return}
  if(a==='insert'){replan((b.dataset.kind==='deload'?'Deload':b.dataset.kind==='test'?'Retest':b.dataset.kind==='travel'?'Travel':'Off')+' week added',p=>{p.inserts[b.dataset.monday]=b.dataset.kind});return}
  if(a==='uninsert'){replan('Week removed',p=>{delete p.inserts[b.dataset.monday]});return}
  if(a==='skip'){replan('Week skipped',p=>{p.skips[b.dataset.rule]=true});return}
  if(a==='unskip'){replan('Week restored',p=>{delete p.skips[b.dataset.rule]});return}
  if(a==='more'){planShow+=26;render();return}
  if(a==='applytest'){const wk=weekOf(b.dataset.monday),res=weekResults(wk,'test'),nc=wk.nextCycle;if(!nc)return;offerUndo('Results applied to Cycle '+nc,snapPlan());mutatePlan(p=>{p.cycleMaxes[nc]=Object.assign({},p.cycleMaxes[nc]||{},res)});return}
  if(a==='savemaxes'){const wk=weekOf(b.dataset.monday),res=weekResults(wk,'test');offerUndo('Maxes saved',snapPlan());mutatePlan(p=>{Object.assign(p.maxes,res)});return}
  if(a==='calc5'){mutatePlan(p=>{for(const k of LK) if(calc5[k]) p.maxes[k]=floorTo(calc5[k]/.87,p.round[k])});calc5={};return}
});

applyTheme();
loadLocal();
render();
if(rest) showRest();
if(gt && Date.now() - (gt.mode === 'down' ? gt.end : gt.start) > GT_STALE_MS){ gt = null; LS.set('ob.gt', null) }
if(gt) gtShow();
if(iv&&Date.now()-iv.start>3*3600*1000){iv=null;LS.set('ob.iv',null)}
if(iv) ivShow();
if(ls&&ls.date!==realToday()){ls=null;LS.set('ob.ls',null)}
if(ls) lsShow();
if(guide&&guide.date!==realToday()){guide=null;LS.set('ob.guide',null)}
if(guide) gdShow();
connect();
calLoad();
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
setTimeout(()=>checkUpdate(false),2000);
})();
