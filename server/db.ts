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

// Returns exercise IDs with APPROVED status — used for progress counting + module gate
export async function getApprovedExerciseIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ exerciseId: schema.userProgress.exerciseId })
    .from(schema.userProgress)
    .where(and(
      eq(schema.userProgress.userId, userId),
      eq(schema.userProgress.submissionStatus, "approved"),
    ));
  return new Set(rows.map((r) => r.exerciseId));
}

// Returns exercise IDs with ANY submission — used for sequential unlock chain
export async function getSubmittedExerciseIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ exerciseId: schema.userProgress.exerciseId })
    .from(schema.userProgress)
    .where(eq(schema.userProgress.userId, userId));
  return new Set(rows.map((r) => r.exerciseId));
}

// Returns all submission rows for a user keyed by exerciseId
export async function getAllExerciseSubmissions(userId: string) {
  const rows = await db
    .select()
    .from(schema.userProgress)
    .where(eq(schema.userProgress.userId, userId));
  return new Map(rows.map((r) => [r.exerciseId, r]));
}

// Submit or re-submit proof — upserts the single row per (user, exercise)
export async function submitExerciseProof(
  userId:       string,
  exerciseId:   string,
  proofText:    string,
  proofImageUrl: string | null = null,
) {
  const [existing] = await db
    .select({ id: schema.userProgress.id })
    .from(schema.userProgress)
    .where(and(eq(schema.userProgress.userId, userId), eq(schema.userProgress.exerciseId, exerciseId)));

  if (existing) {
    const [row] = await db
      .update(schema.userProgress)
      .set({
        proofText,
        proofImageUrl,
        submissionStatus: "pending_review",
        submittedAt:      new Date(),
        reviewedAt:       null,
        reviewedBy:       null,
        reviewNote:       null,
      })
      .where(eq(schema.userProgress.id, existing.id))
      .returning();
    return row!;
  }

  const [row] = await db
    .insert(schema.userProgress)
    .values({ userId, exerciseId, proofText, proofImageUrl, submissionStatus: "pending_review" })
    .returning();
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

// ─── Submission review (admin) ────────────────────────────────────────────────

export async function listSubmissionsForReview(
  status?: "pending_review" | "approved" | "rejected",
  limit = 100,
) {
  const condition = status
    ? eq(schema.userProgress.submissionStatus, status)
    : undefined;

  return db
    .select({
      id:               schema.userProgress.id,
      userId:           schema.userProgress.userId,
      exerciseId:       schema.userProgress.exerciseId,
      proofText:        schema.userProgress.proofText,
      proofImageUrl:    schema.userProgress.proofImageUrl,
      submissionStatus: schema.userProgress.submissionStatus,
      submittedAt:      schema.userProgress.submittedAt,
      reviewedAt:       schema.userProgress.reviewedAt,
      reviewNote:       schema.userProgress.reviewNote,
      userEmail:        schema.users.email,
      userFirstName:    schema.users.firstName,
      userLastName:     schema.users.lastName,
      exerciseTitle:    schema.exercises.title,
      exerciseDayNum:   schema.exercises.dayNumber,
      moduleId:         schema.exercises.moduleId,
    })
    .from(schema.userProgress)
    .innerJoin(schema.users,     eq(schema.userProgress.userId,     schema.users.id))
    .innerJoin(schema.exercises, eq(schema.userProgress.exerciseId, schema.exercises.id))
    .where(condition)
    .orderBy(desc(schema.userProgress.submittedAt))
    .limit(limit);
}

export async function reviewSubmission(
  id:         string,
  reviewerId: string,
  status:     "approved" | "rejected",
  note:       string | null = null,
) {
  const [row] = await db
    .update(schema.userProgress)
    .set({
      submissionStatus: status,
      reviewedAt:       new Date(),
      reviewedBy:       reviewerId,
      reviewNote:       note,
    })
    .where(eq(schema.userProgress.id, id))
    .returning();
  return row ?? null;
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

// ─── DocuSeal submissions ──────────────────────────────────────────────────────

export async function createDocusealSubmission(data: {
  userId:       string;
  documentType: string;
  templateId:   number;
  docusealId:   number;
  signerEmail:  string;
}) {
  const [row] = await db
    .insert(schema.docusealSubmissions)
    .values({ ...data, status: "pending" })
    .returning();
  return row!;
}

export async function getDocusealSubmissionByUser(userId: string, documentType: string) {
  const [row] = await db
    .select()
    .from(schema.docusealSubmissions)
    .where(and(
      eq(schema.docusealSubmissions.userId, userId),
      eq(schema.docusealSubmissions.documentType, documentType),
    ))
    .orderBy(desc(schema.docusealSubmissions.createdAt))
    .limit(1);
  return row ?? null;
}

export async function markDocusealComplete(docusealId: number) {
  await db
    .update(schema.docusealSubmissions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(schema.docusealSubmissions.docusealId, docusealId));
}

export async function markDocusealDeclined(docusealId: number) {
  await db
    .update(schema.docusealSubmissions)
    .set({ status: "declined" })
    .where(eq(schema.docusealSubmissions.docusealId, docusealId));
}

export async function listDocusealSubmissions(limit = 100) {
  return db
    .select({
      id:           schema.docusealSubmissions.id,
      userId:       schema.docusealSubmissions.userId,
      documentType: schema.docusealSubmissions.documentType,
      docusealId:   schema.docusealSubmissions.docusealId,
      status:       schema.docusealSubmissions.status,
      signerEmail:  schema.docusealSubmissions.signerEmail,
      sentAt:       schema.docusealSubmissions.sentAt,
      completedAt:  schema.docusealSubmissions.completedAt,
      userEmail:    schema.users.email,
      userFirstName: schema.users.firstName,
      userLastName:  schema.users.lastName,
      planTier:     schema.users.planTier,
    })
    .from(schema.docusealSubmissions)
    .innerJoin(schema.users, eq(schema.docusealSubmissions.userId, schema.users.id))
    .orderBy(desc(schema.docusealSubmissions.createdAt))
    .limit(limit);
}

// ─── Team / staff ──────────────────────────────────────────────────────────────

export async function createStaffUser(data: {
  email:          string;
  passwordHash:   string;
  clientId:       string;
  firstName:      string | null;
  lastName:       string | null;
  inviteToken:    string;
  inviteExpiresAt: Date;
}) {
  const [user] = await db
    .insert(schema.users)
    .values({
      email:           data.email.toLowerCase().trim(),
      passwordHash:    data.passwordHash,
      role:            "client_staff",
      clientId:        data.clientId,
      firstName:       data.firstName,
      lastName:        data.lastName,
      inviteToken:     data.inviteToken,
      inviteExpiresAt: data.inviteExpiresAt,
      isActive:        false,
    })
    .returning();
  return user!;
}

export async function getUserByInviteToken(token: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.inviteToken, token));
  return user ?? null;
}

