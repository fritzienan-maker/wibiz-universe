/**
 * Migration runner — runs on every Railway deploy before the server starts.
 *
 *   Railway start command:  npx tsx scripts/migrate.ts && pnpm start
 *   Manual run:             npx tsx scripts/migrate.ts
 *
 * Two-step process:
 *   1. drizzle-kit generated migrations (drizzle/migrations/) via drizzle migrator
 *   2. Custom ALTER TABLE statements tracked in _custom_migrations table
 *      (append to CUSTOM_MIGRATIONS below for schema changes between releases)
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate }  from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.warn("[migrate] DATABASE_URL not set  skipping migrations - migrate.ts:23");
  process.exit(0);
}

// ─── Add custom ALTER TABLE migrations here for post-release schema changes ───
// Format: { name: "unique-name", sql: "ALTER TABLE ..." }
// Each migration runs once and is tracked in _custom_migrations table.
const CUSTOM_MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "0001_exercises_proof_prompt",
    sql:  "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS proof_prompt TEXT",
  },
  {
    name: "0002_user_progress_proof_text",
    sql:  "ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS proof_text TEXT",
  },
  {
    name: "0003_create_quiz_questions",
    sql: `CREATE TABLE IF NOT EXISTS quiz_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id UUID NOT NULL,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_answer_index INTEGER NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  },
  {
    name: "0004_create_quiz_responses",
    sql: `CREATE TABLE IF NOT EXISTS quiz_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      module_id UUID NOT NULL,
      answers JSONB NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      passed BOOLEAN NOT NULL DEFAULT FALSE,
      passed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  },
  // ── Submission review workflow (2026-04) ──────────────────────────────────
  {
    name: "0005_submission_status_enum",
    sql: `DO $$ BEGIN
      CREATE TYPE submission_status AS ENUM ('pending_review', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    name: "0006_exercises_video_url",
    sql: `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_url TEXT`,
  },
  {
    name: "0007_user_progress_rename_completed_at",
    sql: `DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_progress' AND column_name = 'completed_at'
      ) THEN
        ALTER TABLE user_progress RENAME COLUMN completed_at TO submitted_at;
      END IF;
    END $$`,
  },
  {
    name: "0008_user_progress_submission_cols",
    sql: `ALTER TABLE user_progress
      ADD COLUMN IF NOT EXISTS proof_image_url    TEXT,
      ADD COLUMN IF NOT EXISTS submission_status  submission_status NOT NULL DEFAULT 'pending_review',
      ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by        UUID,
      ADD COLUMN IF NOT EXISTS review_note        TEXT`,
  },
  {
    name: "0009_backfill_submission_status_approved",
    sql: `UPDATE user_progress SET submission_status = 'approved' WHERE submission_status = 'pending_review'`,
  },
  // ── My Team + DocuSeal (2026-04) ──────────────────────────────────────────
  {
    name: "0010_users_team_fields",
    sql: `ALTER TABLE users
      ADD COLUMN IF NOT EXISTS client_id         UUID,
      ADD COLUMN IF NOT EXISTS invite_token      VARCHAR(64),
      ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP`,
  },
  {
    name: "0011_docuseal_submissions",
    sql: `CREATE TABLE IF NOT EXISTS docuseal_submissions (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID         NOT NULL,
      document_type  VARCHAR(50)  NOT NULL,
      template_id    INTEGER      NOT NULL,
      docuseal_id    INTEGER,
      status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
      signer_email   VARCHAR(255),
      sent_at        TIMESTAMP    DEFAULT NOW(),
      completed_at   TIMESTAMP,
      created_at     TIMESTAMP    DEFAULT NOW()
    )`,
  },
  // ── User avatar + Support Tickets (2026-04) ───────────────────────────────
  {
    name: "0012_users_avatar_url",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
  },
  {
    name: "0013_support_tickets",
    sql: `CREATE TABLE IF NOT EXISTS support_tickets (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID         NOT NULL,
      subject        VARCHAR(255) NOT NULL,
      category       VARCHAR(100),
      message        TEXT         NOT NULL,
      priority       VARCHAR(20)  NOT NULL DEFAULT 'normal',
      attachment_url TEXT,
      status         VARCHAR(20)  NOT NULL DEFAULT 'open',
      ghl_forwarded  BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMP    DEFAULT NOW(),
      updated_at     TIMESTAMP    DEFAULT NOW()
    )`,
  },
  // ── Resources + Tutorial Videos (2026-04) ────────────────────────────────
  {
    name: "0014_resources",
    sql: `CREATE TABLE IF NOT EXISTS resources (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      category    VARCHAR(100),
      url         TEXT,
      icon        VARCHAR(10),
      order_index INTEGER      NOT NULL DEFAULT 0,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW(),
      updated_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0015_tutorial_videos",
    sql: `CREATE TABLE IF NOT EXISTS tutorial_videos (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(255) NOT NULL,
      duration    VARCHAR(20),
      video_url   TEXT,
      order_index INTEGER      NOT NULL DEFAULT 0,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW(),
      updated_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  // ── HSKD ClearPath Certification (2026-04) ────────────────────────────────
  {
    name: "0016_hskd_industries",
    sql: `CREATE TABLE IF NOT EXISTS hskd_industries (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      slug        VARCHAR(100) NOT NULL UNIQUE,
      name        VARCHAR(255) NOT NULL,
      tier        VARCHAR(20)  NOT NULL DEFAULT 'TIER_1',
      description TEXT,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW(),
      updated_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0017_hskd_scenarios",
    sql: `CREATE TABLE IF NOT EXISTS hskd_scenarios (
      id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id              UUID    NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      scenario_number          INTEGER NOT NULL,
      title                    VARCHAR(255) NOT NULL,
      scenario_text            TEXT,
      danger_text              TEXT,
      prescribed_bot_response  TEXT,
      mandatory_bot_action     TEXT,
      certification_prompt     TEXT,
      ops_note                 TEXT,
      is_active                BOOLEAN NOT NULL DEFAULT TRUE,
      created_at               TIMESTAMP DEFAULT NOW(),
      updated_at               TIMESTAMP DEFAULT NOW(),
      UNIQUE(industry_id, scenario_number)
    )`,
  },
  {
    name: "0018_hskd_prohibited_items",
    sql: `CREATE TABLE IF NOT EXISTS hskd_prohibited_items (
      id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id      UUID    NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      item_number      INTEGER NOT NULL,
      category         VARCHAR(255),
      restriction_text TEXT,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMP DEFAULT NOW(),
      updated_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE(industry_id, item_number)
    )`,
  },
  {
    name: "0019_hskd_training_modules",
    sql: `CREATE TABLE IF NOT EXISTS hskd_training_modules (
      id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id   UUID    NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      module_number INTEGER NOT NULL,
      title         VARCHAR(255) NOT NULL,
      content       TEXT,
      video_url     TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE(industry_id, module_number)
    )`,
  },
  {
    name: "0020_client_certifications",
    sql: `CREATE TABLE IF NOT EXISTS client_certifications (
      id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id                    UUID        NOT NULL,
      industry_id                  UUID        NOT NULL REFERENCES hskd_industries(id),
      status                       VARCHAR(50) NOT NULL DEFAULT 'TRAINING',
      training_completed_at        TIMESTAMP,
      affirmation_legal_name       VARCHAR(255),
      affirmation_license_type     VARCHAR(255),
      affirmation_license_number   VARCHAR(255),
      affirmation_license_state    VARCHAR(100),
      affirmation_submitted_at     TIMESTAMP,
      oncall_contact_name          VARCHAR(255),
      oncall_contact_phone         VARCHAR(50),
      mandatory_reporter_status    BOOLEAN,
      hipaa_baa_executed           BOOLEAN,
      hipaa_baa_date               VARCHAR(50),
      ops_signoff_by               VARCHAR(255),
      ops_signoff_at               TIMESTAMP,
      specialist_mode_activated_at TIMESTAMP,
      certificate_id               VARCHAR(100),
      kb_review_due_at             TIMESTAMP,
      tier0_monitoring_start_at    TIMESTAMP,
      created_at                   TIMESTAMP   DEFAULT NOW(),
      updated_at                   TIMESTAMP   DEFAULT NOW()
    )`,
  },
  {
    name: "0021_certification_scenario_logs",
    sql: `CREATE TABLE IF NOT EXISTS certification_scenario_logs (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      certification_id UUID        NOT NULL REFERENCES client_certifications(id) ON DELETE CASCADE,
      scenario_id      UUID        NOT NULL REFERENCES hskd_scenarios(id),
      scenario_number  INTEGER     NOT NULL,
      decision         VARCHAR(20) NOT NULL,
      client_note      TEXT,
      decided_at       TIMESTAMP   DEFAULT NOW(),
      UNIQUE(certification_id, scenario_id)
    )`,
  },
  {
    name: "0022_certification_prohibited_logs",
    sql: `CREATE TABLE IF NOT EXISTS certification_prohibited_logs (
      id                 UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      certification_id   UUID      NOT NULL REFERENCES client_certifications(id) ON DELETE CASCADE,
      prohibited_item_id UUID      NOT NULL REFERENCES hskd_prohibited_items(id),
      confirmed_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE(certification_id, prohibited_item_id)
    )`,
  },
  {
    name: "0023_hskd_crisis_resources",
    sql: `CREATE TABLE IF NOT EXISTS hskd_crisis_resources (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id UUID         NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      name        VARCHAR(255) NOT NULL,
      phone       VARCHAR(50),
      description TEXT,
      url         TEXT,
      priority    INTEGER      NOT NULL DEFAULT 0,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0024_users_hskd_required",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS hskd_required BOOLEAN NOT NULL DEFAULT FALSE`,
  },
];

async function run(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: DB_URL!,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
  });

  // 1. Run drizzle-kit generated migrations
  const db = drizzle(pool);
  const migrationsFolder = path.resolve(__dirname, "..", "drizzle", "migrations");

  console.log("[migrate] Running drizzlekit migrations… - migrate.ts:319");
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Drizzle migrations complete - migrate.ts:321");

  // 2. Run custom migrations
  if (CUSTOM_MIGRATIONS.length > 0) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _custom_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);

    for (const m of CUSTOM_MIGRATIONS) {
      const { rows } = await pool.query(
        "SELECT name FROM _custom_migrations WHERE name = $1",
        [m.name]
      );
      if (rows.length > 0) {
        console.log(`[migrate] ✓ Already applied: ${m.name} - migrate.ts:338`);
        continue;
      }
      try {
        await pool.query(m.sql);
        await pool.query(
          "INSERT INTO _custom_migrations (name) VALUES ($1)",
          [m.name]
        );
        console.log(`[migrate] ✓ Applied: ${m.name} - migrate.ts:347`);
      } catch (err: any) {
        console.error(`[migrate] ✗ Failed: ${m.name} - migrate.ts:349`, err.message);
        await pool.end();
        process.exit(1);
      }
    }
  }

  await pool.end();
  console.log("[migrate] All migrations complete - migrate.ts:357");
}

run().catch((err) => {
  console.error("[migrate] Fatal error: - migrate.ts:361", err);
  process.exit(1);
});