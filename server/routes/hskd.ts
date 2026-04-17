import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../_core/auth";
import { db } from "../db";

export const hskdRouter = Router();

// All routes below require valid session + wibiz_admin role
hskdRouter.use(requireAuth, requireAdmin);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const industryUpdateSchema = z.object({
  name:        z.string().min(1).max(255).optional(),
  tier:        z.enum(["TIER_0", "TIER_1"]).optional(),
  description: z.string().optional().nullable(),
  is_active:   z.boolean().optional(),
});

const scenarioUpdateSchema = z.object({
  title:                   z.string().min(1).max(255).optional(),
  scenario_text:           z.string().optional().nullable(),
  danger_text:             z.string().optional().nullable(),
  prescribed_bot_response: z.string().optional().nullable(),
  mandatory_bot_action:    z.string().optional().nullable(),
  certification_prompt:    z.string().optional().nullable(),
  ops_note:                z.string().optional().nullable(),
  is_active:               z.boolean().optional(),
});

const prohibitedItemSchema = z.object({
  industry_id:      z.string().uuid(),
  item_number:      z.number().int().positive(),
  category:         z.string().max(255).optional().nullable(),
  restriction_text: z.string().optional().nullable(),
  is_active:        z.boolean().default(true),
});

const prohibitedItemUpdateSchema = prohibitedItemSchema.partial();

const trainingModuleSchema = z.object({
  industry_id:   z.string().uuid(),
  module_number: z.number().int().positive(),
  title:         z.string().min(1).max(255),
  content:       z.string().optional().nullable(),
  video_url:     z.string().url().optional().nullable().or(z.literal("")),
  is_active:     z.boolean().default(true),
});

const trainingModuleUpdateSchema = trainingModuleSchema.partial();

const signoffSchema = z.object({
  ops_signoff_by: z.string().min(1),
});

// ─── INDUSTRIES ───────────────────────────────────────────────────────────────

// GET /api/admin/hskd/industries
hskdRouter.get("/industries", async (_req: Request, res: Response): Promise<void> => {
  try {
    const industries = await db.execute(
      `SELECT i.*, 
        (SELECT COUNT(*) FROM hskd_scenarios s WHERE s.industry_id = i.id AND s.is_active = true) as scenario_count
       FROM hskd_industries i 
       ORDER BY i.name ASC`
    );
    res.json({ industries: industries.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch industries" });
  }
});

// GET /api/admin/hskd/industries/:id
hskdRouter.get("/industries/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(
      `SELECT * FROM hskd_industries WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Industry not found" }); return; }
    res.json({ industry: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch industry" });
  }
});

// PATCH /api/admin/hskd/industries/:id
hskdRouter.patch("/industries/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = industryUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const fields = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (fields.name        !== undefined) { updates.push(`name = $${i++}`);        values.push(fields.name); }
    if (fields.tier        !== undefined) { updates.push(`tier = $${i++}`);        values.push(fields.tier); }
    if (fields.description !== undefined) { updates.push(`description = $${i++}`); values.push(fields.description); }
    if (fields.is_active   !== undefined) { updates.push(`is_active = $${i++}`);   values.push(fields.is_active); }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const result = await db.execute(
      `UPDATE hskd_industries SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows.length) { res.status(404).json({ error: "Industry not found" }); return; }
    res.json({ industry: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update industry" });
  }
});

// ─── SCENARIOS ────────────────────────────────────────────────────────────────

// GET /api/admin/hskd/scenarios?industry_id=xxx
hskdRouter.get("/scenarios", async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry_id } = req.query;
    if (!industry_id) { res.status(400).json({ error: "industry_id query param required" }); return; }
    const result = await db.execute(
      `SELECT * FROM hskd_scenarios WHERE industry_id = $1 ORDER BY scenario_number ASC`,
      [industry_id]
    );
    res.json({ scenarios: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch scenarios" });
  }
});

