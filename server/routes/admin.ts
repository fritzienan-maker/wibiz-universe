import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../_core/auth";
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
} from "../db";
import { sendCsmDocument } from "../services/docuseal";

export const adminRouter = Router();

// All routes below require valid session + wibiz_admin role
adminRouter.use(requireAuth, requireAdmin);

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
adminRouter.get(
  "/users",
  async (_req: Request, res: Response): Promise<void> => {
    const users = await listUsers();
    res.json({ users });
  }
);

// ─── GET /api/admin/sync-events ───────────────────────────────────────────────
adminRouter.get(
  "/sync-events",
  async (_req: Request, res: Response): Promise<void> => {
    const events = await listSyncEvents(100);
    res.json({ events });
  }
);

// ─── GET /api/admin/webhook-log ───────────────────────────────────────────────
adminRouter.get(
  "/webhook-log",
  async (_req: Request, res: Response): Promise<void> => {
    const logs = await listWebhookLog(100);
    res.json({ logs });
  }
);

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

// GET /api/admin/modules
adminRouter.get(
  "/modules",
  async (_req: Request, res: Response): Promise<void> => {
    const mods = await listModules();
    res.json({ modules: mods });
  }
);

// POST /api/admin/modules
adminRouter.post(
  "/modules",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = moduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const mod = await createModule(parsed.data);
    res.status(201).json({ module: mod });
  }
);

// PUT /api/admin/modules/:id
adminRouter.put(
  "/modules/:id",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = moduleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const existing = await getModuleById(req.params.id!);
    if (!existing) { res.status(404).json({ error: "Module not found" }); return; }

    const mod = await updateModule(req.params.id!, parsed.data);
    res.json({ module: mod });
  }
);

// DELETE /api/admin/modules/:id
adminRouter.delete(
  "/modules/:id",
  async (req: Request, res: Response): Promise<void> => {
    const existing = await getModuleById(req.params.id!);
    if (!existing) { res.status(404).json({ error: "Module not found" }); return; }

    await deleteModule(req.params.id!);
    res.json({ message: "deleted" });
  }
);

// ─── Exercise CRUD (nested under modules) ────────────────────────────────────
const exerciseSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  proofPrompt: z.string().optional().nullable(),
  videoUrl:    z.string().url().optional().nullable().or(z.literal("")),
  dayNumber:   z.number().int().positive().optional().nullable(),
  orderIndex:  z.number().int().min(0).default(0),
  isActive:    z.boolean().default(true),
});

// GET /api/admin/modules/:id/exercises
adminRouter.get("/modules/:id/exercises", async (req, res): Promise<void> => {
  const mod = await getModuleById(req.params.id!);
  if (!mod) { res.status(404).json({ error: "Module not found" }); return; }
  const exs = await listExercisesByModule(req.params.id!);
  res.json({ exercises: exs });
});

// POST /api/admin/modules/:id/exercises
adminRouter.post("/modules/:id/exercises", async (req, res): Promise<void> => {
  const mod = await getModuleById(req.params.id!);
  if (!mod) { res.status(404).json({ error: "Module not found" }); return; }

  const parsed = exerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const ex = await createExercise({ ...parsed.data, moduleId: req.params.id! });
  res.status(201).json({ exercise: ex });
});

// PUT /api/admin/exercises/:id
adminRouter.put("/exercises/:id", async (req, res): Promise<void> => {
  const ex = await getExerciseById(req.params.id!);
  if (!ex) { res.status(404).json({ error: "Exercise not found" }); return; }

  const parsed = exerciseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const updated = await updateExercise(req.params.id!, parsed.data);
  res.json({ exercise: updated });
});

// DELETE /api/admin/exercises/:id
adminRouter.delete("/exercises/:id", async (req, res): Promise<void> => {
  const ex = await getExerciseById(req.params.id!);
  if (!ex) { res.status(404).json({ error: "Exercise not found" }); return; }
  await deleteExercise(req.params.id!);
  res.json({ message: "deleted" });
});

// ─── Submission review ────────────────────────────────────────────────────────

// GET /api/admin/submissions?status=pending_review|approved|rejected
adminRouter.get("/submissions", async (req, res): Promise<void> => {
  const status = req.query.status as "pending_review" | "approved" | "rejected" | undefined;
  const valid  = ["pending_review", "approved", "rejected"];
  const filter = status && valid.includes(status) ? status : undefined;
  const rows   = await listSubmissionsForReview(filter);
  res.json({ submissions: rows });
});

// ─── DocuSeal ─────────────────────────────────────────────────────────────────

// GET /api/admin/docuseal — list all CSM submissions
adminRouter.get("/docuseal", async (_req, res): Promise<void> => {
  const rows = await listDocusealSubmissions();
  res.json({ submissions: rows });
});

// POST /api/admin/users/:id/send-csm — (re)send CSM to a specific user
adminRouter.post("/users/:id/send-csm", async (req, res): Promise<void> => {
  const user = await getUserById(req.params.id!);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.planTier) {
    res.status(400).json({ error: "User has no plan tier set — cannot determine CSM template." });
    return;
  }
  try {
    const { submissionId, templateId } = await sendCsmDocument({
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      planTier:  user.planTier,
    });
    await createDocusealSubmission({
      userId:       user.id,
      documentType: "client_success_manual",
      templateId,
      docusealId:   submissionId,
      signerEmail:  user.email,
    });
    res.json({ message: "csm_sent", submissionId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "DocuSeal send failed" });
  }
});

// PUT /api/admin/submissions/:id/review — approve or reject with optional note
const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note:   z.string().max(1000).optional().nullable(),
});

adminRouter.put("/submissions/:id/review", async (req, res): Promise<void> => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const updated = await reviewSubmission(
    req.params.id!,
    req.user!.userId,
    parsed.data.status,
    parsed.data.note ?? null,
  );
  if (!updated) { res.status(404).json({ error: "Submission not found" }); return; }
  res.json({ submission: updated });
});
