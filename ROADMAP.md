# Roadmap

What's built, what's open, and what might come next for the Operator + Black app.
Update it as things ship. Last updated 2026-10-07.

This file is the working record, written for whoever is building. The user-facing
summary of each release lives in `public/releases.js` and shows up in the app under
Setup → About this app → What's new.

## Open issues

Known gaps and things to verify. Fix or close these before starting new features.

- **iPhone testing, still to confirm at the gym:** offline launch, the beep on the rest
  between working sets, whether the screen stays awake for a whole session, and the
  interval timer on the bike. The first two were the 1.36 fix and the reasoning is sound,
  but nothing has been observed on a phone since. Confirmed so far: home-screen install,
  Access login in the installed app, the update banner, rest alerts arriving on the lock
  screen, and spoken cues through AirPods with the app open.
- **The Move tool will shuffle a Base Building week freely.** SE days are `'other'` to the
  back-to-back adjacency rules, so nothing stops two circuits landing on consecutive days
  — and Block I's week is built around that spacing. Either give `se` its own adjacency
  class or refuse to rearrange a `bb` week.
- **Restore has still never run against real data**, and it now matters more: a Base
  Building block and the per-day SE lists are new shapes in the log documents. See
  "Verify a backup by restoring it" under Ideas for the way to close it properly.
- **Retest Saturday tests more than two lifts** when several Lift 3 variants are on
  (deadlift + pulldown + OHP, plus pull-ups). Splitting them is an app choice for
  freshness, not a rule — TB1's test day works through the whole cluster in one session.
  Bridge week already splits them; retest week doesn't yet.
- **The current week can still re-plan.** Only fully past weeks are locked, so changing
  deload/retest spacing mid-week can change this week's type.
- **Accessory ticks are stored by position.** Editing a day's list in Setup shifts
  which movement older checkmarks line up with.
- **Conditioning "last/best" across programs** only counts sessions whose format and
  activity are stored. Programs archived by the app stamp them automatically.
- **Checked against TB1 (3rd ed.) and TB2 on 2026-10-02.** Settled:
  - Wave weeks 5–6 are **3×5 @ 85%** and **3×2 @ 95%**. `plan.wave` matches the Operator
    table row for row; the disputed alternative was wrong. Closed.
  - **There is no strength deload in the book.** Operator runs six weeks and retests; the
    recovery guidance is a full week or more off every 3–6 months, plus the easy
    conditioning week. Our `2×5 @ 60%` deload is an app addition — kept, because a
    scheduled light week suits a civilian running this year-round, but labelled as ours.
  - **Retest:** rest 2–3 days first, warm up, then ramp per lift to a 3–5RM and calculate;
    a true single is optional. 6 weeks is the minimum between tests, 6 or 12 recommended,
    and waiting longer is explicitly fine. The whole cluster is tested in one session.
  - Still ours, and marked as such in the Guide: the bridge week, the per-day split on
    retest Saturday, and the deadlift's single set on non-cycle weeks.
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

Not committed to. The technical ones first, because they protect what is already built;
within each group, roughly in order of how useful they'd be.

### Technical

- **Tests for the Worker — the two halves that matter are done.** `test/api.test.js`
  covers backups and the Access JWT check, with hand-written stand-ins for the R2 and KV
  bindings: no Miniflare, no `wrangler dev`, still a plain `node --test` run. Still
  uncovered: the document read/write routes, restore, push, and the three calendar
  endpoints. Restore is the next one worth doing, since it overwrites everything.
- **Sanity-check numeric input.** Nothing stops a bodyweight of 2050 or a 4000 lb squat,
  and the derived numbers now carry further than they used to: one fat-fingered weigh-in
  poisons the 7-day average, the protein target, the weighted pull-up load and the TDEE
  estimate for a fortnight. Not a hard block — an inline "that looks wrong, keep it?"
  on anything outside a plausible band, and leave the decision with the person.
- **Verify a backup by restoring it.** Restore has never run against real data. A
  scheduled check that restores the newest backup into a scratch namespace and diffs it
  against live would turn "there are backups" into "the backups work".
- **Two devices offline on the same day.** Last write wins, silently. Rare for one
  person, but worth either a per-document version check or an honest note in Setup.

### Training and UX

- **Shorten Today on a lifting day.** Check-in, week summary, weekly check-in, PR card,
  then the session. Once a session is under way the cards above it are noise — collapse
  them, or jump straight to the first lift.
- **Share with a partner or coach:** opt-in, read-only progress view.
- **Half-minute rest options** (2:30, 3:30) in the per-lift rest picker.
- **Per-set effort:** RPE or "fast/slow" per working set, feeding the cycle review.
- **Retest planner:** split retest lifts across days automatically (two per day), like
  the bridge week does.

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

**A crash says so instead of going blank (2026-10-07)**
- `render()` splits into a thin `render()` that catches and `renderMain()` that does the
  work. A thrown view now paints a banner with the message, a Reload and a Copy details,
  rather than leaving whatever was on screen or nothing at all.
- `window.onerror` and `unhandledrejection` are recorded too, so a failure that never
  touches `render()` is still reportable.
- The last 5 errors live in `localStorage` under `ob.errs` and surface as a **Problems**
  card in Setup, with Copy all details and Clear. **Device-local, never synced**: a stack
  trace can name a lift or a date and there is no reason for that to reach the server.
  The card says so, because "we collected your errors" should never be a surprise.
- Found while testing: a plan broken enough to kill Today also killed **Setup**, which is
  where the Problems card lives — the recovery screen failed in the one case it exists
  for. The wave table now tolerates a non-array `plan.wave`, and the crash banner carries
  its own Copy details so no other screen is needed.
- Mutation-checked: removing the catch, not recording, dropping the cap, or keeping the
  oldest rather than the newest all fail the suite. 122 → 125 tests.

