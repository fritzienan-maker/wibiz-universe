import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Pool } from "pg";
import { requireAuth } from "../_core/auth";
import { ENV } from "../_core/env";

const pool = new Pool({
  connectionString: ENV.databaseUrl,
  ssl: ENV.isProduction ? { rejectUnauthorized: false } : undefined,
});

export const hskdClientRouter = Router();
hskdClientRouter.use(requireAuth);

const scenarioDecisionSchema = z.object({
  decision:    z.enum(["APPROVED", "REJECTED"]),
  client_note: z.string().optional().nullable(),
});

const prohibitedConfirmSchema = z.object({
  prohibited_item_id: z.string().min(1),
});

const affirmationSchema = z.object({
  legal_name:                 z.string().min(1),
  affirmation_license_type:   z.string().optional().nullable(),
  affirmation_license_number: z.string().optional().nullable(),
  affirmation_license_state:  z.string().optional().nullable(),
  oncall_contact_name:        z.string().optional().nullable(),
  oncall_contact_phone:       z.string().optional().nullable(),
  mandatory_reporter_status:  z.boolean().optional().nullable(),
  hipaa_baa_executed:         z.boolean().optional().nullable(),
  hipaa_baa_date:             z.string().optional().nullable(),
});

const industrySelectSchema = z.object({
  industry_id: z.string().min(1),
});

hskdClientRouter.get("/industries", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, slug, name, tier, description FROM hskd_industries WHERE is_active = true ORDER BY name ASC`
    );
    res.json({ industries: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch industries" });
  }
});

hskdClientRouter.get("/my-certification", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const result = await pool.query(
      `SELECT c.*, i.name as industry_name, i.slug as industry_slug, i.tier
       FROM client_certifications c
       JOIN hskd_industries i ON i.id = c.industry_id
       WHERE c.client_id = $1
       ORDER BY c.created_at DESC LIMIT 1`,
      [clientId]
    );
    if (!result.rows.length) { res.json({ certification: null }); return; }
    const cert = result.rows[0] as any;
    const scenarioLogs = await pool.query(
      `SELECT l.*, s.title as scenario_title, s.scenario_number
       FROM certification_scenario_logs l
       JOIN hskd_scenarios s ON s.id = l.scenario_id
       WHERE l.certification_id = $1 ORDER BY l.scenario_number ASC`,
      [cert.id]
    );
    const prohibitedLogs = await pool.query(
      `SELECT l.*, p.category, p.restriction_text, p.item_number
       FROM certification_prohibited_logs l
       JOIN hskd_prohibited_items p ON p.id = l.prohibited_item_id
       WHERE l.certification_id = $1 ORDER BY l.confirmed_at ASC`,
      [cert.id]
    );
    res.json({ certification: cert, scenario_logs: scenarioLogs.rows, prohibited_logs: prohibitedLogs.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch certification" });
  }
});

hskdClientRouter.post("/start", async (req: Request, res: Response): Promise<void> => {
  console.log("[hskd] start body: - hskd-client.ts:86", JSON.stringify(req.body));
  const parsed = industrySelectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    console.log("[hskd] looking up industry: - hskd-client.ts:95", parsed.data.industry_id);
    const industry = await pool.query(
      `SELECT * FROM hskd_industries WHERE id = $1 AND is_active = true`,
      [parsed.data.industry_id]
    );
    if (!industry.rows.length) { res.status(404).json({ error: "Industry not found or inactive" }); return; }
    const existing = await pool.query(
      `SELECT id, status FROM client_certifications WHERE client_id = $1 AND status NOT IN ('CERTIFIED', 'REJECTED')`,
      [clientId]
    );
    if (existing.rows.length) {
      res.status(409).json({ error: "You already have an active certification in progress", certification_id: (existing.rows[0] as any).id });
      return;
    }
    const result = await pool.query(
      `INSERT INTO client_certifications (client_id, industry_id, status) VALUES ($1, $2, 'TRAINING') RETURNING *`,
      [clientId, parsed.data.industry_id]
    );
    res.status(201).json({ certification: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to start certification" });
  }
});

hskdClientRouter.get("/training/:certificationId", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const cert = await pool.query(
      `SELECT * FROM client_certifications WHERE id = $1 AND client_id = $2`,
      [req.params.certificationId, clientId]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    const modules = await pool.query(
      `SELECT * FROM hskd_training_modules WHERE industry_id = $1 AND is_active = true ORDER BY module_number ASC`,
      [(cert.rows[0] as any).industry_id]
    );
    res.json({ modules: modules.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch training modules" });
  }
});

hskdClientRouter.post("/training/:certificationId/complete", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const cert = await pool.query(
      `SELECT * FROM client_certifications WHERE id = $1 AND client_id = $2`,
      [req.params.certificationId, clientId]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    if ((cert.rows[0] as any).status !== "TRAINING") {
      res.status(400).json({ error: "Certification is not in TRAINING status" }); return;
    }
    const result = await pool.query(
      `UPDATE client_certifications SET status = 'SCENARIOS', training_completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.certificationId]
    );
    res.json({ certification: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to complete training" });
  }
});

