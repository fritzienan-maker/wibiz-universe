import { Router, type Request, type Response } from "express";
import { requireAuth } from "../_core/auth";
import {
  getExerciseById,
  getModuleById,
  listExercisesByModule,
  getCompletedExerciseIds,
  markExerciseComplete,
  markModuleComplete,
  hasPassedQuiz,
} from "../db";

export const progressRouter = Router();
progressRouter.use(requireAuth);

// ─── POST /api/progress/exercise/:id ─────────────────────────────────────────
// Mark a single exercise complete — requires proof text in body
progressRouter.post(
  "/exercise/:id",
  async (req: Request, res: Response): Promise<void> => {
    const userId     = req.user!.userId;
    const exerciseId = req.params.id!;

    const proofText = (req.body?.proofText ?? "").toString().trim();
    if (!proofText) {
      res.status(400).json({ error: "proof_required", message: "You must submit a proof response before marking this exercise complete." });
      return;
    }

    const exercise = await getExerciseById(exerciseId);
    if (!exercise || !exercise.isActive) {
      res.status(404).json({ error: "Exercise not found" });
      return;
    }

    // Verify exercise is unlocked: either it's the first in its module,
    // or the previous exercise is already complete
    const moduleExercises = await listExercisesByModule(exercise.moduleId, true);
    const idx = moduleExercises.findIndex((e) => e.id === exerciseId);
    if (idx > 0) {
      const prevId    = moduleExercises[idx - 1]!.id;
      const completed = await getCompletedExerciseIds(userId);
      if (!completed.has(prevId)) {
        res.status(400).json({ error: "Complete the previous exercise first" });
        return;
      }
    }

    await markExerciseComplete(userId, exerciseId, proofText);
    res.json({ message: "exercise_complete", exerciseId });
  }
);

// ─── POST /api/progress/module/:id ───────────────────────────────────────────
// Submit module gate sign-off — all exercises done + quiz passed required
progressRouter.post(
  "/module/:id",
  async (req: Request, res: Response): Promise<void> => {
    const userId   = req.user!.userId;
    const moduleId = req.params.id!;

    const mod = await getModuleById(moduleId);
    if (!mod || !mod.isActive) {
      res.status(404).json({ error: "Module not found" });
      return;
    }

    // All active exercises must be complete
    const exercises = await listExercisesByModule(moduleId, true);
    if (exercises.length > 0) {
      const completedIds = await getCompletedExerciseIds(userId);
      const allDone = exercises.every((e) => completedIds.has(e.id));
      if (!allDone) {
        res.status(400).json({ error: "Complete all exercises before submitting the module sign-off" });
        return;
      }
    }

    // Quiz must be passed before gate can be submitted
    const quizPassed = await hasPassedQuiz(userId, moduleId);
    if (!quizPassed) {
      res.status(400).json({ error: "quiz_required", message: "Pass the module quiz before submitting the sign-off." });
      return;
    }

    await markModuleComplete(userId, moduleId);
    res.json({ message: "module_complete", moduleId });
  }
);
