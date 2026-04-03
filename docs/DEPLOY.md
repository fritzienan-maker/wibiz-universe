# Railway Deployment Guide

This guide covers the complete first-time deployment of WiBiz Academy to Railway.

---

## Overview

Railway runs a **single service** that:
1. Installs deps with pnpm
2. Builds the frontend (Vite → `dist/public/`) and server (esbuild → `dist/index.js`)
3. Runs `scripts/migrate.ts` (creates/updates all DB tables)
4. Starts the Express server which serves both the API and the static frontend

---

## Step 1 — Create the Railway Project

1. Go to https://railway.app and log in
2. Click **New Project**
3. Choose **Empty Project**
4. Name it `wibiz-academy`

---

## Step 2 — Add PostgreSQL

1. Inside your project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway creates a PostgreSQL 16 instance automatically
3. Click the PostgreSQL service → **Variables** tab
4. Copy the value of `DATABASE_URL` — you will need it in Step 4

---

## Step 3 — Add the Web Service (from GitHub)

1. Click **+ New** → **GitHub Repo**
2. Authorize Railway to access your GitHub account if prompted
3. Select **aileenwebdev/wibiz-academy**
4. Railway detects `railway.toml` and will use it automatically

---

## Step 4 — Set Environment Variables

In the web service (not the PostgreSQL service), click **Variables** and add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `APP_BASE_URL` | `https://your-app.up.railway.app` ← update after deploy |
| `DATABASE_URL` | Paste from Step 2 (or use `${{Postgres.DATABASE_URL}}` to link) |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` |
| `GHL_API_KEY` | Your rotated GHL Private Integration API key |
| `GHL_LOCATION_ID` | Your GHL sub-account location ID |
| `GHL_WEBHOOK_SECRET` | Choose any strong random string — must match what you set in GHL |

> **Note on `DATABASE_URL`:** Railway supports variable references. Instead of copying the value, you can type `${{Postgres.DATABASE_URL}}` and Railway will inject the PostgreSQL connection string automatically.

> **Custom domain:** Once you connect `academy.wibiz.ai`, update `APP_BASE_URL` to `https://academy.wibiz.ai`.

---

## Step 5 — Trigger First Deploy

Railway auto-deploys when you push to the connected branch (`main`).

If it doesn't start automatically:
1. Go to the web service → **Deployments** tab
2. Click **Deploy Now**

Watch the deploy logs — you should see:
```
[migrate] Running drizzle-kit migrations…
[migrate] Drizzle migrations complete
[migrate] All migrations complete
[server] WiBiz Academy listening on http://localhost:3000
[server] Mode: production
```

If you see `DATABASE_URL not set`, go back to Variables and check the value.

---

## Step 6 — Seed the Admin User (one time)

After the first successful deploy, open the **Railway console** for the web service:

1. Click your web service → **Settings** → **Open Shell** (or use the Railway CLI)
2. Run:

```bash
ADMIN_EMAIL=aileen@wibiz.ai ADMIN_PASSWORD=YourStr0ngPass123 npx tsx scripts/seed-admin.ts
```

Expected output:
```
[seed] ✓ Created wibiz_admin: aileen@wibiz.ai
```

> The script is idempotent — you can re-run it to update the password at any time.

**Alternative (Railway CLI):**
```bash
railway run --service wibiz-academy \
  ADMIN_EMAIL=aileen@wibiz.ai \
  ADMIN_PASSWORD=YourStr0ngPass123 \
  npx tsx scripts/seed-admin.ts
```

---

## Step 7 — Verify the Deploy

1. Open your Railway app URL (e.g. `https://wibiz-academy.up.railway.app`)
2. You should see the WiBiz Academy login page
3. Log in with the ADMIN_EMAIL / ADMIN_PASSWORD you seeded
4. Navigate to `/admin` — you should see the admin panel with zero users

---

## Step 8 — Connect Custom Domain

1. In Railway → web service → **Settings** → **Domains**
2. Add domain: `academy.wibiz.ai`
3. Railway shows a `CNAME` record to add in your DNS provider
4. Add the CNAME record (TTL: 300)
5. Wait for DNS propagation (usually under 5 minutes on Cloudflare)
6. Update `APP_BASE_URL` environment variable to `https://academy.wibiz.ai`
7. Railway auto-deploys on variable change

---

## Step 9 — Configure GHL Webhook

In GHL, edit the **"Wibiz Launch (SG) — Successful Payment"** workflow:

1. After the **Onboarding Started** stage action, add a **Send Data via Webhook** action
2. Set **Webhook URL** to: `https://academy.wibiz.ai/api/webhooks/ghl/provision`
3. Set **Method** to: `POST`
4. Add header: `x-wibiz-secret` = `<your GHL_WEBHOOK_SECRET value>`
5. Map these fields to the webhook body:

| Webhook field | GHL field |
|---|---|
| `contact_id` | `{{contact.id}}` |
| `email` | `{{contact.email}}` |
| `first_name` | `{{contact.first_name}}` |
| `last_name` | `{{contact.last_name}}` |
| `plan_tier` | `{{contact.plan_tier}}` (or your custom field) |
| `vertical` | `{{contact.vertical}}` |
| `hskd_required` | `{{contact.hskd_required}}` |
| `temporary_pass` | `{{contact.temporary_pass}}` |
| `location_id` | `{{location.id}}` |

6. Test the webhook step using GHL's built-in test — check the `/admin` panel → Webhook Log for the result

---

## Ongoing Deployments

Every push to the `main` branch on GitHub triggers a Railway redeploy automatically.

**Deploy process:**
1. `pnpm install --frozen-lockfile`
2. `pnpm build` (Vite + esbuild)
3. `npx tsx scripts/migrate.ts` (safe to run every time — idempotent)
4. `node dist/index.js`

**Schema changes:**
1. Edit `drizzle/schema.ts`
2. Run `pnpm db:push` locally to generate the migration file
3. Commit and push — Railway picks up the new migration on deploy

**Adding a custom migration:**
Add an entry to `CUSTOM_MIGRATIONS[]` in `scripts/migrate.ts`:
```typescript
{ name: "0001_your_change", sql: "ALTER TABLE users ADD COLUMN notes TEXT" }
```

---

## Rollback

To roll back to a previous deploy:
1. Railway → web service → **Deployments**
2. Find the last good deploy → click **Redeploy**

---

## Environment Variables Reference (Production)

```env
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://academy.wibiz.ai
DATABASE_URL=<Railway PostgreSQL URL>
JWT_SECRET=<64-char random hex>
JWT_EXPIRES_IN=7d
GHL_API_KEY=<rotated GHL Private Integration key>
GHL_LOCATION_ID=<GHL sub-account location ID>
GHL_WEBHOOK_SECRET=<shared secret matching GHL workflow>
```

---

## Monitoring

- **Health check:** `GET https://academy.wibiz.ai/api/health` → `{ "status": "ok" }`
- **Webhook log:** `/admin` → Webhook Log tab
- **Sync events:** `/admin` → Sync Events tab
- **Railway logs:** Railway dashboard → web service → Logs tab
