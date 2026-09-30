// Release notes for the What's new page. Newest first.
// When something user-facing ships: add an entry here and bump package.json's version
// to match (a test enforces it, and the deploy tag carries it).
const RELEASES=[
  {v:'1.7',date:'2026-09-30',title:'Upper body, travel weeks and a new mark',items:[
    'Optional upper-body power on Thursdays. Each phase gives you movement slots \u2014 a total-body throw, a push, rotation, a pull \u2014 and you pick what fills each one from what you have: slams, scoop tosses and wall throws with a med ball, plyo push-ups and explosive pull-ups with nothing, DB snatches, high pulls and speed presses with a bar, or band rows and rotational punches on the road. Every movement has a full entry in the Guide. Off by default, five minutes, and the first block to cut when you are pulling back.',
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
