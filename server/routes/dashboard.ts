import { Router, type Request, type Response } from "express";
import { requireAuth } from "../_core/auth";
import {
  getUserById,
  listModules,
  listExercisesByModule,
  getCompletedExerciseIds,
  getCompletedModuleIds,
  hasPassedQuiz,
} from "../db";

export const dashboardRouter = Router();

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
dashboardRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [allModules, completedExerciseIds, completedModuleIds] = await Promise.all([
      listModules(true),
      getCompletedExerciseIds(req.user!.userId),
      getCompletedModuleIds(req.user!.userId),
    ]);

    // Fetch exercises and quiz pass status for all modules in parallel
    const [exerciseLists, quizPassedFlags] = await Promise.all([
      Promise.all(allModules.map((m) => listExercisesByModule(m.id, true))),
      Promise.all(allModules.map((m) => hasPassedQuiz(req.user!.userId, m.id))),
    ]);

    // Build enriched module list with status and exercise unlock logic
    let prevGateSubmitted = true; // first module is always available

    const modules = allModules.map((m, i) => {
      const exs          = exerciseLists[i]!;
      const gateSubmitted = completedModuleIds.has(m.id);
      const quizPassed    = quizPassedFlags[i]!;

      // Determine module status
      let status: "available" | "locked" | "complete";
      if (!prevGateSubmitted) {
        status = "locked";
      } else if (gateSubmitted) {
        status = "complete";
      } else {
        status = "available";
      }

      // Exercises: sequential unlock within available/complete modules
      const exercises = exs.map((ex, j) => {
        const isComplete = completedExerciseIds.has(ex.id);
        let isUnlocked = false;
        if (status !== "locked") {
          if (j === 0) {
            isUnlocked = true;
          } else {
            isUnlocked = completedExerciseIds.has(exs[j - 1]!.id);
          }
        }
        return {
          id:          ex.id,
          title:       ex.title,
          description: ex.description,
          proofPrompt: ex.proofPrompt,
          dayNumber:   ex.dayNumber,
          orderIndex:  ex.orderIndex,
          isComplete,
          isUnlocked,
        };
      });

      const completedCount  = exercises.filter((e) => e.isComplete).length;
      const allExercisesDone = exs.length > 0 && completedCount === exs.length;

      prevGateSubmitted = gateSubmitted;

      return {
        id:                  m.id,
        title:               m.title,
        description:         m.description,
        dayStart:            m.dayStart,
        dayEnd:              m.dayEnd,
        orderIndex:          m.orderIndex,
        status,
        gateSubmitted,
        allExercisesDone,
        quizPassed,
        exercises,
        completedExercises:  completedCount,
        totalExercises:      exs.length,
      };
    });

    const totalExercises = modules.reduce((s, m) => s + m.totalExercises, 0);
    const completedExs   = modules.reduce((s, m) => s + m.completedExercises, 0);
    const completedMods  = modules.filter((m) => m.gateSubmitted).length;

    res.json({
      user: {
        id:           user.id,
        firstName:    user.firstName,
        lastName:     user.lastName,
        email:        user.email,
        role:         user.role,
        planTier:     user.planTier,
        vertical:     user.vertical,
        hskdRequired: user.hskdRequired,
      },
      modules,
      stats: {
        totalExercises,
        completedExercises: completedExs,
        completedModules:   completedMods,
        totalModules:       modules.length,
        progressPct:        totalExercises > 0 ? Math.round((completedExs / totalExercises) * 100) : 0,
      },
    });
  }
);
