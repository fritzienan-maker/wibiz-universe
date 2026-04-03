import { Router, type Request, type Response } from "express";
import { requireAuth } from "../_core/auth";
import { getUserById }  from "../db";

export const dashboardRouter = Router();

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
dashboardRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Phase 1: placeholder modules — real content + progress in Phase 2
    const placeholderModules = [
      { id: 1, title: "WiBiz Foundations",    status: "locked", description: "Coming soon" },
      { id: 2, title: "Systems & Tools Setup", status: "locked", description: "Coming soon" },
      { id: 3, title: "Client Acquisition",   status: "locked", description: "Coming soon" },
      { id: 4, title: "Certification Prep",   status: "locked", description: "Coming soon" },
      { id: 5, title: "HSKD Compliance",      status: "locked", description: "Coming soon" },
    ];

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
      modules: placeholderModules,
    });
  }
);