**Measured the render cost, and fixed the real one (2026-10-07)**
- **The premise of the old roadmap item was wrong.** It said every `data-bind` input calls
  `render()`. It does not: the `input` listener only writes state, and `render()` hangs off
  `change`, which for text and number fields fires on blur. Typing has never re-rendered.
  The cost is per *interaction* — a set tick, a checkbox, a day change — not per keystroke.
- Measured against 353 day logs (a year), building the HTML in Node and applying it in
  headless Chrome. **The DOM was never the problem**: parsing and laying out even Status's
  58 kB and 971 nodes costs 3.4 ms. Building the string was 19–25 ms.
- `vToday` spent **15.7 of its 19.1 ms inside `weekSummaryCard`**, which produces about a
  kilobyte. `weekRecap` calls `prsOn` once for each of the week's seven days, `prCard` asks
  an eighth time, and each call rebuilt `prList()` — a walk over every log, several times
  over, per call. Roughly 64 full scans of a year of training to render one card.
- Fixed by caching `prList()` against `planV + logsV`, the way `weeks()` and `maxFor()`
  already are. `logsV` is new: every other path that replaces `logs` wholesale already
  bumped `planV`, so only `setLog` and `applyState` needed it.
- **Today: 19.1 ms → 2.7 ms to build, 5.0 ms including the DOM.** About 25 ms on a phone
  five times slower, which is below the threshold where a tap feels delayed.
- Status is now the slow one at 26 ms (about 130 ms on that phone), but the profile is
  flat — no hotspot, just a lot of date parsing across a year of charts. It is a view you
  open deliberately rather than one that re-renders under your thumb, so it is left alone.
  Worth revisiting only if it is ever felt.
- Tooling note for next time: `node --test` output through `| tail` buffers until the pipe
  closes, which made a working script look hung for ten minutes. Redirect to a file.

**The service worker's cache name is stamped by the build (2026-10-07)**
- `VERSION` was typed by hand. Change an icon or the manifest, deploy, and every
  installed app kept serving the old one out of a cache nothing invalidated — which
  looks like a broken deploy rather than a missed step.
- `build.js` now reads the worker's own `SHELL` array and hashes the files it names.
  One source of truth: the list the worker caches is the list the version is computed
  from, so the two cannot drift. A precached file that is not on disk is a build error
  now, where before it was a silent cache miss.
- `build.js` exports `build`, `shellFiles`, `shellVersion` and `stampServiceWorker` and
  only runs when invoked directly, so the build is testable rather than a script.
- `test/build.test.js`, 8 tests: the name is stamped and matches, every precached file
  exists, a changed icon / manifest / page moves it, a non-shell file does not, a
  missing file or a worker with no `SHELL` or `VERSION` line is a build error, building
  twice changes nothing, and an icon change alone moves the name through a full build.
- Everything that writes runs in a throwaway copy of the repo. The first version called
  `build()` on the real tree, and since `node --test` runs test *files* in parallel it
  rewrote `public/app.js` underneath the other suites: `schedule.test.js` failed with
  "could not replace the boot block" about one run in three. Verified with ten
  consecutive clean runs rather than one.
- Mutation testing caught the same shape of hole as last time, twice running. Asserting
  that `sw.js` is correct *now* proves nothing, because the last build made it correct;
  deleting the stamping step left every test passing. The fix is a test that breaks the
  file first and checks the build repairs it. Worth internalising: a test of current
  state is not a test of the thing that maintains it.
- 113 → 121 tests.

**The Access JWT check is tested (2026-10-07)**
- Tested with **real cryptography**, not a stubbed verifier. The suite generates RSA-2048
  keypairs with `crypto.subtle`, serves them as a JWKS from a stubbed `fetch`, and mints
  genuine RS256 tokens. Nothing about the verification is faked, so a forged token has to
  actually fail the real signature check rather than a mock of it.
- Nine cases: a valid token identifies by its signed claims; a tampered payload with the
  original signature is refused; a token signed by an unpublished key is refused; a token
  from another Access application on the same team is refused (`aud`, as both a string
  and an array); wrong issuer, expired, no expiry, absent and malformed tokens; key
  rotation forcing a refetch rather than failing out of a stale cache; `ALLOWED_EMAILS`
  as a second lock applied after the signature; case-insensitive addresses; and a missing
  `ACCESS_AUD` or team domain closing the door rather than opening it.
- Mutation-checked. Removing the signature, audience, issuer or expiry check, bypassing
  `ALLOWED_EMAILS`, or dropping the lowercasing all fail the suite.
- One mutation does **not** fail, and it should not: replacing `if (!jwk) throw` with a
  fall back to `keys[0]`. A token signed with an unpublished key then fails the signature
  check instead of the `kid` lookup, so the outcome is identical. An equivalent mutant,
  not a hole — and a reminder that the signature is the gate and the `kid` is a hint.
- 104 → 113 tests.

**Backup retention per kind, and the first Worker tests (2026-10-07)**
- `KEEP = {auto:26, manual:6, safety:6}` replacing one shared pool of 26. A run of manual
  backups used to delete weekly history one for one, silently, and the weekly history is
  the part worth having.
- Counting rather than ageing is deliberate: the newest of each kind survives however old
  it is. An R2 lifecycle rule deleting by age would clear the lot during a long break,
  exactly when there is nothing newer to fall back on.
- `backupsToPrune()` is pure and exported, so the decision is testable without a runtime.
- **First tests for `src/api.js`**, with hand-written stand-ins for the R2 and KV bindings
  (paginating at 2 so the cursor loops are actually exercised). 9 tests: retention by
  kind, never emptying a kind, R2 writes and reads, KV still listable and restorable,
  R2 winning a duplicate name, delete clearing both stores, the no-R2 fallback, per-user
  scoping, and the weekly roll-call.
- Worth recording: mutation testing caught a hole in my own tests. Reverting `backupNow`
  to the old shared-pool prune left all 8 of them passing, because they exercised
  `backupsToPrune` in isolation and never checked that `backupNow` calls it. Added a
  ninth that drives the whole path. A unit test of a helper proves nothing about the
  caller.

