import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { Pool } from "pg";
import { requireAuth, requireAdmin } from "../_core/auth";
import { ENV } from "../_core/env";
import {
  listUsers,
  listSyncEvents,
  listWebhookLog,
  listModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
  listExercisesByModule,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
  listSubmissionsForReview,
  reviewSubmission,
  listDocusealSubmissions,
  createDocusealSubmission,
  getUserById,
  getUserByEmail,
  createUser,
  activateExistingUser,
  listSupportTickets,
} from "../db";
import { sendCsmDocument } from "../services/docuseal";

// ─── Pool for raw quiz queries ────────────────────────────────────────────────
const pool = new Pool({
  connectionString: ENV.databaseUrl,
  ssl: ENV.isProduction ? { rejectUnauthorized: false } : undefined,
});

// ─── Temp password generator ──────────────────────────────────────────────────
function generateTempPassword(): string {
  let pass = "";
  while (pass.length < 12) {
    pass += randomBytes(18).toString("base64url").replace(/[-_]/g, "");
  }
  return pass.slice(0, 12);
}

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
adminRouter.get("/users", async (_req: Request, res: Response): Promise<void> => {
  const users = await listUsers();
  res.json({ users });
});

// ─── GET /api/admin/sync-events ───────────────────────────────────────────────
adminRouter.get("/sync-events", async (_req: Request, res: Response): Promise<void> => {
  const events = await listSyncEvents(100);
  res.json({ events });
});

// ─── GET /api/admin/webhook-log ───────────────────────────────────────────────
adminRouter.get("/webhook-log", async (_req: Request, res: Response): Promise<void> => {
  const logs = await listWebhookLog(100);
  res.json({ logs });
});

// ─── Module CRUD ──────────────────────────────────────────────────────────────
const moduleSchema = z.object({
  title:       z.string().min(1, "Title is required").max(255),
  description: z.string().optional().nullable(),
  dayStart:    z.number().int().positive().optional().nullable(),
  dayEnd:      z.number().int().positive().optional().nullable(),
  orderIndex:  z.number().int().min(0).default(0),
  isActive:    z.boolean().default(true),
});
const moduleUpdateSchema = moduleSchema.partial();

adminRouter.get("/modules", async (_req: Request, res: Response): Promise<void> => {
  const mods = await listModules();
  res.json({ modules: mods });
});

adminRouter.post("/modules", async (req: Request, res: Response): Promise<void> => {
  const parsed = moduleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  const mod = await createModule(parsed.data);
  res.status(201).json({ module: mod });
});

adminRouter.put("/modules/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = moduleUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  const existing = await getModuleById(req.params.id!);
  if (!existing) { res.status(404).json({ error: "Module not found" }); return; }
  const mod = await updateModule(req.params.id!, parsed.data);
  res.json({ module: mod });
});

adminRouter.delete("/modules/:id", async (req: Request, res: Response): Promise<void> => {
  const existing = await getModuleById(req.params.id!);
  if (!existing) { res.status(404).json({ error: "Module not found" }); return; }
  await deleteModule(req.params.id!);
  res.json({ message: "deleted" });
});

// ─── Exercise CRUD ────────────────────────────────────────────────────────────
const exerciseSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  proofPrompt: z.string().optional().nullable(),
  videoUrl:    z.string().url().optional().nullable().or(z.literal("")),
  dayNumber:   z.number().int().positive().optional().nullable(),
  orderIndex:  z.number().int().min(0).default(0),
  isActive:    z.boolean().default(true),
});

adminRouter.get("/modules/:id/exercises", async (req, res): Promise<void> => {
  const mod = await getModuleById(req.params.id!);
  if (!mod) { res.status(404).json({ error: "Module not found" }); return; }
  const exs = await listExercisesByModule(req.params.id!);
  res.json({ exercises: exs });
});

adminRouter.post("/modules/:id/exercises", async (req, res): Promise<void> => {
  const mod = await getModuleById(req.params.id!);
  if (!mod) { res.status(404).json({ error: "Module not found" }); return; }
  const parsed = exerciseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  const ex = await createExercise({ ...parsed.data, moduleId: req.params.id! });
  res.status(201).json({ exercise: ex });
});

adminRouter.put("/exercises/:id", async (req, res): Promise<void> => {
  const ex = await getExerciseById(req.params.id!);
  if (!ex) { res.status(404).json({ error: "Exercise not found" }); return; }
  const parsed = exerciseSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  const updated = await updateExercise(req.params.id!, parsed.data);
  res.json({ exercise: updated });
});

