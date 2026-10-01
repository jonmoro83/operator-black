# Roadmap

What's built, what's open, and what might come next for the Operator + Black app.
Update it as things ship. Last updated 2026-10-01.

This file is the working record, written for whoever is building. The user-facing
summary of each release lives in `public/releases.js` and shows up in the app under
Setup → About this app → What's new.

## Open issues

Known gaps and things to verify. Fix or close these before starting new features.

- **iPhone testing, still to confirm at the gym:** offline launch, the rest-timer beep
  (ringer switch, backgrounding), whether the screen really stays awake during a rest,
  and the interval timer on the bike. Confirmed so far: home-screen install, Access login
  in the installed app, the update banner, rest alerts arriving on the lock screen, and
  spoken cues through AirPods with the app open.
- **Retest Saturday tests more than two lifts** when several Lift 3 variants are on
  (deadlift + pulldown + OHP, plus pull-ups). Program notes say two per test day.
  Bridge week already splits them; retest week doesn't yet.
- **The current week can still re-plan.** Only fully past weeks are locked, so changing
  deload/retest spacing mid-week can change this week's type.
- **Accessory ticks are stored by position.** Editing a day's list in Setup shifts
  which movement older checkmarks line up with.
- **Conditioning "last/best" across programs** only counts sessions whose format and
  activity are stored. Programs archived by the app stamp them automatically.
- **Content to verify against the book:**
  - Wave weeks 5–6 (sources disagree: 3×5 @ 85% / 3×2 @ 95% vs 3×3 @ 85% / 3×1 @ 95%).
  - The deload prescription (2×5 @ 60%), bridge/retest day layout, and deadlift and
    test ramps are app choices, not from the book.
- **Plyo PDF is a 10-week block with a week-10 jump retest.** The app runs its three
  phases back to back (9-week rotation) and tests jumps in the program's retest weeks
  instead, as the 18-week summary does.
- **Interval alerts arrive 1–3 s late** when the phone is locked (Apple push delivery).
  Fine for minutes-long intervals; on 30 s anaerobic work, keep the screen on and use
  the in-app beeps.
- **Rest alerts fire even with the app open**, so you get the in-app beep and a
  notification together. iOS expects every push to show a notification, so this is
  deliberate.

## Next up

- **Tune the end-of-cycle review after Cycle 1.** Blocked until there is a finished
  cycle: the first review appears Fri 2026-11-13. Then check whether the grinder /
  missed-set / heavy-week-RPE thresholds suggested sensible next maxes, and adjust
  `recommend()` if they did not.

Nothing else is committed. Pull from Ideas below, or from whatever the gym turns up.

## Ideas

Not committed to. Roughly in order of how useful they'd be.

- **Calendar feed:** the plan in iPhone Calendar with weights, auto-updating.
- **Share with a partner or coach:** opt-in, read-only progress view.
- **Half-minute rest options** (2:30, 3:30) in the per-lift rest picker.
- **Per-set effort:** RPE or "fast/slow" per working set, feeding the cycle review.
- **Retest planner:** split retest lifts across days automatically (two per day), like
  the bridge week does.
- **Move backups to R2** if it gets enabled on the account (browsable in the dashboard).

## Parked

Decided against for now.

- **Spoken cues with the phone locked.** Closed 2026-09-30 as an iOS limitation.
  Notifications are delivered correctly to the lock screen, but Siri's Announce
  Notifications never reads them: iOS announces only Time Sensitive notifications and
  direct messages, and a web app cannot mark a notification Time Sensitive. Verified
  with AirPods Pro, the app enabled in the Announce list, and a unique tag per
  notification. Nothing further is available from the app side.
- **Locked-phone audio track.** Built and tested (one pre-rendered 8 kHz WAV per session
  from tones plus `say`-generated clips; the 100-second test played correctly with the
  phone locked), then removed at the user's request — it pauses music and is the wrong
  trade. See commit a983b65 if it is ever wanted again.
  **What works instead:** in-app spoken cues whenever the screen is on, with Auto-Lock
  set to Never for a session.
