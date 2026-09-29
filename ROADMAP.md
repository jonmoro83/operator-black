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
- **Automated tests for the calculations:** schedule engine (rules, inserts, locked
  weeks), working weights and rounding, weighted pull-up math, Lift 3 rotation, ramps.
  Run them on every push.
- **Undo:** a short "Undo" message after ticking a set, skipping or inserting a week,
  or lowering a max.

## Ideas

Not committed to. Roughly in order of how useful they'd be.

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

**Data safety**
- Past weeks and finished cycles' maxes locked against settings changes.
- End-of-cycle review with suggested max changes, applied on approval.
- Weekly backups to Workers KV (26 kept), listed in Setup with Back up now.
