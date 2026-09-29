# Operator + Black

Training log for Tactical Barbell's **Operator** strength template plus the **Black**
conditioning protocol. It runs 6-week cycles with no end date, schedules deloads and
retests automatically, calculates working weights and plates, and logs every session.

Hosted as a Cloudflare Worker at **operatorblack.com**, with storage in D1 and sign-in
through Cloudflare Access.

```
public/index.html           the whole app (vanilla JS, no build step)
src/worker.js               entry: /api/* → API, everything else → public/
src/api.js                  API: /api/state, /api/doc/<path>, /api/export
migrations/0001_init.sql    D1 schema (one JSON document per row)
wrangler.toml               Worker, static assets, D1, custom domain, Access config
```

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars      # skips the Access check locally
npm run db:migrate:local
npm run dev                         # http://localhost:8787
```

## Deploys

Every push to `main` deploys through Workers Builds (the Worker is connected to this
repo in the dashboard). `wrangler.toml` attaches **operatorblack.com** as a custom
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

## Backups

A cron trigger (Sundays 09:00 UTC) saves a full JSON copy of the plan and every log to
the `operator-black-backups` Workers KV namespace and keeps the newest 26. Setup →
Backups lists them with download links and has **Back up now**. D1 also keeps 30 days
of point-in-time history: `npx wrangler d1 time-travel info operator-black`.