- **AI coach (Claude API):** weekly summary and Q&A over the training log. Not feasible
  right now because of API cost. Revisit if that changes.

## Shipped

Newest first. The user-facing version of each entry is in `public/releases.js`.

**Settings done in Cloudflare**
- Deploys: closed as not needed. Changes go live with `npm run deploy` (wrangler,
  tagged with the commit). Pushing to GitHub does **not** deploy on its own; the
  Workers Builds connection has never triggered (last checked 2026-09-29).
- Access session duration set to 1 month. To add a person: Zero Trust → Access →
  Applications → Operator Black → policy → add their email (details in README).

**More Status charts (2026-10-01)**
- **Conditioning minutes per week**, twelve weeks, at the top of the Conditioning card.
  Only LISS asks you for minutes, so `hicMinutes()` uses what you logged and otherwise
  counts the session the interval timer would have run for that format — warm-up,
  rounds, rest and cool-down — and the card says which it did. The current week is drawn
  hollow and left out of the four-week average, since it is still running.
- **Adherence heatmap**: twelve weeks × seven days under the adherence percentages,
  coloured by the same `sessState()` the week dots use, with the week label (C2W5, DL,
  RT, Br, Tr) down the side. Weeks before the start are not drawn.
- **Estimated 1RM from logged top sets** was in Ideas, and is a trap in this program:
  the working weight is computed *from* the max, so a set done exactly as prescribed
  implies `pct / PCT5[reps]` × max every time — always below it, and nothing to do with
  how the set felt. Printing it invites the wrong conclusion. What shipped instead, under
  each lift's chart: the heaviest set you actually completed (weight × reps, percentage,
  date), plus a claim about your 1RM **only** when you logged your own weight in session
  mode (`lifts.<k>.used`), and a note when it ground, which is what the cycle review reads.

**First live backup confirmed (2026-10-01)**
- Setup → Back up now wrote `backup:<hash>:2026-09-30-manual` to the KV namespace:
  plan, three logs and the `user`/`backedUpAt` envelope the restore path expects. The
  binding, the write and the metadata all work, so the Sunday 09:00 UTC cron has nothing
  left to prove. Restore from a backup is still untested against real data.

**Account menu in the header (2026-09-30)**
- Signing out was one `small` link inside the About this app card, near the bottom of
  Setup. There is now an avatar button in the header (initials from the Access email)
  opening a menu: signed-in address, sync status in words, Profile and settings, What's
  new, Sign out. Setup opens with an Account card carrying the same, and the About card
  keeps only versions.
- The button doubles as the sync indicator. The brand row cannot hold the wordmark, the
  status text and the avatar at phone widths, so `#status` is hidden below 520px and a
  coloured dot on the avatar carries the state, with the words inside the menu. The
  wordmark steps down at 400/360/340px so the button always fits.
- The two menu items shipped dead and were fixed the next morning (2026-10-01).
  Two gotchas behind it. The `data-act` click handler is bound to `#main`, so static markup
  in the header that carries `data-act` looks wired and does nothing — the menu items use
  `data-view` and the shell's own listener instead, and a test now fails on any `data-act`
  inside `<header>`. And those breakpoints have to sit after the base `.brand h1` rule in
  `app.css`: same specificity, so source order decides.

**The plyo phase label (2026-09-30)**
- The day header carried `Plyo: <phase>` on every day of a cycle week. The wave
  prescription belongs there because it applies to three days; the plyo phase applies to
  one, so the other six days showed unexplained jargon with no number on it. It now
  renders only on `plyohic`/`plyobase` days, with the contact target beside it and halved
  when the session is. The Plan tab's week listing keeps it — that view is week-level.
- The Extensive phase description now says what the word means.

