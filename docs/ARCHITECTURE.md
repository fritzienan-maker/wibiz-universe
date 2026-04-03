# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GoHighLevel (GHL)                           │
│                                                                     │
│  Successful payment → contact moves to "Onboarding Started"        │
│  GHL workflow generates temp password → stores in contact field     │
│  GHL fires webhook → WiBiz Academy provisioning endpoint            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │  POST /api/webhooks/ghl/provision
                              │  Header: x-wibiz-secret
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WiBiz Academy (Railway)                         │
│                                                                     │
│  Express + TypeScript + PostgreSQL                                  │
│                                                                     │
│  1. Validate secret header                                          │
│  2. Log raw payload → webhook_log                                   │
│  3. Idempotency check: ghl_contact_id already exists?               │
│     └─ Yes: return 200, log duplicate event                         │
│     └─ No: continue                                                 │
│  4. Hash temporary_pass (bcrypt, cost 12)                           │
│  5. INSERT user (role: client_admin)                                │
│  6. Log sync event → sync_events                                    │
│  7. Return 200                                                      │
│                                                                     │
│  User logs in at /login → JWT cookie → /dashboard                  │
│  wibiz_admin logs in → /admin (users, sync events, webhook log)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 22 | LTS, ESM support, performance |
| Backend framework | Express 4 | Lightweight, well-understood, Railway-compatible |
| ORM | Drizzle | Type-safe, PostgreSQL-native, fast |
| Database | PostgreSQL 16 (Railway) | Reliable, supports JSONB for webhook payloads |
| Auth | JWT in httpOnly cookie | Secure — JS cannot access the token |
| Frontend | React 18 + Vite 6 | Fast builds, HMR in dev |
| Styling | Tailwind CSS v4 | Utility-first, CSS variables for theming |
| Validation | Zod | Schema-validated webhook and auth inputs |
| Deployment | Railway | Zero-config, Nixpacks, auto-deploy from GitHub |

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | VARCHAR UNIQUE | lowercased on write |
| `password_hash` | TEXT | bcrypt cost 12 |
| `role` | ENUM | `client_admin`, `client_staff`, `operator`, `wibiz_admin` |
| `ghl_contact_id` | VARCHAR UNIQUE | nullable — admin users have none |
| `ghl_location_id` | VARCHAR | |
| `first_name` | VARCHAR | |
| `last_name` | VARCHAR | |
| `plan_tier` | ENUM | `lite`, `standard`, `pro` |
| `vertical` | VARCHAR | e.g. `dental`, `medical` |
| `hskd_required` | BOOLEAN | |
| `is_active` | BOOLEAN | |
| `activated_at` | TIMESTAMP | set on provisioning |
| `last_login_at` | TIMESTAMP | updated on each login |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### `sync_events`
Audit log for all provisioning events. Every webhook that touches a user generates a record here.

| Column | Notes |
|---|---|
| `event_type` | e.g. `user_created`, `ghl_provision_duplicate`, `user_create_failed` |
| `status` | `pending`, `success`, `failed` |
| `payload_json` | JSONB snapshot of relevant data |
| `error_message` | Populated on failure |

### `webhook_log`
Raw receipt log — every inbound webhook is logged here before any processing.

| Column | Notes |
|---|---|
| `raw_payload` | JSONB — full request body |
| `processed` | `false` until processing completes or fails |
| `error` | Error message if processing failed |

---

## Auth Flow

```
POST /api/auth/login
  → getUserByEmail()
  → bcrypt.compare(password, hash)
  → jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: "7d" })
  → res.cookie("wibiz_session", token, { httpOnly, sameSite: "none", secure })
  → 200 { user }

Every protected request:
  → requireAuth middleware
  → reads req.cookies.wibiz_session
  → jwt.verify(token, JWT_SECRET)
  → attaches req.user = { userId, email, role }
  → 401 if token missing or invalid

Admin routes additionally:
  → requireAdmin middleware
  → checks req.user.role === "wibiz_admin"
  → 403 if not admin
```

---

## Roles (Phase 1)

| Role | Who | Access |
|---|---|---|
| `client_admin` | GHL-provisioned paying clients | Login, dashboard, change-password |
| `wibiz_admin` | WiBiz team (seeded manually) | All above + `/admin` routes |
| `client_staff` | Phase 2+ | — |
| `operator` | Phase 2+ | — |

---

## Phase 1 Scope — What Is and Is Not Included

### ✅ Phase 1 includes
- GHL webhook provisioning (idempotent)
- Login with temporary password
- JWT auth via httpOnly cookie
- Protected dashboard (placeholder content)
- Self-serve password change
- Admin: view users, sync events, webhook log
- Failed webhook logging
- Duplicate webhook deduplication

### ❌ Phase 2+ (not in this codebase yet)
- Module content / progress tracking
- JotForm integration
- Adobe Sign integration
- HSKD compliance flow
- System certification tests
- Certificates
- Operator tier logic
- Client staff invite flow
- GHL milestone writebacks
- Email sending from portal
- Profile/settings page UI

---

## Key Design Decisions

**Why not tRPC?** The GHL webhook receiver must be a plain HTTP POST endpoint. Adding tRPC would create a hybrid REST+tRPC setup with no clear benefit for Phase 1's small route count. REST is used throughout.

**Why httpOnly cookie instead of localStorage?** `httpOnly` cookies cannot be read by JavaScript. This means even if an XSS vulnerability exists, the session token is protected.

**Why is `ghlContactId` nullable?** The `wibiz_admin` user is seeded manually and has no GHL contact. Making the column nullable allows this without a separate admin-specific table. The unique constraint still applies to all non-null values.

**Why does `scripts/migrate.ts` run on every deploy?** Both `drizzle-kit migrate` and the custom migrations runner are idempotent — they skip already-applied changes. Running on every deploy ensures the schema is always up to date without requiring manual steps.