**Backups moved to R2 (2026-10-07)**
- Bucket `operator-black-backups`, binding `R2BACKUPS`. KV capped a value at 25 MB and is
  priced for small hot reads rather than whole-history JSON; R2 is also browsable in the
  dashboard, which was the point of the idea.
- **No data was migrated, by design.** `listBackups` merges both stores and `readBackup`
  tries R2 then KV, so every backup taken before today is still listed, downloadable and
  restorable. They age out of the 26-week window on their own and the KV binding can be
  dropped then. A name in R2 wins over the same name in KV.
- Writes fall back to KV if the binding is absent, so a deploy without the bucket
  degrades instead of failing.
- Pruning now deletes from both stores, so the 26 kept are 26 in total rather than 26 each.
- Untested, like all of `api.js`. This is backup code, which is the worst place in the
  project to have no tests, and it moves the Worker-tests item up the list.

**Calendar feed: training time and reminders (2026-10-07)**
- `plan.cal` = `{mode,time,weekend,alarm}`, so the setting syncs across devices and a
  change queues an upload through the existing plan-write hook.
- Timed events use **floating local time**: `DTSTART:20260907T060000`, no `Z` and no
  `TZID`. 6am stays 6am when you travel, and it avoids embedding a `VTIMEZONE` block,
  which is the usual reason hand-rolled ICS breaks.
- Duration per session type, and conditioning asks `ivPartsLabel(fmt, ivOpts(date,fmt))`
  so the calendar block matches what the session card promises rather than a round hour.
- `VALARM` with `ACTION:DISPLAY` and a relative `TRIGGER`. All-day mode offers only
  −4 h, which is 8pm the night before, since offsets from midnight are meaningless.
- Covered: defaults stay all-day with no alarm, durations, the weekend clock, a late start
  rolling `DTEND` into the next day, every trigger value, and malformed times falling back
  to 06:00 without producing a broken calendar. 91 → 95 tests.

**Calendar feed: Guide section (2026-10-07)**
- Step-by-step for both platforms in the Guide, above the warm-up reference cards. The
  Android path is the one worth having written down: Google Calendar cannot add a
  subscription from the phone app at all, and the new calendar stays invisible on the
  phone until Sync is switched on for it in the app's settings.
- Also fixed: switching the feed on left the body empty for the debounce interval, so
  subscribing straight away hit the same 404 as an unknown token. Enabling now pushes
  with no delay; ordinary plan changes keep the 4 s debounce.

**Calendar feed (2026-10-07)**
- A subscribable `.ics` of the plan: `/cal/<token>.ics`, generated by the app and stored
  verbatim by the Worker (`cal_feeds` in D1, migration `0003`). The schedule lives only in
  `src/app/`, and a second implementation on the server would drift from it, so the client
  that already knows the answer is the one that writes the file.
- Consequence to be honest about: the feed is as fresh as the last time the app was
  opened. For a plan that changes a few times a cycle that is not a real cost.
- `icsFeed()` emits all-day events for the training days in a −2/+18 week window, with
  the lifts, the prescription and the working weight. Stable per-day UIDs so a refresh
  updates rather than duplicates; CRLF and 75-octet folding, both tested.
- Change detection compares with `DTSTAMP` stripped (`icsKey`), or an identical calendar
  would upload on every app open. Normally this uploads once a day, when the window moves.
- **Needs a dashboard step this repo cannot do**: an Access **Bypass** policy on `/cal/*`,
  since a calendar client cannot sign in. Written up in the README. The token is the whole
  authentication for that path, so the feed carries the schedule and nothing else.
- Still untested on the server side, like the rest of `api.js` — the three new endpoints
  and `calendarFeed()` have no coverage. That is the Worker-tests gap, now slightly bigger.

**A schema version on the stored data (2026-10-07)**
- `plan.schema` plus an ordered `MIGRATIONS` list in `01-constants.js`, run by `migrate()`
  in `05-persistence.js` on load and after every sync. Costs one integer comparison when
  there is nothing to do, and writes back only the documents a migration actually changed.
- The half that matters is backwards, not forwards: data stamped **newer** than `SCHEMA`
  sets `schemaAhead`, which makes `readOnly()` true, so an out-of-date copy stops writing
  instead of flattening a shape it cannot read. A banner says so with a Reload button.
  This only protects against clients from 1.34 on; older ones cannot know to check.
- Migration 1 turns numeric-keyed objects back into arrays in logs and archived programs.
  That shape is why `wuList`, `wuListFor` and two `Array.isArray` guards exist. The guards
  stay for now (an old export can be restored at any time) but the stored data is clean.
- Near-miss worth recording: the set range nearly shipped as `{s:[3,10]}`. An old client
  doing `+v.s` on an array gets `NaN` and writes it back over every working weight. Two
  scalars avoided it by luck, not design — this is the machinery that would have caught it.
- 88 tests across `app`, `schedule` and `weights`.

**Change an SE day's exercises on the day (2026-10-07)**
- The cluster is a Setup choice, which is right for a block and wrong for a Tuesday when
  somebody else is on the bar. Every exercise on a strength-endurance day is a button now:
  swap it, remove it or add one, for that day only (`logs[d].se.ex`).
- Stored as the day's whole list rather than a diff, which is what keeps the ticks
  slot-indexed: a swap keeps the circuits already done against that slot, a removal splices
  the row out, and clearing it ("Back to Barbell") falls through to the cluster again.
  `seDayList(date)` is the single read and `seEdited(date)` is what the card's banner reads.
- The picker offers every cluster's movements plus `plan.se.custom`, deduped by name, and
  takes free text, so a tool the app has never heard of needs no code.

**Base Building as an insertable block (2026-10-07)**
- TB2's Block I, offered from the Plan tab's Change menu on any future week: eight weeks of
  endurance and strength endurance, then Operator resumes on the same maxes. `BB_WEEKS` is
  the book's template day for day, and `weeks()` carries `bbLeft`/`bbVer` so the block runs
  to completion and the next cycle week picks up after it.