// PATCH /api/admin/hskd/scenarios/:id
hskdRouter.patch("/scenarios/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = scenarioUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const fields = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    const fieldMap: Record<string, any> = {
      title: fields.title,
      scenario_text: fields.scenario_text,
      danger_text: fields.danger_text,
      prescribed_bot_response: fields.prescribed_bot_response,
      mandatory_bot_action: fields.mandatory_bot_action,
      certification_prompt: fields.certification_prompt,
      ops_note: fields.ops_note,
      is_active: fields.is_active,
    };
    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) { updates.push(`${key} = $${i++}`); values.push(val); }
    }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const result = await db.execute(
      `UPDATE hskd_scenarios SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows.length) { res.status(404).json({ error: "Scenario not found" }); return; }
    res.json({ scenario: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update scenario" });
  }
});

// ─── PROHIBITED ITEMS ─────────────────────────────────────────────────────────

// GET /api/admin/hskd/prohibited-items?industry_id=xxx
hskdRouter.get("/prohibited-items", async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry_id } = req.query;
    if (!industry_id) { res.status(400).json({ error: "industry_id query param required" }); return; }
    const result = await db.execute(
      `SELECT * FROM hskd_prohibited_items WHERE industry_id = $1 ORDER BY item_number ASC`,
      [industry_id]
    );
    res.json({ items: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch prohibited items" });
  }
});

// POST /api/admin/hskd/prohibited-items
hskdRouter.post("/prohibited-items", async (req: Request, res: Response): Promise<void> => {
  const parsed = prohibitedItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const { industry_id, item_number, category, restriction_text, is_active } = parsed.data;
    const result = await db.execute(
      `INSERT INTO hskd_prohibited_items (industry_id, item_number, category, restriction_text, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [industry_id, item_number, category ?? null, restriction_text ?? null, is_active]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create prohibited item" });
  }
});

// PATCH /api/admin/hskd/prohibited-items/:id
hskdRouter.patch("/prohibited-items/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = prohibitedItemUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const fields = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (fields.item_number      !== undefined) { updates.push(`item_number = $${i++}`);      values.push(fields.item_number); }
    if (fields.category         !== undefined) { updates.push(`category = $${i++}`);         values.push(fields.category); }
    if (fields.restriction_text !== undefined) { updates.push(`restriction_text = $${i++}`); values.push(fields.restriction_text); }
    if (fields.is_active        !== undefined) { updates.push(`is_active = $${i++}`);        values.push(fields.is_active); }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const result = await db.execute(
      `UPDATE hskd_prohibited_items SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows.length) { res.status(404).json({ error: "Item not found" }); return; }
    res.json({ item: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update prohibited item" });
  }
});

// DELETE /api/admin/hskd/prohibited-items/:id
hskdRouter.delete("/prohibited-items/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(
      `DELETE FROM hskd_prohibited_items WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Item not found" }); return; }
    res.json({ message: "deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to delete prohibited item" });
  }
});

// ─── TRAINING MODULES ─────────────────────────────────────────────────────────

// GET /api/admin/hskd/training?industry_id=xxx
hskdRouter.get("/training", async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry_id } = req.query;
    if (!industry_id) { res.status(400).json({ error: "industry_id query param required" }); return; }
    const result = await db.execute(
      `SELECT * FROM hskd_training_modules WHERE industry_id = $1 ORDER BY module_number ASC`,
      [industry_id]
    );
    res.json({ modules: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch training modules" });
  }
});

