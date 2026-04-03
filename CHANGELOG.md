# Changelog

All notable changes to WiBiz Academy will be documented here.

Format: [Semantic Versioning](https://semver.org/). Each entry covers what changed, why, and any migration steps needed.

---

## [1.0.0] — 2026-04-03

### Phase 1 — Initial release

First production-ready version of WiBiz Academy. Covers everything needed to onboard a paying GHL contact into the portal.

#### Added

**Authentication**
- Login with email + bcrypt-hashed password via `POST /api/auth/login`
- Session stored in `httpOnly` cookie (`wibiz_session`) — JS-inaccessible
- JWT signed with `JWT_SECRET`, 7-day expiry by default
- `GET /api/auth/me` — returns current user profile from cookie
- `POST /api/auth/logout` — clears session cookie
- `POST /api/auth/change-password` — self-serve password change (requires current password)

**GHL Webhook Provisioning**
- `POST /api/webhooks/ghl/provision` — idempotent provisioning endpoint
- Validates `x-wibiz-secret` header before processing
- Logs every inbound webhook to `webhook_log` before any other action
- Full Zod validation — rejects with 400 if `temporary_pass` is missing
- Deduplication by `ghl_contact_id` — duplicate fires return 200 without re-inserting
- bcrypt hashes `temporary_pass` at cost 12 before storing
- New user provisioned with role `client_admin`
- Sync event logged (`user_created`) on success

**Admin Panel** (`/admin` — `wibiz_admin` only)
- Users tab — all provisioned users with role badges, plan tier, vertical, active status
- Sync Events tab — full audit trail of provisioning events
- Webhook Log tab — raw inbound webhook receipts with processed status and errors

**Dashboard** (`/dashboard` — all authenticated users)
- Placeholder page confirming successful login; module content comes in Phase 2

**Database**
- PostgreSQL 16 with Drizzle ORM
- Three tables: `users`, `sync_events`, `webhook_log`
- Migration runner (`scripts/migrate.ts`) — idempotent, runs on every Railway deploy
- Seed script (`scripts/seed-admin.ts`) — creates/updates the `wibiz_admin` account

**Infrastructure**
- Single Express + Vite service — backend serves the built frontend in production
- Railway deployment via `railway.toml` (nixpacks, auto-deploy on push to `main`)
- Health check at `GET /api/health`

**Developer experience**
- 14 Vitest tests — webhook idempotency + auth flows; no real DB needed (mocked)
- `pnpm dev` — single command for Express + Vite HMR
- `pnpm check` — TypeScript type-check across all source files

---

## Phase 2+ (planned)

See `docs/ARCHITECTURE.md` → Phase 2+ section for the full list of upcoming features including module content, JotForm, Adobe Sign, HSKD compliance, certificates, and client staff invites.
