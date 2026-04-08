import { Router, type Request, type Response } from "express";
import bcrypt      from "bcryptjs";
import jwt         from "jsonwebtoken";
import { z }       from "zod";
import { ENV }     from "../_core/env";
import { getSessionCookieOptions, COOKIE_NAME } from "../_core/cookies";
import { requireAuth } from "../_core/auth";
import {
  getUserByEmail,
  getUserById,
  updateUserLastLogin,
  updateUserPassword,
  updateUserProfile,
} from "../db";

export const authRouter = Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { email, password } = parsed.data;

    const user = await getUserByEmail(email);
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    if (!user.isActive) { res.status(403).json({ error: "Account inactive" }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

    await updateUserLastLogin(user.id);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      ENV.jwtSecret,
      { expiresIn: ENV.jwtExpiresIn } as Parameters<typeof jwt.sign>[2]
    );

    res.cookie(COOKIE_NAME, token, {
      ...getSessionCookieOptions(req),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    res.json({
      user: {
        id:           user.id,
        email:        user.email,
        firstName:    user.firstName,
        lastName:     user.lastName,
        role:         user.role,
        planTier:     user.planTier,
        vertical:     user.vertical,
        hskdRequired: user.hskdRequired,
      },
    });
  }
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
authRouter.post(
  "/logout",
  (req: Request, res: Response): void => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ message: "Logged out" });
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
authRouter.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    res.json({
      id:           user.id,
      email:        user.email,
      firstName:    user.firstName,
      lastName:     user.lastName,
      role:         user.role,
      planTier:     user.planTier,
      vertical:     user.vertical,
      hskdRequired: user.hskdRequired,
      isActive:     user.isActive,
    });
  }
);

// ─── POST /api/auth/change-password ──────────────────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
});

authRouter.post(
  "/change-password",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input — newPassword must be at least 8 characters" });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Current password incorrect" }); return; }

    const hash = await bcrypt.hash(newPassword, 12);
    await updateUserPassword(user.id, hash);

    res.json({ message: "Password updated successfully" });
  }
);

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
const profileSchema = z.object({
  firstName: z.string().max(100).optional().nullable(),
  lastName:  z.string().max(100).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

authRouter.put(
  "/profile",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const updated = await updateUserProfile(req.user!.userId, parsed.data);
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({
      user: {
        id:        updated.id,
        email:     updated.email,
        firstName: updated.firstName,
        lastName:  updated.lastName,
        avatarUrl: updated.avatarUrl,
      },
    });
  }
);
