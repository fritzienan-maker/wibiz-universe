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
} from "../db";

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
