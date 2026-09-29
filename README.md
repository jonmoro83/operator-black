# Operator + Black

Training log for Tactical Barbell's **Operator** strength template plus the **Black**
conditioning protocol. It runs 6-week cycles with no end date, schedules deloads and
retests automatically, calculates working weights and plates, and logs every session.

Hosted on Cloudflare Pages at **operatorblack.com**, with storage in D1 and sign-in
through Cloudflare Access.

```
public/index.html           the whole app (vanilla JS, no build step)
functions/api/[[path]].js   API: /api/state, /api/doc/<path>, /api/export
migrations/0001_init.sql    D1 schema (one JSON document per row)
wrangler.toml               Pages + D1 + Access config
```

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars      # skips the Access check locally
npm run db:migrate:local
npm run dev                         # http://localhost:8788
```

## First-time Cloudflare setup

1. **Log in:** `npx wrangler login`
2. **Create the database:** `npx wrangler d1 create operator-black`. Paste the
   `database_id` it prints into `wrangler.toml`.
3. **Create the table:** `npm run db:migrate:remote`
4. **Create the Pages project:** Dashboard → Workers & Pages → Create → Pages →
   *Connect to Git* → pick `jonmoro83/operator-black`.
   - Framework preset: None · Build command: *(empty)* · Output directory: `public`
   - The D1 binding comes from `wrangler.toml`. No dashboard setup is needed for it.
5. **Custom domain:** in the Pages project, open Custom domains → Set up →
   `operatorblack.com` (optionally add `www.operatorblack.com` too).
6. **Lock it down with Cloudflare Access** (Zero Trust → Access → Applications → Add →
   Self-hosted):
   - Add **both** hostnames: `operatorblack.com` and `operator-black.pages.dev`
     (plus `*.operator-black.pages.dev` for preview deploys).
   - Policy: Allow → Include → Emails → your email. Login method: One-time PIN.
   - Copy the **Application Audience (AUD) tag** into `ACCESS_AUD` and your team
     domain (`<team>.cloudflareaccess.com`) into `ACCESS_TEAM_DOMAIN` in
     `wrangler.toml`, then commit and push.

The API rejects every request until those two values are set. Every request must
also carry a valid Access token, so the app can't be read or written around the
login screen.

## Backups

Setup → **Download backup** saves everything as JSON. D1 also keeps 30 days of
point-in-time history: `npx wrangler d1 time-travel info operator-black`.