**Days say what they contain (2026-09-30)**
- The bridge week's Saturday is labelled `5RM+Spin` when Lift 3 has two movements to
  test, and the note asked for 30–40 min of easy cardio, but the day rendered only the
  lift tests: nowhere to pick an activity, log the minutes or run the timer. The day plan
  now carries `cardio:true, fmt:'liss'` and the test branch renders `hicCard` under the
  lifts, so the ride is logged like any other LISS session (and reaches the CSV, the
  conditioning records and the day summary, which already keyed off `L.hic`).
- The retest week's mobility-only Tuesday was also labelled `Easy`, which reads like a
  conditioning day; it is `Mobility` now. A test walks every scheduled day and fails if
  one whose label mentions conditioning has no card to log it on.

**Jump tests get a warm-up and an entry each (2026-09-30)**
- The bridge week's jump day rendered the three test fields and nothing else: three
  maximal attempts, cold. Both jump-test days (bridge Thursday and every retest week)
  now show the general warm-up and the jump drills above the tests, in that order. The
  drills moved out of `plyoCard` into `plyoWarmBlock` so the two days share one block
  and one set of ticks.
- Library entries for the vertical and the standing triple jump, which the PDF tests but
  never described, with an ⓘ on each field of the jump card and a Jump tests group in
  the Guide's library. Both entries lead on measurement: a vertical is meaningless
  without the same standing reach every time.

**Optional upper-body power (2026-09-30)**
- A block on the Thursday plyo card, off by default (`plan.plyoUpper`). Operator's bench
  is deliberately sub-maximal and the bike does nothing above the waist, so there is a
  genuine gap; it is small, capped at about five minutes, and the first thing the
  pull-back banner tells you to cut.
- Each phase is movement *slots*, not fixed exercises: a total-body throw, a push,
  rotation, a pull. What fills a slot is a per-phase choice stored in `plan.plyoUp`, so
  the same block runs with a med ball, with nothing (plyo push-ups, explosive pull-ups),
  with a barbell (DB snatch, high pull, speed press) or with one band on the road. Reps
  and rest come from the chosen movement, and all twelve have full Guide entries.
- Throws are counted separately from ground contacts, the sets halve with the cut toggle,
  and each tick starts that movement's rest timer.

**Travel week and launch screens (2026-09-30)**
- Travel week: add one from the Plan tab and the cycle pauses for a week of dumbbell and
  bodyweight work (three sessions with rep targets, conditioning and plyos unchanged).
  Nothing touches your maxes, and because it is not a cycle week the end-of-cycle review
  ignores it. Movements are editable in Setup → Travel week.
- Launch screens for ten iPhone sizes instead of a white flash, generated by
  `node tools/splash.js`. They live under `/brand/splash/` so the existing Access bypass
  serves them before sign-in — iOS fetches them without a session.

**Source split into files (2026-09-30)**
- `src/app/*.js` (22 ordered sections) joined by `build.js` into `public/app.js`;
  `index.html` is down to 74 lines. Deliberately concatenation rather than ES modules:
  251 functions share mutable state, so real modules would mean either a large state
  refactor or hand-maintained import lists for every symbol. The bundle is byte-identical
  to the script it replaced. The build stamps a content hash on the asset tags so the
  update banner still fires, `npm test`/`npm run deploy` build first, and CI fails if the
  committed bundle has drifted from its sources.

**Smaller index.html (2026-09-30)**
- Styles moved to `public/app.css` and the release notes to `public/releases.js`,
  taking `index.html` from 3,148 to 2,728 lines with no build step and no behaviour
  change. The service worker caches both and refreshes them in the background, so a
  style or notes change lands on the next load without bumping its VERSION.

**Release notes and a fix (2026-09-30)**
- **What's new** page listing every release and what it added, reached from Setup →
  About this app and from the update banner. When something user-facing ships, add a
  `RELEASES` entry and bump `package.json`'s version to match — a test enforces it, and
  the deploy tag (`v<version>-<commit>`) carries it so About this app can name both the
  running and the deployed release.
- About this app leads with the release version ("1.6 · Records, coaching and polish")
  instead of the asset fingerprint, which is now fine print. `APP_VERSION` comes from
  `RELEASES[0].v`; `tagVersion()` parses the deployed tag for the Latest row.