export async function acceptInvite(userId: string, passwordHash: string) {
  const [user] = await db
    .update(schema.users)
    .set({
      passwordHash,
      isActive:        true,
      activatedAt:     new Date(),
      inviteToken:     null,
      inviteExpiresAt: null,
      updatedAt:       new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning();
  return user!;
}

export async function listTeamMembers(clientAdminId: string) {
  return db
    .select({
      id:          schema.users.id,
      email:       schema.users.email,
      firstName:   schema.users.firstName,
      lastName:    schema.users.lastName,
      isActive:    schema.users.isActive,
      lastLoginAt: schema.users.lastLoginAt,
      activatedAt: schema.users.activatedAt,
      inviteToken: schema.users.inviteToken,  // non-null = still pending
    })
    .from(schema.users)
    .where(eq(schema.users.clientId, clientAdminId))
    .orderBy(asc(schema.users.createdAt));
}

export async function deactivateStaffMember(staffId: string, clientAdminId: string) {
  await db
    .update(schema.users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(schema.users.id, staffId),
      eq(schema.users.clientId, clientAdminId),
    ));
}

// ─── Profile update ────────────────────────────────────────────────────────────
export async function updateUserProfile(
  id: string,
  data: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null },
) {
  const [user] = await db
    .update(schema.users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.users.id, id))
    .returning();
  return user ?? null;
}

// ─── Re-provision user (admin override) ───────────────────────────────────────
export async function activateExistingUser(id: string, passwordHash: string) {
  const [user] = await db
    .update(schema.users)
    .set({
      passwordHash,
      isActive:    true,
      activatedAt: new Date(),
      updatedAt:   new Date(),
    })
    .where(eq(schema.users.id, id))
    .returning();
  return user ?? null;
}