hskdClientRouter.get("/scenarios/:certificationId", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const cert = await pool.query(
      `SELECT * FROM client_certifications WHERE id = $1 AND client_id = $2`,
      [req.params.certificationId, clientId]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    if (!["SCENARIOS", "PROHIBITED", "AFFIRMATION", "OPS_REVIEW", "CERTIFIED"].includes((cert.rows[0] as any).status)) {
      res.status(403).json({ error: "Training must be completed before accessing scenarios" }); return;
    }
    const scenarios = await pool.query(
      `SELECT id, scenario_number, title, scenario_text, danger_text, certification_prompt
       FROM hskd_scenarios WHERE industry_id = $1 AND is_active = true ORDER BY scenario_number ASC`,
      [(cert.rows[0] as any).industry_id]
    );
    res.json({ scenarios: scenarios.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch scenarios" });
  }
});

hskdClientRouter.post("/scenarios/:certificationId/decision", async (req: Request, res: Response): Promise<void> => {
  const parsed = scenarioDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return;
  }
  const { scenario_id } = req.query;
  if (!scenario_id) { res.status(400).json({ error: "scenario_id query param required" }); return; }
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const cert = await pool.query(
      `SELECT * FROM client_certifications WHERE id = $1 AND client_id = $2`,
      [req.params.certificationId, clientId]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    const scenario = await pool.query(`SELECT * FROM hskd_scenarios WHERE id = $1`, [scenario_id]);
    if (!scenario.rows.length) { res.status(404).json({ error: "Scenario not found" }); return; }
    await pool.query(
      `INSERT INTO certification_scenario_logs (certification_id, scenario_id, scenario_number, decision, client_note, decided_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (certification_id, scenario_id) DO UPDATE SET decision = $4, client_note = $5, decided_at = NOW()`,
      [req.params.certificationId, scenario_id, (scenario.rows[0] as any).scenario_number, parsed.data.decision, parsed.data.client_note ?? null]
    );
    if (parsed.data.decision === "REJECTED") {
      await pool.query(`UPDATE client_certifications SET status = 'OPS_REVIEW', updated_at = NOW() WHERE id = $1`, [req.params.certificationId]);
      res.json({ message: "Scenario flagged for ops review", status: "OPS_REVIEW" }); return;
    }
    const totalScenarios = await pool.query(`SELECT COUNT(*) as count FROM hskd_scenarios WHERE industry_id = $1 AND is_active = true`, [(cert.rows[0] as any).industry_id]);
    const approvedScenarios = await pool.query(`SELECT COUNT(*) as count FROM certification_scenario_logs WHERE certification_id = $1 AND decision = 'APPROVED'`, [req.params.certificationId]);
    const total = parseInt((totalScenarios.rows[0] as any).count);
    const approved = parseInt((approvedScenarios.rows[0] as any).count);
    if (approved >= total) {
      await pool.query(`UPDATE client_certifications SET status = 'PROHIBITED', updated_at = NOW() WHERE id = $1`, [req.params.certificationId]);
      res.json({ message: "All scenarios approved", status: "PROHIBITED" });
    } else {
      res.json({ message: "Scenario approved", remaining: total - approved });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to submit scenario decision" });
  }
});

hskdClientRouter.get("/prohibited/:certificationId", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const cert = await pool.query(`SELECT * FROM client_certifications WHERE id = $1 AND client_id = $2`, [req.params.certificationId, clientId]);
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    const items = await pool.query(`SELECT * FROM hskd_prohibited_items WHERE industry_id = $1 AND is_active = true ORDER BY item_number ASC`, [(cert.rows[0] as any).industry_id]);
    const confirmed = await pool.query(`SELECT prohibited_item_id FROM certification_prohibited_logs WHERE certification_id = $1`, [req.params.certificationId]);
    res.json({ items: items.rows, confirmed_ids: confirmed.rows.map((r: any) => r.prohibited_item_id) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch prohibited items" });
  }
});

hskdClientRouter.post("/prohibited/:certificationId/confirm", async (req: Request, res: Response): Promise<void> => {
  const parsed = prohibitedConfirmSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const cert = await pool.query(`SELECT * FROM client_certifications WHERE id = $1 AND client_id = $2`, [req.params.certificationId, clientId]);
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    await pool.query(
      `INSERT INTO certification_prohibited_logs (certification_id, prohibited_item_id, confirmed_at) VALUES ($1, $2, NOW()) ON CONFLICT (certification_id, prohibited_item_id) DO NOTHING`,
      [req.params.certificationId, parsed.data.prohibited_item_id]
    );
    const totalItems = await pool.query(`SELECT COUNT(*) as count FROM hskd_prohibited_items WHERE industry_id = $1 AND is_active = true`, [(cert.rows[0] as any).industry_id]);
    const confirmedItems = await pool.query(`SELECT COUNT(*) as count FROM certification_prohibited_logs WHERE certification_id = $1`, [req.params.certificationId]);
    const total = parseInt((totalItems.rows[0] as any).count);
    const confirmed = parseInt((confirmedItems.rows[0] as any).count);
    if (confirmed >= total) {
      await pool.query(`UPDATE client_certifications SET status = 'AFFIRMATION', updated_at = NOW() WHERE id = $1`, [req.params.certificationId]);
      res.json({ message: "All prohibited items confirmed", status: "AFFIRMATION" });
    } else {
      res.json({ message: "Item confirmed", remaining: total - confirmed });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to confirm prohibited item" });
  }
});

hskdClientRouter.post("/affirmation/:certificationId", async (req: Request, res: Response): Promise<void> => {
  const parsed = affirmationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }); return; }
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const cert = await pool.query(
      `SELECT c.*, i.slug as industry_slug FROM client_certifications c JOIN hskd_industries i ON i.id = c.industry_id WHERE c.id = $1 AND c.client_id = $2`,
      [req.params.certificationId, clientId]
    );
    if (!cert.rows.length) { res.status(404).json({ error: "Certification not found" }); return; }
    if ((cert.rows[0] as any).status !== "AFFIRMATION") { res.status(400).json({ error: "Certification is not in AFFIRMATION status" }); return; }
    const d = parsed.data;
    const result = await pool.query(
      `UPDATE client_certifications SET status = 'OPS_REVIEW', affirmation_legal_name = $1, affirmation_license_type = $2, affirmation_license_number = $3, affirmation_license_state = $4, oncall_contact_name = $5, oncall_contact_phone = $6, mandatory_reporter_status = $7, hipaa_baa_executed = $8, hipaa_baa_date = $9, affirmation_submitted_at = NOW(), updated_at = NOW() WHERE id = $10 RETURNING *`,
      [d.legal_name, d.affirmation_license_type ?? null, d.affirmation_license_number ?? null, d.affirmation_license_state ?? null, d.oncall_contact_name ?? null, d.oncall_contact_phone ?? null, d.mandatory_reporter_status ?? null, d.hipaa_baa_executed ?? null, d.hipaa_baa_date ?? null, req.params.certificationId]
    );
    res.json({ certification: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to submit affirmation" });
  }
});