// POST /api/admin/hskd/training
hskdRouter.post("/training", async (req: Request, res: Response): Promise<void> => {
  const parsed = trainingModuleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const { industry_id, module_number, title, content, video_url, is_active } = parsed.data;
    const result = await db.execute(
      `INSERT INTO hskd_training_modules (industry_id, module_number, title, content, video_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [industry_id, module_number, title, content ?? null, video_url ?? null, is_active]
    );
    res.status(201).json({ module: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create training module" });
  }
});

// PATCH /api/admin/hskd/training/:id
hskdRouter.patch("/training/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = trainingModuleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const fields = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (fields.module_number !== undefined) { updates.push(`module_number = $${i++}`); values.push(fields.module_number); }
    if (fields.title         !== undefined) { updates.push(`title = $${i++}`);         values.push(fields.title); }
    if (fields.content       !== undefined) { updates.push(`content = $${i++}`);       values.push(fields.content); }
    if (fields.video_url     !== undefined) { updates.push(`video_url = $${i++}`);     values.push(fields.video_url); }
    if (fields.is_active     !== undefined) { updates.push(`is_active = $${i++}`);     values.push(fields.is_active); }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const result = await db.execute(
      `UPDATE hskd_training_modules SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows.length) { res.status(404).json({ error: "Module not found" }); return; }
    res.json({ module: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update training module" });
  }
});

// DELETE /api/admin/hskd/training/:id
hskdRouter.delete("/training/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(
      `DELETE FROM hskd_training_modules WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Module not found" }); return; }
    res.json({ message: "deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to delete training module" });
  }
});

// ─── CERTIFICATIONS ───────────────────────────────────────────────────────────

// GET /api/admin/hskd/certifications
hskdRouter.get("/certifications", async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry_id, status } = req.query;
    let query = `
      SELECT c.*, i.name as industry_name, i.slug as industry_slug, i.tier
      FROM client_certifications c
      JOIN hskd_industries i ON i.id = c.industry_id
      WHERE 1=1
    `;
    const values: any[] = [];
    let idx = 1;
    if (industry_id) { query += ` AND c.industry_id = $${idx++}`; values.push(industry_id); }
    if (status)      { query += ` AND c.status = $${idx++}`;      values.push(status); }
    query += ` ORDER BY c.created_at DESC`;
    const result = await db.execute(query, values);

    // Summary counts
    const counts = await db.execute(
      `SELECT status, COUNT(*) as count FROM client_certifications GROUP BY status`
    );
    res.json({ certifications: result.rows, counts: counts.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch certifications" });
  }
});

// GET /api/admin/hskd/certifications/:id
hskdRouter.get("/certifications/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const cert = await db.execute(
      `SELECT c.*, i.name as industry_name, i.slug as industry_slug, i.tier
       FROM client_certifications c
       JOIN hskd_industries i ON i.id = c.industry_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }

    const scenarioLogs = await db.execute(
      `SELECT l.*, s.title as scenario_title
       FROM certification_scenario_logs l
       JOIN hskd_scenarios s ON s.id = l.scenario_id
       WHERE l.certification_id = $1
       ORDER BY l.scenario_number ASC`,
      [req.params.id]
    );

    const prohibitedLogs = await db.execute(
      `SELECT l.*, p.category, p.restriction_text
       FROM certification_prohibited_logs l
       JOIN hskd_prohibited_items p ON p.id = l.prohibited_item_id
       WHERE l.certification_id = $1
       ORDER BY l.confirmed_at ASC`,
      [req.params.id]
    );

    res.json({
      certification: cert.rows[0],
      scenario_logs: scenarioLogs.rows,
      prohibited_logs: prohibitedLogs.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch certification detail" });
  }
});

