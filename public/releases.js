// Release notes for the What's new page. Newest first.
// One entry per release, and a release is what went out in one deploy run. Once an entry
// has shipped it is history: never add to it, start a new one and bump the minor version.
// Rewording a shipped entry is allowed, since the facts are what is history, not the prose.
// Keep it spoken-aloud plain: contractions, few dashes, no neat closing aphorism per bullet.
// package.json's version has to match the top entry (a test enforces it, and the deploy
// tag carries it), so the two move together.
const RELEASES=[
  {v:'1.68',date:'2026-10-08',title:'Distances in your own units',items:[
    'Interval distances for running, trail running and hill sprints were always shown in metres, even with the app set to pounds and miles. They now follow your unit setting like everything else \u2014 yards on imperial, metres on metric.',
    'The rower and ski erg still read in metres whichever setting you use, because that is what the machine in front of you says.']},
  {v:'1.67',date:'2026-10-08',title:'Hill sprints',items:[
    'Hill sprints are their own activity now, rather than something to write into the Other box. Pick them on any hard conditioning day and log the distance, with elevation counted the way it is for trail runs, rucks and hikes.',
    'The card carries the warm-up and the thing worth knowing: the incline caps your top speed, which takes most of the hamstring risk out of sprinting, but they are hard on calves and Achilles and they are a true anaerobic effort. Walk down slowly, and stop when your times start slipping.']},
  {v:'1.66',date:'2026-10-08',title:'What matters today',items:[
    'Before a session you can now pick up to three things to pay attention to \u2014 finishing every set, a proper warm-up, keeping technique tight, stopping short of failure, and so on. Three is the limit on purpose: any more and none of them is a focus.',
    'Afterwards you get an account of them. The ones the app can see \u2014 sets, warm-up, grinders, accessories, mobility \u2014 it counts for you. The ones only you can judge, like technique, ask you once with three buttons.',
    'The note you write at the end is now shown to you before your next session of the same kind. Your last squat note turns up before you squat again. It used to go into a table and stay there.',
    'If the same focus slips two sessions out of three, it says so once \u2014 and for technique it says what that usually means, which is the weight rather than the concentration.']},
  {v:'1.65',date:'2026-10-08',title:'Accessories in session mode',items:[
    'Session mode used to hand you the accessories as one list of tick boxes. Each job is its own step now, after the lifts: it says what is doing it, you can swap it for that session if the bar is taken, and you log the weight and reps as you go.',
    'Each one has its own rest timer, 90 seconds by default rather than the two to five minutes the main lifts use. The \u00b130s buttons on the timer still work if that is wrong for a given movement.',
    'They also count towards the session progress bar now, instead of being invisible to it.']},
  {v:'1.64',date:'2026-10-07',title:'A silent timer says it is silent',items:[
    'If you have Silent timers on, the rest timer now shows a <b>Silent</b> tag you can tap to turn sound back on. It was off the whole time and nothing said so, which reads exactly like a broken beep.',
    'Silent was also suppressing the vibration, which it had no business doing \u2014 vibrating does not interrupt your music. It buzzes now whatever the sound setting says. (iPhones cannot vibrate from a web app at all, so there it really is screen and notifications only, and Setup now says that instead of claiming otherwise.)']},
  {v:'1.63',date:'2026-10-07',title:'Confirmation boxes you can actually type in',items:[
    'Typing an address to confirm an admin restore or removal kicked you out of the box after every character. Fixed \u2014 the caret stays where it was.',
    'Same cause, quieter symptom: in Setup \u2192 Accessories, the \u201cAdd it\u201d button for your own exercise never came alive while you typed a name. It does now.']},
  {v:'1.62',date:'2026-10-07',title:'Restore a backup for someone',items:[
    'An administrator can now list a person\u2019s backups and put one back for them, rather than talking them through doing it themselves.',
    'It works the same way restoring your own does: whatever they have at that moment is saved as a \u201cbefore restore\u201d copy first, so it can be undone from their own Backups screen. It needs their address typed back to confirm, and it is written to the audit log along with which backup it came from.']},
  {v:'1.61',date:'2026-10-07',title:'The audit log keeps up',items:[
    'Exports were being recorded but the panel was showing a snapshot from before you did them. It loads by itself now, has its own Refresh, and the screen\u2019s Refresh reloads it too.',
    'Renamed from \u201cWhat administrators have done\u201d to Audit log, and a removal now says what it actually took \u2014 documents, backups, calendar feed, alerts \u2014 with the time in your own timezone rather than UTC.']},
  {v:'1.60',date:'2026-10-07',title:'Admin is a tab',items:[
    'Administration has moved out of Setup into its own tab, next to Guide. It only appears if your address is named as an administrator, and it stays put when you open the app offline.']},
  {v:'1.59',date:'2026-10-07',title:'Administration',items:[
    'Groundwork for other people using this. If your address is named as an administrator, Setup gains an Administration card: who is using the app, how much they have logged, when they were last active and whether their backups are verifying.',
    'It can export someone\u2019s data whole, and remove an account entirely \u2014 their plan, every session, all their backups, their calendar feed and their alerts. That needs the address typed back to confirm, cannot be aimed at your own account, and is written to a record you cannot edit from the app.',
    'It deliberately cannot read anyone\u2019s training log. Counts and dates are enough to run the thing; their sessions are theirs.',
    'If nobody is named as an administrator, none of this exists.']},
  {v:'1.58',date:'2026-10-07',title:'JM press',items:[
    'Added to the triceps list, alongside the pushdown, skullcrusher, close-grip bench, overhead extension, dip and kickback.']},
  {v:'1.57',date:'2026-10-07',title:'Carries last',items:[
    'On OP3 the carry now comes at the end of the accessories rather than in the middle, so a fried grip is not making the curls and rows that follow it worse.']},
  {v:'1.56',date:'2026-10-07',title:'A shoulder press and a raise',items:[
    'Shoulders were one job doing two things. There is now a Shoulder press on OP1 \u2014 dumbbell press, Arnold press, landmine, push press, machine, kettlebell or pike push-ups \u2014 and a Lateral raise on OP2.',
    'That keeps the overhead pushing away from whichever day your main overhead press lands on, with the raises on the other day where they cost you nothing.',
    'Anything you had already picked or logged for shoulders is treated as the lateral raise, which is what it was.']},
  {v:'1.55',date:'2026-10-07',title:'Shoulders off the press day',items:[
    'Shoulder work moves to OP1 and the row moves to OP2, so side delts are not being hammered on the same day as the overhead press and the row is there to balance it.',
    'Rear delts stay with the shoulders on OP1 rather than following the row \u2014 that slot is shoulder health, not back volume. If you would rather it moved, it is two taps in Setup.',
    'OP1 is now shoulders, rear delt, core, biceps, triceps. OP2 is horizontal pull, pull-ups, biceps, triceps. OP3 is unchanged.',
    'This changes the defaults. If you have already edited a day\u2019s jobs in Setup, that day keeps what you set.']},
  {v:'1.54',date:'2026-10-07',title:'Arms on every lifting day',items:[
    'Biceps and triceps are on all three Operator days now, rather than one each.',
    'Which turned up something: the exercise for a job used to be one choice everywhere, so arms three times a week meant the same curl three times a week. You now pick per day \u2014 barbell curl on Monday, hammer on Wednesday, incline on Friday, if that is what you want.',
    'Setup is tidier as a result. One switch at the top chooses whether you are setting up this cycle or later ones, and each day lists its jobs with the picker right there.',
    'Anything you had already chosen has been carried across to every day that uses it.']},
  {v:'1.53',date:'2026-10-07',title:'Accessories, properly',items:[
    'Accessories are no longer a list of text with a tick. Each lifting day covers a few jobs \u2014 a horizontal pull, some core, a carry \u2014 and you choose the exercise that does each one, from a catalogue of about sixty. Setup \u2192 Accessories.',
    'The choice is per cycle, like your cluster lifts, because that is what it is. And if the barbell is taken, swap it on the day: that session uses what you picked and is logged as it, your block is untouched, and the card marks it \u201ctoday only\u201d.',
    'Sets, weight and reps are logged like the main lifts now, so curls have a history. Or just tap Mark done if you would rather not count.',
    'Missing a movement? Add it under Your own, with the job it does and the kit it needs. It then appears everywhere the built-in ones do.',
    'Old ticks are brought across and pinned to the right job. They used to be stored by position, so editing a day\u2019s list quietly re-pointed every one of them \u2014 that cannot happen now.']},
  {v:'1.52',date:'2026-10-07',title:'Backups that check themselves',items:[
    'Every backup is now read straight back after it is saved and checked against what it should contain. Setup \u2192 Backups says when it was last checked, and warns you loudly if one ever fails. \u201cThere are backups\u201d and \u201cthe backups are good\u201d are different claims.',
    'If you ever use the app on two devices at once and both are offline, and both change the same day, the one that syncs last used to quietly win. It still wins, but the day is now listed in Setup under Changes that crossed, so you can check it rather than wonder.',
    'Behind the scenes: restore, the calendar feed and the data routes all have proper tests now. A day that cannot exist, like the 31st of February, is no longer accepted by either.']},
  {v:'1.51',date:'2026-10-07',title:'A second look at odd numbers',items:[
    'Type a bodyweight of 2050 or a 4000 lb squat and the app now says so underneath the box. It still keeps exactly what you typed \u2014 it is a second look, not a rule.',
    'The ranges are wide on purpose, so a heavy squat or a light bodyweight never gets questioned. They follow your units too, so kilograms and centimetres are judged on their own terms.',
    'The reason it matters: one slipped weigh-in feeds your 7-day average, your protein target, your weighted pull-up load and your burn estimate for a fortnight before it washes out.']},
  {v:'1.50',date:'2026-10-07',title:'If it breaks, it tells you',items:[
    'If the app ever hits a bug while drawing a screen, you now get a short explanation, a Reload button and a Copy details button \u2014 instead of a blank page halfway through a session, which is what used to happen.',
    'The last five problems are listed in Setup under Problems, so if something goes wrong on Tuesday you can still send me the details on Wednesday. They are kept on your phone and never sent anywhere on their own.',
    'Your training is never at risk from this. A drawing error does not touch what you have logged.']},
  {v:'1.49',date:'2026-10-07',title:'Today got quicker',items:[
    'With a year of training logged, the Today screen was taking about seven times longer to redraw than it needed to. Every tap of a set button rebuilt your entire personal-records list eight times over, scanning every session you have ever logged, to render one small card.',
    'It is worked out once now and reused until something actually changes. On a phone that is the difference between a tap feeling instant and feeling like it hesitated.',
    'Nothing looks different and nothing you have logged is affected. The Status tab is unchanged \u2014 it is slower to open than Today, but you open it on purpose rather than mid-set, so it was left as it is.']},
  {v:'1.48',date:'2026-10-07',title:'Icons update when they change',items:[
    'Housekeeping. The home-screen app keeps a copy of the icons, the app manifest and the page itself so it opens instantly offline, and that copy is thrown away and refetched whenever one of them actually changes. It used to depend on me remembering to bump a number by hand, which is the kind of thing that gets forgotten and leaves an old icon on your home screen looking like a failed update.']},
  {v:'1.47',date:'2026-10-07',title:'Backups keep the right things',items:[
    'Your automatic Sunday backups and the ones you take by hand no longer compete for the same space. The last 26 Sundays are kept, about six months, plus the newest six you took yourself and the newest six taken before a restore.',
    'Before this they all shared one pool of 26, so tapping Back up now a few times quietly deleted that many weeks of automatic history. That was the history worth keeping.',
    'Nothing is deleted purely for being old. The most recent backup of each kind stays however long it has been there, so a few months away from training never leaves you with nothing to go back to.']},
  {v:'1.46',date:'2026-10-07',title:'Backups moved',items:[
    'Your weekly backups are stored somewhere better suited to them. Nothing changes in the app: Setup \u2192 Backups looks the same, has the same list and the same Back up now button.',
    'Every backup taken before today is still there and still restorable. Nothing was moved or rewritten \u2014 the app simply looks in both places.']},
  {v:'1.45',date:'2026-10-07',title:'Training time and reminders',items:[
    'The calendar feed can book sessions at the time you actually train instead of leaving them as all-day entries. Setup \u2192 Calendar feed \u2192 In the calendar \u2192 At a set time, then give it your usual time. Weekends can have their own.',
    'Each session takes as long as it really takes: 75 minutes for a lifting day, 90 for a retest, and for conditioning whatever the interval timer says that format runs to, so a 23-minute MAP session books 23 minutes rather than a round hour.',
    'Reminders, off unless you pick one: at the start, or 15 minutes, half an hour, one hour or two hours before. If you keep all-day entries you can still have 8pm the night before, which is the one worth having for packing a bag.',
    'The time is local wherever you are. Set 6am and it stays 6am in another country instead of sliding with the time difference.']},
  {v:'1.44',date:'2026-10-07',title:'How to use the calendar feed',items:[
    'The Guide has a Calendar feed section now, with the actual steps for both phones. iPhone is two taps. Android needs a computer, because Google Calendar won\u2019t add a subscription from the phone app, and then one easy-to-miss step: turn Sync on for the new calendar in the Google Calendar app or it never shows up on the phone.',
    'It also covers what the feed does and doesn\u2019t carry, how often it updates and why Google is slow about it, and how to revoke the address if it ever gets out.',
    'Fixed quietly in the last deploy: the feed used to take a few seconds to fill after you switched it on, so subscribing immediately could fail. It\u2019s ready as soon as the address appears.']},
  {v:'1.43',date:'2026-10-07',title:'The plan in your calendar',items:[
    'Setup \u2192 Calendar feed gives you a private web address for your plan. Subscribe to it and every session turns up in your phone\u2019s calendar as an all-day entry, with the lifts, the sets and reps, and the weight to put on the bar.',
    'On iPhone there\u2019s an Add to iPhone button that opens Calendar straight away. On Android, add the address in Google Calendar on a computer and it syncs down to the phone \u2014 Google refreshes on its own schedule, which can take a day.',
    'It is read-only and it keeps itself up to date. Move a week, change a max, swap a lift, and the calendar follows next time you open the app. Eighteen weeks ahead and a fortnight behind.',
    'The address is private but it isn\u2019t a login, so treat it like a password. New address issues a fresh one and kills the old link. The feed carries your schedule only \u2014 no logs, maxes or measurements.']},
  {v:'1.42',date:'2026-10-07',title:'A version stamp on your data',items:[
    'Housekeeping you shouldn\u2019t ever notice. Your saved data now carries a version number, and the app knows how to bring older data up to date when it loads it.',
    'The useful half: if a phone or tablet is running an out-of-date copy of the app and your data has moved on since, it now stops and tells you instead of saving over something it doesn\u2019t understand. Reload and it\u2019s fine. Before this, an old device could quietly undo a setting and nothing would flag it.',
    'Some old warm-up and set logs were stored in a shape the app has to work around. They\u2019ve been tidied up as part of this.']},
  {v:'1.41',date:'2026-10-07',title:"Swap an exercise on the day",items:[
    "Tap any exercise on a strength-endurance day and you can change it for that session. The bar is taken, so row becomes swings. Pick from everything the app knows, or type your own.",
    "You can add and remove exercises the same way, so a day's circuit doesn't have to be the cluster you set up.",
    "It only touches that day. Your default cluster and every other session stay exactly as they were, and \u201cBack to Barbell\u201d puts the day back if you change your mind."]},
  {v:'1.40',date:'2026-10-07',title:"Base Building",items:[
    "You can drop Tactical Barbell's Block I in as your next cycle. Plan tab, open Change on any future week, and pick Base Building. Eight weeks, straight from the book's template, and Operator picks up afterwards at the same maxes.",
    "Weeks 1 to 5 are endurance and strength-endurance with no barbell work at all. Weeks 6 to 8 taper the long sessions and bring back two strength days and the aerobic HIC sessions.",
    "Strength-endurance circuits are a new session type. Pick a cluster, tick each exercise off per circuit, and the rest timer runs short between exercises and two minutes between circuits.",
    "The book's four clusters are built in, bodyweight, barbell, kettlebell and dumbbell, and you can write your own in Setup. Switch cluster on any single day from the session card.",
    "There is a strength-first version too, which lifts for the first five weeks and does the circuits in the last three. The book only says to reverse it and gives no rep numbers for those late weeks, so the app ramps 3×30, 3×40, 3×50, and says so.",
    "The Guide has the whole eight-week table, the circuit rules and the clusters."]},
  {v:'1.39',date:'2026-10-06',title:"Climbing counts, and a word after you lift",items:[
    "Elevation now turns into distance. A thousand feet of climbing counts as a mile, so five miles with 3,000 ft of gain shows as eight miles flat. The raw numbers stay on screen, the equivalent sits next to them.",
    "That is also what \u201clast\u201d and \u201cbest\u201d compare for trail runs, hikes and rucks, so a brutal climbing day stops looking worse than an easy flat one.",
    "Status has a climbing total: this week, the last four weeks, and whether that is up or down on the four before. The factor is in Setup if a thousand feet isn\u2019t your mile.",
    "After a lifting session there are two more questions. How did it move, easy or about right or hard. And did anything hurt: nothing, a niggle, or sharp pain, and where.",
    "A niggle is only ever reported back to you. Sharp pain on a lift holds its max at the end of the cycle instead of adding to it, twice and it comes down, and the review says which joint it was. Both show on Status if they keep turning up."]},
  {v:'1.38',date:'2026-10-06',title:"Elevation gain on rucks too",items:[
    "Rucking asks for elevation gain now, the same as trail runs and hikes. It sits next to the pack weight, which is the pairing that actually tells you what the session was."]},
  {v:'1.37',date:'2026-10-06',title:"Trail running, and elevation gain",items:[
    "Trail run is in the activity list now, next to Run / sprints. It warms up and advises differently: pace means nothing on uneven ground, so the hard efforts go by breathing, and the downhills are the part that leaves you sore two days later.",
    "Trail runs and hikes have an elevation gain box. Five miles with 100 feet of climbing isn\u2019t five miles with 3,000, and now the log says which one you did.",
    "It shows up in History next to the distance and in the sessions CSV. Nothing in the programming uses it yet, it\u2019s there to be looked at.",
    "Feet if you train in pounds, metres if you train in kilos."]},
  {v:'1.36',date:'2026-10-06',title:"The screen stays on, and the beep comes back",items:[
    "The screen now stays awake for the whole session, not just while a rest is counting. Before, it let go the moment a rest hit zero, so it would go dark while you were actually lifting.",
    "That was also why the rest between working sets often didn\u2019t beep. Once the screen had slept, iOS had muted the app\u2019s audio and the app never woke it back up. It does now, every time you come back to it.",
    "The rest between warm-up sets used to be labelled \u201cRamp rest\u201d, which reads like something off a bike test. It says \u201cWarm-up rest\u201d.",
    "The screen is held while session mode or a guided warm-up is open, and while any timer is running. A paused timer lets it sleep."]},
  {v:'1.35',date:'2026-10-05',title:"A timer for anything",items:[
    "There\u2019s a \u23f1 at the end of the tab row now. Tap it and you get a countdown or a stopwatch, on any tab, with no session started and nothing logged.",
    "Pick 30 seconds, 1, 2, 3, 5 or 10 minutes, or type the minutes you want. \u00b130s while it runs, and pause and resume whenever.",
    "It runs on its own. Start one while a rest or an interval is going and both keep counting, stacked at the bottom of the screen.",
    "It beeps and speaks when it finishes, same as the rest timer, and sends a notification if you have rest alerts on and nothing else is using them.",
    "Lock the phone or reload the app and it\u2019s still right, because it counts to a fixed time rather than ticking. One left running overnight clears itself."]},
  {v:'1.34',date:'2026-10-04',title:"Longer rests between warm-up sets",items:[
    "The rest between ramp sets was 45 seconds, which is too short once the bar gets heavy. It\u2019s 90 seconds now.",
    "You can change it, and it\u2019s per lift. Open the warm-up block on a lift card and pick 30s, 45s, 60s, 90s or 2 min. Deadlift can sit longer than the pulldown if that\u2019s what you want.",
    "The rest before your first working set hasn\u2019t changed. That\u2019s still the lift\u2019s own rest, somewhere between 2 and 5 minutes.",
    "Mid-rest, the \u00b130s buttons on the timer work the same as always, and now they nudge the warm-up rest too."]},
  {v:'1.33',date:'2026-10-02',title:"Add a set without leaving the session",items:[
    "There\u2019s a + at the end of the sets on every lift card now. Tap it and you get another one. It applies to that lift on that day and nothing else, so your program stays put and the next session is back to normal.",
    "Session mode has the same thing: \u201c+ One more set\u201d on the last working set, so you don\u2019t have to drop out of full screen just to decide you\u2019ve got another one in you.",
    "Tapped it by mistake? \u201cRemove the last set\u201d puts it back. Once you\u2019ve ticked a set it stays, so you can\u2019t lose work you actually did.",
    "It stops at ten sets a lift, which is where Ageless Athlete draws the line. Set a higher ceiling for the week in Setup if you want more."]},
  {v:'1.32',date:'2026-10-02',title:"Optional sets",items:[
    "Every week of the wave can have an \u201cUp to\u201d number in Setup now. Leave it blank and nothing changes. Put something higher than the prescribed sets and the extras show up on the lift card as dashed buttons. Take them or don\u2019t; the day counts as done either way.",
    "It\u2019s the one bit of Operator I/A that works on a fixed calendar: you pick the volume session by session. Ageless Athlete goes up to ten sets a lift and reckons a couple of extra ones are the gentlest way to put size on, especially on weighted pull-ups.",
    "Deadlifts have always worked like this, one set required and up to three. They go through the same code as everything else now instead of being a special case in six different places.",
    "The wave table in Setup fits on a phone again."]},
  {v:'1.31',date:'2026-10-02',title:"FOBBITs, from the book this time",items:[
    "The bursts are sets of reps, not timed intervals. The book alternates twenty kettlebell swings with ten snatches per arm. The 30 to 90 second burst picker was something I made up, and it\u2019s gone.",
    "The timer holds at each set now instead of counting down. Step off, do the reps, tap Done, and the base picks up again. That\u2019s how the session actually runs, since only the base is on the clock.",
    "You pick the length: 15 minutes of base for the easy version with the reps halved, 20 standard, 30 hard. The card and the timer finally agree on that number instead of quietly adding the bursts to it.",
    "Movements are named, along with the swaps the book allows. Dumbbells instead of kettlebells, a push-press instead of the snatch, and rowing, skipping, cycling or stairs instead of running."]},
  {v:'1.30',date:'2026-10-02',title:"Run it by the book",items:[
    "The default cadence is the book\u2019s now: two six-week cycles, then a retest. That\u2019s twelve weeks between tests, which it calls the best length for a strength phase. Six weeks is the minimum if you\u2019d rather test often, and waiting longer is fine too. If the loads still feel heavy, keep your numbers and test when they feel solid.",
    "No scheduled deload by default. Operator doesn\u2019t have one. It runs cycles back to back and retests, and the recovery it asks for is a full week or more off every three to six months, which you add from the Plan tab. The scheduled light week is still there if you want it, labelled as ours rather than the book\u2019s.",
    "Setup tells you whether your cadence matches, with a <b>Match the book</b> button that sets both at once and says what it moved. Nothing changes until you tap it."]},
  {v:'1.29',date:'2026-10-02',title:"Checked against the books",items:[
    "Conditioning eases off on the weeks your lifting is heaviest. Weeks 3 and 6 of every cycle are the 90% and 95% weeks, so conditioning drops to fewer rounds and a shorter steady session and the heavy lifting gets the energy. The day says so, so an easy week doesn\u2019t read like one you let slip.",
    "The strength wave checks out. Weeks 5 and 6 really are 3\u00d75 at 85% and 3\u00d72 at 95%. That was the open question sitting behind every heavy week in the app, and nothing needed changing.",
    "FOBBITs were timed wrong. The twenty minutes counts the easy base only, so the bursts sit on top and the whole thing runs about thirty. Ten bursts now, not six, and the timer alternates Burst A and Burst B because the session alternates two movements.",
    "The rest note on heavy squat and deadlift days gives the real figure: five to ten minutes is normal at that load, not five."]},
  {v:'1.28',date:'2026-10-02',title:"FOBBITs can\u2019t be benchmarks",items:[
    "A FOBBIT has no single number you can compare between sessions, since the work is whichever movement you picked. So it\u2019s off the benchmark list. Pinning one would have left Status telling you the benchmark was overdue no matter how many you\u2019d done.",
    "They still count everywhere else: the weekly minutes, the rotation nudge and the log."]},
  {v:'1.27',date:'2026-10-02',title:"FOBBITs",items:[
    "FOBBIT is a conditioning format now. You keep moving on an easy base (slow jog, skipping, easy spin) and break it every two minutes with a 30 to 90 second burst of something else: kettlebell swings, burpees, a sandbag. Twenty minutes, no ground to cover, hardly any kit.",
    "The timer runs it the right way round for once. It opens on the base, puts a base either side of every burst, and doesn\u2019t bolt a warm-up on the front, since the base already is one. Burst length is pickable at 30, 45, 60 or 90 seconds.",
    "There\u2019s no calorie or distance box, because the work is whatever movement you chose. You log the minutes, the bursts and what you did. The card also says the thing that\u2019s easy to get wrong: past 30 minutes it stops counting as a HIC and turns into an easy session."]},
  {v:'1.26',date:'2026-10-02',title:"Tidying after a full read-through",items:[
    "The suggested-minutes explanation is its own sentence now, instead of trailing off a dash after the button.",
    "The lift and the Lift 3 swap both say \u201cthis session\u201d. One of them used to say \u201ctoday\u201d for the same thing."]},
  {v:'1.25',date:'2026-10-02',title:"Fix the squashed banners",items:[
    "The blue Bridge week notice, and every other info banner, was being crushed into a 22-pixel circle with its text spilling out behind the cards. The style for the new movement info button shared a name with the banner\u2019s own. Both look right again."]},
  {v:'1.24',date:'2026-10-02',title:"Make the info button work",items:[
    "The little info marker next to each warm-up and mobility movement did nothing when you tapped it in 1.23. It\u2019s a real button now. Tapping it opens the movement underneath the row, and leaves the tick box alone, which the old one didn\u2019t."]},
  {v:'1.23',date:'2026-10-02',title:"The warm-up explains itself",items:[
    "All 28 warm-up and mobility movements get the same treatment as the plyo drills and jump tests: setup, execution, cues, and the mistakes that actually matter. Tap the name on any checklist and it opens underneath, and the whole lot is browsable in the Guide.",
    "They\u2019re written around how these go wrong rather than how they go right. The couch stretch is useless without the pelvic tuck, knee-to-wall is useless if your heel lifts, and a bent-knee calf stretch is a different muscle from the straight-leg one rather than a repeat of it."]},
  {v:'1.22',date:'2026-10-02',title:"A note that counts",items:[
    "The bridge week\u2019s 5RM+Spin Saturday said \u201ctest these first, two lifts per day keeps the numbers honest\u201d even on days it only had one lift. With two Lift 3 movements turned on, Friday takes one and Saturday takes the other, so it names that lift now instead of talking about two."]},
  {v:'1.21',date:'2026-10-02',title:"Pull-up road, benchmarks and plan previews",items:[
    "A pull-up card on Status that strings your test sets into a road: hangs and negatives, band-assisted volume, clean reps, ready to load, weighted. It tells you which rung you\u2019re on and how many reps to the next one, and Wednesday\u2019s pull-up accessory prescribes that rung instead of a generic line.",
    "Benchmark conditioning sessions. Pick one activity and format, repeat it, and compare it against itself. It\u2019s charted on Status and chased up on the day it\u2019s due. The app picks the pairing you repeat most until you pin one in Setup \u2192 Conditioning.",
    "The app notices when you stop rotating. Six hard sessions in a row on the same format or the same machine gets you a nudge, because Black rotates on purpose.",
    "Changing the deload cadence, or adding, skipping or removing a week, now tells you what moved (\u201cretest 11/30 \u2192 12/7\u201d) in the undo toast instead of silently re-planning everything after it."]},
  {v:'1.20',date:'2026-10-01',title:"Show the arithmetic",items:[
    "The suggested minutes show their working now: \u201cUse 23 min \u2014 8 min warm-up + 15 min of intervals, from 8 rounds (there is no easy period after the last one, so 8 \u00d7 hard + 7 \u00d7 easy)\u201d. Eight rounds of a minute on and a minute off is fifteen minutes of work, not sixteen, because the timer doesn\u2019t make you stand there resting once the last one is done.",
    "The warm-up checkbox says what it costs: five minutes plus three pickups is about eight, not five."]},
  {v:'1.19',date:'2026-10-01',title:"Silent timers, and minutes without them",items:[
    "Silent timers, in Setup \u2192 Sound. On iPhone, any sound a web app makes takes over the audio session and pauses your music, which is why the interval timer kept stopping it. Silent turns off the beeps and the spoken cues and leaves the countdown, the vibration and the screen to do the work, so your music keeps going. Rest alerts still arrive as notifications, which never touch audio.",
    "You can log minutes on any conditioning session now, not just LISS. There\u2019s a one-tap button with the planned length of that format, including whatever warm-up and cool-down you ticked. Change it if you did more or less.",
    "If you do use the timer, it records the minutes it actually ran when you finish, for every format rather than only LISS.",
    "The minutes-per-week card shows this week\u2019s total while it\u2019s still your only week, instead of nothing at all."]},
  {v:'1.18',date:'2026-10-01',title:"Fold the weekly check-in away",items:[
    "Once the weekly check-in has measurements in it, it collapses to one line with the date and your body fat, and you can fold it shut. Before, it only did that if you\u2019d logged on an earlier day, so filling it in this morning left the whole form sitting on Today for the rest of the day.",
    "Open it again and the numbers are still editable, so a typo is one tap away rather than a lost week."]},
  {v:'1.17',date:'2026-10-01',title:"Define your own lift variants",items:[
    "The generic Back squat has gone from the squat list. If you\u2019re back squatting it\u2019s high bar, low bar or a safety squat bar, so those are the choices. High bar is the reference the others are measured against, and the safety squat bar has joined at about 90% of it.",
    "Setup \u2192 Lift variants will take your own, for either lift: a name, and what share of the reference lift it carries. Pin squats, tempo work, a bar the list has never heard of. They turn up everywhere the built-in ones do, including the cycle picker, the one-session swap on Today and the export, and they work the same way.",
    "Not sure what percentage to give it? Use what you can actually lift on it against what you lift on the reference. The form says so."]},
  {v:'1.16',date:'2026-10-01',title:"The lift you pick is the lift",items:[
    "Pick trap bar deadlifts and you get trap bar deadlifts everywhere: the 5RM day, every lifting day, the session screen and the export. The max you enter is read as that lift\u2019s max and used as it stands. Before, it quietly treated your number as a conventional max and scaled off it, which isn\u2019t what you asked for.",
    "The choice is per cycle, because that\u2019s how Tactical Barbell works. You pick your cluster lifts for a block and run them for the block. Setup \u2192 Lift variants sets this cycle and what later cycles start on, separately.",
    "For one session, a taken rack or a sore back, the lift\u2019s card on Today still swaps it and only that session. The weight is scaled from the lift your cycle is built on and the card says so plainly, so a one-off never looks like a program change.",
    "Retest and bridge weeks always measure the lift the cycle runs on, even if you swapped a session that week."]},
  {v:'1.15',date:'2026-10-01',title:"The main squat is barbell only",items:[
    "Goblet and double kettlebell front squats have left the squat variants, for the same reason the RDL left the deadlifts: what you can hold runs out long before your legs do, so there\u2019s no one-rep max to run the program\u2019s percentages against. Both slots are barbell movements now, and every one of them has a sensible share of your main lift\u2019s max.",
    "They\u2019re still in the app where they earn their place. The travel week\u2019s squat slot reads goblet, double KB front or DB front squat.",
    "If you had one selected, your squat goes back to the back squat and your maxes are untouched."]},
  {v:'1.14',date:'2026-10-01',title:"RDL is an accessory, not a deadlift",items:[
    "The Romanian deadlift is out of the deadlift variants. No lockout and no reset on the floor, so there\u2019s no real one-rep max to run percentages against. It\u2019s a hamstring accessory, and it\u2019s named as one in Friday\u2019s posterior chain slot now.",
    "If you had it selected, your deadlift goes back to conventional and your maxes are untouched."]},
  {v:'1.13',date:'2026-10-01',title:"Squat and deadlift variants",items:[
    "Pick which squat you\u2019re running (back, high bar, low bar, front, box, paused, Zercher, goblet or double kettlebell front) and which deadlift (conventional, sumo, trap bar, deficit, snatch-grip, paused, blocks or RDL). Setup \u2192 Lift variants sets the default, and the lift\u2019s card on Today has a picker for swapping a single session.",
    "The weight follows. Each variant carries a share of your main lift\u2019s max: a front squat at 85%, a trap bar pull at 105%, a deficit at 90%. The card says where the number came from. Tested the variant for real? Enter its max in Setup and that gets used instead.",
    "Goblet squats, kettlebell front squats and RDLs have no honest percentage of a barbell max, because what you can hold runs out before your legs do. They ask for their own number rather than inventing one.",
    "Your stored maxes don\u2019t move, and retest and bridge weeks always measure the reference lift, whatever you\u2019ve been running day to day. The CSV export gets a variant column."]},
  {v:'1.12',date:'2026-10-01',title:"A weekly check-in",items:[
    "Measurements have moved out of the daily check-in into a weekly one. It sits on Today from the start of each training week until you fill it in, so a weekly number gets asked for weekly instead of being buried under Optional every morning.",
    "It shows last week\u2019s numbers as placeholders, works out the body-fat estimate as you type, and says how far it\u2019s moved since the last one. Log it on any day of the week and it collapses to a one-line summary for the rest of the week."]},
  {v:'1.11',date:'2026-10-01',title:"A burn rate that keeps up with you",items:[
    "Your burn is a running estimate now, recalculated every day from the 28 days behind it, so it follows a metabolism that adapts instead of holding a number worked out once. A Burn over time chart shows it moving. If it\u2019s fallen 200 a day over a long cut, the card says so and suggests a maintenance break rather than a bigger deficit.",
    "It doesn\u2019t go quiet while you\u2019re getting started. Before there\u2019s enough data it\u2019s the formula, then a blend, then entirely your own numbers after six weeks of logging weight and calories. The card always says which one you\u2019re looking at, and how many weeks are left before the formula drops out.",
    "Stop logging calories for a while and it falls back to the formula and tells you, instead of quietly showing a stale number."]},
  {v:'1.10',date:'2026-10-01',title:"Calories, burn rate and body fat",items:[
    "Calories go in the daily check-in, under yesterday\u2019s eating. Once you\u2019ve got a few weeks of them next to your weigh-ins, Status works out what you actually burn: your average intake against what the scale trend did about it. That number is yours, not a formula\u2019s. It already accounts for your job, your training and your metabolism.",
    "Until there\u2019s enough data it falls back to Mifflin-St Jeor from your height, sex, age and activity (new fields in Setup \u2192 About you), and it tells you which of the two you\u2019re looking at. The two usually disagree, and when they do, yours wins.",
    "Weekly neck, waist and hip measurements, also in the check-in, turn into a body-fat estimate by the US Navy tape method, charted next to your waist. Expect it to be within 3 or 4 points. It\u2019s a direction, not a number.",
    "If your goal is set to lose or build, the card suggests a daily intake off your measured burn rather than a generic one.",
    "Calories, measurements and the body-fat estimate are in the CSV export too."]},
  {v:'1.9',date:'2026-10-01',title:"Bodyweight, properly charted",items:[
    "Bodyweight has its own card on Status: every weigh-in as a faint line, the 7-day average solid on top of it, and the range switchable between 30 days, 90 days and the whole program. Above the chart you get the current average, your latest reading, the change across the range and the change per week.",
    "The change across a range compares the first few weigh-ins with the last few rather than the first reading with the last, so one heavy morning can\u2019t set the headline.",
    "It also says how many of the days in the range you actually weighed in on. The average is only as good as how often you get on the scale."]},
  {v:'1.8',date:'2026-10-01',title:"Status charts",items:[
    "Three additions to Status. Conditioning minutes per week over twelve weeks, counting what you logged or, where you didn\u2019t, the length that format\u2019s timer would have run. An adherence heatmap: twelve weeks of sessions, green for done, red for missed, dashed for rest days. And under each lift, the heaviest set you actually completed, with what it implies about your 1RM when you logged your own weight for it. A set done exactly as prescribed only restates the max it was calculated from.",
    "Fixed: the account menu\u2019s Profile and settings and What\u2019s new buttons did nothing in 1.7. Sign out was fine."]},
  {v:'1.7',date:'2026-09-30',title:"Upper body, travel weeks, a new mark and an account menu",items:[
    "Optional upper-body power on Thursdays. Each phase gives you movement slots (a total-body throw, a push, rotation, a pull) and you fill each one from whatever you\u2019ve got: slams, scoop tosses and wall throws with a med ball, plyo push-ups and explosive pull-ups with nothing, DB snatches, high pulls and speed presses with a bar, or band rows and rotational punches on the road. Every movement has a full entry in the Guide. Off by default, five minutes, and the first block to cut when you\u2019re pulling back.",
    "An account button in the top right with your initials. Tap it for the address you\u2019re signed in as, Profile and settings, What\u2019s new, and a plain Sign out, which used to be one small link near the bottom of Setup. The button carries a sync dot too: green saved, amber saving, red offline or signed out. Setup opens with an Account card saying the same thing.",
    "\u201cPlyo: Extensive\u201d no longer sits on the week header every day of a cycle week. It shows on the plyo day, where it carries the contact target as well (\u201cPlyo: Extensive \u00b7 ~60 contacts\u201d, halved when you halve the session), and the phase description says what extensive means: volume over intensity, plenty of contacts, none of them all-out.",
    "The bridge week\u2019s 5RM+Spin Saturday has the spin on it now: an activity picker, somewhere to log the minutes, and the interval timer, under the lifts. The label promised easy cardio and the card only had the lifts. The retest week\u2019s mobility-only Tuesday is labelled Mobility instead of Easy for the same reason.",
    "Jump tests warm you up first. The bridge week\u2019s jump day showed the three fields and nothing else. It now has the warm-up and the pogo/skip/submaximal-jump drills above them, like every retest week does. The vertical and the standing triple jump finally have library entries, so the \u24d8 on each field tells you how to perform it and, more to the point, how to measure it the same way every time.",
    "Travel week: add one from the Plan tab and the cycle pauses for a week of dumbbell and bodyweight work. Nothing touches your maxes and it stays out of the end-of-cycle review.",
    "Launch screens on iPhone instead of a white flash.",
    "A new logo, the OB monogram, on the icon, the login page, the launch screen and now the app header."]},
  {v:'1.6',date:'2026-09-30',title:"Records, coaching and polish",items:[
    "Personal records across every program, with a card on Today whenever you set one.",
    "A week summary at the start of each week: last week\u2019s sessions, readiness and bests, then what this week holds.",
    "Guided warm-up and mobility: one movement at a time, timers that run both sides, and optional auto-advance.",
    "Bodyweight runs off a 7-day average now, for the chart, the weekly rate, your protein target and the trend advice.",
    "Appearance: Match device, Light or Dark, plus gym mode for bigger buttons and firmer edges.",
    "A session complete card listing what was logged and what\u2019s still open.",
    "Undo for set ticks, moved days, lowered maxes and more.",
    "Twenty-eight automated tests over the calculations, run before every deploy."]},
  {v:'1.5',date:'2026-09-30',title:"Spoken cues, clarified",items:[
    "Spoken cues have their own Setup card and a Try a cue button. They were off by default and easy to miss.",
    "Deloads and retests moved to their own step in the welcome setup, away from conditioning.",
    "Siri announcements looked into and closed: iOS won\u2019t read a web app\u2019s notifications aloud."]},
  {v:'1.4',date:'2026-09-29',title:"Warm-ups, mobility and the calendar",items:[
    "The warm-up is a checklist with hold timers, in full or the seven-minute version.",
    "Every session ends with a mobility block matched to what that day loaded.",
    "A calendar view of the whole plan, and rearranging sessions straight from it.",
    "Move a session to another day and the week reshuffles itself. It won\u2019t put two strength days or two hard conditioning days together.",
    "Hiking joined the conditioning activities, and the last ramp set now gets a full rest before the first working set."]},
  {v:'1.3',date:'2026-09-29',title:"In the gym",items:[
    "Session mode: one set at a time, full screen, with rests starting themselves.",
    "Session mode on test days, ramping to a target and logging the result.",
    "A drawn barbell with your gym\u2019s plates, and a warning when a weight can\u2019t be loaded.",
    "Spoken cues for interval changes and the end of a rest.",
    "Restore from any backup or a downloaded file, with a safety backup taken first.",
    "A guided welcome setup for anyone new."]},
  {v:'1.2',date:'2026-09-29',title:"People, programs and export",items:[
    "Everyone signing in gets their own program, history, backups and alerts.",
    "Archive a program and start over, carrying your maxes or re-testing.",
    "CSV export of sessions and lifts across every program.",
    "A guided interval timer for every Black format.",
    "Choose how often deloads are scheduled, with a check-in every second cycle.",
    "The home-screen app tells you when a new version is ready."]},
  {v:'1.1',date:'2026-09-29',title:"Alerts, plyos and safety nets",items:[
    "Rest alerts that reach the phone while it\u2019s locked.",
    "The full plyometric program and exercise library.",
    "Past weeks are locked, so changing a setting never rewrites history.",
    "An end-of-cycle review that suggests each lift\u2019s next max.",
    "Weekly backups, and conditioning on more than the Echo bike."]},
  {v:'1.0',date:'2026-09-29',title:"First release",items:[
    "Operator and Black on a rolling calendar: bridge week, six-week cycles, deloads and retests, with no end date.",
    "Working weights, plate maths, ramp sets and set tracking.",
    "A daily check-in that scores readiness and adjusts the day\u2019s advice.",
    "A Status dashboard for cycle position, adherence and trends.",
    "An offline home-screen app with a per-lift rest timer.",
    "Lift 3 variants, including weighted pull-up maths."]},
];
