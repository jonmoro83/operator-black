# Operator + Black

Training log for Tactical Barbell's **Operator** strength template plus the **Black**
conditioning protocol. It runs 6-week cycles with no end date, schedules deloads and
retests automatically, calculates working weights and plates, and logs every session.

Hosted as a Cloudflare Worker at **operatorblack.com**, with storage in D1 and sign-in
through Cloudflare Access.

Open issues, next steps and ideas live in [ROADMAP.md](ROADMAP.md).

```
src/app/*.js                the app, in ordered sections (01-constants … 22-events)
build.js                    joins them into public/app.js and stamps index.html
public/index.html           the markup: 101 lines
public/app.css              every style
public/app.js               built — do not edit by hand
public/releases.js          release notes for the What's new page (a plain global)
src/worker.js               entry: /api/* → API, everything else → public/
src/api.js                  API: state, docs, export, backups, push
src/alerts.js               RestAlerts Durable Object: push subscriptions + alert queue
src/webpush.js              Web Push encryption (RFC 8291) and VAPID signing (RFC 8292)
migrations/                 D1 schema: one JSON document per (user, path) row
wrangler.toml               Worker, static assets, D1, custom domain, Access config
```

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars      # skips the Access check locally
npm run db:migrate:local
npm run dev                         # http://localhost:8787
npm test                            # the calculation tests
```

## Brand assets

`node tools/brand.js` renders everything from one definition of the mark at the top of
that file: the favicons, the manifest icons, the Apple touch icon (inlined into
`index.html`, since iOS reads it before there is an Access session), the Access login
logo, and launch screens for ten iPhone sizes. Change the mark there and re-run it.

Two things that bite: the mark is set in Archivo from Google Fonts, so the renderer waits
for the webfont or silently falls back to a serif; and headless Chrome has a minimum
window size, so icons are rendered at 1024 and scaled down rather than requested at size.
Launch screens and the login logo live under `/brand/` because Access lets that path
through unauthenticated — iOS fetches a startup image before any session exists.

## Build

`src/app/*.js` are plain script fragments, joined in filename order inside one IIFE by
`node build.js` into `public/app.js`. No bundler, no transforms, no module graph: the
bundle is the sources concatenated, so what runs is what you wrote and the scope is
exactly what it was when it lived in one file. The build also stamps a content hash onto
the `app.css`, `releases.js` and `app.js` tags in `index.html`, so a changed bundle is
fetched fresh and the in-app update banner still fires.

`npm test` and `npm run deploy` build first. CI rebuilds and fails if the committed
`public/app.js` or `index.html` differ, so the bundle can never drift from its sources.
**Edit `src/app/*.js`, never `public/app.js`.**

## Tests

`test/harness.js` pulls the `<script>` out of `public/index.html`, evaluates it against a
stub DOM, and exposes every top-level function plus the live state, so the calculations
can be tested without a browser. `npm test` runs them, `npm run deploy` runs them first
and refuses to deploy if any fail, and they also run on every push
(`.github/workflows/test.yml`). Covered: the schedule engine (bridge, cycles, deload and
retest cadence, inserts, skips, frozen weeks), working weights, rounding, training-max
basis, cycle increments and overrides, ramp sets, weighted pull-up maths, Lift 3
rotation, day rearranging, personal records, the bodyweight average, mobility mapping,
the guided runner and CSV export.

## Deploys

Deploy with `npm run deploy` (wrangler, tagged with the git commit). Pushing to `main`
is meant to deploy through Workers Builds, but that connection doesn't trigger yet;
see ROADMAP.md. `wrangler.toml` attaches **operatorblack.com** as a custom
domain; `workers_dev` and preview URLs are off, so the only way in is through the
Access login.

## First-time Cloudflare setup (done once)

1. `npx wrangler login`
2. `npx wrangler d1 create operator-black`, then paste the `database_id` into `wrangler.toml`
3. `npm run db:migrate:remote`
4. Dashboard → Workers & Pages → Create → Import a repository → this repo
   (deploy command `npx wrangler deploy`)
5. Zero Trust → Access → Applications → Add → Self-hosted, hostname `operatorblack.com`,
   policy Allow → Emails → your email, login method One-time PIN
6. Put the team domain (`<team>.cloudflareaccess.com`) and the application's **AUD tag**
   into `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` in `wrangler.toml` and push.

The API rejects every request until those two values are set. Every request must
also carry a valid Access token, so the app can't be read or written around the
login screen.

## Offline and home screen

`public/sw.js` caches the app so it opens with no signal, and the page keeps a copy
of your data plus a queue of unsent changes in localStorage. Changes made offline
upload when the phone reconnects. Bump `VERSION` in `sw.js` when you change icons or
the manifest.

Cloudflare Access sessions expire (Zero Trust → Access → Applications →
Operator Black → session duration; 1 month is the max). When one expires, the app
still opens from cache, the status line reads "Signed out · tap to sign in,"
and tapping it goes to the login page.

## People and programs

**Each person's data is their own.** The API takes the user from the verified Access
JWT (email) and scopes every read and write to it: plan, logs, archived programs,
backups (KV keys use a hash of the email) and rest alerts (one Durable Object per
person). To add someone, add their email to the Access policy; their first visit
starts at their own bridge week. Rows from before per-user data were parked under
`__legacy__` and are claimed by the first sign-in from an address in the
`LEGACY_OWNERS` secret. If a different person signs in on the same phone, the app
drops the previous person's local copy and unsent changes.

**Programs.** Setup → Programs archives the current program (its whole plan, locked
weeks, maxes and reviews) to `programs/<id>` with an end date, and starts a new one
either carrying the latest maxes or with a bridge week (old maxes shown as reference).
Logs stay keyed by date; programs never overlap, so a log belongs to whichever
program's dates contain it. History, Status and Plan have a program picker; an archived
program opens read-only, with "today" set to its last day.

## Updates on the home-screen app

The Worker stamps every page it serves with the page's fingerprint (its asset ETag) in
`<meta name="app-version">`. The app compares that with `GET /api/version` when it
opens, when it comes back from the background, and every 30 minutes, and shows a
"new version is ready · Reload" banner if they differ. Backend-only deploys don't
change the fingerprint, so they don't trigger it. Setup → About this app shows both
versions and the deploy time. The running page reports itself as `RELEASES[0].v`
(`APP_VERSION`), and `npm run deploy` tags the Worker `v<package.json version>-<commit>`
so `/api/version` can name the deployed release too. A test keeps `package.json`,
`RELEASES[0]` and the tag format in step — bump all three together when you add a release.

**A release is one deploy run.** Once an entry in `public/releases.js` has gone out it is
history: don't append to it because the work is "the same sort of thing" or landed the
same week. Start a new entry and bump the minor version (`1.7` → `1.8`, with
`package.json` at `1.8.0`). Versions are `major.minor` only — `APP_VERSION` is what the
app shows and what the update banner compares. A test enforces newest-first order,
non-increasing dates and no reused version.

## Rearranging a week

`plan.order[monday]` maps weekday → prescribed slot, so a week keeps its seven sessions
whatever order you do them in. `sessKind` labels each slot strength / hic / easy / other,
and `bestOrder(monday, day, slot)` searches for the valid order that moves the fewest
days: never two `strength` or two `hic` days adjacent, checked across the week
boundaries too, with days already past in the current week pinned. Two front ends drive
it: Today → Move… (pick what you'll do today) and Plan → Calendar → Rearrange days (tap a
session, tap its new day, preview the week, Apply).

## Warm-up and mobility

`WARMUP` (14 items, `s` marks the 7-minute short version) renders as a checklist on
lifting and test days; `MOB` holds one block per session type (`lift`, `dead`, `hic`,
`plyo`, `off`) chosen by `mobKind(dayPlan)` and overridable per person in
`plan.mob[kind]` (Setup → Mobility). Ticks live in the day's log as `warmup[]`,
`mobility[]` and `plyo.warm[]`; session mode shows both as its first and last steps.

## Account and sign-out

The header's right-hand button shows your initials (from the Access email) and carries a
sync dot: green saved, amber saving or loading, red offline, errored or signed out.
Tapping it opens a menu with the address you are signed in as, the same status in words,
Profile and settings, What's new, and **Sign out** — a link to `/cdn-cgi/access/logout`,
which drops the Access session cookie so the next request lands on the login screen.
Nothing local is cleared: a different person signing in on the same phone is handled by
`switchUser()`. Setup's first card repeats all of it. Below 520px the header's status text
is hidden — the brand row cannot hold the wordmark, the status and the avatar on a phone
— so the dot and the menu carry it there.

## Appearance

Theme (`ob.theme`: auto/light/dark) and gym mode (`ob.gym`) are per device in
localStorage, applied by `applyTheme()` before the first render. It sets `data-theme`
and `data-gym` on the root and manages a single `theme-color` meta so an explicit choice
also moves the phone's status bar.

## Energy and body composition

Calories go in the daily check-in and are asked for the morning after, so `kcalOn(d)`
reads the next day's answer. `tdeeMeasured()` is energy balance over a 28- or 14-day
window: mean intake minus the trend-weight change converted at 3500 kcal/lb (7700/kg),
divided by the real gap between the mean dates of the two end groups. It returns null
unless calories cover 60% of the window and both ends have two weigh-ins.
`tdeePredicted()` is Mifflin-St Jeor × `plan.activity`, used until the measured number
exists. `navyBf()` is the US Navy tape method over `logs[d].meas`. Height, sex, birth year
and activity live in Setup → About you; without them those estimates are simply hidden.

## Records and the week summary

`prList()` computes lifetime bests from the log across all programs — tested 1RMs per
lift (via `estMax`), pull-ups, broad/vertical/triple jumps, and the best result per
conditioning activity + format — each with the date set and the value it beat.
`prsOn(date)` drives the "New personal best" card on Today; `prBoard()` is the Status
table. `weekSummaryCard()` recaps last week (sessions, readiness, bests, conditioning)
and previews this one, until dismissed via `plan.weekSeen`.

## Guided warm-up and mobility

`gdStart('warmup'|'mobility')` opens a full-screen runner over the same checklists.
Items whose dose parses as a duration (`holdSecs`) count down and advance themselves,
running both sides when the dose says per side; the rest wait for a tap. `plan.guideAuto`
(toggled inside the runner) decides whether a finished timer flows on by itself or holds
at 0:00 on `guide.wait` until tapped. State lives in `ob.guide` with absolute end times,
so locking the phone doesn't lose the place.

## Interval timer

HIC and LISS cards have a guided timer built from the Black formats (MAP 1:00/1:00 ×8–10,
anaerobic 0:30/2:00 ×6–8, threshold 4:00/3:00 ×4, long 3:00/1:30 ×5, LISS 30–45 min) with
an optional warm-up (5:00 + three 15 s pickups) and cool-down. Segments are timed from an
absolute start (`ob.iv` in localStorage), so they survive screen locks and reloads. Each
change beeps, and with alerts on the whole session is queued as pushes in one
`/api/push/schedule` call (`alerts: [...]`); pause, skip and end reschedule or cancel it.

## Rest alerts

Setup → Rest alerts subscribes the device to Web Push (home-screen app on iOS 16.4+).
Each rest schedules a Durable Object alarm for its end time; skip, ±30s and new sets
reschedule or cancel it, and the alarm pushes a notification to every subscribed
device. The VAPID private key is the `VAPID_JWK` Worker secret
(`npx wrangler secret put VAPID_JWK`; a local one lives in `.dev.vars`). Rotating it
means every device has to turn alerts on again.

## History is locked

Once a week has passed, its plan (cycle/week, prescription, Lift 3 picks) is stored in
`plan.frozen`, and a finished cycle's maxes in `plan.lockedMax`. Changing rules, the
wave or maxes only re-plans from the current week on. Changing the start date or the
bridge week clears the lock and re-plans everything.

## End-of-cycle review

From Friday of week 6 until two weeks into the next cycle, Today shows a review per
lift built from grinders, missed sets, heavy-week RPE and readiness: lower 5%, hold,
standard increment, or a bigger jump. Nothing changes until you apply it; choices are
written to `plan.cycleMaxes[next]` and recorded in `plan.reviews`.

## CSV export

Setup → Export to a spreadsheet builds two CSVs on the device (so rows carry the
computed week, session and prescription): **sessions** (one row per day) and **lifts**
(one row per lift per session, plus test results). Every date is evaluated against the
plan of the program it belongs to. On iPhone they open the share sheet; elsewhere they
download.

## Restore

`POST /api/backups/<name>/restore` or `POST /api/restore` (an uploaded backup or export
file) replaces the user's plan, logs and programs in one D1 batch, after saving a
`YYYY-MM-DD-before-restore-HHMMSS` backup. Setup → Backups has Restore buttons and
Restore from a file.

## Backups

A cron trigger (Sundays 09:00 UTC) saves a full JSON copy of the plan and every log to
the `operator-black-backups` Workers KV namespace and keeps the newest 26. Setup →
Backups lists them with download links and has **Back up now**. D1 also keeps 30 days
of point-in-time history: `npx wrangler d1 time-travel info operator-black`.