// ─── Support tickets ───────────────────────────────────────────────────────────
export async function createSupportTicket(data: {
  userId:        string;
  subject:       string;
  category:      string | null;
  message:       string;
  priority:      string;
  attachmentUrl: string | null;
  ghlForwarded:  boolean;
}) {
  const [row] = await db
    .insert(schema.supportTickets)
    .values({ ...data, status: "open" })
    .returning();
  return row!;
}

export async function listSupportTickets(limit = 100) {
  return db
    .select({
      id:            schema.supportTickets.id,
      userId:        schema.supportTickets.userId,
      subject:       schema.supportTickets.subject,
      category:      schema.supportTickets.category,
      message:       schema.supportTickets.message,
      priority:      schema.supportTickets.priority,
      attachmentUrl: schema.supportTickets.attachmentUrl,
      status:        schema.supportTickets.status,
      ghlForwarded:  schema.supportTickets.ghlForwarded,
      createdAt:     schema.supportTickets.createdAt,
      userEmail:     schema.users.email,
      userFirstName: schema.users.firstName,
      userLastName:  schema.users.lastName,
    })
    .from(schema.supportTickets)
    .innerJoin(schema.users, eq(schema.supportTickets.userId, schema.users.id))
    .orderBy(desc(schema.supportTickets.createdAt))
    .limit(limit);
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

// ─── Resource queries ─────────────────────────────────────────────────────────

export async function listResources(activeOnly = false) {
  if (activeOnly) {
    return db.select().from(schema.resources)
      .where(eq(schema.resources.isActive, true))
      .orderBy(asc(schema.resources.orderIndex), asc(schema.resources.createdAt));
  }
  return db.select().from(schema.resources)
    .orderBy(asc(schema.resources.orderIndex), asc(schema.resources.createdAt));
}

export async function getResourceById(id: string) {
  const [row] = await db.select().from(schema.resources).where(eq(schema.resources.id, id));
  return row ?? null;
}

export async function createResource(data: typeof schema.resources.$inferInsert) {
  const [row] = await db.insert(schema.resources).values(data).returning();
  return row!;
}

export async function updateResource(id: string, data: Partial<typeof schema.resources.$inferInsert>) {
  const [row] = await db
    .update(schema.resources)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.resources.id, id))
    .returning();
  return row ?? null;
}

export async function deleteResource(id: string) {
  await db.delete(schema.resources).where(eq(schema.resources.id, id));
}

// ─── Tutorial video queries ───────────────────────────────────────────────────

export async function listTutorialVideos(activeOnly = false) {
  if (activeOnly) {
    return db.select().from(schema.tutorialVideos)
      .where(eq(schema.tutorialVideos.isActive, true))
      .orderBy(asc(schema.tutorialVideos.orderIndex), asc(schema.tutorialVideos.createdAt));
  }
  return db.select().from(schema.tutorialVideos)
    .orderBy(asc(schema.tutorialVideos.orderIndex), asc(schema.tutorialVideos.createdAt));
}

export async function getTutorialVideoById(id: string) {
  const [row] = await db.select().from(schema.tutorialVideos).where(eq(schema.tutorialVideos.id, id));
  return row ?? null;
}

export async function createTutorialVideo(data: typeof schema.tutorialVideos.$inferInsert) {
  const [row] = await db.insert(schema.tutorialVideos).values(data).returning();
  return row!;
}

export async function updateTutorialVideo(id: string, data: Partial<typeof schema.tutorialVideos.$inferInsert>) {
  const [row] = await db
    .update(schema.tutorialVideos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.tutorialVideos.id, id))
    .returning();
  return row ?? null;
}