- SE circuits are a new session type: `SE_CLUSTERS` (the book's bodyweight, barbell,
  kettlebell and dumbbell lists, plus your own), ticks per circuit, and a short rest between
  exercises against two minutes between circuits (`SE_RESTS`, `plan.se.rest`).
- Two things in it are ours, and the Guide says so: weeks 6–8's two strength days run on the
  Operator wave percentages, because the book says to lift again without saying at what, and
  the strength-first variant's late SE weeks ramp 3×30 / 3×40 / 3×50 (`BB_SF_SE`), because
  the book only says to reverse the order and gives no numbers for those weeks.
- Explicitly **not** the Ageless Athlete version of Base Building, by request.

**Elevation as distance, and a word after lifting (2026-10-06)**
- `flatEquiv(x)` turns gain into distance at `plan.elevPer` (1,000 ft, or 190 m, per mile),
  and `hicValue(x)` is what "last" and "best" compare for trail runs, hikes and rucks — so a
  hard climbing day stops reading worse than an easy flat one. The raw numbers stay on screen
  beside the equivalent, and nothing feeds readiness or the deload prompt. Deliberate: a
  comparison is worth having, an extra lever on the programming is not.
- Status gained a climbing total: this week, the last four weeks, and the direction against
  the four before that.
- The post-lift check-in asks two more things: how it moved (`FEELS`) and whether anything
  hurt (`PAINS`, and where, from `PAIN_AT`). A niggle is only ever reported back to you.
  Sharp pain is the one input that outranks every other rule in `recommend()` — once holds
  that lift's max at the end of the cycle, twice brings it down, and the review names the
  joint. It sits above the grinder and RPE branches on purpose: an averaged score can be
  argued with, a joint cannot.

**Trail running, and elevation gain (2026-10-06)**
- Trail run as its own activity rather than a flavour of Run: pace means nothing on uneven
  ground, so the hard efforts go by breathing, and the advice leads on the descents being
  what leaves you sore two days later. Elevation gain on trail runs and hikes, feet for
  pounds and metres for kilos, in History beside the distance and in the sessions CSV.
- Rucking got the same field the same afternoon (1.38), next to the pack weight, which is the
  pairing that says what the session actually was.
- Shipped as data only — nothing in the programming read it yet. Splitting it from 1.39 that
  way was right: the field had real sessions in it before any number was derived from it.

**One wake lock for the whole session (2026-10-06)**
- Two reports, one cause. The rest between working sets often did not beep, and the screen
  went dark mid-session: the lock was owned by the rest timer and released the instant a rest
  hit zero, so the phone slept while you were lifting, and with the screen asleep iOS had
  suspended the `AudioContext`, which is why the next rest was silent.
- `wantScreen()` is the single answer to whether the screen should stay on (session mode, a
  guided block, a live rest, a live interval, an unpaused generic timer) and `syncScreen()`
  is called wherever any of those change. `holdScreen` re-checks `wakeLock.released` first,
  and a `visibilitychange` handler re-takes the lock and resumes audio on return.
- Lesson worth keeping: a released wake lock is indistinguishable from a held one unless you
  read `.released`, so every re-request was being skipped as redundant. Any API the platform
  can revoke under you needs a re-check on the way in, not a flag of your own.
- The warm-up rest was labelled "Ramp rest", which reads like something off a bike test and
  appeared on Operator days too, since every session has a warm-up. It says "Warm-up rest".

**A timer for anything (2026-10-05)**
- `src/app/10b-timer.js`: a countdown or a stopwatch from the ⏱ at the end of the tab row, on
  any tab, with no session started and nothing logged. Presets, typed minutes, ±30s, pause
  and resume.
- Like the other two timers it runs off absolute times (`gt.end`, or `gt.start` plus
  `gt.pausedMs`), so locking the phone or reloading the app does not make it drift, and it
  stacks above the rest bar rather than replacing it, so a rest keeps counting underneath.
  State is in `ob.gt`, and a run left going for more than 12 hours is dropped on load.
- It only touches the push queue when nothing in a session owns it, so a scheduled rest alert
  is never cancelled by a timer started beside it.

**Longer rests between warm-up sets (2026-10-04)**
- Reported as "30 seconds is too short"; it was actually 45, and the correction mattered less
  than the point. `DEF.warmRest` is 90 s, per lift, editable from the warm-up block on the
  lift card (`WARM_RESTS`: 30/45/60/90/120 s). The rest before the first working set is
  unchanged — that is still the lift's own 2–5 min.
- `warmRestSecs(k)` is the only reader, so the lift card, session mode's ramp rests and the
  ±30s buttons mid-rest cannot disagree.

**No-metric formats, properly (2026-10-02)**
- Putting FOBBIT in the format list (right: it runs on any modality) left it offerable as
  a benchmark, where `benchmarkState` filters on a logged result — so a pinned FOBBIT
  benchmark read "never run, due" no matter how many you had done.
- Replaced the `fmt==='fobbit'` special cases with a `noMetric` flag on the format, used
  by `metricFor`, `hicSessions`, the benchmark picker and `benchmark()` (which now drops a
  stale pin). The burst fields key off `noMetric` and the base-first copy off `IV[f].lead`,
  so a second format of either kind needs no new branches.
- A test walks `HIC` and asserts the benchmark picker offers exactly the formats that
  produce a comparable number.

**Release notes rewritten in a plainer voice (2026-10-02)**
- All 34 entries reworded. Em-dashes 52 -> 1 (the one left quotes the interface), contractions
  30 -> 90, and the habit of ending every bullet on a tidy aphorism mostly gone.
- Facts verified unchanged: all 58 numeric tokens across every entry match the previous file
  exactly. Only `FOBBITs cannot be benchmarks` -> `FOBBITs can't be benchmarks` changed in a
  title. No version bump, since nothing was added or removed.
