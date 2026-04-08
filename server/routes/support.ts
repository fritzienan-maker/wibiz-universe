import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../_core/auth";
import { ENV } from "../_core/env";
import { getUserById, createSupportTicket } from "../db";

export const supportRouter = Router();

const ticketSchema = z.object({
  subject:       z.string().min(1, "Subject is required").max(255),
  category:      z.string().max(100).optional().nullable(),
  message:       z.string().min(1, "Message is required"),
  priority:      z.enum(["low", "normal", "high"]).default("normal"),
  attachmentUrl: z.string().url().max(500).optional().nullable(),
});

// ─── POST /api/support/ticket ─────────────────────────────────────────────────
supportRouter.post(
  "/ticket",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Forward to GHL inbound webhook if configured (non-fatal on failure)
    let ghlForwarded = false;
    if (ENV.ghlSupportWebhookUrl) {
      try {
        const ghlRes = await fetch(ENV.ghlSupportWebhookUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:          user.email,
            first_name:     user.firstName ?? "",
            last_name:      user.lastName ?? "",
            ghl_contact_id: user.ghlContactId ?? "",
            subject:        parsed.data.subject,
            category:       parsed.data.category ?? "",
            message:        parsed.data.message,
            priority:       parsed.data.priority,
            attachment_url: parsed.data.attachmentUrl ?? "",
          }),
        });
        ghlForwarded = ghlRes.ok;
      } catch {
        // GHL forward failure is non-fatal — ticket is still saved locally
      }
    }

    const ticket = await createSupportTicket({
      userId:        user.id,
      subject:       parsed.data.subject,
      category:      parsed.data.category ?? null,
      message:       parsed.data.message,
      priority:      parsed.data.priority,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      ghlForwarded,
    });

    res.status(201).json({ ticket: { id: ticket.id, status: ticket.status } });
  }
);
