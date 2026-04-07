// ─── Team management routes ───────────────────────────────────────────────────
// GET    /api/team          — list staff + their progress
// POST   /api/team/invite   — invite a staff member
// DELETE /api/team/:id      — deactivate a staff member
// GET    /api/auth/invite/:token  — validate invite token (public)
// POST   /api/auth/invite/accept  — accept invite + set password (public)

import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { requireAuth } from "../_core/auth";
import { ENV } from "../_core/env";
import {
  createStaffUser,
  getUserByInviteToken,
  acceptInvite,
  listTeamMembers,
  deactivateStaffMember,
  getUserByEmail,
  getApprovedExerciseIds,
  getCompletedModuleIds,
  listModules,
} from "../db";

export const teamRouter  = Router();
export const inviteRouter = Router(); // public invite-accept routes

// ─── GET /api/team ────────────────────────────────────────────────────────────
teamRouter.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;

  const members = await listTeamMembers(adminId);

  // Fetch progress stats for each member in parallel
  const [allModules, ...memberStats] = await Promise.all([
    listModules(true),
    ...members.map(async (m) => {
      const [approvedIds, completedModIds] = await Promise.all([
        getApprovedExerciseIds(m.id),
        getCompletedModuleIds(m.id),
      ]);
      return { approvedExercises: approvedIds.size, completedModules: completedModIds.size };
    }),
  ]);

  // Count total exercises across all active modules (same for everyone)
  const totalExercises = 0; // will be filled below using allModules if needed
  const totalModules   = allModules.length;

  const team = members.map((m, i) => ({
    id:                m.id,
    email:             m.email,
    firstName:         m.firstName,
    lastName:          m.lastName,
    isActive:          m.isActive,
    isPending:         m.inviteToken !== null && !m.isActive,
    lastLoginAt:       m.lastLoginAt,
    activatedAt:       m.activatedAt,
    approvedExercises: memberStats[i]!.approvedExercises,
    completedModules:  memberStats[i]!.completedModules,
    totalModules,
  }));

  res.json({ team });
});

// ─── POST /api/team/invite ────────────────────────────────────────────────────
const inviteSchema = z.object({
  email:     z.string().email("Valid email required"),
  firstName: z.string().max(100).optional().nullable(),
  lastName:  z.string().max(100).optional().nullable(),
});

teamRouter.post("/invite", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, firstName, lastName } = parsed.data;

  // Check for existing user
  const existing = await getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "A user with that email already exists." });
    return;
  }

  // Generate invite token (32-byte hex = 64 chars)
  const inviteToken    = randomBytes(32).toString("hex");
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Placeholder password hash (user can't log in until invite is accepted)
  const passwordHash = `invite_pending_${randomBytes(16).toString("hex")}`;

  const staff = await createStaffUser({
    email,
    passwordHash,
    clientId: adminId,
    firstName: firstName ?? null,
    lastName:  lastName ?? null,
    inviteToken,
    inviteExpiresAt,
  });

  const inviteUrl = `${ENV.appBaseUrl}/invite/${inviteToken}`;

  // Push to GHL (best-effort — don't fail if GHL is misconfigured)
  if (ENV.ghlApiKey) {
    pushInviteToGhl({
      email,
      firstName: firstName ?? null,
      lastName:  lastName ?? null,
      inviteUrl,
    }).catch((err) => {
      console.warn("[team] GHL contact push failed:", (err as Error).message);
    });
  }

  res.status(201).json({
    message:   "invite_sent",
    staffId:   staff.id,
    inviteUrl, // admin can also share this link manually
  });
});

// ─── DELETE /api/team/:id ─────────────────────────────────────────────────────
teamRouter.delete("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  await deactivateStaffMember(req.params.id!, req.user!.userId);
  res.json({ message: "deactivated" });
});

// ─── GET /api/auth/invite/:token — validate token (public) ───────────────────
inviteRouter.get("/:token", async (req: Request, res: Response): Promise<void> => {
  const user = await getUserByInviteToken(req.params.token!);

  if (
    !user ||
    !user.inviteExpiresAt ||
    new Date(user.inviteExpiresAt) < new Date()
  ) {
    res.status(404).json({ error: "Invite link is invalid or has expired." });
    return;
  }

  res.json({
    email:     user.email,
    firstName: user.firstName,
    lastName:  user.lastName,
  });
});

// ─── POST /api/auth/invite/accept — set password + activate (public) ─────────
const acceptSchema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

inviteRouter.post("/accept", async (req: Request, res: Response): Promise<void> => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { token, password } = parsed.data;
  const user = await getUserByInviteToken(token);

  if (
    !user ||
    !user.inviteExpiresAt ||
    new Date(user.inviteExpiresAt) < new Date()
  ) {
    res.status(404).json({ error: "Invite link is invalid or has expired." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await acceptInvite(user.id, passwordHash);

  // Issue session cookie (same as login)
  const jwt = await import("jsonwebtoken");
  const token_ = jwt.default.sign(
    { userId: user.id, role: user.role },
    ENV.jwtSecret,
    { expiresIn: ENV.jwtExpiresIn } as any,
  );
  res.cookie("wibiz_session", token_, {
    httpOnly: true,
    secure:   ENV.isProduction,
    sameSite: "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  res.json({ message: "activated", role: user.role });
});

// ─── GHL helper — create contact + tag for invite workflow ───────────────────
async function pushInviteToGhl(params: {
  email:     string;
  firstName: string | null;
  lastName:  string | null;
  inviteUrl: string;
}) {
  const body: Record<string, unknown> = {
    email:      params.email,
    firstName:  params.firstName ?? "",
    lastName:   params.lastName  ?? "",
    locationId: ENV.ghlLocationId,
    tags:       ["academy-staff-invite"],
  };

  // Add invite URL to custom field if configured
  if (ENV.ghlStaffInviteFieldId) {
    body.customFields = [{ id: ENV.ghlStaffInviteFieldId, value: params.inviteUrl }];
  }

  const res = await fetch("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ENV.ghlApiKey}`,
      "Content-Type":  "application/json",
      "Version":        "2021-07-28",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GHL ${res.status}: ${txt}`);
  }
}
