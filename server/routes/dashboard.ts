import { Router, type Request, type Response } from "express";
import { requireAuth } from "../_core/auth";
import {
  getUserById,
  listModules,
  listExercisesByModule,
  getApprovedExerciseIds,
  getSubmittedExerciseIds,
  getAllExerciseSubmissions,
  getCompletedModuleIds,
  hasPassedQuiz,
  getUserCertificates,
  checkAndSetAcademyComplete,
} from "../db";

export const dashboardRouter = Router();

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
dashboardRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const uid = req.user!.userId;

    const [allModules, approvedIds, submittedIds, submissions, completedModuleIds] = await Promise.all([
      listModules(true),
      getApprovedExerciseIds(uid),
      getSubmittedExerciseIds(uid),
      getAllExerciseSubmissions(uid),
      getCompletedModuleIds(uid),
    ]);

    // Fetch exercises and quiz pass status for all modules in parallel
    const [exerciseLists, quizPassedFlags] = await Promise.all([
      Promise.all(allModules.map((m) => listExercisesByModule(m.id, true))),
      Promise.all(allModules.map((m) => hasPassedQuiz(uid, m.id))),
    ]);

    let prevGateSubmitted = true; // first module is always available

    const modules = allModules.map((m, i) => {
      const exs           = exerciseLists[i]!;
      const gateSubmitted = completedModuleIds.has(m.id);
      const quizPassed    = quizPassedFlags[i]!;

      let status: "available" | "locked" | "complete";
      if (!prevGateSubmitted) {
        status = "locked";
      } else if (gateSubmitted) {
        status = "complete";
      } else {
        status = "available";
      }

      const exercises = exs.map((ex, j) => {
        const submission = submissions.get(ex.id) ?? null;
        const isComplete = approvedIds.has(ex.id);

        // Unlock chain uses submitted IDs — client can progress while awaiting review
        let isUnlocked = false;
        if (status !== "locked") {
          if (j === 0) {
            isUnlocked = true;
          } else {
            isUnlocked = submittedIds.has(exs[j - 1]!.id);
          }
        }

        return {
          id:               ex.id,
          title:            ex.title,
          description:      ex.description,
          proofPrompt:      ex.proofPrompt,
          videoUrl:         ex.videoUrl ?? null,
          dayNumber:        ex.dayNumber,
          orderIndex:       ex.orderIndex,
          isComplete,
          isUnlocked,
          submissionStatus: submission?.submissionStatus ?? null,
          proofText:        submission?.proofText ?? null,
          proofImageUrl:    submission?.proofImageUrl ?? null,
          reviewNote:       submission?.reviewNote ?? null,
        };
      });

      const approvedCount         = exercises.filter((e) => e.isComplete).length;
      const allExercisesDone      = exs.length > 0 && approvedCount === exs.length;
      // Quiz unlocks when all exercises are submitted (pending OK), not just approved
      const allExercisesSubmitted = exs.length > 0 && exs.every((e) => submittedIds.has(e.id));

      prevGateSubmitted = gateSubmitted;

      return {
        id:                   m.id,
        title:                m.title,
        description:          m.description,
        dayStart:             m.dayStart,
        dayEnd:               m.dayEnd,
        orderIndex:           m.orderIndex,
        status,
        gateSubmitted,
        allExercisesDone,
        allExercisesSubmitted,
        quizPassed,
        exercises,
        completedExercises:   approvedCount,
        totalExercises:       exs.length,
      };
    });

    const totalExercises = modules.reduce((s, m) => s + m.totalExercises, 0);
    const completedExs   = modules.reduce((s, m) => s + m.completedExercises, 0);
    const completedMods  = modules.filter((m) => m.gateSubmitted).length;

    // ── Check & set academy_completed if all gates done ──────────────────────
    if (completedMods === allModules.length && allModules.length > 0) {
      await checkAndSetAcademyComplete(uid);
      // Re-fetch user to get updated flags
      const freshUser = await getUserById(uid);
      if (freshUser) Object.assign(user, freshUser);
    }

    // ── Build certifications summary ─────────────────────────────────────────
    const certs = await getUserCertificates(uid);

    const findCert = (type: string) => {
      const c = certs.find((x) => x.type === type);
      return c
        ? { passed: true, issuedAt: c.issuedAt, certNumber: c.certNumber, certId: c.id }
        : { passed: false, issuedAt: null, certNumber: null, certId: null };
    };

    const academyComplete = user.academyCompleted ?? false;
    const certifications = {
      academyComplete,
      academyCert: { ...findCert("academy"), issued: academyComplete },
      botCert:     findCert("bot_cert"),
      hskdCert:    user.hskdRequired ? findCert("hskd_cert") : null,
      clearpath:   { ...findCert("clearpath"), issued: user.clearpathIssued ?? false },
    };

    res.json({
      user: {
        id:               user.id,
        firstName:        user.firstName,
        lastName:         user.lastName,
        email:            user.email,
        role:             user.role,
        planTier:         user.planTier,
        vertical:         user.vertical,
        hskdRequired:     user.hskdRequired,
        avatarUrl:        user.avatarUrl ?? null,
        // ── Cert gate flags ──
        academyCompleted: user.academyCompleted ?? false,
        botCertPassed:    user.botCertPassed    ?? false,
        hskdPassed:       user.hskdPassed       ?? false,
        clearpathIssued:  user.clearpathIssued  ?? false,
      },
      modules,
      stats: {
        totalExercises,
        completedExercises: completedExs,
        completedModules:   completedMods,
        totalModules:       modules.length,
        progressPct: totalExercises > 0 ? Math.round((completedExs / totalExercises) * 100) : 0,
      },
      certifications,
    });
  }
);