adminRouter.delete("/exercises/:id", async (req, res): Promise<void> => {
  const ex = await getExerciseById(req.params.id!);
  if (!ex) { res.status(404).json({ error: "Exercise not found" }); return; }
  await deleteExercise(req.params.id!);
  res.json({ message: "deleted" });
});

// ─── Quiz Question CRUD ───────────────────────────────────────────────────────

// GET /api/admin/modules/:moduleId/quiz-questions
adminRouter.get("/modules/:moduleId/quiz-questions", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id,
              module_id           AS "moduleId",
              question,
              options,
              correct_answer_index AS "correctAnswerIndex",
              order_index          AS "orderIndex",
              is_active            AS "isActive"
       FROM quiz_questions
       WHERE module_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [req.params.moduleId]
    );
    res.json({ questions: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch quiz questions" });
  }
});

// POST /api/admin/modules/:moduleId/quiz-questions
adminRouter.post("/modules/:moduleId/quiz-questions", async (req: Request, res: Response): Promise<void> => {
  const { question, options, correctAnswerIndex, orderIndex, isActive } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: "question and at least 2 options required" }); return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO quiz_questions (module_id, question, options, correct_answer_index, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.params.moduleId, question, JSON.stringify(options), correctAnswerIndex ?? 0, orderIndex ?? 0, isActive ?? true]
    );
    res.status(201).json({ question: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create quiz question" });
  }
});

// PUT /api/admin/quiz-questions/:id
adminRouter.put("/quiz-questions/:id", async (req: Request, res: Response): Promise<void> => {
  const { question, options, correctAnswerIndex, orderIndex, isActive } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: "question and at least 2 options required" }); return;
  }
  try {
    const result = await pool.query(
      `UPDATE quiz_questions
       SET question             = $1,
           options              = $2,
           correct_answer_index = $3,
           order_index          = $4,
           is_active            = $5
       WHERE id = $6
       RETURNING *`,
      [question, JSON.stringify(options), correctAnswerIndex ?? 0, orderIndex ?? 0, isActive ?? true, req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Quiz question not found" }); return; }
    res.json({ question: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update quiz question" });
  }
});

// DELETE /api/admin/quiz-questions/:id
adminRouter.delete("/quiz-questions/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    await pool.query(`DELETE FROM quiz_questions WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to delete quiz question" });
  }
});

// ─── HSKD Certifications (admin) ──────────────────────────────────────────────
const hskdPool = pool; // reuse same pool

adminRouter.get("/hskd/certifications", async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const whereClause = status ? `WHERE cc.status = $1` : "";
    const params = status ? [status] : [];
    const result = await hskdPool.query(
      `SELECT cc.*, hi.name AS industry_name, hi.slug AS industry_slug, hi.tier
       FROM client_certifications cc
       JOIN hskd_industries hi ON hi.id = cc.industry_id
       ${whereClause}
       ORDER BY cc.updated_at DESC`,
      params
    );
    const counts = await hskdPool.query(
      `SELECT status, COUNT(*) AS count FROM client_certifications GROUP BY status`
    );
    res.json({ certifications: result.rows, counts: counts.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch certifications" });
  }
});

adminRouter.get("/hskd/certifications/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const cert = await hskdPool.query(
      `SELECT cc.*, hi.name AS industry_name, hi.slug AS industry_slug, hi.tier
       FROM client_certifications cc
       JOIN hskd_industries hi ON hi.id = cc.industry_id
       WHERE cc.id = $1`,
      [req.params.id]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const scenarioLogs = await hskdPool.query(
      `SELECT l.*, s.title AS scenario_title, s.scenario_number
       FROM certification_scenario_logs l
       JOIN hskd_scenarios s ON s.id = l.scenario_id
       WHERE l.certification_id = $1 ORDER BY l.scenario_number ASC`,
      [req.params.id]
    );
    const prohibitedLogs = await hskdPool.query(
      `SELECT l.*, p.category, p.restriction_text, p.item_number
       FROM certification_prohibited_logs l
       JOIN hskd_prohibited_items p ON p.id = l.prohibited_item_id
       WHERE l.certification_id = $1 ORDER BY l.confirmed_at ASC`,
      [req.params.id]
    );
    res.json({ certification: cert.rows[0], scenario_logs: scenarioLogs.rows, prohibited_logs: prohibitedLogs.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch certification detail" });
  }
});