export async function deleteTutorialVideo(id: string) {
  await db.delete(schema.tutorialVideos).where(eq(schema.tutorialVideos.id, id));
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

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATION SYSTEM (Phase 2 + Phase 3 + ClearPath)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Academy completion check ─────────────────────────────────────────────────
// Called after every module gate sign-off. Marks academy_completed if all
// module gates are submitted, then issues the Academy Completion Certificate.
export async function checkAndSetAcademyComplete(userId: string): Promise<boolean> {
  const allModules = await listModules(true);
  if (allModules.length === 0) return false;
  const completedIds = await getCompletedModuleIds(userId);
  const allDone = allModules.every((m) => completedIds.has(m.id));
  if (allDone) {
    const [user] = await db
      .select({ academyCompleted: schema.users.academyCompleted })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    if (!user?.academyCompleted) {
      await db
        .update(schema.users)
        .set({ academyCompleted: true, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      // Issue Academy Completion Certificate (once only)
      const certNumber = await generateCertNumber();
      await createCertificate(userId, "academy", certNumber);
    }
  }
  return allDone;
}

// ─── Bot Certification: Questions ────────────────────────────────────────────

export async function listBotCertQuestionsForClient() {
  return db
    .select({
      id:         schema.botCertQuestions.id,
      question:   schema.botCertQuestions.question,
      options:    schema.botCertQuestions.options,
      orderIndex: schema.botCertQuestions.orderIndex,
    })
    .from(schema.botCertQuestions)
    .where(eq(schema.botCertQuestions.isActive, true))
    .orderBy(asc(schema.botCertQuestions.orderIndex));
}

export async function listBotCertQuestionsWithAnswers() {
  return db
    .select()
    .from(schema.botCertQuestions)
    .where(eq(schema.botCertQuestions.isActive, true))
    .orderBy(asc(schema.botCertQuestions.orderIndex));
}

export async function getLatestBotCertResponse(userId: string) {
  const [row] = await db
    .select()
    .from(schema.botCertResponses)
    .where(eq(schema.botCertResponses.userId, userId))
    .orderBy(desc(schema.botCertResponses.createdAt))
    .limit(1);
  return row ?? null;
}

export async function saveBotCertResponse(
  userId: string,
  answers: number[],
  score: number,
  totalQuestions: number,
) {
  const passed = score >= 8; // hard threshold: 8 out of 10
  const [row] = await db
    .insert(schema.botCertResponses)
    .values({ userId, answers, score, totalQuestions, passed, passedAt: passed ? new Date() : null })
    .returning();
  return row!;
}

export async function setBotCertPassed(userId: string) {
  await db
    .update(schema.users)
    .set({ botCertPassed: true, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

// ─── Bot Cert: Admin CRUD ─────────────────────────────────────────────────────

export async function getBotCertQuestionById(id: string) {
  const [row] = await db.select().from(schema.botCertQuestions).where(eq(schema.botCertQuestions.id, id));
  return row ?? null;
}

export async function createBotCertQuestion(data: {
  question: string; options: string[]; correctAnswerIndex: number; orderIndex: number;
}) {
  const [row] = await db.insert(schema.botCertQuestions).values({ ...data, isActive: true }).returning();
  return row!;
}

export async function updateBotCertQuestion(id: string, data: {
  question?: string; options?: string[]; correctAnswerIndex?: number; orderIndex?: number; isActive?: boolean;
}) {
  const [row] = await db
    .update(schema.botCertQuestions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.botCertQuestions.id, id))
    .returning();
  return row ?? null;
}

export async function deleteBotCertQuestion(id: string) {
  await db.delete(schema.botCertQuestions).where(eq(schema.botCertQuestions.id, id));
}

// ─── HSKD Certification: Questions ───────────────────────────────────────────

export async function listHskdCertQuestions() {
  return db
    .select()
    .from(schema.hskdCertQuestions)
    .where(eq(schema.hskdCertQuestions.isActive, true))
    .orderBy(asc(schema.hskdCertQuestions.orderIndex));
}

export async function getLatestHskdCertResponse(userId: string) {
  const [row] = await db
    .select()
    .from(schema.hskdCertResponses)
    .where(eq(schema.hskdCertResponses.userId, userId))
    .orderBy(desc(schema.hskdCertResponses.createdAt))
    .limit(1);
  return row ?? null;
}

export async function saveHskdCertResponse(
  userId: string,
  answers: ("approve" | "reject")[],
) {
  const hasRejection = answers.some((a) => a === "reject");
  const [row] = await db
    .insert(schema.hskdCertResponses)
    .values({ userId, answers, hasRejection, flaggedAt: hasRejection ? new Date() : null })
    .returning();
  return row!;
}

export async function approveHskdResponse(responseId: string, adminId: string) {
  const [row] = await db
    .update(schema.hskdCertResponses)
    .set({ adminApproved: true, approvedBy: adminId, approvedAt: new Date() })
    .where(eq(schema.hskdCertResponses.id, responseId))
    .returning();
  return row ?? null;
}

export async function setHskdPassed(userId: string) {
  await db
    .update(schema.users)
    .set({ hskdPassed: true, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

export async function listPendingHskdResponses() {
  return db
    .select({
      id:            schema.hskdCertResponses.id,
      userId:        schema.hskdCertResponses.userId,
      answers:       schema.hskdCertResponses.answers,
      hasRejection:  schema.hskdCertResponses.hasRejection,
      flaggedAt:     schema.hskdCertResponses.flaggedAt,
      createdAt:     schema.hskdCertResponses.createdAt,
      userEmail:     schema.users.email,
      userFirstName: schema.users.firstName,
      userLastName:  schema.users.lastName,
    })
    .from(schema.hskdCertResponses)
    .innerJoin(schema.users, eq(schema.hskdCertResponses.userId, schema.users.id))
    .where(eq(schema.hskdCertResponses.adminApproved, false))
    .orderBy(desc(schema.hskdCertResponses.createdAt));
}

// ─── HSKD: Admin CRUD ─────────────────────────────────────────────────────────

export async function getHskdCertQuestionById(id: string) {
  const [row] = await db.select().from(schema.hskdCertQuestions).where(eq(schema.hskdCertQuestions.id, id));
  return row ?? null;
}

export async function createHskdCertQuestion(data: { scenario: string; orderIndex: number; }) {
  const [row] = await db.insert(schema.hskdCertQuestions).values({ ...data, isActive: true }).returning();
  return row!;
}

export async function updateHskdCertQuestion(id: string, data: {
  scenario?: string; orderIndex?: number; isActive?: boolean;
}) {
  const [row] = await db
    .update(schema.hskdCertQuestions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.hskdCertQuestions.id, id))
    .returning();
  return row ?? null;
}

export async function deleteHskdCertQuestion(id: string) {
  await db.delete(schema.hskdCertQuestions).where(eq(schema.hskdCertQuestions.id, id));
}

// ─── Certificates ─────────────────────────────────────────────────────────────

let certCounter = 0;
export async function generateCertNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ certNumber: schema.certificates.certNumber })
    .from(schema.certificates)
    .orderBy(desc(schema.certificates.createdAt))
    .limit(1);
  const lastNum = rows[0]?.certNumber?.match(/(\d+)$/)?.[1];
  certCounter = lastNum ? parseInt(lastNum, 10) : certCounter;
  certCounter++;
  return `WBA-${year}-${String(certCounter).padStart(5, "0")}`;
}

export async function createCertificate(
  userId:     string,
  type:       "academy" | "bot_cert" | "hskd_cert" | "clearpath",
  certNumber: string,
) {
  const [row] = await db
    .insert(schema.certificates)
    .values({ userId, type, certNumber })
    .returning();
  return row!;
}

export async function getCertificateById(certId: string) {
  const [row] = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.id, certId));
  return row ?? null;
}

export async function getUserCertificates(userId: string) {
  return db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.userId, userId))
    .orderBy(asc(schema.certificates.issuedAt));
}

