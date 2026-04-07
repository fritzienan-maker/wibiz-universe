import { Router, type Request, type Response } from "express";
import { requireAuth } from "../_core/auth";
import {
  getModuleById,
  listQuizQuestionsForClient,
  listQuizQuestionsWithAnswers,
  getLatestQuizResponse,
  saveQuizResponse,
  getSubmittedExerciseIds,
  listExercisesByModule,
} from "../db";

export const quizRouter = Router();
quizRouter.use(requireAuth);

// ─── GET /api/quiz/module/:id ─────────────────────────────────────────────────
// Returns quiz questions for a module WITHOUT exposing the correct answer
quizRouter.get(
  "/module/:id",
  async (req: Request, res: Response): Promise<void> => {
    const userId   = req.user!.userId;
    const moduleId = req.params.id!;

    const mod = await getModuleById(moduleId);
    if (!mod || !mod.isActive) {
      res.status(404).json({ error: "Module not found" });
      return;
    }

    // Quiz only available once all exercises in the module are complete
    const exercises    = await listExercisesByModule(moduleId, true);
    const completedIds = await getSubmittedExerciseIds(userId);
    const allDone      = exercises.length > 0 && exercises.every((e) => completedIds.has(e.id));
    if (!allDone) {
      res.status(400).json({ error: "quiz_locked", message: "Complete all exercises in this module to unlock the quiz." });
      return;
    }

    const questions   = await listQuizQuestionsForClient(moduleId);
    const lastAttempt = await getLatestQuizResponse(userId, moduleId);

    res.json({
      moduleId,
      questions,
      lastAttempt: lastAttempt
        ? {
            score:          lastAttempt.score,
            totalQuestions: lastAttempt.totalQuestions,
            passed:         lastAttempt.passed,
            passedAt:       lastAttempt.passedAt,
          }
        : null,
    });
  }
);

// ─── POST /api/quiz/module/:id ────────────────────────────────────────────────
// Submit quiz answers. Body: { answers: number[] } — array of selected option indices
quizRouter.post(
  "/module/:id",
  async (req: Request, res: Response): Promise<void> => {
    const userId   = req.user!.userId;
    const moduleId = req.params.id!;

    const mod = await getModuleById(moduleId);
    if (!mod || !mod.isActive) {
      res.status(404).json({ error: "Module not found" });
      return;
    }

    const answers: unknown = req.body?.answers;
    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: "answers array is required" });
      return;
    }

    // Exercises must all be complete before quiz can be submitted
    const exercises    = await listExercisesByModule(moduleId, true);
    const completedIds = await getSubmittedExerciseIds(userId);
    const allDone      = exercises.length > 0 && exercises.every((e) => completedIds.has(e.id));
    if (!allDone) {
      res.status(400).json({ error: "quiz_locked", message: "Complete all exercises before taking the quiz." });
      return;
    }

    const questions = await listQuizQuestionsWithAnswers(moduleId);
    if (answers.length !== questions.length) {
      res.status(400).json({ error: `Expected ${questions.length} answers, got ${answers.length}` });
      return;
    }

    // Score the quiz
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      if (Number(answers[i]) === questions[i]!.correctAnswerIndex) score++;
    }

    const response = await saveQuizResponse(userId, moduleId, answers as number[], score, questions.length);

    res.json({
      score,
      totalQuestions: questions.length,
      passed:         response.passed,
      passedAt:       response.passedAt,
      message:        response.passed
        ? "Quiz passed — you can now submit the module sign-off."
        : `Quiz not passed (${score}/${questions.length}). You need at least ${Math.ceil(questions.length * 0.6)}/${questions.length} to pass. Try again.`,
    });
  }
);