adminRouter.patch("/hskd/certifications/:id/signoff", async (req: Request, res: Response): Promise<void> => {
  const { ops_signoff_by } = req.body;
  if (!ops_signoff_by) { res.status(400).json({ error: "ops_signoff_by required" }); return; }
  try {
    const certResult = await hskdPool.query(
      `SELECT cc.*, hi.tier FROM client_certifications cc JOIN hskd_industries hi ON hi.id = cc.industry_id WHERE cc.id = $1`,
      [req.params.id]
    );
    if (!certResult.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    if ((certResult.rows[0] as any).status !== "OPS_REVIEW") {
      res.status(400).json({ error: "Certification must be in OPS_REVIEW status" }); return;
    }
    const certId = `WBZ-HSKD-${Date.now()}-${req.params.id.slice(0, 6).toUpperCase()}`;
    const result = await hskdPool.query(
      `UPDATE client_certifications
       SET status                        = 'CERTIFIED',
           ops_signoff_by               = $1,
           ops_signoff_at               = NOW(),
           certificate_id               = $2,
           specialist_mode_activated_at = NOW(),
           updated_at                   = NOW()
       WHERE id = $3
       RETURNING *`,
      [ops_signoff_by, certId, req.params.id]
    );
    res.json({ certification: result.rows[0], certificate_id: certId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Sign-off failed" });
  }
});

// ─── Submission review ────────────────────────────────────────────────────────
adminRouter.get("/submissions", async (req, res): Promise<void> => {
  const status = req.query.status as "pending_review" | "approved" | "rejected" | undefined;
  const valid  = ["pending_review", "approved", "rejected"];
  const filter = status && valid.includes(status) ? status : undefined;
  const rows   = await listSubmissionsForReview(filter);
  res.json({ submissions: rows });
});

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note:   z.string().max(1000).optional().nullable(),
});

adminRouter.put("/submissions/:id/review", async (req, res): Promise<void> => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  const updated = await reviewSubmission(req.params.id!, req.user!.userId, parsed.data.status, parsed.data.note ?? null);
  if (!updated) { res.status(404).json({ error: "Submission not found" }); return; }
  res.json({ submission: updated });
});

// ─── DocuSeal ─────────────────────────────────────────────────────────────────
adminRouter.get("/docuseal", async (_req, res): Promise<void> => {
  const rows = await listDocusealSubmissions();
  res.json({ submissions: rows });
});

adminRouter.post("/users/:id/send-csm", async (req, res): Promise<void> => {
  const user = await getUserById(req.params.id!);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.planTier) { res.status(400).json({ error: "User has no plan tier set." }); return; }
  try {
    const { submissionId, templateId } = await sendCsmDocument({ email: user.email, firstName: user.firstName, lastName: user.lastName, planTier: user.planTier });
    await createDocusealSubmission({ userId: user.id, documentType: "client_success_manual", templateId, docusealId: submissionId, signerEmail: user.email });
    res.json({ message: "csm_sent", submissionId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "DocuSeal send failed" });
  }
});

// ─── Support tickets ──────────────────────────────────────────────────────────
adminRouter.get("/support-tickets", async (_req, res): Promise<void> => {
  const tickets = await listSupportTickets(200);
  res.json({ tickets });
});

// ─── Provision override ───────────────────────────────────────────────────────
const provisionOverrideSchema = z.object({
  email:     z.string().email("Valid email required"),
  firstName: z.string().max(100).optional().nullable(),
  lastName:  z.string().max(100).optional().nullable(),
  planTier:  z.enum(["lite", "standard", "pro"]).optional().nullable(),
});

adminRouter.post("/provision-override", async (req, res): Promise<void> => {
  const parsed = provisionOverrideSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  const { email, firstName, lastName, planTier } = parsed.data;
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const existing = await getUserByEmail(email);
  if (!existing) {
    const user = await createUser({ email: email.toLowerCase().trim(), passwordHash, role: "client_admin", firstName: firstName ?? null, lastName: lastName ?? null, planTier: planTier ?? null, isActive: true, activatedAt: new Date() });
    res.status(201).json({ action: "created", email: user.email, tempPassword, userId: user.id, note: "New account created. Give the client their temporary password — they can change it after first login." });
    return;
  }
  await activateExistingUser(existing.id, passwordHash);
  res.json({ action: "re-provisioned", email: existing.email, tempPassword, userId: existing.id, note: "Existing account re-activated with a new temporary password. Previous progress and data are preserved." });
});