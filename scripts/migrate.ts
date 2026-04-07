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
  console.warn("[migrate] DATABASE_URL not set — skipping migrations");
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

  console.log("[migrate] Running drizzle-kit migrations…");
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Drizzle migrations complete");

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
        console.log(`[migrate] ✓ Already applied: ${m.name}`);
        continue;
      }
      try {
        await pool.query(m.sql);
        await pool.query(
          "INSERT INTO _custom_migrations (name) VALUES ($1)",
          [m.name]
        );
        console.log(`[migrate] ✓ Applied: ${m.name}`);
      } catch (err: any) {
        console.error(`[migrate] ✗ Failed: ${m.name}`, err.message);
        await pool.end();
        process.exit(1);
      }
    }
  }

  await pool.end();
  console.log("[migrate] All migrations complete");
}

run().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
