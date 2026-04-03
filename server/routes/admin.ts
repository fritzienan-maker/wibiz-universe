import { Router, type Request, type Response } from "express";
import { requireAuth, requireAdmin } from "../_core/auth";
import { listUsers, listSyncEvents, listWebhookLog } from "../db";

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