- Restored the **About this app** card, which a bad edit removed alongside the audio-cue
  card in `eed4fc2` (signed-in address, versions, update check). A test now asserts every
  Setup card is present so that cannot happen quietly again.

**Tests and undo (2026-09-30)**
- 31 tests over the calculations, run by `npm test`, before every deploy, and on every
  push via GitHub Actions. `test/harness.js` loads the app's script into Node against a
  stub DOM, so no browser is needed. Two of them guard the app's shape rather than its
  maths: every Setup card is present, and the version numbers agree.
- Undo for the taps that are easy to get wrong: set ticks, marking a session done,
  lowering a max, adding/skipping/removing a week, moving days, resetting a week's
  order, clearing the warm-up or mobility, and applying a review or test results.

**Data safety**
- Past weeks and finished cycles' maxes locked against settings changes.
- End-of-cycle review with suggested max changes, applied on approval.
- Weekly backups to Workers KV (26 kept), listed in Setup with Back up now.

**Averages, appearance, polish (2026-09-30)**
- Bodyweight runs off a 7-day rolling average (`bwAvg`/`bwFor`/`bwRate`): the Status
  chart plots the average with the weekly rate, the protein target and weighted pull-up
  loads use it, and the trend advice compares averages 14 days apart instead of two raw
  weigh-ins. Falls back to the latest single reading until the window has two.
- Appearance in Setup, per device: Match device / Light / Dark, plus gym mode (bigger
  buttons and inputs, firmer borders). An explicit theme also moves the phone's status
  bar colour.
- Session complete card on a finished day listing what was logged and what's still open;
  a tick animation on the set you just pressed; clearer empty states.

**Records, week summary, guided blocks (2026-09-30)**
- Personal records across every program (tested 1RMs, pull-ups, all three jumps, best
  result per conditioning activity and format), on Status with the date and the gain.
  A day that sets one shows a "New personal best" card on Today with the value it beat.
- Week summary on Today at the start of each week: last week's sessions, readiness and
  bests, then what this week holds and when the next deload and retest fall. Dismissable.
- Guided run through the warm-up and mobility blocks: full screen, one movement at a
  time, timed items count down (both sides where the dose says per side), rep items wait
  for a tap, each one ticked off as it completes. **Auto-advance** is a toggle in the
  runner (`plan.guideAuto`): on, it flows straight into the next side and movement; off,
  it holds at 0:00 with a Start side 2 / Next button so you set up in your own time.

**Rearranging, calendar, timers (2026-09-29)**
- Move a session: pick what you'll actually do today and the app finds the week order
  that moves the fewest days, never putting two strength days or two hard conditioning
  days back to back (including across week boundaries). Days already done stay put.
  Stored per week in `plan.order[monday]`; reset to standard from the same panel.
- Calendar view in Plan: month grid with week bands, session labels and done/missed dots,
  and a Rearrange mode — tap a session, tap the day to move it to, see the whole week
  previewed with the shifted days outlined, then Apply.
- Hold timers (⏱) on warm-up and mobility items with a real duration, running each side
  in turn; the last ramp set now gets the lift's full rest before the first working set.

**Warm-up and mobility (2026-09-29)**
- Warm-up checklist on every lifting and test day (full 12–15 min or the 7-min short
  version), with progress in the summary; plyo warm-up drills get check-offs too.
- Mobility block at the end of every session, matched to what the day loaded (hips /
  posterior chain / hip flexors + calves / ankles / full on rest days), editable in
  Setup, with check-offs.
- Both appear as steps in session mode (warm-up first, mobility last) and as counts in
  the sessions CSV.

**Gym flow, onboarding, restore (2026-09-29)**
- Welcome setup for new people (units, bodyweight, Lift 3, start week, bridge week or
  known 1RM/5RM maxes, conditioning tool, then deloads and retests on their own step);
  re-run from Setup.
