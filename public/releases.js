// Release notes for the What's new page. Newest first.
// One entry per release, and a release is what went out in one deploy run. Once an entry
// has shipped it is history: never add to it, start a new one and bump the minor version.
// package.json's version has to match the top entry (a test enforces it, and the deploy
// tag carries it), so the two move together.
const RELEASES=[
  {v:'1.17',date:'2026-10-01',title:'Define your own lift variants',items:[
    'The generic Back squat has gone from the squat list. If you are back squatting it is high bar, low bar or a safety squat bar, so those are the choices \u2014 high bar is the reference the others are measured against, and the safety squat bar has joined at about 90% of it.',
    'Setup \u2192 Lift variants will take your own, for either lift: a name and what share of the reference lift it carries. Pin squats, tempo work, a bar the list has never heard of. They appear everywhere the built-in ones do \u2014 the cycle picker, the one-session swap on Today, the export \u2014 and work the same way.',
    'Not sure what percentage to give it? Use what you can actually lift on it against what you lift on the reference. The app says so on the form.']},
  {v:'1.16',date:'2026-10-01',title:'The lift you pick is the lift',items:[
    'Picking trap bar deadlifts now means trap bar deadlifts everywhere \u2014 the 5RM day, every lifting day, the session screen and the export \u2014 and the max you enter is read as that lift\u2019s max, used as it stands. Before, it quietly treated your number as a conventional max and scaled off it, which is not what you asked for.',
    'The choice is per cycle, because that is how Tactical Barbell works: you pick your cluster lifts for a block and run them for the block. Setup \u2192 Lift variants sets this cycle and what later cycles start on, separately.',
    'For one session \u2014 a taken rack, a sore back \u2014 the lift\u2019s card on Today still swaps it, and only that session. The weight is scaled from the lift your cycle is built on and the card says so plainly, so a one-off never looks like a programme change.',
    'Retest and bridge weeks always measure the lift the cycle runs on, even if you swapped a session that week.']},
  {v:'1.15',date:'2026-10-01',title:'The main squat is barbell only',items:[
    'Goblet and double kettlebell front squats have left the squat variants, for the same reason the RDL left the deadlifts: what you can hold runs out long before your legs do, so there is no one-rep max to run the program\u2019s percentages against. Both slots are barbell movements now, and every one of them has a sensible share of your main lift\u2019s max.',
    'They are still in the app where they earn their place \u2014 the travel week\u2019s squat slot now reads goblet, double KB front or DB front squat.',
    'If you had one selected, your squat goes back to the back squat and your maxes are untouched.']},
  {v:'1.14',date:'2026-10-01',title:'RDL is an accessory, not a deadlift',items:[
    'The Romanian deadlift has been taken out of the deadlift variants. It has no lockout and no reset on the floor, so it has no real one-rep max to run percentages against \u2014 it is a hamstring accessory, and it is now named as one in Friday\u2019s posterior chain slot.',
    'If you had it selected, your deadlift goes back to conventional and your maxes are untouched.']},
  {v:'1.13',date:'2026-10-01',title:'Squat and deadlift variants',items:[
    'Pick which squat you are running \u2014 back, high bar, low bar, front, box, paused, Zercher, goblet or double kettlebell front \u2014 and which deadlift: conventional, sumo, trap bar, deficit, snatch-grip, paused, blocks or RDL. Setup \u2192 Lift variants sets the default, and the lift\u2019s card on Today has a picker for swapping a single session.',
    'The weight follows. Each variant carries a share of your main lift\u2019s max \u2014 a front squat at 85%, a trap bar pull at 105%, a deficit at 90% \u2014 and the card says where the number came from. Tested the variant for real? Enter its max in Setup and that is used instead.',
    'Goblet squats, kettlebell front squats and RDLs have no honest percentage of a barbell max, because what you can hold runs out before your legs do. They ask for their own number rather than inventing one.',
    'Your stored maxes do not move, and retest and bridge weeks always measure the reference lift, whatever you have been running day to day. The CSV export gains a variant column.']},
  {v:'1.12',date:'2026-10-01',title:'A weekly check-in',items:[
    'Measurements have moved out of the daily check-in into a weekly one, which sits on Today from the start of each training week until you fill it in \u2014 a weekly number asked for weekly, rather than buried under Optional every morning.',
    'It shows last week\u2019s numbers as placeholders, works out the body-fat estimate as you type, and says how far it has moved since the last one. Log it on any day of the week and it collapses to a one-line summary for the rest of the week.']},
  {v:'1.11',date:'2026-10-01',title:'A burn rate that keeps up with you',items:[
    'Your burn is now a running estimate, recalculated every day from the 28 days behind it, so it follows a metabolism that adapts instead of holding a number worked out once. A Burn over time chart shows it moving \u2014 if it has fallen 200 a day over a long cut, the card says so and suggests a maintenance break rather than a bigger deficit.',
    'It no longer goes quiet while you are getting started. Before there is enough data it is the formula, then a blend, then entirely your own numbers after six weeks of logging weight and calories. The card always says which you are looking at, and how many weeks are left before the formula drops out.',
    'Stop logging calories for a while and it falls back to the formula and tells you, rather than quietly showing a stale number.']},
  {v:'1.10',date:'2026-10-01',title:'Calories, burn rate and body fat',items:[
    'Calories go in the daily check-in, under yesterday\u2019s eating. Once you have a few weeks of them next to your weigh-ins, Status works out what you actually burn: your average intake against what the scale trend did about it. That number is yours, not a formula\u2019s \u2014 it already accounts for your job, your training and your metabolism.',
    'Until there is enough data it falls back to Mifflin-St Jeor from your height, sex, age and activity (new fields in Setup \u2192 About you), and it tells you which of the two you are looking at. The two usually disagree, and when they do, yours wins.',
    'Weekly neck, waist and hip measurements, also in the check-in, turn into a body-fat estimate by the US Navy tape method, charted next to your waist. Expect it to be within 3\u20134 points \u2014 it is a direction, not a number.',
    'If your goal is set to lose or build, the card suggests a daily intake off your measured burn rather than a generic one.',
    'Calories, measurements and the body-fat estimate are in the CSV export too.']},
  {v:'1.9',date:'2026-10-01',title:'Bodyweight, properly charted',items:[
    'Bodyweight has its own card on Status: every weigh-in as a faint line, the 7-day average solid on top of it, and the range switchable between 30 days, 90 days and the whole program. Above the chart: the current average and your latest reading, the change across the range, and the change per week.',
    'The change across a range compares the first few weigh-ins with the last few, rather than the first reading with the last, so one heavy morning cannot set the headline.',
    'It also says how many of the days in the range you actually weighed in on \u2014 the average is only as good as how often you step on the scale.']},
  {v:'1.8',date:'2026-10-01',title:'Status charts',items:[
    'Three additions to Status. Conditioning minutes per week over twelve weeks, counting what you logged or, where you did not, the length that format\u2019s timer would have run. An adherence heatmap: twelve weeks of sessions, green done, red missed, dashed for rest days. And under each lift, the heaviest set you actually completed \u2014 with what it implies about your 1RM when you logged your own weight for it, since a set done exactly as prescribed only restates the max it was calculated from.',
    'Fixed: the account menu\u2019s Profile and settings and What\u2019s new buttons did nothing in 1.7. Sign out was unaffected.']},
  {v:'1.7',date:'2026-09-30',title:'Upper body, travel weeks, a new mark and an account menu',items:[
    'Optional upper-body power on Thursdays. Each phase gives you movement slots \u2014 a total-body throw, a push, rotation, a pull \u2014 and you pick what fills each one from what you have: slams, scoop tosses and wall throws with a med ball, plyo push-ups and explosive pull-ups with nothing, DB snatches, high pulls and speed presses with a bar, or band rows and rotational punches on the road. Every movement has a full entry in the Guide. Off by default, five minutes, and the first block to cut when you are pulling back.',
    'An account button in the top right, showing your initials. Tap it for the address you are signed in as, Profile and settings, What\u2019s new and a plain Sign out \u2014 which was previously one small link near the bottom of Setup. The button also carries a sync dot: green saved, amber saving, red offline or signed out. Setup opens with an Account card saying the same thing.',
    '\u201cPlyo: Extensive\u201d no longer sits on the week header every day of a cycle week. It shows on the plyo day, where it now carries the contact target too (\u201cPlyo: Extensive \u00b7 ~60 contacts\u201d, halved when you halve the session), and the phase description says what extensive means: volume over intensity, plenty of contacts, none of them all-out.',
    'The bridge week\u2019s 5RM+Spin Saturday now has the spin on it: an activity picker, somewhere to log the minutes, and the interval timer, under the lifts. The label promised easy cardio and the card only had the lifts. The retest week\u2019s mobility-only Tuesday is labelled Mobility instead of Easy for the same reason.',
    'Jump tests now warm you up first. The bridge week\u2019s jump day showed the three fields and nothing else \u2014 it now has the warm-up and the pogo/skip/submaximal-jump drills above them, as every retest week does. The vertical and the standing triple jump finally have library entries, so the \u24d8 on each field tells you how to perform it and, more importantly, how to measure it the same way every time.',
    'Travel week: add one from the Plan tab and the cycle pauses for a week of dumbbell and bodyweight work. Nothing touches your maxes and it stays out of the end-of-cycle review.',
    'Launch screens on iPhone instead of a white flash.',
    'A new logo \u2014 the OB monogram \u2014 on the icon, the login page, the launch screen and now in the app header.']},
  {v:'1.6',date:'2026-09-30',title:'Records, coaching and polish',items:[
    'Personal records across every program, with a card on Today whenever you set one.',
    'A week summary at the start of each week: last week\u2019s sessions, readiness and bests, then what this week holds.',
    'Guided warm-up and mobility: one movement at a time, timers that run both sides, and optional auto-advance.',
    'Bodyweight now runs off a 7-day average \u2014 the chart, the weekly rate, your protein target and the trend advice.',
    'Appearance: Match device, Light or Dark, plus gym mode for bigger buttons and firmer edges.',
    'A session complete card listing what was logged and what is still open.',
    'Undo for set ticks, moved days, lowered maxes and more.',
    'Twenty-eight automated tests over the calculations, run before every deploy.']},
  {v:'1.5',date:'2026-09-30',title:'Spoken cues, clarified',items:[
    'Spoken cues have their own Setup card and a Try a cue button. They were off by default and easy to miss.',
    'Deloads and retests moved to their own step in the welcome setup, away from conditioning.',
    'Siri announcements looked into and closed: iOS will not read a web app\u2019s notifications aloud.']},
  {v:'1.4',date:'2026-09-29',title:'Warm-ups, mobility and the calendar',items:[
    'The warm-up is a checklist with hold timers, in full or the seven-minute version.',
    'Every session ends with a mobility block matched to what that day loaded.',
    'A calendar view of the whole plan, and rearranging sessions straight from it.',
    'Move a session to another day and the week reshuffles itself \u2014 never two strength days or two hard conditioning days together.',
    'Hiking joined the conditioning activities, and the last ramp set now gets a full rest before the first working set.']},
  {v:'1.3',date:'2026-09-29',title:'In the gym',items:[
    'Session mode: one set at a time, full screen, with rests starting themselves.',
    'Session mode on test days, ramping to a target and logging the result.',
    'A drawn barbell with your gym\u2019s plates, and a warning when a weight cannot be loaded.',
    'Spoken cues for interval changes and the end of a rest.',
    'Restore from any backup or a downloaded file, with a safety backup taken first.',
    'A guided welcome setup for anyone new.']},
  {v:'1.2',date:'2026-09-29',title:'People, programs and export',items:[
    'Everyone signing in gets their own program, history, backups and alerts.',
    'Archive a program and start over, carrying your maxes or re-testing.',
    'CSV export of sessions and lifts across every program.',
    'A guided interval timer for every Black format.',
    'Choose how often deloads are scheduled, with a check-in every second cycle.',
    'The home-screen app tells you when a new version is ready.']},
  {v:'1.1',date:'2026-09-29',title:'Alerts, plyos and safety nets',items:[
    'Rest alerts that reach the phone while it is locked.',
    'The full plyometric program and exercise library.',
    'Past weeks are locked, so changing a setting never rewrites history.',
    'An end-of-cycle review that suggests each lift\u2019s next max.',
    'Weekly backups, and conditioning on more than the Echo bike.']},
  {v:'1.0',date:'2026-09-29',title:'First release',items:[
    'Operator and Black on a rolling calendar: bridge week, six-week cycles, deloads and retests, with no end date.',
    'Working weights, plate maths, ramp sets and set tracking.',
    'A daily check-in that scores readiness and adjusts the day\u2019s advice.',
    'A Status dashboard for cycle position, adherence and trends.',
    'An offline home-screen app with a per-lift rest timer.',
    'Lift 3 variants, including weighted pull-up maths.']},
];
