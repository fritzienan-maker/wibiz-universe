// ─── Database client + all query functions (BC360 pattern: one file) ──────────
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool }    from "pg";
import { eq, desc } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import type { NewUser, NewSyncEvent } from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── Connection ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: ENV.databaseUrl,
  ssl: ENV.isProduction ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

// ─── User queries ──────────────────────────────────────────────────────────────
export async function getUserById(id: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id));
  return user ?? null;
}

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()));
  return user ?? null;
}

export async function getUserByGhlContactId(ghlContactId: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.ghlContactId, ghlContactId));
  return user ?? null;
}

export async function createUser(data: NewUser) {
  const [user] = await db.insert(schema.users).values(data).returning();
  return user!;
}

export async function updateUserLastLogin(id: string) {
  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.users.id, id));
}

export async function updateUserPassword(id: string, passwordHash: string) {
  await db
    .update(schema.users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(schema.users.id, id));
}

export async function listUsers() {
  return db
    .select({
      id:           schema.users.id,
      email:        schema.users.email,
      firstName:    schema.users.firstName,
      lastName:     schema.users.lastName,
      role:         schema.users.role,
      planTier:     schema.users.planTier,
      vertical:     schema.users.vertical,
      isActive:     schema.users.isActive,
      ghlContactId: schema.users.ghlContactId,
      activatedAt:  schema.users.activatedAt,
      lastLoginAt:  schema.users.lastLoginAt,
      createdAt:    schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt));
}

// ─── Webhook log ───────────────────────────────────────────────────────────────
export async function logWebhookReceived(rawPayload: unknown) {
  const [log] = await db
    .insert(schema.webhookLog)
    .values({ source: "ghl", rawPayload: rawPayload as any, processed: false })
    .returning();
  return log!;
}

export async function markWebhookProcessed(id: string, error?: string) {
  await db
    .update(schema.webhookLog)
    .set({
      processed: !error,
      error:     error ?? null,
    })
    .where(eq(schema.webhookLog.id, id));
}

export async function listWebhookLog(limit = 100) {
  return db
    .select()
    .from(schema.webhookLog)
    .orderBy(desc(schema.webhookLog.receivedAt))
    .limit(limit);
}

// ─── Sync events ───────────────────────────────────────────────────────────────
export async function logSyncEvent(data: NewSyncEvent) {
  const [event] = await db.insert(schema.syncEvents).values(data).returning();
  return event!;
}

export async function listSyncEvents(limit = 100) {
  return db
    .select()
    .from(schema.syncEvents)
    .orderBy(desc(schema.syncEvents.createdAt))
    .limit(limit);
}
