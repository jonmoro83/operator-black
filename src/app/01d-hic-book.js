/* ---------------- Tactical Barbell II's named HIC sessions ----------------
The book gives forty numbered High Intensity Conditioning sessions in Part II, in three
groups: 1 to 24 aerobic/anaerobic, 25 to 36 general conditioning, 37 to 40 power. Black
asks for two or three HICs a week and leaves the choice to you, so these are formats you
pick on the day, like any other, rather than something a protocol schedules. #9 is the
FOBBIT, which already exists under its own machinery, so it is only numbered here.

Each one carries, in the book's own order: the prescription (`lines`), the basic and
advanced versions and any alternative (`basic`, `advanced`, `alt`), and the book's
reasoning (`why`), paraphrased. `sess` is the one-line form for the calendar and the day
card. `measure` is what the session is scored by when the book scores it: a time for the
ones done "for time" (lower is better, hence `lower`), rounds for an AMRAP, reps for
Beat Your Face. A session the book does not score has no measure and is logged by
minutes and rounds, like a FOBBIT.

The timer shape lives in IV (14-interval-timer.js) as `seq`: the segments of one round,
timed where the book times them and held until you tap Done where it counts reps or
distance. `est` is our guess at how long a held bout takes, used only to size the session
in minutes before you run it; nothing in the book depends on it. */
const HIC_CAT={aa:'Aerobic / anaerobic',gc:'General conditioning',power:'Power development',core:'Core',challenge:'Challenge sessions'};
// The forty are numbered 1 to 40 (`n`). Full Core and the challenge sessions come from
// their own short lists later in the book, so they carry their place in those (`no`)
// and no HIC number. The three finishers are not formats at all: see 01e-finishers.js.
const HIC_BOOK={
  connaught:{n:1,cat:'aa',name:'Connaught Range 10 to 1s',sys:'Aerobic / anaerobic',gear:'100 m of running room',measure:['time','mm:ss'],lower:true,
    sess:'10 burpees, 100 m sprint, 9 burpees, sprint back … down to 1, for time',
    lines:['10 burpees, sprint 100 m','9 burpees, sprint back','8 burpees, sprint 100 m … down to 1 burpee','Shuttle-run style, as quickly as you can'],
    basic:'Start with 5 to 1 and work up to 10. And/or cut the run to 50 m.',
    advanced:'Sprint the full 100 m. And/or add 10 squats at each stop, so burpees and squats both count down.',
    why:'Find a football field or a track, anywhere with 100 m of running room. The session comes from a member of the RCMP’s federal Emergency Response Team, where 10-to-1 burpees in this fashion were a regular part of morning PT for candidates. Your goal is to complete it as quickly as possible, so log the time and chase it.'},
  fast5:{n:2,cat:'aa',name:'Fast 5 Tempo Run',sys:'Aerobic power',gear:'Somewhere to run 5 km',measure:['time','mm:ss'],lower:true,
    sess:'5 km / 3 mi at 80 to 85% of max heart rate',
    lines:['Run 5 km (3 miles)','80 to 85% of maximum heart rate'],
    basic:'Start with half the distance if you need to, and work up to the full distance.',
    advanced:'Pick up the pace, and/or run 4 to 5 miles.',
    why:'Faster than your LSS work: fast enough that you cannot hold a conversation easily. Get a little outside your comfort zone. It is still one continuous effort, so it trains the aerobic engine at the top of its range rather than the anaerobic systems.'},
  resets600:{n:3,cat:'aa',name:'600 Meter Resets',sys:'Max aerobic power',gear:'A track, or 600 m of running room',
    sess:'Sprint 600 m flat out, rest 3 to 5 min, × 6',
    lines:['Sprint 600 m, maximum effort','Rest 3 to 5 minutes','× 6'],
    basic:'4 reps.',advanced:'10 reps.',
    why:'The long rest is the point. The benefit comes from a maximum effort made from a rested state: you do yourself no favors sprinting the next rep while still exhausted, and that kind of training is elsewhere in the book for a different purpose. Think of it as strength training for the heart: it develops the strength of cardiac contraction and builds mitochondria. Jog 5 to 10 minutes first. Each 600 is all out, then rest until you are relatively well recovered.'},
  bagresets:{n:4,cat:'aa',name:'Heavy Bag Resets',sys:'Max aerobic power',gear:'A heavy bag',
    sess:'Heavy bag 90 s all out, rest 2 to 5 min, × 5',
    lines:['Heavy bag strikes 90 s, maximum effort','Rest 2 to 5 minutes','× 5'],
    basic:'4 rounds, and/or 60 s of striking instead of 90.',
    advanced:'Up to 10 rounds, and/or 2 minutes of striking.',
    why:'The same principle as the resets: intense work springing from a well-rested state. Any striking you like, punches, kicks, knees, elbows, combos, as long as it is an all-out effort for the full 90 seconds. Your power will fade part way through; that is where the training happens, so keep pushing with whatever you have until the alarm. Light skipping or stretching between rounds is fine. A good one to tack on after a strength session when you are already in the gym, or run alone with a core or grip finisher.'},
  indoorpower:{n:5,cat:'aa',name:'Indoor Power Intervals',sys:'Max aerobic power',gear:'A treadmill, Airdyne or rower',
    sess:'2 min max effort indoors, rest 3 to 5 min, × 5',
    lines:['Treadmill run, Airdyne or row 2 minutes, max effort','Rest 3 to 5 minutes','× 5'],
    why:'The 600 m resets for people who cannot get to a track or are dealing with the weather. It is not an all-out sprint for two minutes but it should not be far behind: roughly 80 to 90% of max heart rate, a pace you can hold for the length of the interval. On a treadmill, something like 80% of your 100 m sprint speed, with the incline if the belt cannot go fast enough. Then slow to a walk and rest the full 3 to 5 minutes. Most training works you hard for 20 to 60 seconds; a sustained two-minute maximum takes your game somewhere else.'},
  sledgedrill:{n:6,cat:'aa',name:'Sledge Drill',sys:'Anaerobic threshold',gear:'A sledgehammer, a tire and a jump rope',
    sess:'Sledge 1 min, rope 1 min, sledge 30 s, rope 30 s, rest 2 to 3 min, × 5',
    lines:['Sledgehammer on tire 1 minute','Jump rope 1 minute','Sledgehammer 30 seconds','Jump rope 30 seconds','Rest 2 to 3 minutes','× 5'],
    basic:'3 rounds.',advanced:'1 minute for each of the four, 5 rounds.',
    alt:'Dumbbell or barbell push press in place of the sledge and tire.',
    why:'Switch hands and grip now and then. You want powerful, consistent blows you can keep up, not an all-out frenzy: a sustained effort for the duration. It is an anaerobic-threshold session, built to lengthen how long you can work near your maximum, with strength-endurance, power-endurance and work capacity thrown in.'},
  boo:{n:7,cat:'aa',name:'Black on Oxygen',sys:'Aerobic / anaerobic',gear:'A kettlebell and a track',
    sess:'Swings 60 s, run 800 m, rest 2 to 3 min, × 5',
    lines:['Kettlebell swings 60 seconds (or 30 swings)','Run 800 m','Rest 2 to 3 minutes','× 5'],
    basic:'3 rounds.',advanced:'A heavier bell, or the same bell swung for 2 minutes instead of 1.',
    why:'Learned from a former US Army Ranger: the solo version of a partner drill where one swings while the other runs two laps, then they switch, continuously. Take the bell to the track: 16 to 32 kg for men with 24 about the mean, 8 to 24 kg for women. The aim is continuous higher-intensity work for several minutes. Swing at a steady, comfortable pace and switch hands halfway; if you have to set it down before the minute is up, rest briefly and carry on. Then drop it and run the 800 as quickly as you can. Stick to 2 to 3 minutes of rest; you do not have to be fully recovered today.'},
  boo2:{n:8,cat:'aa',name:'BOO II',sys:'Aerobic / anaerobic',gear:'A track',
    sess:'10 burpees, 800 m, 5 burpees, 400 m flat out, rest 2 to 3 min, × 3',
    lines:['10 burpees','Run 800 m','5 burpees','Run 400 m, maximum effort','Rest 2 to 3 minutes','× 3'],
    basic:'5 burpees, 400 m, 5 burpees, 400 m max effort, rest 2 to 3 min, × 2.',
    advanced:'20 burpees, 800 m, 10 burpees, 400 m max effort, rest 2 min, × 3 to 5.',
    why:'Each round as quickly as you can. The 800 is not a sprint but it is faster than a jog; drop straight into the burpees, then give the final 400 everything. You do not have to be fully rested between rounds, so try not to run over the rest.'},
  shorthills:{n:10,cat:'aa',name:'Short Hills',sys:'Aerobic / anaerobic',gear:'A hill of 10 to 15 seconds',
    sess:'Sprint a 10 to 15 s hill, walk down, × 10',
    lines:['Hill sprint, 10 to 15 seconds up','Walk back down as the rest (30 to 60 s)','× 10'],
    basic:'× 5, work up to 10.',advanced:'× 15 to 20, and/or a 10 to 20 lb weight vest.',
    why:'For this one you want a shorter hill, roughly 10 to 15 seconds to sprint up, nothing longer or higher. The walk down is the rest; at the bottom, go again. If the author could keep one conditioning exercise for life it would be hill sprints: nothing builds legs, heart, lungs and willpower like them, and after Block I he recommends making them a staple.'},
  oxygendebt:{n:11,cat:'aa',name:'Oxygen Debt 101',sys:'Glycolytic',gear:'A track',
    sess:'3 × 200 m flat out with 30 s between, rest 3 min, × 3 to 4',
    lines:['Sprint 200 m, maximum effort, × 3 with 30 seconds between','Rest 3 minutes','× 3 to 4'],
    basic:'2 rounds, work up to 4 over time.',advanced:'All 4 rounds.',
    why:'From a nationally ranked runner and former police academy instructor. It is built to work the lactic system and raise your tolerance for pain: three maximum 200s with only 30 seconds between them make one round, and the three minutes between rounds is not enough to clear it.'},
  seladder:{n:12,cat:'aa',name:'Speed-Endurance Ladders',sys:'Speed-endurance',gear:'A track',
    sess:'400, 300, 200, 100 m and back up, flat out, short rests',
    lines:['400 m, rest 40 s','300 m, rest 30 s','200 m, rest 20 s','100 m, rest 10 s','Then back up: 100 m, rest 20 s, 200 m, rest 30 s, 300 m, rest 40 s, 400 m','All running at maximum effort'],
    basic:'Down the ladder only. Rest a full 2 minutes at the bottom before coming back up.',
    advanced:'Down and back up is one round. Keep going for as many rounds as you can, with a 2-minute rest at the bottom between some rounds if you need it.',
    why:'Every rung is a maximum effort and the rests shrink as the distances do, which is what makes it speed-endurance rather than speed. Work down from the 400, rest ten seconds after the 100, and climb straight back.'},
  meateater:{n:13,cat:'aa',name:'Meat Eater',sys:'Aerobic / anaerobic',gear:'A kettlebell and 100 m of track',measure:['time','mm:ss'],lower:true,
    sess:'Sprint 100 m, 20 swings, walk back, × 10',
    lines:['Sprint 100 m','20 Russian kettlebell swings (24 to 48 kg)','Walk back to the start','× 10'],
    basic:'× 5, with a lighter bell if you need one.',
    advanced:'For time, as quickly as possible: jog back instead of walking. And/or a heavier bell.',
    alt:'A dumbbell for the swings.',
    why:'Use a moderate to medium-heavy bell and leave it on the track 100 m away, near the finish line. Sprint flat out to it, pick it up and swing, then turn around and walk back. Two-handed swings are the author’s preference, but one-handed works. The time is only scored in the advanced version; the standard one is paced by the walk.'},
  meateater2:{n:14,cat:'aa',name:'Meat Eater II',sys:'Glycolytic',gear:'One kettlebell',measure:['time','mm:ss'],lower:true,
    sess:'10 swings, 10 burpees, rest 60 s, × 10, for time',
    lines:['10 Russian kettlebell swings','10 burpees','Rest 60 seconds','× 10, for time'],
    basic:'× 5, with a lighter bell if you need one.',
    advanced:'A heavier bell, one you can barely swing for the full 10. Leave a swing or two in the bank to keep your form.',
    why:'Deceptively simple, highly effective. A medium to heavy bell for you, two-handed Russian swings. If you only have light bells, swing one-handed and do 10 per arm. It does not matter whether you start with the burpees or the swings. The clock runs through the rests, so the whole thing is one time.'},
  disarmed:{n:15,cat:'aa',name:'Disarmed',sys:'Aerobic / anaerobic',gear:'A heavy bag',
    sess:'10 burpees, heavy bag 2 min, rest 60 s, × 3 to 5, then Plank & Shank',
    lines:['10 burpees','Heavy bag strikes 2 minutes','Rest 60 seconds','× 3 to 5','Finisher: Plank & Shank, 3 minutes × 3'],
    basic:'Bag 1 minute instead of 2.',advanced:'Bag 3 minutes.',
    why:'Work hard on the bag: steady strikes, with combos approaching maximum effort and speed. After the rounds, rest a minute or two and move to the finisher: 30 seconds of plank, 30 seconds of shank, until three minutes is up, with 30 to 60 seconds of rest after each pair if you need it, three times over. The shank is a static back extension held at the top.'},
  stdhills:{n:16,cat:'aa',name:'Standard Issue Hills',sys:'Aerobic / anaerobic',gear:'A hill of 30 to 45 seconds',
    sess:'5 to 10 hill sprints, 1 to 2 min rest at the bottom',
    lines:['Hill sprint, maximum effort','Walk or jog down','Rest 1 to 2 minutes at the bottom','× 5 to 10'],
    basic:'3 to 4 rounds, working up to 5 to 10 over time. Stretch the rests to 3 minutes.',
    advanced:'Jog down and take no rest at the bottom.',
    why:'The basic hill session, and do not let its simplicity fool you: it will probably do more for your conditioning than a complicated session with ten exercises and twenty toys. Aim for a hill that takes 30 to 45 seconds to sprint up; if all you have is a short one of 10 to 15 seconds, double the reps. Maximum effort and speed up, the rest starts at the bottom. Hills are to conditioning what barbells are to strength.'},
  apex:{n:17,cat:'aa',name:'Apex Hills',sys:'Aerobic / anaerobic',gear:'A kettlebell and a hill',
    sess:'Hill sprint, 10 swings at the top, walk down, rest 1 to 2 min, × 5 to 10',
    lines:['Hill sprint','10 Russian kettlebell swings at the top','Walk down','Rest 1 to 2 minutes','× 5 to 10'],
    basic:'3 to 4 rounds, working up to 10. And/or a lighter bell.',
    advanced:'Jog down and drop the rest: the jog is the recovery. And/or a heavier bell, or double kettlebell swings. Operators work up to the 48 kg Beast for 15 or more rounds.',
    why:'One of the simplest and most effective sessions in the book, the author’s personal favorite and a staple of his own conditioning. Simple, scalable, flexible, and it will turn you into a machine. A heavy bell with two-handed swings adds a power and strength element. Set the bell at the top, sprint to it flat out, bang out ten crisp swings, walk down; the rest starts at the bottom. No hill you can drive to? Hike out to one with the bell in a pack, and make sure the pack is comfortable, because you will be tired on the way back.'},
  bloodylungs:{n:18,cat:'aa',name:'Bloody Lungs',sys:'Aerobic / anaerobic',gear:'A hill',
    sess:'10 plank push-ups, hill sprint, 10 burpees at the top, walk down, × 5',
    lines:['10 plank push-ups at the bottom','Hill sprint','10 burpees at the top','Walk down','× 5'],
    basic:'An extra 1 to 2 minutes of rest at the bottom after the walk down. And/or 5 plank push-ups and burpees instead of 10.',
    advanced:'× 10, and/or jog down instead of walking. Operators: a 10 to 20 lb weight vest.',
    why:'The plank push-up: start in the plank, push up onto one hand and then the other, do one full push-up from there, then go back down to the elbows one at a time. That is one rep. Ten of those, then sprint the hill with maximum effort, ten burpees at the top, and the walk down is your rest.'},
  bloodylungs2:{n:19,cat:'aa',name:'Bloody Lungs II',sys:'Aerobic / anaerobic',gear:'A kettlebell or dumbbell and a hill',
    sess:'10 burpees, hill sprint, 5 snatches per arm at the top, walk down, rest, × 5 to 10',
    lines:['10 burpees','Hill sprint','5 kettlebell or dumbbell snatches per arm at the top','Walk down','Rest 1 to 2 minutes','× 5 to 10'],
    basic:'× 5, working up to 10. A lighter bell to start. And/or 10 swings instead of snatches, and/or 5 burpees.',
    advanced:'× 10 or more. And/or 10 snatches per arm, and/or jog down, and/or no rest between rounds. Operators: a 10 to 15 lb vest.',
    alt:'Push presses or swings in place of the snatches.',
    why:'The harder Bloody Lungs: the bell waits at the top. Burpees at the bottom, sprint straight up, snatch, walk down and rest.'},
  anaerobiccap:{n:20,cat:'aa',name:'Anaerobic Capacity',sys:'Glycolytic',gear:'A track',
    sess:'Jog 800, sprint 400, jog 800, sprint 400, jog 400, sprint 200, jog 400, sprint 200, then 50 plank push-ups',
    lines:['Jog 800 m, sprint 400 m','Jog 800 m, sprint 400 m','Jog 400 m, sprint 200 m','Jog 400 m, sprint 200 m','Finisher: 50 plank push-ups'],
    basic:'25 plank push-ups.',advanced:'A 5 to 10 lb weight vest.',
    why:'Best done at a track. The sprints are roughly 90 to 95% of maximum, and the whole sequence runs continuously with no rest: the jogs are the recovery. Then the finisher.'},
  pepperpot:{n:21,cat:'aa',name:'Pepper Potting',sys:'Aerobic / anaerobic, under load',gear:'A 30 to 50 lb ruck or vest and a route',
    sess:'Ruck a 1.5 mile route; every 5 min, pepper-pot 100 m',
    lines:['Rucksack, pack or weight vest, 30 to 50 lb','A 1.5 mile route, or a 30-minute hike','Pepper-pot 100 m every 5 minutes'],
    why:'A specialist drill, for people preparing for bootcamp or infantry training: it is patterned on fire and movement, and the author would not recommend it unless you are starting a military contract. It also happens to build aerobic and anaerobic capacity, strength-endurance and load bearing. Set a timer for every 5 minutes. When it goes, break into a run, and every fourth or fifth footfall drop to one knee, knee touching the ground, for two seconds, then up as fast as you can for another short bound. “Up, he sees me, down.” Keep the bounds short: as people tire they get longer, or the kneel turns into a rest, and that is exactly when to cut them short. Across the 100 m as fast as humanly possible, then the 5 minutes restart. The longer the route takes, the more pepper-potting you do.'},
  buffalo:{n:22,cat:'aa',name:'Buffalo Laps',sys:'Aerobic / anaerobic',gear:'A kettlebell and a track',measure:['time','mm:ss'],lower:true,
    sess:'10 burpees, 400 m, 10 swings, rest 45 to 60 s, × 4, for time',
    lines:['10 burpees','Run 400 m','10 two-handed kettlebell swings (20 if one-handed)','Rest 45 to 60 seconds','× 4, for time'],
    basic:'Rest 60 seconds between rounds.',advanced:'Double kettlebell swings.',
    alt:'No kettlebell: one-handed dumbbell swings, 5 per side.',
    why:'Submitted by a member of the RCMP who used it to bring his PARE time down from 3:15 to 2:54. The PARE is the force’s fitness test: a circuit of obstacles and stairs ending in a push-pull machine, built to simulate chasing, wrestling with and arresting a suspect, and anything in the two-minute range is the top percentile. The book’s header gives 45 to 60 seconds of rest and its prose says four rounds as fast as possible with none; the timer here follows the header, and you can skip the rest segment for the harder version.'},
  meateater3:{n:23,cat:'aa',name:'Meat Eater III',sys:'Strength, power and anaerobic',gear:'Two kettlebells and a track',
    sess:'10 double KB clean and press, sprint 300 m, lunge 100 m back, × 4 to 6',
    lines:['10 double kettlebell clean and press','Sprint 300 m','Lunge 100 m back to the start','× 4 to 6'],
    basic:'5 clean and presses instead of 10. Skip the lunges and walk the 100 m back as the rest.',
    advanced:'Heavier bells, and/or 6 rounds or more.',
    alt:'One bell: 10 swings per arm, then 10 presses per arm.',
    why:'This one is about strength, power and the anaerobic system. Two bells of equal weight at the start line, moderate to begin with, roughly 16 to 32 kg. Press, drop them, sprint 300 m, and if you are on a track lunge the last 100 m of the lap back to your bells.'},
  trinity:{n:24,cat:'aa',name:'Devil’s Trinity',sys:'Combat conditioning',gear:'A kettlebell and a heavy bag',
    sess:'Swings 1 min, burpees 1 min, bag 1 min, rest 1 min, × 5',
    lines:['Kettlebell swings 1 minute','Burpees 1 minute','Heavy bag, sparring or shadow boxing 1 minute','Rest 1 minute','× 5'],
    basic:'2 to 3 rounds.',advanced:'All 5 rounds without the rest. And/or double kettlebell swings.',
    alt:'With a partner, light sparring in place of the bag.',
    why:'Deceptively simple and very challenging, from a British paratrooper; the partner version had the two of them spar instead of hitting the bag. Set one-minute rounds. As many swings as you can in the minute, 12 to 24 kg for men and 8 to 16 kg for women, straight into burpees, then maximum effort on the bag with punches, knees, kicks and elbows.'},
  gc1:{n:25,cat:'gc',name:'GC 1: Beat Your Face',sys:'Work capacity',gear:'A floor',measure:['reps','burpees'],
    sess:'Burpees 3 min, rest 3, burpees 2 min, rest 2, burpees 1 min, rest 1',
    lines:['Burpees 3 minutes, rest 3 minutes','Burpees 2 minutes, rest 2 minutes','Burpees 1 minute, rest 1 minute','× 1 to 3'],
    basic:'One round, and work up over time.',
    advanced:'Burpees 5 minutes, rest 2 minutes, × 3 to 4. And/or a 5 to 15 lb weight vest.',
    why:'Instead of push-ups, you beat your face with burpees. How many you can do in a set time is a great indicator of general conditioning, so do as many as you can in each block, record the total, and compare it over time. That total is what the app scores.'},
  gc2:{n:26,cat:'gc',name:'GC 2',sys:'Work capacity',gear:'A pull-up bar',measure:['time','mm:ss'],lower:true,
    sess:'10 pull-ups, burpees, squat jumps, plyo push-ups, then 9, 8 … 1, for time',
    lines:['10 pull-ups, 10 burpees, 10 squat jumps, 10 plyometric push-ups','Then 9 of each, 8 of each … down to 1','For time'],
    why:'A descending ladder: finish the round of ten, then do the whole set again with nine, and keep going until you reach one. The pull-ups are what make it long, so scale them to what you have.'},
  gc3:{n:27,cat:'gc',name:'GC 3: Brig Rat',sys:'Work capacity',gear:'A dip station',
    sess:'Burpees and dips, burpees and squats, burpees and back extensions, 30 s each, rest 1 min, × 3 to 5',
    lines:['Burpees 30 s, dips 30 s','Burpees 30 s, squats 30 s','Burpees 30 s, back extensions 30 s','Rest 1 minute','× 3 to 5'],
    advanced:'A 10 to 15 lb weight vest.',
    alt:'A plank in place of the back extensions, every round or every other round.',
    why:'The squats are bodyweight. Three minutes of work on the clock, every other block burpees, then a minute to breathe.'},
  gc4:{n:28,cat:'gc',name:'GC 4',sys:'Work capacity',gear:'A pull-up bar, a kettlebell and 400 m',measure:['time','mm:ss'],lower:true,
    sess:'100 pull-ups, 400 m, 100 push-ups, 400 m, 100 swings, 400 m, for time',
    lines:['100 pull-ups, run 400 m','100 push-ups, run 400 m','100 kettlebell or dumbbell swings, run 400 m','1 round, for time'],
    basic:'50 reps of each exercise.',
    advanced:'A heavy bell, 48 kg or more, or double bells. And/or 2 rounds.',
    why:'It can be done indoors with a treadmill or rower for the 400s, or step out of the gym, run roughly 400 m and come back in for the next exercise. Break the hundreds into whatever sets you need; the clock is the score.'},
  gc5:{n:29,cat:'gc',name:'GC 5',sys:'Work capacity',gear:'A dip station and a pull-up bar',
    sess:'A: max dips and push-ups, 1 min each, × 3. B: 5 pull-ups, 10 burpees, × 3',
    lines:['A: max dips 1 minute, rest 90 s, max push-ups 1 minute, rest 90 s, × 3','Rest 2 minutes','B: 5 pull-ups, 10 burpees, × 3'],
    basic:'Dips and push-ups for 30 seconds instead of a minute.',
    advanced:'A weight vest for the dips, push-ups, pull-ups and/or burpees.',
    why:'Dips at a station or on rings. Complete all of A, rest two minutes, then B.'},
  gc6:{n:30,cat:'gc',name:'GC 6',sys:'Work capacity',gear:'A sledgehammer and a tire',measure:['amrap','rounds'],
    sess:'10 sledge strikes, 5 burpees, 10 squats, AMRAP 5 min, rest 60 to 90 s, × 3',
    lines:['10 sledgehammer strikes on the tire','5 burpees','10 squats','As many rounds as possible in 5 minutes','Rest 60 to 90 seconds','× 3'],
    advanced:'10 burpees instead of 5. 5 rounds or more. And/or a 5 to 15 lb weight vest.',
    alt:'Kettlebell or dumbbell swings in place of the sledge.',
    why:'Cycle through the three movements as many times as you can in five minutes, rest, and repeat for three rounds. Log the rounds you got through across all three blocks.'},
  gc7:{n:31,cat:'gc',name:'GC 7',sys:'Work capacity',gear:'800 m of running room',measure:['time','mm:ss'],lower:true,
    sess:'50 burpees, 50 squats, 50 diamond push-ups, run 800 m, × 3, for time',
    lines:['50 burpees','50 squats','50 diamond push-ups','Run 800 m','× 3, for time'],
    basic:'1 to 2 rounds.',advanced:'100 reps of each exercise, × 3 to 5.',
    why:'Three big rounds of bodyweight work with a run on the end of each. The book gives nothing but the numbers; the time is the whole story.'},
  gc8:{n:32,cat:'gc',name:'GC 8',sys:'Work capacity',gear:'A kettlebell, a box, a bar and dip station',measure:['time','mm:ss'],lower:true,
    sess:'A: snatches, box jumps, knees to elbows, dips, burpees, 4 rounds for time. B: handstand holds',
    lines:['A: 10 kettlebell or dumbbell snatches per arm, 25 box jumps, 25 hanging knees to elbows, 25 dips, 5 burpees','4 rounds, for time','B: handstand hold 60 seconds, rest 2 to 3 minutes, × 3'],
    basic:'2 rounds of A, 1 round of B.',
    why:'All of A before moving on to B. You can support yourself against a wall for the handstand holds. The time is for A.'},
  gc9:{n:33,cat:'gc',name:'GC 9',sys:'Work capacity',gear:'A pull-up bar and 100 m',measure:['amrap','rounds'],
    sess:'A: 3 pull-ups, 5 burpees, 10 squats, AMRAP 10 min. B: 10 × 100 m sprints',
    lines:['A: 3 pull-ups, 5 burpees, 10 squats, as many rounds as possible in 10 minutes','B: 10 × 100 m sprints'],
    basic:'5 × 100 m sprints instead of 10.',advanced:'Muscle-ups instead of pull-ups.',
    why:'All of A before B, and aim for continuous work in A. The rounds you complete in the ten minutes are the score.'},
  gc10:{n:34,cat:'gc',name:'GC 10',sys:'Work capacity',gear:'Somewhere to jog',
    sess:'Jog 2 min, 25 burpees, × 4, then a core or grip finisher',
    lines:['A: jog 2 minutes, 25 burpees, × 4','B: a core or grip finisher of your choice'],
    basic:'15 burpees.',advanced:'50 burpees. And/or a 5 to 20 lb weight vest.',
    why:'Indoors, a treadmill or rowing machine does the jogging. Treat the jog as active recovery and do the burpees as quickly as possible.'},
  gc11:{n:35,cat:'gc',name:'GC 11: Outside the Wire',sys:'Work capacity',gear:'100 m, a sledgehammer and a tire',measure:['time','mm:ss'],lower:true,
    sess:'Sprint 100 m, bear crawl 50 m, × 5, then 100 sledge strikes, for time',
    lines:['A: sprint 100 m, bear crawl 50 m, × 5, for time','B: 100 sledgehammer strikes on the tire, for time'],
    advanced:'A 5 to 20 lb weight vest.',
    alt:'10 muscle-ups for time, or 50 pull-ups for time, in place of the sledge.',
    why:'Get through A and B as quickly as you can. In A there is no rest between the sprint and the crawl: transition immediately.'},
  gc12:{n:36,cat:'gc',name:'GC 12',sys:'Work capacity',gear:'A barbell, a back extension and a bar',measure:['time','mm:ss'],lower:true,
    sess:'A: 1.5 mile run for time. B: 20 push presses, 20 back extensions, 20 pull-ups, × 3, for time',
    lines:['A: run 1.5 miles, for time','B: 20 barbell push presses, 20 back extensions, 20 pull-ups','× 3, for time'],
    basic:'1 to 2 rounds of B.',
    why:'Light on the push press, roughly 15 to 30% of your estimated one-rep max; no need to calculate, guess and err on the side of lighter. Two clocks: the run, and the circuit.'},
  bwplyo:{n:37,cat:'power',name:'BW Plyometric Power',sys:'Power',gear:'A pull-up bar and 50 m',
    sess:'Plyo push-ups, jump squats, plyo pull-ups with long rests, × 3, then 5 × 50 m',
    lines:['A: 10 explosive plyometric push-ups, rest 90 s','10 explosive jump squats, rest 90 s','5 to 10 plyometric pull-ups, rest 2 minutes','× 3','B: 5 × 50 m sprints'],
    basic:'2 rounds. And/or 5 plyometric pull-ups.',
    why:'Every rep explosive and crisp. Power sessions should not make up the bulk of your HIC work: pick most of it from sessions 1 to 36 and sprinkle these in.'},
  powercomplex:{n:38,cat:'power',name:'Power Complex',sys:'Power',gear:'A barbell, two kettlebells and a bar',
    sess:'Push press at 60 to 70%, double KB squat jumps, snatches, plyo pull-ups, long rests, × 3',
    lines:['Barbell push press × 5 at 60 to 70% of 1RM, rest 1 to 2 minutes','10 double kettlebell or dumbbell squat jumps, 8 to 24 kg, rest 1 to 2 minutes','Kettlebell or dumbbell snatch × 5 per arm, 8 to 24 kg, rest 1 to 2 minutes','5 plyometric pull-ups, rest 1 to 2 minutes','× 3'],
    basic:'2 rounds, working up to 3. The lighter end of the weights. 3 plyo pull-ups instead of 5, and bodyweight jump squats if you like.',
    load:[{lift:'ohp',pct:[60,70]}],
    why:'Everything with maximum speed and explosiveness, but under control with good form at all times. The push press is fast on the way up and slower, controlled, on the way down; 60 to 70% is the weight you can still move with speed. Same principle for the squat jumps, onto a box if it helps. For the pull-ups, pull as forcefully and quickly as you can to the bar, then let go and drop: no need to lower yourself under control, this is power, not maximum strength.'},
  kinetic:{n:39,cat:'power',name:'Kinetic Conditioning',sys:'Power and speed',gear:'50 m of running room',
    sess:'Sprint 50 m + 5 plyo push-ups, rest 2 min, sprint 50 m + 5 squat jumps, rest 2 min, × 3',
    lines:['Sprint 50 m, then 5 explosive plyometric push-ups','Rest 2 minutes','Sprint 50 m, then 5 explosive squat jumps','Rest 2 minutes','× 3'],
    basic:'2 rounds.',
    why:'Built to increase power, speed and explosiveness, and the trick is to do every exercise at maximum intensity: as explosively, powerfully and quickly as you can. The two-minute rest is deliberate, so that you are fully rested before each maximum effort; you only get the benefit by going all out every rep. Take more than two minutes if you need it. Err on the side of more rest.'},
  transition:{n:40,cat:'power',name:'Transition Complex',sys:'Strength to power',gear:'A rack, a barbell, a belt and a medicine ball',
    sess:'Heavy front squat then squat jumps, heavy press then plyo push-ups, weighted pull-ups then slams, × 2 to 3',
    lines:['Front squat × 3 at 85% of 1RM, then 10 squat jumps, rest 2 minutes','Standing overhead press × 3 at 85%, then 10 plyometric push-ups, rest 2 minutes','Weighted pull-ups × 3 (+10 to 50 lb), then 10 medicine ball slams','× 2 to 3'],
    basic:'Bodyweight pull-ups instead of weighted.',
    advanced:'Muscle-ups in place of the pull-ups. Plyo pull-ups in place of the slams.',
    alt:'10 plyometric or kipping pull-ups instead of the medicine ball slams.',
    load:[{lift:'ohp',pct:[85,85]}],
    why:'Heavy standard lifting primes the system for power work. Finish the set of front squats, rack the bar at once, step back and do ten powerful, explosive bodyweight squat jumps. Rest a couple of minutes and move on. Estimate the one-rep maxes if you need to, there is no need to be exact; just make sure the front squat, the press and the pull-ups are heavy.'},
  /* Core + Grip, session 2. The other three in that list are finishers; this one the
     book calls "a complete core focused session in and of itself". */
  fullcore:{no:2,cat:'core',name:'Full Core',sys:'Core',gear:'A barbell, a pull-up bar and a back extension',
    sess:'100 Romanian deadlifts at 20 to 30%, rest, 100 hanging knees to elbows, then Plank & Shank × 3',
    lines:['A: Romanian deadlifts × 100, at 20 to 30% of 1RM','Rest 3 to 5 minutes','Hanging knees to elbows, or hanging leg raises, × 100','B, the finisher: Plank & Shank × 3 (60 s plank, 45 s shank)'],
    basic:'50 deadlifts and 50 leg raises instead of 100.',
    advanced:'A weight vest for the plank and shank. And/or hold a weight when shanking.',
    why:'Not a finisher: a whole session on its own. Simple, minimalist and highly effective. Do the deadlifts and the leg raises in sets of 3, 5, 10, 20 or more, and rest as you need to. The author would rather pick the fewest highly effective movements and hit them hard than do ten kinds of sit-up. The book says 20 to 30% of 1RM without saying which lift; the app does not hold a Romanian deadlift max, so this is left for you to set, and lighter is the safer guess.'},
  /* The challenge sessions. Optional, "not meant to be a part of your regular
     conditioning protocol", once every couple of months when fully rested -- so they are
     on offer and never scheduled, and they are kept out of the benchmark. */
  dukuduku:{no:1,cat:'challenge',name:'Duku-Duku (Pretorian Hills)',sys:'Challenge',gear:'A hill and a 24 kg kettlebell (12 kg for women)',
    sess:'5 goblet squats, run the hill with the bell, 10 swings, walk down, × 5, and the bell never touches the ground',
    lines:['Kettlebell goblet squats × 5 (24 kg for men, 12 kg for women)','Run up the hill, carrying the kettlebell','Kettlebell swings × 10 at the top','Walk down, still carrying it','× 5','The kettlebell cannot touch the ground for the whole session'],
    basic:'A light kettlebell. Put it down and rest 2 to 3 minutes after every round, at the bottom of the hill.',
    advanced:'10 rounds. 10 goblet squats instead of 5. A 32 kg bell, working up to the 48 kg.',
    why:'Loosely based on a South African military selection exercise, where a candidate who put his load down was done. Carry the bell any way you like as long as it stays off the ground; a dumbbell works, a backpack does not. Even in great shape you may not finish all five, so work up: two rounds without putting it down, a break, then three. Pick a hill that takes 35 to 45 seconds to sprint up empty-handed, or a longer one run slower; with a short hill, do more rounds.'},
  burpeesmd:{no:2,cat:'challenge',name:'Burpees for the Mentally Disturbed',sys:'Challenge',gear:'A floor',measure:['reps','burpees'],
    sess:'Burpees for 10 minutes, rest 3, burpees for 10 minutes and beat the first set',
    lines:['Burpees for 10 minutes, as many as possible','Record the number','Rest 3 minutes','Burpees for 10 minutes, as many as possible: more than the first set'],
    basic:'5 minute rounds.',
    advanced:'A weight vest, 5 to 15 lb.',
    why:'On the second set, try to do more than you did on the first, and do not cheat the first by pacing yourself. The book asks only that the second beat the first; the app logs the two added together so there is one number to compare next time, and that total is the app\u2019s choice.'},
  triska:{no:3,cat:'challenge',name:'Triska-Deka-Phobia',sys:'Challenge',gear:'A ruck with 50 lb',measure:['time','mm:ss'],lower:true,
    sess:'Ruck 13 miles with 50 lb, then run 13 miles, for time',
    lines:['Ruck march 13 miles, 50 lb load','Run 13 miles','For time'],
    basic:'6 miles of each.',
    advanced:'An 80 to 100 lb ruck.',
    why:'Unlucky thirteen. Drop the ruck for the run. One clock for the whole of it.'},
  beasting:{no:4,cat:'challenge',name:'Beasting',sys:'Challenge',gear:'A ruck and a 48 kg kettlebell',measure:['time','mm:ss'],lower:true,
    sess:'3 mile march with a 48 kg bell in the ruck; every 10 minutes, 100 swings or 100 weighted squats; for time',
    lines:['Carry a 48 kg kettlebell, or the same in a dumbbell, in your ruck','March or hike 3 miles','Every 10 minutes: 100 Russian swings, or 100 weighted squats, alternating','For time'],
    basic:'A 24 or 32 kg kettlebell, and 2 miles.',
    advanced:'Both the swings and the squats at every stop. And/or 6 miles instead of 3.',
    why:'Pad the ruck extremely well. Drop it for the swings; leave it on, bell inside, for the squats. The ten-minute timer stops while you do the kettlebell work and starts again when you ruck up and walk, which is how the timer here runs it. The longer you take, the more swings and squats you owe.'},
  snakeeater:{no:5,cat:'challenge',name:'Snake-Eater\u2019s Delight',sys:'Challenge',gear:'A ruck with 50 lb, and two days',measure:['time','mm:ss'],lower:true,
    sess:'10 km ruck with 50 lb and a 10 km run for time, a night with no sleep, then the same again',
    lines:['Day 1: ruck march 10 km with 50 lb, then run 10 km, for time','That night: stay awake. No sleep, no catnaps','Day 2, any time after 5 AM: the same ruck and run, and match or beat day 1'],
    basic:'Sleep 2 to 3 hours before day 2: bed at 2 AM, up at 5.',
    advanced:'Two nights without sleep between the two.',
    why:'A taste of what selection adds to physical work: sleep deprivation is the great equalizer, and how someone performs at their breaking point is what selection is looking for. The book is plain that there is no benefit to this beyond testing your limits, and that going without sleep is unhealthy. Pick it on each of the two days and log that day\u2019s time.'},
};
// The book's number and group on the formats that come from it. #9 is the FOBBIT.
for(const [k,x] of Object.entries(HIC_BOOK)){
  HIC[k]={name:x.name,sess:x.sess,sys:x.sys,book:x,lower:!!x.lower};
  if(!x.measure) HIC[k].noMetric=true;
  // Not a session to repeat until it is a habit, so never the benchmark.
  if(x.cat==='challenge') HIC[k].noCompare=true;
}
HIC.fobbit.book={n:9,cat:'aa'};
function hicBook(f){ return !!(HIC[f]&&HIC[f].book&&HIC[f].book.lines) }
function hicLower(f){ return !!(HIC[f]&&HIC[f].lower) }
// Which of two results is better for a format: lower for the ones done for time.
function hicBetter(f,a,b){ return hicLower(f)?a<b:a>b }
// A book session is the same session whatever you ran it on, so the activity drops out
// of its key and its title. Everything else compares within activity and format.
function hicKey(mod,f){ return (hicBook(f)?'book':mod)+'|'+f }
function hicTitle(mod,f){ const H=HIC[f]||{}; return (mod==='book'||hicBook(f)||!MOD[mod])?H.name:MOD[mod].name+' · '+H.name }
function hicSrcLabel(f){
  const b=(HIC[f]||{}).book; if(!b) return '';
  if(b.src==='mti') return `Mountain Tactical Institute, “${b.a}”, filed as ${TB_CAT[hicTbCat(f)].toLowerCase()} (TB II p189)`;
  if(b.n) return `Tactical Barbell II, HIC #${b.n}, ${HIC_CAT[b.cat].toLowerCase()}`;
  return b.cat==='challenge'?`Tactical Barbell II, challenge session ${b.no}`:`Tactical Barbell II, core and grip, session ${b.no}`;
}
// Where a book format sits in its own list: the HIC number, or its place among the
// core sessions or the challenges.
function hicOrd(x){ return (x.book&&(x.book.n||x.book.no))||0 }
// A result as the person reads it: a time as m:ss, anything else as the number.
// Past the hour it reads h:mm:ss: a challenge session's "187:40" is not a time anyone says.
function resStr(v,un){
  if(v==null||v===''||Number.isNaN(+v)) return '—';
  if(un!=='mm:ss') return n(v);
  const t=Math.round(+v); return t>=3600?Math.floor(t/3600)+':'+pad(Math.floor(t%3600/60))+':'+pad(t%60):mmss(t);
}
// "8:20" or "8.5" or "500" to seconds. Minutes and seconds the way people type them.
function toSecs(s){
  if(s==null||s==='') return null;
  if(typeof s==='number') return s;
  const t=String(s).trim(); if(!t) return null;
  const m=t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if(m) return m[3]!=null?(+m[1]*3600+ +m[2]*60+ +m[3]):(+m[1]*60+ +m[2]);
  const v=+t; return Number.isNaN(v)?null:v;
}
// A result with its unit, for a line of prose: "151 cal", "8:20".
function resLine(v,un){ const s=resStr(v,un); return un==='mm:ss'||s==='—'?s:s+' '+un }
/* The format picker's options, grouped by what a session trains, in TB II's own
   categories (p111–112, p189), so the books' and MTI's sessions of one kind sit
   together. Each says where it is from, as the user asked: TB II, TB III, MTI, or App
   for the app's own shapes. Within a group: the app's, then TB II by number, TB III,
   MTI. On Black's days your cluster comes first (`o.cluster`); an option listed there
   is not marked selected again below, or the browser would pick the second one.
   `keep` filters, so Setup can offer only what makes a benchmark. */
