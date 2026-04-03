/**
 * One-time admin seed script — creates or updates the wibiz_admin user.
 * Idempotent: safe to run multiple times (re-running updates the password).
 *
 * Run once after first deploy via Railway console:
 *
 *   ADMIN_EMAIL=you@wibiz.ai ADMIN_PASSWORD=YourStr0ngPass npx tsx scripts/seed-admin.ts
 *
 * Or with .env already populated:
 *
 *   npx tsx scripts/seed-admin.ts
 *
 * Requirements:
 *   - DATABASE_URL must be set
 *   - ADMIN_EMAIL must be a valid email
 *   - ADMIN_PASSWORD must be at least 12 characters
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq }      from "drizzle-orm";
import bcrypt      from "bcryptjs";
import { users }   from "../drizzle/schema";

const email    = process.env.ADMIN_EMAIL?.toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("[seed] ADMIN_EMAIL and ADMIN_PASSWORD must both be set");
  process.exit(1);
}
if (password.length < 12) {
  console.error("[seed] ADMIN_PASSWORD must be at least 12 characters");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("[seed] DATABASE_URL must be set");
  process.exit(1);
}

async function run(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
  });
  const db = drizzle(pool);

  const passwordHash = await bcrypt.hash(password!, 12);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email!));

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        role:      "wibiz_admin",
        isActive:  true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log(`[seed] ✓ Updated → wibiz_admin: ${email}`);
  } else {
    await db.insert(users).values({
      email: email!,
      passwordHash,
      role:        "wibiz_admin",
      firstName:   "Admin",
      lastName:    "WiBiz",
      isActive:    true,
      activatedAt: new Date(),
    });
    console.log(`[seed] ✓ Created wibiz_admin: ${email}`);
  }

  await pool.end();
}

run().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
