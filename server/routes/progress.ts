import { Router, type Request, type Response } from "express";
import { requireAuth } from "../_core/auth";
import {
  getExerciseById,
  getModuleById,
  listExercisesByModule,
  getSubmittedExerciseIds,
  getApprovedExerciseIds,
  submitExerciseProof,
  markModuleComplete,
  hasPassedQuiz,
} from "../db";

export const progressRouter = Router();
progressRouter.use(requireAuth);

// ─── POST /api/progress/exercise/:id ─────────────────────────────────────────
// Submit (or re-submit) proof for an exercise — sets status to pending_review
progressRouter.post(
  "/exercise/:id",
  async (req: Request, res: Response): Promise<void> => {
    const userId     = req.user!.userId;
    const exerciseId = req.params.id!;

    const proofText    = (req.body?.proofText ?? "").toString().trim();
    const proofImageUrl = (req.body?.proofImageUrl ?? "").toString().trim() || null;

    if (!proofText) {
      res.status(400).json({ error: "proof_required", message: "A written proof response is required." });
      return;
    }

    const exercise = await getExerciseById(exerciseId);
    if (!exercise || !exercise.isActive) {
      res.status(404).json({ error: "Exercise not found" });
      return;
    }

    // Unlock check: exercise is unlocked if it is first in its module,
    // or if the previous exercise has been submitted (any status).
    const moduleExercises = await listExercisesByModule(exercise.moduleId, true);
    const idx = moduleExercises.findIndex((e) => e.id === exerciseId);
    if (idx > 0) {
      const prevId    = moduleExercises[idx - 1]!.id;
      const submitted = await getSubmittedExerciseIds(userId);
      if (!submitted.has(prevId)) {
        res.status(400).json({ error: "Complete the previous exercise first" });
        return;
      }
    }

    const submission = await submitExerciseProof(userId, exerciseId, proofText, proofImageUrl);
    res.json({ message: "submitted_for_review", exerciseId, submissionId: submission.id });
  }
);

// ─── POST /api/progress/module/:id ───────────────────────────────────────────
// Submit module gate sign-off — all exercises APPROVED + quiz passed required
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

    // All active exercises must be approved (not just submitted)
    const exercises = await listExercisesByModule(moduleId, true);
    if (exercises.length > 0) {
      const approvedIds = await getApprovedExerciseIds(userId);
      const allApproved = exercises.every((e) => approvedIds.has(e.id));
      if (!allApproved) {
        res.status(400).json({ error: "All exercises must be approved by staff before submitting the module sign-off" });
        return;
      }
    }

    const quizPassed = await hasPassedQuiz(userId, moduleId);
    if (!quizPassed) {
      res.status(400).json({ error: "quiz_required", message: "Pass the module quiz before submitting the sign-off." });
      return;
    }

    await markModuleComplete(userId, moduleId);
    res.json({ message: "module_complete", moduleId });
  }
);