- The file header now says rewording a shipped entry is allowed (the facts are the history,
  not the prose) and what the voice should be, so this does not drift back.

**Add a set on the day, from the lift card (2026-10-02)**
- 1.32 made the ceiling a Setup field, which still meant leaving the session to change it.
  A `+` tile now sits at the end of the sets on every lift card, and `+ One more set` on the
  last working set in the full-screen stepper. It writes `logs[date].lifts[k].extra`, so it
  is a decision about today: the plan is untouched and the next session is back to normal.
- `addSet(k,delta,date)` holds the ceiling (the book's ten, or higher if the wave says so)
  and the guard that stops a ticked set being pulled out from under its own tick. Both
  surfaces call it, and because the stub DOM in the harness dispatches no events, having the
  logic in a named function is the only way any of it is testable — worth remembering for
  the Worker/API gap, which has the same shape.
- `rx()` folds `extra` into `sMax`, so the day summary, session stepper, rest-timer "next up"
  and CSV all picked it up without changes.

**Optional sets on the wave — Operator I/A's volume choice (2026-10-02)**
- A wave entry can carry `sMax`, a ceiling above the prescribed sets. `rx()` now returns `s`
  (required) and `sMax` (ceiling); the lift card renders the surplus as dashed buttons, the
  session-mode stepper marks them `opt` so skipping them is not a gap, and the day summary
  shows `2/3+`.
- This absorbed the deadlift's 1–3 rule, which was duplicated at six call sites
  (day view ×2, session mode ×2, alerts, CSV). Deadlift is now just the first wave entry
  with a range, and `rx()` is the only place that knows.
- Setup's wave table gained an **Up to** column, blank by default. That table had four number
  inputs at a fixed 84px and already scrolled sideways on a phone; `.wavetbl` tightens the
  cells so all four editable columns fit at 390px.
- Deliberately *not* I/A: the 48–72h floating schedule. See AGELESS-AND-MASS.md's addendum
  — I/A indexes by session where this app indexes by date, and the book's own author keeps
  a fixed three-a-week calendar and takes his variability in volume instead.

**All PDFs out of the repo (2026-10-02)**
- The repo is public. `*.pdf` is now absolute: the `!Plyometric_Program_Thursday.pdf`
  exception is gone and that file is untracked (still on disk, still the source for the
  plyo library -- only the source comments in `01-constants.js` point at it now).
- History rewritten and force-pushed: `git filter-branch --index-filter` stripped the two
  commercial books from every commit, so they are gone from `main` entirely rather than
  just untracked. Gitignoring alone would not have done this -- the blobs were public and
  downloadable from the old `92130aa` for a day. Every SHA from that commit forward
  changed (`92130aa` is now `5f48111`); any older clone has the pre-rewrite history.
- Backup kept locally until this is confirmed settled: tag `pre-pdf-purge` and
  `refs/original/refs/heads/main`, both at the old `150a3f5`. Deleting those two refs and
  running `git gc --prune=now` drops the blobs from this machine too.
- Left in history deliberately: `Plyometric_Program_Thursday.pdf`, which is ours.
- GitHub Support still has to purge their cached objects. A force-push leaves the old
  commit reachable by SHA on github.com until their GC runs.

**FOBBITs rebuilt from the book (2026-10-02)**
- Second correction to the same feature. 1.29 fixed the timing but kept a 30–90 second
  burst picker, which the book never prescribes: its bursts are **sets of reps** — 20 KB
  swings, then 10 snatches per arm, alternating — and the base is a pace *just under* a jog.
- Segments gained `hold`. A held segment auto-pauses on entry, shows the rep prescription
  instead of a countdown, and the Pause button becomes Done; finishing resumes and skips to
  the end of the segment, reusing the existing pause/skip machinery rather than rewriting
  `ivPos`. Held time is excluded from `ivParts`, `ivPartsLabel.total`, the card's suggested
  minutes and the timer header, so every number on the card is base-only and they all agree.
- Session length is the thing you pick (15 / 20 / 30 min of base = 7 / 10 / 15 rounds).
  The easy conditioning week takes the book's basic version: 15 minutes *and* halved reps.
- Worth noting for anything built off `AGELESS-AND-MASS.md`: twice now the structure was
  right and the prescription was wrong. The rendered page is the source; a plausible-looking
  parameter is not.

**Default cadence set to the book's (2026-10-02)**
- `DEF.testEvery` 3 → **2** and `DEF.deloadEvery` 2 → **0**. TB1 runs six-week blocks back
  to back and retests after two of them; it has no deload week, and prescribes a full week
  or more off every 3–6 months instead.
- The scheduled deload stays as an option, labelled in Setup and the Guide as our addition
  rather than the book's, because a light week suits running this year-round outside a unit.
- A stored plan beats the defaults in `deepMerge(clone(DEF), saved)`, so existing users keep
  their cadence until they act. Hence the **Match the book** button: it runs through
  `replan()`, so it reports what moved ("retest 11/30 → 12/7") and is undoable. No silent
  rewrite of somebody's training schedule.
- Two older tests leaned on the old defaults rather than setting them; both now pin
  `deloadEvery`/`testEvery` explicitly. Note the interaction that caught one of them: when
  `testEvery` and `deloadEvery` are equal the retest wins every time and no deload ever
  appears.

**Read against the source books (2026-10-02)**
- The user supplied TB1 (3rd ed.) and TB2 directly, which settled the open content
  questions. `plan.wave` is confirmed correct against the Operator table.
- **Implemented TB2's Easy Week Principle**, which we had missed. Every third week the
  conditioning load comes down, and the book says it is designed to coincide with the
  90–95% strength weeks — in a six-week wave, weeks 3 and 6. `easyCondWeek(date)` is
  exactly `tier()==='heavy'` on a cycle week; `ivOpts` then uses the low end of the round
  range and trims LISS from 35 to 25 min. Previously conditioning only eased on a poor
  readiness score, so the hardest lifting weeks carried a full conditioning load.
- **Corrected the FOBBIT prescription shipped in 1.27.** The book's twenty minutes counts
  base time only — the timer stops for the bursts — so a session is 10 × (2 min base +
  burst), about 30 minutes in total, not 20. `IV.fobbit` gained `def:10` and emits
  base-then-burst per round, alternating Burst A / Burst B because the session alternates
  two movements. Also dropped the "over 30 minutes it stops being a HIC" line: that came
  from the forum, and the book's own advanced version runs to 30 minutes.
- Lesson: 1.27 was built from a web search because the book was not to hand. The structure
  was right and the arithmetic was not. Where a number comes from the source, cite it.

**FOBBITs (2026-10-02)**
- A TB II conditioning format, added to `HIC` rather than to `MOD`: it is a session
  structure, not a tool. Checked against tacticalbarbell.com rather than built from
  memory — 2 min easy base, 30–90 s burst of an alternative movement, ~20 min, classed
  as an aerobic-based HIC, and an endurance session rather than a HIC past 30 minutes.
- It inverts the interval model, so `IV.fobbit` carries `lead:true` (a base segment opens
  the session) and `burst:[30,45,60,90]` (per-session, in `hic.iv.burst`). Unlike every
  other format it keeps the easy period after the final round, so six bursts have seven
  bases: 6×60 + 7×120 = exactly the 20 minutes prescribed.
- `ivOpts` defaults `warm` to false when a format has `lead` — the base is the warm-up.
  `ivParts` counts the lead segment as work, not warm-up, and the suggested-length
  sentence has a FOBBIT branch, since "no easy period after the last one" is false here.
- `metricFor` returns null for it and `hicSessions` accepts it on minutes or bursts: the
  work is a movement, so there is no distance or calorie number to compare.

**Full day-view read-through (2026-10-02)**
- Rendered `vToday()` for every day type at phone width — lift, plyo+HIC, HIC, deload,
  both retest days, off, bridge — with a seeded history, after two UI bugs in a row got
  through by checking only the card that changed. Two blemishes, both cosmetic: the
  suggested-minutes explanation began with a dash because the button wrapped above it,
  and the Lift 3 swap said "Today" where the variant swap said "This session".
- Worth keeping as a habit: `scratchpad/days.js` renders a list of dates into side-by-side
  iframes at 390px, which is how both were spotted.

**Banner/button class collision (2026-10-02)**
- Reported with a screenshot: the bridge-week banner rendered as a tiny blue column with
  its text leaking out around the cards. 1.24's movement button was styled `.info`, and
  `.banner.info` is an existing modifier — so the bare rule (22px, round, no wrap) hit
  every info banner in the app. Renamed `.libinfo`.
- A test now fails on a bare rule in `app.css` for any of the modifier names the markup
  composes with (`info`, `warn`, `alert`, `light`, `heavy`, `mid`). Those words are
  adjectives in this codebase, never components.

**The library button, properly (2026-10-02)**
- 1.23 shipped the ℹ as a `::after` on the row's `<label for>` inside a `<summary>`.
  Tapping it ticked the checkbox, which fired `change` → `render()`, which rebuilt the
  row *before* the browser's `toggle` event could reach `openPx` — so the panel opened
  and was immediately thrown away. It looked like a dead control.
- No native disclosure on these rows now. A real `<button data-act="mlib">` flips the key
  in `openPx` and `checkRow` renders the panel from that, so the state cannot race the
  re-render. The capturing click guard that existed only for the old structure is gone.
- Lesson for anything inside a row that re-renders on input: drive disclosure from state,
  not from the DOM element's own open attribute.
- Verified over the DevTools protocol rather than by reading the markup: the button opens
  the panel, does not tick the box, the panel survives ticking a box, and a second click
  closes it.

**Warm-up and mobility library (2026-10-02)**
- `MLIB` in `src/app/01a-movements.js`: 28 entries in the same shape as `PLIB`, covering
  every movement in `WARMUP` and in all five `MOB` blocks. `libBody(e)` is the shared
  renderer both libraries use now.
- Names in those lists are editable text, so entries are matched through `MLIB_ALIAS` on a
  normalised name (`mnorm`). A test asserts every built-in item still resolves, which is
  what catches a reworded item silently losing its entry. A movement the library does not
  know renders as a plain row.
- `checkRow` returns a `<details>` whose `<summary>` is the whole row when there is an
  entry, so the explanation opens full width rather than inside one grid column. A
  capturing click handler stops a checkbox inside a summary from toggling the disclosure
  as well as itself.
- Also in the Guide, grouped by what they are for rather than by which block they appear
  in, since several appear in more than one.

**The 5RM+Spin note counts its own lifts (2026-10-02)**
- Reported from the app: with two Lift 3 variants on, `l3On().slice(1)` leaves the bridge
  Saturday a single lift, but the note was written for the three-variant case and still
  said "test these first — two lifts per day". It is built from `rest.length` now and
  names the lift when there is one. A test asserts the note matches the day's lift count
  for both configurations.

**Pull-up road, benchmarks, variety and plan previews (2026-10-02)**
- `PULLUP` is five rungs with a rep threshold, a prescription and the reason it is the
  thing that moves you up. `pullupState(date)` reads the best `logs[d].pullups` **up to
  that date**, so a past day shows the rung you were on then, and `pullupCard()` goes on
  Status. Wednesday's accessory line prints the rung's own prescription.
- `benchmark()` returns `plan.benchmark` or, until one is pinned in Setup, the hard
  activity/format pairing with the most logged results. `benchmarkState(date)` adds the
  series, the best, days since and whether it is due (`plan.benchEvery`, default 35).
  Charted on Status; the check-in asks for it on a conditioning day when it is due.
- `hicRut(date,6)` flags six hard sessions in a row sharing a format or a tool. LISS is
  excluded — it is meant to be samey.
- `replan(label,fn)` captures `milestones()` either side of a plan change and appends the
  difference to the undo toast: "Deload week added · retest 11/30 → 12/7". Used by the
  deload cadence, the deload prompt, and insert / remove / skip / unskip. A change that
  moves nothing adds nothing.
- Chose "act, then say what moved, with undo" over a preview-then-confirm step: on a phone
  the second tap is the cost, and undo is already there.

**The planned length shows its working (2026-10-01)**
- Asked where 23 minutes came from for 8 × 1:00/1:00, which reads like 16 + warm-up. It
  is right: `ivSegments` omits the easy period after the final round, so the work block is
  `rounds` hard and `rounds - 1` easy = 15 min, and the warm-up is 5:00 plus three pickups
  with their easy periods = 8:15, not the 5:00 its label implied.
- `ivParts(segs)` splits a session into warm-up / work / cool-down and `ivPartsLabel()`
  renders it, so the suggestion explains itself instead of asserting a number. The
  warm-up checkbox now reads "5 min + 3 pickups ≈ 8 min".
- A test pins the arithmetic for every format, so a change to the segment builder that
  quietly alters session length fails rather than drifts.

**Conditioning minutes without the timer (2026-10-01)**
- Reported from use: the interval timer stopped the phone's music, so it went unused and
  no minutes were logged. On iOS, opening an `AudioContext` hands the audio session to the
  page and pauses whatever was playing; `navigator.audioSession.type='transient'` does not
  save you on current Safari. `plan.quietTimer` (Setup → Sound) makes `quiet()` true and
  `unlockAudio`, `beep`, `tone` and `say` all return before touching audio at all — the
  only reliable fix, since the problem is opening the channel, not the volume.
- The minutes field is on every conditioning card now, not just LISS, with a
  `minplan` button offering `ivTotal(ivSegments(...))` for the chosen format and options.
- `ivFinish` writes `ivElapsed()` into `hic.min` for any format when the field is empty,
  so a finished timer logs what it actually ran rather than only LISS's planned length.
- Minutes-per-week shows the current week's total when no completed week exists yet, and
  the "this week is dashed" note no longer appears when no chart was drawn.

**Collapsible weekly check-in (2026-10-01)**
- It became a `<details>` only when the week's measurements were logged on an *earlier*
  day; filling it in today left the form open all day. Now any logged week renders the
  `<details>`, with the inputs still inside so same-day corrections work.
- Open/closed is remembered through `openPx` under `wkmeas`, like every other collapsible
  block. The empty form seeds that key, so completing it does not snap the card shut
  mid-entry; closing it keeps it closed on later days and next week's empty form re-opens
  it.

**Custom lift variants, and no generic back squat (2026-10-01)**
- `back` (r 1) sat alongside `high` (r 1) and `low` (r 1.03), which is a distinction
  without a difference: a back squat is high bar, low bar or a safety squat bar. `high` is
  the reference now and `ssb` (.9) joins the list. A stored `liftVar` of `'back'` falls
  back to the reference, which is the same number it was using.
- `varsOf(k)` merges `plan.customVar[k]` (`{id,name,short,r}`) over the built-in list, and
  every lookup by id goes through it — `liftName`, `varOf`, `blockVar`, `varDefault`,
  `varMax`, the Setup selects, the Today picker. Entries without a name or a positive
  ratio are dropped rather than prescribed.
- Add and remove in Setup; removing one that a cycle or the default points at clears
  those too, with an undo. Validation rejects a blank name, a duplicate name and anything
  outside 25–150%.
- A custom variant needs no other machinery: a name and a share of the reference max is
  all the prescription ever used.

**Variants: block lift vs one-off (2026-10-01)**
- 1.13 had this backwards. It treated `maxes[k]` as the *reference* lift's max always, and
  derived every variant from it by ratio — so choosing trap bar gave you a trap bar
  prescription computed from a conventional number you were never asked for, and the
  bridge week still said "Conventional deadlift". Reported from the app.
- Now: `blockVar(k,date)` is what the cycle runs on (`plan.cycleVar[c][k]`, else
  `plan.liftVar[k]`, else the reference) and **its max is the max you stored, unscaled**.
  `varOf()` returns a per-day swap (`logs[d].var[k]`) over it, and `varMax()` scales only
  that case, by `r(day) / r(block)`. Test and bridge weeks return `blockVar` even against
  an explicit swap.
- Per-cycle rather than per-program because that is the template: cluster lifts are picked
  for a block and kept for the block. Setup has one select for the current cycle and one
  for later cycles, and says that changing mid-cycle is a deviation — the wave builds to
  heavy weeks on a max set for a particular lift.
- `plan.liftMax` (a tested max per variant) is gone: the block lift's max *is* the stored
  max, so there was nothing left for it to hold.
- Also fixed: `liftName(k)` defaults to `sel`, so the day summary printed the *selected*
  day's lift for every other day in the week. Anywhere a date is in scope now passes it.

**Both variant slots are barbell only (2026-10-01)**
- Goblet and double KB front squat out of `VARS.squat`, following the RDL out of
  `VARS.dead`. Same rule, applied consistently: if the limit is what you can hold or
  there is no lockout to test, there is no 1RM and the percentages mean nothing. They
  live in the travel week's squat slot instead.
- `r:null` has no instances left, so the branches that served it are gone: the
  "needs its own max" banner on the lift card, the `— needs its own max` suffix in the
  Setup picker, and a dead `base&&r==null?null:null` in `varMax`. A test asserts every
  variant has `r > 0`, so the dead paths cannot come back without the case coming back.

**RDL out of the deadlift variants (2026-10-01)**
- It shipped in `VARS.dead` with `r:null` an hour earlier. Wrong category: an RDL has no
  lockout and no reset on the floor, so there is no 1RM to hang percentages on at all —
  not merely one that is hard to estimate. It is named in Friday's accessory slot instead.
- Goblet and KB front squat initially stayed in `VARS.squat` by request, then came out
  the same day once the rule was applied consistently (see above).
- A `plan.liftVar.dead` of `'rdl'` left over from 1.13 falls back to the reference,
  because `varDefault()` checks the key still exists.

**Squat and deadlift variants (2026-10-01)**
- `VARS` keyed by lift: nine squats, eight deadlifts. The first entry of each is the
  reference. `varOf(k,date)` resolves a per-day swap (`logs[d].var[k]`) over
  `plan.liftVar[k]`; `varMax(k,c,date)` returns a tested `plan.liftMax[k][v]` if there is
  one, otherwise the reference max × the variant's ratio. `rx()` takes an optional date
  and routes any lift in `VARS` through it.
- `r:null` (goblet, KB front, RDL) means no honest ratio to a barbell max exists — the
  hold or the range caps the lift — so the card refuses to prescribe and asks for a
  tested max instead of inventing one.
- Deliberate boundary: variants change the **working weight only**. `maxFor()` and so the
  PR board, the strength charts, the cycle review and the retest cards all stay on the
  reference lift, and `varOf()` forces the reference on test and bridge weeks even
  against an explicit per-day swap. Otherwise a front-squat single would be written back
  as a back-squat max and silently drop every weight in the next cycle by 15%.
- Two bugs caught by tests while building it: the retest guard first returned
  `varDefault()` (the user's choice) rather than `varRef()`, and the CSV's test rows were
  not given the new variant column, so every field after it shifted left by one.
- Watch for: the generic rewrite of `liftName`/`varOf` replaced a span of `03-utils.js`
  that also held `l3On`, `l3For` and `isBW`. Anchor replacements on both ends.

**Weekly check-in (2026-10-01)**
- `weeklyCard()` on Today: measurements once a week, from Monday until they are logged,
  then a collapsed summary for the rest of the week. Last week's numbers are the input
  placeholders, the body-fat estimate updates as you type, and the change since the
  previous entry is spelled out.
- They were in the daily check-in's Optional group, which asked a weekly question every
  morning and made it both easy to skip and easy to over-log. The week summary card next
  to it is a recap with no inputs, so this is a separate card rather than a section of it.
- Renders only when `sel` is today, because `data-bind` writes to the selected day.
- Shipped under 1.11 by mistake and corrected with 1.12 the same morning: the release
  note is what tells someone the card exists, so it has to go out with it.

**A running burn estimate (2026-10-01)**
- `tdeeOn(date)` is the number the card leads with: the longest window with the data
  (28 → 21 → 14 days), blended with Mifflin-St Jeor by `w = min(1, days logged in the
  last 42 / 42)`. One rule rather than two — an earlier version multiplied a
  window-reliability term by a coverage term and stuck at 73% for anyone who missed one
  day in eight, which permanently kept a formula that was 600 kcal out.
- `tdeeSeries()` charts it weekly, each point from its own 28-day window, so metabolic
  adaptation across a cut is visible. Over 100 kcal of drift gets a line of prose.
- Fallback is explicit in both directions: no data yet → the formula, named as such;
  calories logged and then abandoned → back to the formula rather than a stale number.
- `endAvg()` walks the date range instead of every log, since the chart calls it ~24
  times per render.
- Watch for: the card quotes two burn numbers on purpose — what your own data says, and
  the blended headline — and the deficit sentence must use the measured one, or it
  contradicts the weight trend in the same sentence.

**Calories, TDEE and body fat (2026-10-01)**
- Calories per day in the check-in (`checkin.kcal`), asked the morning after, so
  `kcalOn(d)` reads day d+1's answer: intake belongs to the day it was eaten.
- `tdeeMeasured(date,days)` is energy balance, not a formula: mean intake over the window
  minus the trend-weight change × 3500/lb (7700/kg) over the real gap between the two
  ends. Both ends average their own 7 days, so the window needs no history before it, and
  the divisor is the gap between the two groups' *mean dates* — not the window length,
  which would overstate the burn by a third. Needs calories on 60% of the days and two
  weigh-ins at each end, or it returns null rather than guessing.
- `bmr()`/`tdeePredicted()` are Mifflin-St Jeor × an activity factor, shown until there
  is enough data for the measured number, and alongside it after. New `plan.sex`,
  `plan.height`, `plan.birthYear`, `plan.activity` in Setup → About you.
- `navyBf()` is the US Navy circumference method from `logs[d].meas` (neck, waist, hip),
  collected by the weekly check-in. Men use waist − neck, women add the hips; hips are
  still tracked for men because the trend is worth having. Returns null rather than a
  number when the profile is incomplete or the measurements are impossible.
- Why measured over predicted: Mifflin is a population average and was out by ~300 kcal
  against the test data. The adaptive number is the one the card leads with.

**Bodyweight card (2026-10-01)**
- Its own card on Status, replacing the small chart that lived in Body and recovery:
  every weigh-in as a faint second series behind the 7-day average, a 30 / 90 / all range
  kept per device in `ob.bwRange`, and the current average, range change and weekly rate
  above it. `lineChart` grew an optional `y2` per point for the raw series, and includes
  it in the scale.
- The range change compares the mean of the first `k` weigh-ins with the mean of the last
  `k` (k up to 7), not first reading to last: with the old method a noisy first morning
  made a 90-day cut look larger than the whole program.

**One release per deploy (2026-10-01)**
- Release 1.7 had been treated as a bucket for "recent work": entries kept being appended
  to it across two days and seven deploys, so the What's new page said 1.7 contained
  things that shipped after people had already installed 1.7. A release is now one deploy
  run — shipped entries are history, new work starts a new entry and bumps the minor
  version. Today's Status charts moved out of 1.7 into 1.8, and the rule is in the README
  and at the top of `public/releases.js`.
- A test enforces newest-first order, non-increasing dates, `major.minor` format, no
  reused version, and that every entry has a title and items.

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
