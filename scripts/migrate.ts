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
  // Example:
  // { name: "0001_add_notes_column", sql: "ALTER TABLE users ADD COLUMN notes TEXT" },
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
