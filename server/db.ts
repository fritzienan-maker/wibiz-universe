// ─── Database client + all query functions (BC360 pattern: one file) ──────────
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool }    from "pg";
import { eq, desc, asc, and } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import type { NewUser, NewSyncEvent, NewModule } from "../drizzle/schema";
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

// ─── Module queries ────────────────────────────────────────────────────────────
export async function listModules(activeOnly = false) {
  const query = db
    .select()
    .from(schema.modules)
    .orderBy(asc(schema.modules.orderIndex), asc(schema.modules.createdAt));
  if (activeOnly) {
    return db
      .select()
      .from(schema.modules)
      .where(eq(schema.modules.isActive, true))
      .orderBy(asc(schema.modules.orderIndex), asc(schema.modules.createdAt));
  }
  return query;
}

export async function getModuleById(id: string) {
  const [mod] = await db
    .select()
    .from(schema.modules)
    .where(eq(schema.modules.id, id));
  return mod ?? null;
}

export async function createModule(data: NewModule) {
  const [mod] = await db.insert(schema.modules).values(data).returning();
  return mod!;
}

export async function updateModule(id: string, data: Partial<NewModule>) {
  const [mod] = await db
    .update(schema.modules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.modules.id, id))
    .returning();
  return mod ?? null;
}

export async function deleteModule(id: string) {
  await db.delete(schema.modules).where(eq(schema.modules.id, id));
}

// ─── Exercise queries ──────────────────────────────────────────────────────────
export async function listExercisesByModule(moduleId: string, activeOnly = false) {
  const condition = activeOnly
    ? and(eq(schema.exercises.moduleId, moduleId), eq(schema.exercises.isActive, true))
    : eq(schema.exercises.moduleId, moduleId);
  return db
    .select()
    .from(schema.exercises)
    .where(condition)
    .orderBy(asc(schema.exercises.orderIndex), asc(schema.exercises.createdAt));
}

export async function getExerciseById(id: string) {
  const [ex] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, id));
  return ex ?? null;
}

export async function createExercise(data: typeof schema.exercises.$inferInsert) {
  const [ex] = await db.insert(schema.exercises).values(data).returning();
  return ex!;
}

export async function updateExercise(id: string, data: Partial<typeof schema.exercises.$inferInsert>) {
  const [ex] = await db
    .update(schema.exercises)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.exercises.id, id))
    .returning();
  return ex ?? null;
}

export async function deleteExercise(id: string) {
  await db.delete(schema.exercises).where(eq(schema.exercises.id, id));
}

// ─── Progress queries ─────────────────────────────────────────────────────────
export async function getCompletedExerciseIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ exerciseId: schema.userProgress.exerciseId })
    .from(schema.userProgress)
    .where(eq(schema.userProgress.userId, userId));
  return new Set(rows.map((r) => r.exerciseId));
}

export async function markExerciseComplete(userId: string, exerciseId: string, proofText: string) {
  const existing = await db
    .select()
    .from(schema.userProgress)
    .where(and(eq(schema.userProgress.userId, userId), eq(schema.userProgress.exerciseId, exerciseId)));
  if (existing.length > 0) return existing[0]!;
  const [row] = await db.insert(schema.userProgress).values({ userId, exerciseId, proofText }).returning();
  return row!;
}

export async function getCompletedModuleIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ moduleId: schema.userModuleCompletions.moduleId })
    .from(schema.userModuleCompletions)
    .where(eq(schema.userModuleCompletions.userId, userId));
  return new Set(rows.map((r) => r.moduleId));
}

export async function markModuleComplete(userId: string, moduleId: string) {
  const existing = await db
    .select()
    .from(schema.userModuleCompletions)
    .where(and(eq(schema.userModuleCompletions.userId, userId), eq(schema.userModuleCompletions.moduleId, moduleId)));
  if (existing.length > 0) return existing[0]!;
  const [row] = await db.insert(schema.userModuleCompletions).values({ userId, moduleId }).returning();
  return row!;
}

// ─── Quiz queries ─────────────────────────────────────────────────────────────

// Returns questions WITHOUT the correct answer (safe for client)
export async function listQuizQuestionsForClient(moduleId: string) {
  const rows = await db
    .select({
      id:         schema.quizQuestions.id,
      question:   schema.quizQuestions.question,
      options:    schema.quizQuestions.options,
      orderIndex: schema.quizQuestions.orderIndex,
    })
    .from(schema.quizQuestions)
    .where(and(eq(schema.quizQuestions.moduleId, moduleId), eq(schema.quizQuestions.isActive, true)))
    .orderBy(asc(schema.quizQuestions.orderIndex));
  return rows;
}

// Returns full question including correct answer (server-side only)
export async function listQuizQuestionsWithAnswers(moduleId: string) {
  return db
    .select()
    .from(schema.quizQuestions)
    .where(and(eq(schema.quizQuestions.moduleId, moduleId), eq(schema.quizQuestions.isActive, true)))
    .orderBy(asc(schema.quizQuestions.orderIndex));
}

// Returns the latest quiz response for a user/module pair, or null
export async function getLatestQuizResponse(userId: string, moduleId: string) {
  const [row] = await db
    .select()
    .from(schema.quizResponses)
    .where(and(eq(schema.quizResponses.userId, userId), eq(schema.quizResponses.moduleId, moduleId)))
    .orderBy(desc(schema.quizResponses.createdAt))
    .limit(1);
  return row ?? null;
}

export async function hasPassedQuiz(userId: string, moduleId: string): Promise<boolean> {
  const latest = await getLatestQuizResponse(userId, moduleId);
  return latest?.passed ?? false;
}

export async function saveQuizResponse(
  userId: string,
  moduleId: string,
  answers: number[],
  score: number,
  totalQuestions: number,
) {
  const passed = score >= Math.ceil(totalQuestions * 0.6); // 60% to pass
  const [row] = await db
    .insert(schema.quizResponses)
    .values({
      userId,
      moduleId,
      answers,
      score,
      totalQuestions,
      passed,
      passedAt: passed ? new Date() : null,
    })
    .returning();
  return row!;
}

// Fetch completed exercise IDs including proof text
export async function getExerciseProgress(userId: string): Promise<Map<string, string | null>> {
  const rows = await db
    .select({ exerciseId: schema.userProgress.exerciseId, proofText: schema.userProgress.proofText })
    .from(schema.userProgress)
    .where(eq(schema.userProgress.userId, userId));
  return new Map(rows.map((r) => [r.exerciseId, r.proofText ?? null]));
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