export async function setClearpathIssued(userId: string) {
  await db
    .update(schema.users)
    .set({ clearpathIssued: true, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

// Issues a ClearPath certificate if all required gates have passed.
export async function checkAndIssueClearpath(
  userId: string,
  user: {
    hskdRequired:    boolean | null;
    botCertPassed:   boolean | null;
    hskdPassed:      boolean | null;
    clearpathIssued: boolean | null;
  },
) {
  if (user.clearpathIssued) return null;
  const botOk  = user.botCertPassed === true;
  const hskdOk = !user.hskdRequired || user.hskdPassed === true;
  if (!botOk || !hskdOk) return null;

  const certNumber = await generateCertNumber();
  const cert = await createCertificate(userId, "clearpath", certNumber);
  await setClearpathIssued(userId);
  return cert;
}

export async function listAllCertificatesAdmin() {
  return db
    .select({
      id:         schema.certificates.id,
      type:       schema.certificates.type,
      certNumber: schema.certificates.certNumber,
      issuedAt:   schema.certificates.issuedAt,
      userId:     schema.certificates.userId,
      userEmail:  schema.users.email,
      firstName:  schema.users.firstName,
      lastName:   schema.users.lastName,
      vertical:   schema.users.vertical,
    })
    .from(schema.certificates)
    .innerJoin(schema.users, eq(schema.certificates.userId, schema.users.id))
    .orderBy(desc(schema.certificates.issuedAt));
}