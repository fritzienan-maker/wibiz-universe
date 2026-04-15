import { Router, type Request, type Response } from "express";
import { Pool } from "pg";
import { z } from "zod";
import { requireAuth } from "../_core/auth";
import { ENV } from "../_core/env";

const pool = new Pool({
  connectionString: ENV.databaseUrl,
  ssl: ENV.isProduction ? { rejectUnauthorized: false } : undefined,
});

export const botCertRouter = Router();
botCertRouter.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  answers: z.record(z.string(), z.enum(["A", "B", "C", "D"])),
  // answers: { "question_id": "A" | "B" | "C" | "D" }
});

// ─── GET /api/client/bot-cert/status ─────────────────────────────────────────
// Returns the client's current bot cert state: not_started | in_progress | passed | failed

botCertRouter.get("/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const result = await pool.query(
      `SELECT * FROM bot_certifications
       WHERE client_id = $1
       ORDER BY attempt_number DESC LIMIT 1`,
      [clientId]
    );

    if (!result.rows.length) {
      res.json({ status: "not_started", attempt_number: 0 });
      return;
    }

    const cert = result.rows[0] as any;
    res.json({
      status:         cert.status.toLowerCase(),
      attempt_number: cert.attempt_number,
      score:          cert.score,
      total_questions: cert.total_questions,
      passed_at:      cert.passed_at,
      completed_at:   cert.completed_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch bot cert status" });
  }
});

// ─── GET /api/client/bot-cert/questions ──────────────────────────────────────
// Returns the 10 questions (no correct answers exposed)
// Gate: academy must be complete (check user_progress or a flag)

botCertRouter.get("/questions", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }

    // Check if client already has a PASSED bot cert
    const existing = await pool.query(
      `SELECT status FROM bot_certifications
       WHERE client_id = $1 AND status = 'PASSED'`,
      [clientId]
    );
    if (existing.rows.length) {
      res.status(400).json({ error: "Bot Certification already passed.", already_passed: true });
      return;
    }

    const questions = await pool.query(
      `SELECT id, question_number, question_text,
              option_a, option_b, option_c, option_d
       FROM bot_cert_questions
       WHERE is_active = true
       ORDER BY question_number ASC`
    );

    res.json({ questions: questions.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch questions" });
  }
});

// ─── POST /api/client/bot-cert/start ─────────────────────────────────────────
// Creates a new bot_certifications attempt record

botCertRouter.post("/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }

    // Block if already passed
    const passed = await pool.query(
      `SELECT id FROM bot_certifications WHERE client_id = $1 AND status = 'PASSED'`,
      [clientId]
    );
    if (passed.rows.length) {
      res.status(400).json({ error: "Bot Certification already passed.", already_passed: true });
      return;
    }

    // Get current attempt number
    const lastAttempt = await pool.query(
      `SELECT MAX(attempt_number) as max_attempt FROM bot_certifications WHERE client_id = $1`,
      [clientId]
    );
    const attemptNumber = ((lastAttempt.rows[0] as any)?.max_attempt ?? 0) + 1;

    const result = await pool.query(
      `INSERT INTO bot_certifications (client_id, attempt_number, status)
       VALUES ($1, $2, 'IN_PROGRESS') RETURNING *`,
      [clientId, attemptNumber]
    );

    res.status(201).json({ certification: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to start bot certification" });
  }
});

// ─── POST /api/client/bot-cert/submit ────────────────────────────────────────
// Submits answers, scores them, marks PASSED or FAILED

botCertRouter.post("/submit", async (req: Request, res: Response): Promise<void> => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const clientId = req.user?.userId;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }

    // Get the active IN_PROGRESS attempt
    const attempt = await pool.query(
      `SELECT * FROM bot_certifications
       WHERE client_id = $1 AND status = 'IN_PROGRESS'
       ORDER BY attempt_number DESC LIMIT 1`,
      [clientId]
    );
    if (!attempt.rows.length) {
      res.status(400).json({ error: "No active bot certification attempt found. Please start first." });
      return;
    }
    const cert = attempt.rows[0] as any;

    // Fetch all questions with correct answers
    const questions = await pool.query(
      `SELECT id, question_number, correct_option
       FROM bot_cert_questions WHERE is_active = true ORDER BY question_number ASC`
    );

    // Score the answers
    let score = 0;
    const answerMap = parsed.data.answers;
    const scoredAnswers: Record<string, { given: string; correct: string; is_correct: boolean }> = {};

    for (const q of questions.rows as any[]) {
      const given = answerMap[q.id];
      const isCorrect = given === q.correct_option;
      if (isCorrect) score++;
      scoredAnswers[q.id] = {
        given:      given ?? "SKIPPED",
        correct:    q.correct_option,
        is_correct: isCorrect,
      };
    }

    const totalQuestions = questions.rows.length;
    const passed = score >= 8; // v6.0: 8/10 pass threshold
    const newStatus = passed ? "PASSED" : "FAILED";

    // Update the certification record
    await pool.query(
      `UPDATE bot_certifications SET
        status          = $1,
        score           = $2,
        total_questions = $3,
        answers         = $4,
        completed_at    = NOW(),
        passed_at       = $5,
        updated_at      = NOW()
       WHERE id = $6`,
      [
        newStatus,
        score,
        totalQuestions,
        JSON.stringify(scoredAnswers),
        passed ? new Date() : null,
        cert.id,
      ]
    );

    // Fetch questions with explanations for the result screen
    const questionsWithDetails = await pool.query(
      `SELECT id, question_number, question_text,
              option_a, option_b, option_c, option_d,
              correct_option, explanation
       FROM bot_cert_questions WHERE is_active = true ORDER BY question_number ASC`
    );

    res.json({
      passed,
      score,
      total_questions:   totalQuestions,
      pass_threshold:    8,
      status:            newStatus,
      scored_answers:    scoredAnswers,
      questions:         questionsWithDetails.rows,
      attempt_number:    cert.attempt_number,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to submit bot certification" });
  }
});