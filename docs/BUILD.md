# Local Development Guide

This guide covers everything you need to run WiBiz Academy locally for development.

---

## Prerequisites

Install these before starting:

1. **Node.js 22+**
   ```bash
   # Check your version
   node --version   # must be v22.x.x or higher
   ```
   Download: https://nodejs.org/en/download

2. **pnpm 10+**
   ```bash
   npm install -g pnpm
   pnpm --version   # must be 10.x.x or higher
   ```

3. **PostgreSQL 15+**

   **Option A — Local install:**
   - Windows: https://www.postgresql.org/download/windows/
   - Create a database: `createdb wibiz_academy`

   **Option B — Docker (recommended for dev):**
   ```bash
   docker run -d \
     --name wibiz-pg \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=wibiz_academy \
     -p 5432:5432 \
     postgres:16
   ```
   Connection string: `postgresql://postgres:password@localhost:5432/wibiz_academy`

4. **Git**
   ```bash
   git --version
   ```

---

## First-Time Setup

### 1. Clone and install

```bash
git clone https://github.com/aileenwebdev/wibiz-academy.git
cd wibiz-academy
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000

DATABASE_URL=postgresql://postgres:password@localhost:5432/wibiz_academy

JWT_SECRET=generate-a-random-64-char-string-here
JWT_EXPIRES_IN=7d

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourStr0ngPass123

GHL_API_KEY=pit-your-rotated-key
GHL_LOCATION_ID=your-location-id
GHL_WEBHOOK_SECRET=any-string-you-choose-for-local-testing
```

**Generate a strong JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Run database migrations

```bash
npx tsx scripts/migrate.ts
```

This creates all three tables: `users`, `sync_events`, `webhook_log`.

### 4. Seed the admin user

```bash
npx tsx scripts/seed-admin.ts
```

This reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env` and creates a `wibiz_admin` user. Run it again anytime to update the password.

### 5. Start the dev server

```bash
pnpm dev
```

Open http://localhost:3000 — you should see the WiBiz Academy login page.

Log in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set above.

---

## Development Workflow

### Dev server

```bash
pnpm dev
```

- Single process — Express serves both the API and the Vite frontend
- Frontend changes: hot-reloaded instantly (HMR)
- Backend changes: auto-restarts via `tsx watch`
- No need to run frontend and backend separately

### TypeScript type checking

```bash
pnpm check
```

Runs `tsc --noEmit` across all source files. Zero errors means you're clean.

### Tests

```bash
pnpm test
```

Runs the vitest suite (14 tests covering webhook idempotency and auth flows). No database connection needed — all DB calls are mocked.

### Database changes

If you add or change a Drizzle table definition in `drizzle/schema.ts`:

```bash
pnpm db:push
```

This generates a migration SQL file in `drizzle/migrations/` and applies it. Commit the generated migration files.

---

## Testing the Webhook Locally

To simulate GHL firing the provision webhook during local dev:

```bash
curl -X POST http://localhost:3000/api/webhooks/ghl/provision \
  -H "Content-Type: application/json" \
  -H "x-wibiz-secret: <your-GHL_WEBHOOK_SECRET>" \
  -d '{
    "contact_id":     "test-contact-001",
    "email":          "testuser@example.com",
    "first_name":     "Test",
    "last_name":      "User",
    "plan_tier":      "standard",
    "vertical":       "dental",
    "hskd_required":  false,
    "temporary_pass": "TempPass123!",
    "location_id":    "test-location"
  }'
```

Expected response:
```json
{ "message": "provisioned", "userId": "..." }
```

Send the same request again — you should get:
```json
{ "message": "already_provisioned" }
```

Confirm in the Admin panel (`/admin` → Webhook Log and Sync Events tabs) that both events were logged.

---

## Project Conventions

### File naming
- React components: `PascalCase.tsx` (e.g., `Admin.tsx`)
- Utilities and routes: `camelCase.ts` (e.g., `db.ts`, `auth.ts`)
- Folders: lowercase (e.g., `routes/`, `_core/`)

### Adding a new API route
1. Create `server/routes/yourRoute.ts` — export a `Router`
2. Add query functions to `server/db.ts`
3. Mount in `server/_core/index.ts`: `app.use("/api/your-path", yourRouter)`

### Adding a new page
1. Create `client/src/pages/YourPage.tsx`
2. Add the route to `client/src/App.tsx`
3. Wrap with `<PrivateRoute>` if it requires authentication

### Environment variables
- Add new vars to `.env.example` (with placeholder value, never real)
- Read in `server/_core/env.ts` via the `ENV` object
- Add a startup warning if the var is required

---

## Common Issues

**`pnpm install` fails with pnpm version error**
```bash
npm install -g pnpm@latest
```

**`DATABASE_URL` connection refused**
Make sure PostgreSQL is running and the connection string matches your local setup.

**`JWT_SECRET` warning on startup**
The server warns if `JWT_SECRET` is shorter than 32 characters. Use the generation command above.

**Port 3000 already in use**
Change `PORT=3001` in your `.env`.

**Tailwind styles not applying**
The project uses Tailwind v4 with `@import "tailwindcss"` syntax (not the old `@tailwind base` directives). If you see unstyled pages, verify `client/src/index.css` starts with `@import "tailwindcss";`.