function hicSrcTag(k){
  const b=(HIC[k]||{}).book;
  if(b&&b.src==='mti') return 'MTI';
  if(b) return 'TB II';
  return ['predator','sprints','reset20','hillsprint'].includes(k)?'TB III':'App';
}
function hicOptLabel(k){ const x=HIC[k]; return (x.book&&x.book.n?'#'+x.book.n+' ':'')+x.name+' \u00b7 '+hicSrcTag(k) }
function hicOptions(cur,keep,o){
  const ok=k=>!keep||keep(k,HIC[k]);
  let done=false;
  const opt=k=>{const on=k===cur&&!done; if(on) done=true; return `<option value="${esc(k)}"${on?' selected':''}>${esc(hicOptLabel(k))}</option>`};
  const rank=k=>{const t=hicSrcTag(k);return (t==='App'?0:t==='TB II'?1000+hicOrd(HIC[k]):t==='TB III'?3000:4000)};
  const ks=Object.keys(HIC).filter(ok);
  let h='';
  if(o&&o.cluster){ const cl=hicCluster().map(c=>c.f).filter(k=>ks.includes(k)); if(cl.length) h+=`<optgroup label="Your cluster">${cl.map(opt).join('')}</optgroup>` }
  const groups=[['AA','Aerobic / anaerobic'],['GC','General conditioning'],['PD','Power development'],['E','Endurance (E)'],['Core','Core'],['Challenge','Challenge sessions']];
  for(const [c,label] of groups){
    const xs=ks.filter(k=>k!=='free'&&hicTbCat(k)===c).map((k,i)=>[k,rank(k),i]).sort((a0,b0)=>a0[1]-b0[1]||a0[2]-b0[2]).map(x=>opt(x[0])).join('');
    if(xs) h+=`<optgroup label="${esc(label)}">${xs}</optgroup>`;
  }
  if(ks.includes('free')) h+=`<optgroup label="Your own">${opt('free')}</optgroup>`;
  return h;
}
