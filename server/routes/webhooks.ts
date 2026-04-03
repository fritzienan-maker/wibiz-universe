// ─── GHL Webhook — Provision endpoint ────────────────────────────────────────
// POST /api/webhooks/ghl/provision
//
// Processing order (must not change — idempotency depends on it):
//   1. Log raw payload to webhook_log (before any validation)
//   2. Validate x-wibiz-secret header
//   3. Validate required payload fields with Zod
//   4. Idempotency check: ghl_contact_id already in users table?
//   5. Hash temporary_pass (bcrypt cost 12)
//   6. Insert user (role: client_admin)
//   7. Log sync_event
//   8. Return 200

import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z }  from "zod";
import { ENV } from "../_core/env";
import {
  logWebhookReceived,
  markWebhookProcessed,
  getUserByGhlContactId,
  createUser,
  logSyncEvent,
} from "../db";

export const webhookRouter = Router();

// ─── Payload schema ───────────────────────────────────────────────────────────
// GHL "Send Data via Webhook" action sends contact custom fields as flat keys.
// temporary_pass is required — without it the user can never log in.
const provisionSchema = z.object({
  contact_id:     z.string().min(1, "contact_id is required"),
  email:          z.string().email("valid email is required"),
  first_name:     z.string().optional(),
  last_name:      z.string().optional(),
  plan_tier:      z.enum(["lite", "standard", "pro"]).optional().nullable(),
  vertical:       z.string().optional().nullable(),
  hskd_required:  z.boolean().optional().default(false),
  temporary_pass: z.string().min(1, "temporary_pass is required — user cannot log in without it"),
  location_id:    z.string().optional(),
});

// ─── POST /api/webhooks/ghl/provision ────────────────────────────────────────
webhookRouter.post(
  "/ghl/provision",
  async (req: Request, res: Response): Promise<void> => {

    // Step 1 — Log raw payload immediately (fire-and-forget, never block on this)
    const logEntry = await logWebhookReceived(req.body).catch(() => null);
    const logId = logEntry?.id;

    // Step 2 — Validate shared secret
    const incomingSecret = req.headers["x-wibiz-secret"];
    if (!incomingSecret || incomingSecret !== ENV.ghlWebhookSecret) {
      console.warn("[webhook] Rejected: invalid or missing x-wibiz-secret");
      if (logId) {
        await markWebhookProcessed(logId, "Invalid webhook secret").catch(() => null);
      }
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Step 3 — Validate payload
    const parsed = provisionSchema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      console.warn("[webhook] Invalid payload:", issues);
      if (logId) {
        await markWebhookProcessed(logId, `Invalid payload: ${issues}`).catch(() => null);
      }
      await logSyncEvent({
        entityType:   "webhook",
        eventType:    "ghl_provision_invalid_payload",
        payloadJson:  { issues, body: req.body } as any,
        status:       "failed",
        errorMessage: `Missing or invalid fields: ${issues}`,
      }).catch(() => null);
      res.status(400).json({ error: "Invalid payload", details: issues });
      return;
    }

    const {
      contact_id,
      email,
      first_name,
      last_name,
      plan_tier,
      vertical,
      hskd_required,
      temporary_pass,
      location_id,
    } = parsed.data;

    // Step 4 — Idempotency: user with this GHL contact ID already exists?
    const existing = await getUserByGhlContactId(contact_id);
    if (existing) {
      console.info(`[webhook] Duplicate ignored: ghl_contact_id=${contact_id}`);
      if (logId) await markWebhookProcessed(logId).catch(() => null);
      await logSyncEvent({
        entityType:  "user",
        entityId:    existing.id,
        eventType:   "ghl_provision_duplicate",
        payloadJson: { contact_id, email } as any,
        status:      "success",
      }).catch(() => null);
      res.json({ message: "already_provisioned" });
      return;
    }

    // Step 5 — Hash the temporary password (plaintext never stored)
    const passwordHash = await bcrypt.hash(temporary_pass, 12);

    // Step 6 — Create user
    let newUser: Awaited<ReturnType<typeof createUser>>;
    try {
      newUser = await createUser({
        email:         email.toLowerCase().trim(),
        passwordHash,
        role:          "client_admin",
        ghlContactId:  contact_id,
        ghlLocationId: location_id ?? ENV.ghlLocationId ?? null,
        firstName:     first_name ?? null,
        lastName:      last_name ?? null,
        planTier:      plan_tier ?? null,
        vertical:      vertical ?? null,
        hskdRequired:  hskd_required ?? false,
        isActive:      true,
        activatedAt:   new Date(),
      });
    } catch (err: any) {
      const msg = (err?.message as string) ?? "DB insert failed";
      console.error("[webhook] Failed to create user:", msg);
      if (logId) await markWebhookProcessed(logId, msg).catch(() => null);
      await logSyncEvent({
        entityType:   "user",
        eventType:    "user_create_failed",
        payloadJson:  { contact_id, email, error: msg } as any,
        status:       "failed",
        errorMessage: msg,
      }).catch(() => null);
      res.status(500).json({ error: "Provisioning failed — see webhook_log for details" });
      return;
    }

    // Step 7 — Log success
    if (logId) await markWebhookProcessed(logId).catch(() => null);
    await logSyncEvent({
      entityType:   "user",
      entityId:     newUser.id,
      eventType:    "user_created",
      payloadJson:  { contact_id, email, planTier: plan_tier, vertical } as any,
      status:       "success",
      attemptCount: 1,
      lastAttemptAt: new Date(),
    }).catch(() => null);

    console.info(`[webhook] Provisioned: ${email} (ghl=${contact_id})`);
    res.json({ message: "provisioned", userId: newUser.id });
  }
);

// ─── GET /api/webhooks/ghl/provision (health ping from GHL) ──────────────────
webhookRouter.get(
  "/ghl/provision",
  (_req: Request, res: Response): void => {
    res.json({ status: "ok", message: "WiBiz Academy webhook endpoint is active" });
  }
);