hskdClientRouter.get("/crisis-resources/:industrySlug", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT cr.* FROM hskd_crisis_resources cr JOIN hskd_industries i ON i.slug = $1 WHERE cr.industry_id = i.id AND cr.is_active = true ORDER BY cr.priority ASC`,
      [req.params.industrySlug]
    );
    res.json({ resources: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch crisis resources" });
  }
});

// ─── NEW: GET /summary ────────────────────────────────────────────────────────
// Used by HskdSummaryCard on the dashboard.
// Returns the most advanced certification for the current user.

hskdClientRouter.get("/summary", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const result = await pool.query(
      `SELECT cc.id, cc.status, cc.certificate_id, cc.training_completed_at,
              cc.affirmation_submitted_at,
              hi.name AS industry_name, hi.slug AS industry_slug
       FROM client_certifications cc
       JOIN hskd_industries hi ON hi.id = cc.industry_id
       WHERE cc.client_id = $1
       ORDER BY
         CASE cc.status
           WHEN 'CERTIFIED'    THEN 1
           WHEN 'OPS_REVIEW'   THEN 2
           WHEN 'AFFIRMATION'  THEN 3
           WHEN 'PROHIBITED'   THEN 4
           WHEN 'SCENARIOS'    THEN 5
           WHEN 'TRAINING'     THEN 6
           ELSE 7
         END ASC,
         cc.updated_at DESC
       LIMIT 1`,
      [clientId]
    );

    if (!result.rows.length) {
      res.json({ status: "not_started", total_steps: 7 });
      return;
    }

    const cert = result.rows[0] as any;

    const statusMap: Record<string, string> = {
      CERTIFIED:   "certified",
      OPS_REVIEW:  "pending_review",
      AFFIRMATION: "in_progress",
      PROHIBITED:  "in_progress",
      SCENARIOS:   "in_progress",
      TRAINING:    "in_progress",
    };
    const widgetStatus = statusMap[cert.status] ?? "not_started";

    let currentStep = 1;
    if (widgetStatus === "in_progress") {
      if (cert.training_completed_at)     currentStep = 2;

      if (cert.status === "SCENARIOS") {
        const approved = await pool.query(
          `SELECT COUNT(*) as count FROM certification_scenario_logs WHERE certification_id = $1 AND decision = 'APPROVED'`,
          [cert.id]
        );
        if (parseInt((approved.rows[0] as any).count) > 0) currentStep = 3;
      }

      if (cert.status === "PROHIBITED") {
        const confirmed = await pool.query(
          `SELECT COUNT(*) as count FROM certification_prohibited_logs WHERE certification_id = $1`,
          [cert.id]
        );
        if (parseInt((confirmed.rows[0] as any).count) > 0) currentStep = 4;
        else currentStep = 3;
      }

      if (cert.status === "AFFIRMATION") currentStep = 5;
    }

    res.json({
      status:        widgetStatus,
      industry_name: cert.industry_name,
      industry_slug: cert.industry_slug,
      certificate_id: cert.certificate_id ?? undefined,
      current_step:  widgetStatus === "in_progress" ? currentStep : undefined,
      total_steps:   7,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch summary" });
  }
});

// ─── NEW: GET /certify/:industrySlug/status ───────────────────────────────────
// Used by HskdCertificate.tsx — returns full status for the certificate page.

hskdClientRouter.get("/certify/:industrySlug/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const certResult = await pool.query(
      `SELECT cc.id, cc.status, cc.certificate_id,
              cc.affirmation_legal_name   AS client_full_name,
              cc.training_completed_at,
              cc.affirmation_submitted_at,
              cc.ops_signoff_at,
              cc.specialist_mode_activated_at,
              cc.notes                    AS rejection_note,
              hi.name  AS industry_name,
              hi.slug  AS industry_slug,
              hi.tier
       FROM client_certifications cc
       JOIN hskd_industries hi ON hi.id = cc.industry_id
       WHERE cc.client_id = $1 AND hi.slug = $2
       ORDER BY cc.created_at DESC
       LIMIT 1`,
      [clientId, req.params.industrySlug]
    );

    if (!certResult.rows.length) {
      res.status(404).json({ error: "No certification found for this industry." });
      return;
    }

    const cert = certResult.rows[0] as any;

    const scenariosResult = await pool.query(
      `SELECT COUNT(*) AS approved_count FROM certification_scenario_logs WHERE certification_id = $1 AND decision = 'APPROVED'`,
      [cert.id]
    );
    const scenariosApproved = parseInt((scenariosResult.rows[0] as any).approved_count) || 0;

    const prohibitedResult = await pool.query(
      `SELECT COUNT(*) AS confirmed_count FROM certification_prohibited_logs WHERE certification_id = $1`,
      [cert.id]
    );
    const prohibitedConfirmed = parseInt((prohibitedResult.rows[0] as any).confirmed_count) || 0;

    const affirmationSubmitted = ["OPS_REVIEW", "CERTIFIED", "REJECTED"].includes(cert.status);

    const userResult = await pool.query(
      `SELECT business_name FROM users WHERE id = $1 LIMIT 1`,
      [clientId]
    );
    const businessName = (userResult.rows[0] as any)?.business_name ?? null;

    res.json({
      id:                            cert.id,
      status:                        cert.status,
      industry_name:                 cert.industry_name,
      industry_slug:                 cert.industry_slug,
      tier:                          cert.tier,
      certificate_id:                cert.certificate_id,
      client_full_name:              cert.client_full_name,
      business_name:                 businessName,
      specialist_mode_activated_at:  cert.specialist_mode_activated_at,
      ops_signoff_at:                cert.ops_signoff_at,
      training_completed_at:         cert.training_completed_at,
      scenarios_approved:            scenariosApproved,
      prohibited_confirmed:          prohibitedConfirmed,
      affirmation_submitted:         affirmationSubmitted,
      rejection_note:                cert.status === "REJECTED" ? cert.rejection_note : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch certification status" });
  }
});