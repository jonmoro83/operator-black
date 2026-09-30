# Roadmap

What's built, what's open, and what might come next for the Operator + Black app.
Update it as things ship. Last updated 2026-09-29.

## Open issues

Known gaps and things to verify. Fix or close these before starting new features.

- **iPhone testing, still to confirm at the gym:** offline launch, the rest-timer beep
  (ringer switch, backgrounding), the screen staying awake during rest, rest alerts on
  the lock screen (Setup → Rest alerts → Send a test), and the interval timer on the
  bike. Confirmed so far: home-screen install, Access login in the installed app, the
  update banner.
- **Confirm the first live backup.** The KV store is still empty (checked 2026-09-29);
  the first automatic backup runs Sunday 09:00 UTC, or tap Setup → Back up now.
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

- **Tune the end-of-cycle review after Cycle 1** (review due Fri 11/13/2026). Check
  whether the grinder / missed-set / RPE thresholds suggested sensible changes.

## Ideas

Not committed to. Roughly in order of how useful they'd be.

- **Travel week:** swap barbell lifts for dumbbell/bodyweight versions for a week and
  keep that week out of the cycle review.
- **Launch screen on iPhone:** branded splash instead of a white flash.
- **Calendar feed:** the plan in iPhone Calendar with weights, auto-updating.
- **Share with a partner or coach:** opt-in, read-only progress view.

- **Standing triple jump in the plyo library:** hop, step, jump from a two-foot start;
  the PDF lists it as a test but has no library entry. Add an ⓘ entry to the jump-test
  card and the Guide.
- **Half-minute rest options** (2:30, 3:30) in the per-lift rest picker.
- **Per-set effort:** RPE or "fast/slow" per working set, feeding the cycle review.
- **More Status charts:** weekly conditioning minutes, an adherence calendar heatmap,
  estimated 1RM from logged top sets.
- **Retest planner:** split retest lifts across days automatically (two per day), like
  the bridge week does.
- **Split `index.html` into modules** with a small build step once it gets harder to
  change safely. It's ~2,000 lines today.
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

**Settings done in Cloudflare**
- Deploys: closed as not needed. Changes go live with `npm run deploy` (wrangler,
  tagged with the commit). Pushing to GitHub does **not** deploy on its own; the
  Workers Builds connection has never triggered (last checked 2026-09-29).
- Access session duration set to 1 month. To add a person: Zero Trust → Access →
  Applications → Operator Black → policy → add their email (details in README).

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

**Warm-up and mobility (2026-09-29)**
- Warm-up checklist on every lifting and test day (full 12–15 min or the 7-min short
  version), with progress in the summary; plyo warm-up drills get check-offs too.
- Mobility block at the end of every session, matched to what the day loaded (hips /
  posterior chain / hip flexors + calves / ankles / full on rest days), editable in
  Setup, with check-offs.
- Both appear as steps in session mode (warm-up first, mobility last) and as counts in
  the sessions CSV.

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

**Records, week summary, guided blocks (2026-10-01)**
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

**Averages, appearance, polish (2026-10-01)**
- Bodyweight runs off a 7-day rolling average (`bwAvg`/`bwFor`/`bwRate`): the Status
  chart plots the average with the weekly rate, the protein target and weighted pull-up
  loads use it, and the trend advice compares averages 14 days apart instead of two raw
  weigh-ins. Falls back to the latest single reading until the window has two.
- Appearance in Setup, per device: Match device / Light / Dark, plus gym mode (bigger
  buttons and inputs, firmer borders). An explicit theme also moves the phone's status
  bar colour.
- Session complete card on a finished day listing what was logged and what's still open;
  a tick animation on the set you just pressed; clearer empty states.

**Release notes and a fix (2026-10-01)**
- **What's new** page listing every release and what it added, reached from Setup →
  About this app and from the update banner. Add a `RELEASES` entry when something
  user-facing ships.
- Restored the **About this app** card, which a bad edit removed alongside the audio-cue
  card in `eed4fc2` (signed-in address, versions, update check). A test now asserts every
  Setup card is present so that cannot happen quietly again.

**Tests and undo (2026-10-01)**
- 28 tests over the calculations, run by `npm test`, before every deploy, and on every
  push via GitHub Actions. `test/harness.js` loads the app's script into Node against a
  stub DOM, so no browser is needed.
- Undo for the taps that are easy to get wrong: set ticks, marking a session done,
  lowering a max, adding/skipping/removing a week, moving days, resetting a week's
  order, clearing the warm-up or mobility, and applying a review or test results.

**Data safety**
- Past weeks and finished cycles' maxes locked against settings changes.
- End-of-cycle review with suggested max changes, applied on approval.
- Weekly backups to Workers KV (26 kept), listed in Setup with Back up now.
