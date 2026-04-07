// ─── GHL Webhook — Provision endpoint ────────────────────────────────────────
// POST /api/webhooks/ghl/provision
//
// Processing order (must not change — idempotency depends on it):
//   1. Log raw payload to webhook_log (before any validation)
//   2. Validate x-wibiz-secret header
//   3. Validate required payload fields with Zod
//   4. Idempotency check: ghl_contact_id already in users table?
//   5. Generate temporary password (server-side — never sent by GHL)
//   6. Hash temporary_pass (bcrypt cost 12)
//   7. Insert user (role: client_admin)
//   8. Write plaintext password to GHL contact custom field (for welcome email)
//   9. Log sync_event
//  10. Return 200

import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
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

// ─── Password generator ───────────────────────────────────────────────────────
// Produces a 12-char mixed-case alphanumeric string, e.g. "aB3xQ7mZkT9w"
// Base64url gives [A-Za-z0-9_-]; we drop _ and - for safer email/copy-paste.
function generateTempPassword(): string {
  let pass = "";
  while (pass.length < 12) {
    pass += randomBytes(18).toString("base64url").replace(/[-_]/g, "");
  }
  return pass.slice(0, 12);
}

// ─── GHL contact field writer ─────────────────────────────────────────────────
// Writes a value to a GHL contact custom field via the v2 API.
// Returns true on success, false on failure (caller logs the error).
async function writeGhlContactField(
  contactId: string,
  fieldId: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!ENV.ghlApiKey || !fieldId) {
    return { ok: false, error: "GHL_API_KEY or GHL_TEMP_PASS_FIELD_ID not configured" };
  }
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${ENV.ghlApiKey}`,
          "Content-Type":  "application/json",
          "Version":        "2021-07-28",
        },
        body: JSON.stringify({
          customFields: [{ id: fieldId, value }],
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `GHL API ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch failed" };
  }
}

// ─── Payload schema ───────────────────────────────────────────────────────────
// GHL "Send Data via Webhook" action sends contact custom fields as flat keys.
// temporary_pass is generated server-side — GHL no longer needs to send it.
const provisionSchema = z.object({
  contact_id:    z.string().min(1, "contact_id is required"),
  email:         z.string().email("valid email is required"),
  first_name:    z.string().optional(),
  last_name:     z.string().optional(),
  plan_tier:     z.enum(["lite", "standard", "pro"]).optional().nullable(),
  vertical:      z.string().optional().nullable(),
  hskd_required: z.boolean().optional().default(false),
  location_id:   z.string().optional(),
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

    // Step 5 — Generate temporary password (plaintext kept only long enough to
    //           hash it and write it to GHL; never stored in DB)
    const tempPassword = generateTempPassword();

    // Step 6 — Hash the temporary password
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Step 7 — Create user
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

    // Step 8 — Write plaintext password to GHL contact custom field.
    // The GHL welcome-email workflow reads this field and sends access details.
    // If this call fails we log it but still return 200 — the user account exists
    // and a support team member / retry can push the field again.
    const ghlWrite = await writeGhlContactField(
      contact_id,
      ENV.ghlTempPassFieldId,
      tempPassword,
    );
    if (!ghlWrite.ok) {
      console.warn(`[webhook] GHL field write failed for ${contact_id}: ${ghlWrite.error}`);
      await logSyncEvent({
        entityType:   "user",
        entityId:     newUser.id,
        eventType:    "ghl_field_write_failed",
        payloadJson:  { contact_id, email, error: ghlWrite.error } as any,
        status:       "failed",
        errorMessage: ghlWrite.error,
      }).catch(() => null);
    } else {
      console.info(`[webhook] Temp password written to GHL contact ${contact_id}`);
    }

    // Step 9 — Log success
    if (logId) await markWebhookProcessed(logId).catch(() => null);
    await logSyncEvent({
      entityType:    "user",
      entityId:      newUser.id,
      eventType:     "user_created",
      payloadJson:   { contact_id, email, planTier: plan_tier, vertical, ghlFieldWritten: ghlWrite.ok } as any,
      status:        "success",
      attemptCount:  1,
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
