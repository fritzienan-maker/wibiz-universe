import { Router, type Request, type Response } from "express";
import { requireAuth } from "../_core/auth";
import { getUserById, listModules } from "../db";

export const dashboardRouter = Router();

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
dashboardRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const allModules = await listModules(true); // active only

    // Module 1 (lowest orderIndex) is available; all others are locked until
    // JotForm progress gates are built in Phase 2.
    const modules = allModules.map((m, i) => ({
      id:          m.id,
      title:       m.title,
      description: m.description,
      dayStart:    m.dayStart,
      dayEnd:      m.dayEnd,
      orderIndex:  m.orderIndex,
      status:      i === 0 ? "available" : "locked",
    }));

    res.json({
      user: {
        id:           user.id,
        firstName:    user.firstName,
        lastName:     user.lastName,
        email:        user.email,
        role:         user.role,
        planTier:     user.planTier,
        vertical:     user.vertical,
        hskdRequired: user.hskdRequired,
      },
      modules,
    });
  }
);