// PATCH /api/admin/hskd/certifications/:id/signoff
hskdRouter.patch("/certifications/:id/signoff", async (req: Request, res: Response): Promise<void> => {
  const parsed = signoffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const cert = await db.execute(
      `SELECT c.*, i.slug as industry_slug
       FROM client_certifications c
       JOIN hskd_industries i ON i.id = c.industry_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    const c = cert.rows[0] as any;

    // ── Compliance gates ──────────────────────────────────────────────────────
    if (c.industry_slug === "clinics") {
      if (!c.hipaa_baa_executed || !c.hipaa_baa_date) {
        res.status(400).json({ error: "HIPAA BAA must be executed with a date before signing off Clinics certification." });
        return;
      }
      if (!c.affirmation_license_type || !c.affirmation_license_state) {
        res.status(400).json({ error: "Professional license type and state are required for Clinics certification." });
        return;
      }
    }

    if (c.industry_slug === "legal-services") {
      if (!c.affirmation_license_number) {
        res.status(400).json({ error: "State bar license number required for Legal Services certification." });
        return;
      }
    }

    if (c.industry_slug === "social-welfare") {
      if (!c.mandatory_reporter_status) {
        res.status(400).json({ error: "Mandatory reporter status is required for Social Welfare certification." });
        return;
      }
      if (!c.oncall_contact_name || !c.oncall_contact_phone) {
        res.status(400).json({ error: "On-call contact name and phone are required for Social Welfare certification." });
        return;
      }
    }

    // ── Check all 5 scenarios approved ───────────────────────────────────────
    const rejectedScenarios = await db.execute(
      `SELECT id FROM certification_scenario_logs WHERE certification_id = $1 AND decision = 'REJECTED'`,
      [req.params.id]
    );
    if (rejectedScenarios.rows.length > 0) {
      res.status(400).json({ error: "All scenarios must be APPROVED before ops sign-off." });
      return;
    }

    // ── Generate Certificate ID ───────────────────────────────────────────────
    const slugMap: Record<string, string> = {
      "real-estate":    "RE",
      "clinics":        "CL",
      "legal-services": "LS",
      "social-welfare": "SW",
      "restaurants":    "RB",
    };
    const industryCode = slugMap[c.industry_slug] ?? "XX";
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const shortId = c.client_id.toString().replace(/-/g, "").slice(0, 6).toUpperCase();
    const certificateId = `WBZ-${industryCode}-CERT-US-${dateStr}-${shortId}`;

    // ── Set KB review for Clinics and Social Welfare ──────────────────────────
    const needsKbReview = ["clinics", "social-welfare"].includes(c.industry_slug);
    const needsTier0Monitoring = c.industry_slug === "social-welfare";

    const result = await db.execute(
      `UPDATE client_certifications SET
        status = 'CERTIFIED',
        ops_signoff_by = $1,
        ops_signoff_at = NOW(),
        specialist_mode_activated_at = NOW(),
        certificate_id = $2,
        kb_review_due_at = CASE WHEN $3 THEN NOW() + INTERVAL '30 days' ELSE NULL END,
        tier0_monitoring_start_at = CASE WHEN $4 THEN NOW() ELSE NULL END,
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [parsed.data.ops_signoff_by, certificateId, needsKbReview, needsTier0Monitoring, req.params.id]
    );

    res.json({ certification: result.rows[0], certificate_id: certificateId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to complete ops sign-off" });
  }
});

// GET /api/admin/hskd/kb-reviews-due
hskdRouter.get("/kb-reviews-due", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(
      `SELECT c.*, i.name as industry_name
       FROM client_certifications c
       JOIN hskd_industries i ON i.id = c.industry_id
       WHERE c.kb_review_due_at <= NOW() + INTERVAL '7 days'
         AND c.status = 'CERTIFIED'
       ORDER BY c.kb_review_due_at ASC`
    );
    res.json({ reviews: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch KB reviews" });
  }
});

// ─── GET /api/admin/hskd/scenarios?industry_id=xxx ────────────────────────────
hskdRouter.get("/scenarios", async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry_id } = req.query;
    if (!industry_id) { res.status(400).json({ error: "industry_id required" }); return; }
    const result = await pool.query(
      `SELECT * FROM hskd_scenarios WHERE industry_id = $1 ORDER BY scenario_number ASC`,
      [industry_id]
    );
    res.json({ scenarios: result.rows });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ─── PATCH /api/admin/hskd/scenarios/:id ─────────────────────────────────────
hskdRouter.patch("/scenarios/:id", async (req: Request, res: Response): Promise<void> => {
  const { title, scenario_text, danger_text, prescribed_bot_response, mandatory_bot_action, certification_prompt, ops_note, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE hskd_scenarios SET
        title = COALESCE($1, title),
        scenario_text = COALESCE($2, scenario_text),
        danger_text = COALESCE($3, danger_text),
        prescribed_bot_response = COALESCE($4, prescribed_bot_response),
        mandatory_bot_action = COALESCE($5, mandatory_bot_action),
        certification_prompt = COALESCE($6, certification_prompt),
        ops_note = COALESCE($7, ops_note),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [title, scenario_text, danger_text, prescribed_bot_response, mandatory_bot_action, certification_prompt, ops_note, is_active, req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ scenario: result.rows[0] });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ─── GET /api/admin/hskd/prohibited?industry_id=xxx ──────────────────────────
hskdRouter.get("/prohibited", async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry_id } = req.query;
    if (!industry_id) { res.status(400).json({ error: "industry_id required" }); return; }
    const result = await pool.query(
      `SELECT * FROM hskd_prohibited_items WHERE industry_id = $1 ORDER BY item_number ASC`,
      [industry_id]
    );
    res.json({ items: result.rows });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ─── PATCH /api/admin/hskd/prohibited/:id ────────────────────────────────────
hskdRouter.patch("/prohibited/:id", async (req: Request, res: Response): Promise<void> => {
  const { category, restriction_text, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE hskd_prohibited_items SET
        category = COALESCE($1, category),
        restriction_text = COALESCE($2, restriction_text),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [category, restriction_text, is_active, req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ item: result.rows[0] });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ─── GET /api/admin/hskd/training?industry_id=xxx ────────────────────────────
hskdRouter.get("/training", async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry_id } = req.query;
    if (!industry_id) { res.status(400).json({ error: "industry_id required" }); return; }
    const result = await pool.query(
      `SELECT * FROM hskd_training_modules WHERE industry_id = $1 ORDER BY module_number ASC`,
      [industry_id]
    );
    res.json({ modules: result.rows });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ─── PATCH /api/admin/hskd/training/:id ──────────────────────────────────────
hskdRouter.patch("/training/:id", async (req: Request, res: Response): Promise<void> => {
  const { title, content, video_url, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE hskd_training_modules SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        video_url = COALESCE($3, video_url),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, content, video_url, is_active, req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ module: result.rows[0] });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});