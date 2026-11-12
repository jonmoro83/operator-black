/* ---------------- Mountain Tactical Institute's conditioning sessions ----------------
Nineteen sessions from MTI's article archive, the same archive the coach reads. They sit
in the format list beside Tactical Barbell II's, and are filed into the book's own
categories by the rule the book gives for bringing in sessions from elsewhere (TB II
p189): a high-intensity session is a HIC, one done for time or with several tools is
general conditioning, and a long steady one is an E. `tb` is that filing; `cat` is 'mti'
so nothing that lists the book's own groups picks these up by accident.

The prescriptions are MTI's, paraphrased, each from the article named in `a`. Where the
article gives no round count (`rx` below says so) the timer's count is the app's. MTI's
assessment-based sessions, the ones that need a test before you can do them, are left
out until the app can run a test with them. */
const MTI_SHUT='MTI’s Favorite Shuttle Sprint Formats for Work Capacity Programming (2019)';
const MTI_DUR='MTI’s Favorite Work Capacity Events by Duration (2017)';
const MTI_PROVEN='Most Proven Work Capacity Training Events by Athlete (2017)';
const MTI_BEEP='Mini Study: Fixed-Interval Beep Test Progression (2025)';
const HIC_MTI={
  m40:{tb:'aa',name:'40-ft Shuttle Intervals',sys:'Aerobic / anaerobic',gear:'40 ft of floor',a:MTI_SHUT,
    sess:'30 s shuttles / 30 s rest × 10–20',
    lines:['Two lines about 40 ft apart','Shuttle for 30 s, touching the line with a hand at each end','Rest 30 s','10 to 20 rounds'],
    basic:'10 rounds.',advanced:'20 rounds.',
    why:'Any 30 to 50 ft works. In a weight vest, stop touching the line: bending to it under load is too much on the low back.'},
  m40d:{tb:'aa',name:'40-ft Shuttle Density',sys:'Aerobic / anaerobic',gear:'40 ft of floor',a:MTI_SHUT,
    sess:'8 lengths of 40 ft every minute × 10',
    lines:['Every minute on the minute for 10 minutes','8 lengths of 40 ft, which is 4 round trips','Rest for what is left of the minute'],
    why:'A density format: the work is fixed and the clock is fixed, so fitness shows up as rest. The faster you finish the lengths, the more of the minute you get back.'},
  msui:{tb:'aa',name:'Suicide Shuttles',sys:'Aerobic / anaerobic',gear:'40 ft of floor',a:MTI_SHUT,
    sess:'A suicide every 30 s × 20',
    lines:['Cones at each end and one in the middle','Run to the middle and back, then to the far end and back','Start a new one every 30 s, 20 rounds'],
    advanced:'3 burpees or 5 box jumps before each shuttle, inside the same 30 s.',
    why:'MTI’s harder versions put 3 burpees or 5 box jumps in front of each shuttle, inside the same 30 s, so the extra work comes out of your rest.'},
  m300:{tb:'aa',name:'300 m Shuttle',sys:'Aerobic / anaerobic',gear:'25 m of running room',a:MTI_SHUT,
    sess:'12 lengths of 25 m, every 2:30 × 4',
    lines:['Two cones 25 m apart','12 lengths, 6 round trips, with a hand touch at each end','Start a new one every 2:30, 4 rounds'],
    basic:'Every 2:30.',advanced:'Every 2:10. Then the same again in a 25 lb vest.',
    why:'MTI’s favorite mode for work capacity. Most athletes finish a 300 in 1:00 to 1:15, so it runs at roughly one to one work and rest. MTI progresses it by the clock: two sessions at 2:30, two at 2:20, two at 2:10, then back to 2:30 in a vest. The timer runs 2:30.'},
  m150:{tb:'aa',name:'150 m Shuttle',sys:'Aerobic / anaerobic',gear:'25 m of running room',a:MTI_SHUT,
    sess:'6 lengths of 25 m, every 1:15 × 4',
    lines:['Two cones 25 m apart','6 lengths, 3 round trips','Start a new one every 1:15, 4 rounds'],
    basic:'4 rounds.',advanced:'8 rounds.',
    why:'The law-enforcement version of the 300: shorter, and closer to what a foot chase actually is.'},
  mp2s:{tb:'aa',name:'Prone to Sprint',sys:'Aerobic / anaerobic',gear:'25 m or 40 ft of floor',a:MTI_SHUT,rx:true,
    sess:'30 s on / 30 s off, dropping prone at each end',
    lines:['Shuttle 40 ft or 25 m','Drop to full prone at each end, get up, sprint back','30 s of work, 30 s of rest'],
    why:'The level change adds a large metabolic cost to an ordinary shuttle, and getting up off the ground fast is a skill in itself. It is the basis of MTI’s tactical work capacity test. The article gives the work and the rest but not a count; the timer’s eight rounds are the app’s.'},
  mbeep:{tb:'aa',name:'20 m Shuttle Intervals',sys:'Aerobic / anaerobic',gear:'20 m of running room',a:MTI_BEEP,
    sess:'Shuttle reps every 2 min × 10, set from your beep test',
    lines:['Cones 20 m apart, and one at 10 m for half reps','Every 2 min for 10 rounds','Reps a round from your beep test level: 10.5 at level 7, 11.5 at level 9, 12.5 at level 11'],
    why:'Assessment-based: the work is scaled to you from a beep test, and when you re-test mid-cycle the reps go up. In MTI’s small study this narrowly lost to the fixed version, 20 m Shuttle Intervals’ simpler sibling.'},
  mfix:{tb:'aa',name:'Fixed Shuttle Intervals',sys:'Aerobic / anaerobic',gear:'20 m of running room',a:MTI_BEEP,
    sess:'60 s of 20 m shuttles / 60 s rest × 10',
    lines:['20 m shuttles for 60 s','Rest 60 s','10 rounds'],
    basic:'60 s on, 60 s off.',advanced:'70 s on and 50 s off, then 80 s on and 40 s off.',
    why:'No test needed: the work and rest are fixed and you progress by moving the split. In MTI’s study it narrowly beat the beep-test version. Four athletes over five weeks, so a hint rather than a finding.'},
  mtjt:{tb:'aa',name:'Touch, Jump, Touch to Box',sys:'Aerobic / anaerobic',gear:'A 17 in box',a:'Touch Jump Touch to Box Intervals (2025)',
    sess:'20 × 1 min: 10 s on / 50 s off, building to 30 / 30',
    lines:['Stand beside the box and touch the floor with the inside hand','Hop laterally onto the box and off the other side, touch, and back','20 rounds of 1 minute'],
    basic:'10 s of work, 50 s of rest.',advanced:'30 s of work, 30 s of rest.',
    why:'MTI calls it its most intense work capacity event, built for skiers’ legs. The work grows across the cycle while the minute stays a minute.'},
  m555:{tb:'gc',name:'5+5+5 Clean and Burpee',sys:'Work capacity',gear:'A barbell, 95 or 65 lb',a:MTI_DUR,
    sess:'3 × 5 min, every minute: 6 power cleans, 6 burpees',
    lines:['Every minute for 5 minutes: 6 power cleans at 95 or 65 lb, then 6 burpees','Rest a minute','Three times through'],
    why:'Scale it as you go: if you are getting 40 s of rest, add a rep to each; if you barely make the minute, drop one. Two tools and a fixed clock, which is what makes it general conditioning rather than an interval.'},
  m1010:{tb:'gc',name:'10 + 10',sys:'Work capacity',gear:'25 m of running room and a 60 or 80 lb sandbag',a:MTI_DUR,
    sess:'4 × 300 m shuttle every 2:30, rest 3 min, then 10 min of sandbag get-ups',
    lines:['A 300 m shuttle every 2:30, 4 rounds','Rest 3 min','10 min of sandbag get-ups for reps, 60 or 80 lb'],
    measure:['reps','get-ups'],
    why:'Two hard ten-minute efforts back to back, the shuttles and then the sandbag, with only three minutes between them.'},
  mamrap:{tb:'gc',name:'Clean, Press and Shuttle',sys:'Work capacity',gear:'A barbell, 85 or 135 lb, and 25 m',a:MTI_DUR,
    sess:'20 min AMRAP: 3 clean and push press, 75 m shuttle, walk back',
    lines:['As many rounds as possible in 20 min','3 power clean and push press, 85 or 135 lb','A 75 m shuttle, 3 lengths of 25 m','Walk back to the bar'],
    measure:['amrap','rounds'],
    why:'Sprint the shuttle and recover on the walk back to the bar. Scored by rounds completed in the 20 minutes.'},
  mhinge:{tb:'gc',name:'Hinge and Step Up',sys:'Work capacity',gear:'A barbell, 95 or 155 lb, and a 20 in box',a:MTI_DUR,
    sess:'8 rounds for time: 10 hinge lifts, 30 step-ups, rest 15 s',
    lines:['8 rounds for time','10 hinge lifts, 95 or 155 lb','30 step-ups on a 20 in box','Rest 15 s'],
    measure:['time','mm:ss'],lower:true,
    why:'MTI’s favorite gym work capacity event for mountain athletes. The 15 s rest keeps each round an attack rather than a slog.'},
  mmtn:{tb:'gc',name:'Step Up, Shuttle, Rope',sys:'Work capacity',gear:'A 25 lb pack, a 20 in box, 25 m and a rope',a:MTI_PROVEN,
    sess:'8 rounds for time in a 25 lb pack: 20 step-ups, 6 shuttles, 1 rope climb',
    lines:['8 rounds for time, with a 25 lb pack on','20 step-ups on a 20 in box','6 shuttle sprints of 25 m','1 rope climb'],
    measure:['time','mm:ss'],lower:true,
    why:'Legs, lungs and a climbing pull, under a pack. Fit mountain athletes finish in about 20 minutes.'},
  mvest:{tb:'gc',name:'Clean and Shuttle, vested',sys:'Work capacity',gear:'A barbell, 95 or 135 lb, a 25 lb vest and 25 m',a:MTI_PROVEN,
    sess:'12 min AMRAP in a vest: 3 power cleans, 75 m shuttle, walk back',
    lines:['As many rounds as possible in 12 min, in a 25 lb vest','3 power cleans, 95 or 135 lb','A 75 m shuttle, then walk back to the bar'],
    measure:['amrap','rounds'],
    why:'MTI’s movement-under-fire event, under load: short, explosive, and done in the kit you would wear.'},
  mrr15:{tb:'gc',name:'1.5-mile Ruck Run',sys:'Work capacity',gear:'A 45 lb ruck and a 10 lb dumbbell',a:MTI_PROVEN,
    sess:'1.5 miles for time with 45 lb, carrying 10 lb',
    lines:['1.5 miles for time','45 lb ruck, and a rubber rifle, sledge or 10 lb dumbbell in your hands'],
    measure:['time','mm:ss'],lower:true,
    why:'One of the events MTI’s athletes have improved on most reliably. Top athletes finish around 13:30.'},
  mshort:{tb:'power',name:'Short Sprints',sys:'Power',gear:'A track',a:'Mini Study: Short Sprints outperform Heavy Squats and Lunges (2023)',rx:true,
    sess:'50, 100 and 200 m sprints with full recovery',
    lines:['Sprint 50 m, 100 m and 200 m','Recover fully between efforts'],
    why:'In MTI’s study these did more for a 3-mile run time than heavy squats and lunges: 7.7% against 4.2%, in a handful of athletes. “Full recovery” is the article’s; the timer’s rests are the app’s estimate of it.'},
  mz2:{tb:'e',name:'Zone 2 Run',sys:'Aerobic base',gear:'Somewhere to run',a:'Mini Study: 3 Hours of Weekly Zone 2 Running Improves Aerobic Base (2025)',
    sess:'45–60 min at a heart rate of 180 minus your age',
    lines:['45 to 60 min easy','Heart rate at 180 minus your age, or a pace where you can talk in full sentences'],
    why:'Three of these a week improved aerobic base in four weeks in MTI’s study. It is an E session in the book’s terms: long, steady and easy, and as useful for being repeatable as for anything else.'},
  m21:{tb:'e',name:'2/1 Ruck Run',sys:'Aerobic base',gear:'A ruck',a:'2/1 Intervals vs Continuous Ruck Run (2025)',rx:true,
    sess:'2 min running / 1 min walking, for the distance',
    lines:['Run 2 min, walk 1 min, and repeat','For the whole distance: the study used 6 miles at 60 lb'],
    why:'Faster than running the same distance continuously for all four athletes in MTI’s study, and easier to hold on to mentally. The timer’s twenty rounds, an hour, are the app’s.'},
};
for(const [k,x] of Object.entries(HIC_MTI)){
  x.cat='mti'; x.src='mti';
  HIC[k]={name:x.name,sess:x.sess,sys:x.sys,book:x,lower:!!x.lower};
  if(!x.measure) HIC[k].noMetric=true;
}
/* TB II's categories for every format (p111–112, p189): AA aerobic/anaerobic, GC
   general conditioning, PD power development, E long steady endurance, plus the core
   and challenge sessions. The app's own interval shapes are aerobic/anaerobic work;
   TB III's short maximal sprints are power. */
const TB_CAT={AA:'Aerobic / anaerobic',GC:'General conditioning',PD:'Power development',E:'Endurance',Core:'Core',Challenge:'Challenge'};
function hicTbCat(f){
  const b=(HIC[f]||{}).book;
  if(f==='liss'||f==='predator') return 'E';
  if(['sprints','reset20','hillsprint'].includes(f)) return 'PD';
  const c=b&&(b.src==='mti'?b.tb:b.cat);
  return {aa:'AA',gc:'GC',power:'PD',e:'E',core:'Core',challenge:'Challenge'}[c]||'AA';
}
function hicMti(f){ return !!(HIC[f]&&HIC[f].book&&HIC[f].book.src==='mti') }
