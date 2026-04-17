// ─── ADD THESE ROUTES TO server/routes/admin.ts ───────────────────────────────
// Add after existing module/exercise routes

// GET /api/admin/modules/:moduleId/quiz-questions
adminRouter.get("/modules/:moduleId/quiz-questions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, module_id as "moduleId", question, options, correct_answer_index as "correctAnswerIndex", order_index as "orderIndex", is_active as "isActive"
       FROM quiz_questions WHERE module_id = $1 ORDER BY order_index ASC, created_at ASC`,
      [req.params.moduleId]
    );
    res.json({ questions: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch quiz questions" });
  }
});

// POST /api/admin/modules/:moduleId/quiz-questions
adminRouter.post("/modules/:moduleId/quiz-questions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { question, options, correctAnswerIndex, orderIndex, isActive } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: "question and at least 2 options required" }); return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO quiz_questions (module_id, question, options, correct_answer_index, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.moduleId, question, JSON.stringify(options), correctAnswerIndex ?? 0, orderIndex ?? 0, isActive ?? true]
    );
    res.status(201).json({ question: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create quiz question" });
  }
});

// PUT /api/admin/quiz-questions/:id
adminRouter.put("/quiz-questions/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { question, options, correctAnswerIndex, orderIndex, isActive } = req.body;
  try {
    const result = await pool.query(
      `UPDATE quiz_questions SET question = $1, options = $2, correct_answer_index = $3, order_index = $4, is_active = $5
       WHERE id = $6 RETURNING *`,
      [question, JSON.stringify(options), correctAnswerIndex ?? 0, orderIndex ?? 0, isActive ?? true, req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ question: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update quiz question" });
  }
});

// DELETE /api/admin/quiz-questions/:id
adminRouter.delete("/quiz-questions/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await pool.query(`DELETE FROM quiz_questions WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to delete quiz question" });
  }
});