- Lifting session mode: full-screen, one set at a time with drawn plates, ramp and
  working rests on the same screen, ±weight, grinder, accessories, summary + RPE.
- Session mode on test days (bridge 5RMs, retest singles): ramp to the target (or a
  typed target when there's no max yet), log weight × reps with a live est. 1RM,
  3+ min rest between lifts, max pull-ups, results summary.
- Visual plate loader in bumper colors and a plate inventory; unloadable targets flagged
  with the nearest load.
- Restore any backup or a downloaded file, with a time-stamped safety backup first.
- Spoken cues for interval changes and rest ends (toggle).

**Core (2026-09-29)**
- Operator + Black schedule with endless 6-week cycles, bridge week, automatic deload
  and retest weeks, and inserting or skipping deload/retest/off weeks from the Plan tab.
- Working weights, rounding, plate math, ramp-up sets, set tracking, grinder flag with
  "lower max 5%", and a deload prompt after repeated hard sessions.
- Bike/conditioning logging, plyo phases with the 5% broad-jump stop rule,
  accessories that skip on heavy weeks, holiday flags.
- Bridge-week 5RM → 1RM conversion; retest results carried into the next cycle.

**Hosting**
- Cloudflare Worker + static assets at operatorblack.com (www redirects), D1 storage,
  Cloudflare Access login verified on every API call.

**Logging and coaching**
- Warm-up sets calculated from the working weight, with plates per side, loggable.
- Daily check-in (sleep, energy, soreness, stress, yesterday's eating, bodyweight) with
  a readiness score and session, recovery and nutrition suggestions.
- Status tab: position in cycle, milestones, adherence, strength/conditioning/body
  trend charts.

**Phone**
- Installable home-screen app, offline cache, local copy of data and an unsent-changes
  queue.
- Rest timer, 2–5 min per lift, with ±30s, beep, screen wake, and "next set" label.

**Flexibility**
- Lift 3 variants (lat pulldown, OHP, weighted pull-up) with rotation modes and
  per-day swap; weighted pull-up math on bodyweight + added weight.
- Editable accessory lists (arms on Monday).
- Conditioning activities beyond the Echo bike, each with its own measure;
  like-for-like progress only.

**Plyos and alerts**
- Plyo program and exercise library from Plyometric_Program_Thursday.pdf: per-phase
  sessions with set ticks and program rest times, inline library entries, pull-back
  check, full library in the Guide.
- Background rest alerts via Web Push: Durable Object alarm at the rest's end time,
  rescheduled on ±30s/skip/new set, test button in Setup.

**Updates**
- Update-available banner on the home-screen app (page fingerprint vs deployed),
  plus About this app in Setup with a manual check.

**Interval timer**
- Guided HIC/LISS timer from the Black formats with round picker, optional warm-up
  pickups and cool-down, full-screen or minimized display, 3-2-1 beeps, screen wake,
  lock-screen alerts for every interval change, and result logging at the end.

**People and programs**
- Per-user data: every document, backup and alert store is scoped to the signed-in
  Access email; legacy data claimed by the owner; phone cache reset on user switch.
- Programs: archive the current program and start over (carry maxes or bridge week),
  with read-only archived programs viewable from History, Status and Plan.

**Login page**
- Branded Access login page: public `/brand/logo.png` via a Bypass → Everyone
  Access application for `operatorblack.com/brand/*`; everything else stays locked.

**Export**
- CSV export (Setup): sessions (one row per day) and lifts (one row per lift per
  session, prescribed vs working, warm-ups, tests with est. 1RM), across every
  program, via the share sheet on iPhone.

**Deload choice**
- Setup: scheduled deload as a clear choice (As needed · After every cycle · After
  every 2 cycles) with a preview of the next deload and retest dates. "As needed" plus
  retest every 3 cycles matches the 18-week program summary (retest week of 2/8/2027).
- Deload check-in on Today in weeks 5–6 of every second cycle (first: 12/14–12/25/2026):
  current setting, next deload date, a two-cycle recap, Keep or change. Can be turned
  off in Setup.
