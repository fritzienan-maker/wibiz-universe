import { Router, type Request, type Response } from "express";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireAuth, requireAdmin } from "../_core/auth";
import {
  getUserById,
  listBotCertQuestionsForClient,
  listBotCertQuestionsWithAnswers,
  getLatestBotCertResponse,
  saveBotCertResponse,
  setBotCertPassed,
  listHskdCertQuestions,
  getLatestHskdCertResponse,
  saveHskdCertResponse,
  approveHskdResponse,
  setHskdPassed,
  getUserCertificates,
  getCertificateById,
  generateCertNumber,
  createCertificate,
  checkAndIssueClearpath,
  listPendingHskdResponses,
} from "../db";

export const certificationRouter = Router();
certificationRouter.use(requireAuth);

// ─── GET /api/certification/bot ───────────────────────────────────────────────
// Returns questions (no correct answers) + last attempt summary
// Gate: academy_completed = true
certificationRouter.get(
  "/bot",
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (!user.academyCompleted) {
      res.status(423).json({
        error:   "academy_incomplete",
        message: "Complete the WiBiz Academy - 30-Module Activation Programme before taking Bot Certification.",
      });
      return;
    }

    const questions   = await listBotCertQuestionsForClient();
    const lastAttempt = await getLatestBotCertResponse(user.id);

    res.json({
      questions,
      passed: user.botCertPassed ?? false,
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

// ─── POST /api/certification/bot ──────────────────────────────────────────────
// Body: { answers: number[] }  — array of selected option indices
// Pass threshold: 8 / 10
certificationRouter.post(
  "/bot",
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (!user.academyCompleted) {
      res.status(423).json({ error: "academy_incomplete", message: "Complete the Academy first." });
      return;
    }
    if (user.botCertPassed) {
      res.status(400).json({ error: "already_passed", message: "Bot Certification already passed." });
      return;
    }

    const answers: unknown = req.body?.answers;
    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: "answers array is required" });
      return;
    }

    const questions = await listBotCertQuestionsWithAnswers();
    if (questions.length === 0) {
      res.status(503).json({ error: "no_questions", message: "Bot Certification questions have not been configured yet." });
      return;
    }
    if (answers.length !== questions.length) {
      res.status(400).json({ error: `Expected ${questions.length} answers, got ${answers.length}` });
      return;
    }

    // Score server-side
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      if (Number(answers[i]) === questions[i]!.correctAnswerIndex) score++;
    }

    const response = await saveBotCertResponse(user.id, answers as number[], score, questions.length);

    if (response.passed) {
      await setBotCertPassed(user.id);

      // Issue Bot Cert certificate
      const certNumber = await generateCertNumber();
      await createCertificate(user.id, "bot_cert", certNumber);

      // Check if ClearPath can now be issued (hskd not required)
      const freshUser = await getUserById(user.id);
      if (freshUser) await checkAndIssueClearpath(user.id, freshUser);
    }

    res.json({
      score,
      totalQuestions: questions.length,
      passed:         response.passed,
      passedAt:       response.passedAt,
      message: response.passed
        ? "Bot Certification passed. Your certificate has been issued."
        : `Score: ${score}/${questions.length}. You need 8/10 to pass. Please try again.`,
    });
  }
);

// ─── GET /api/certification/hskd ─────────────────────────────────────────────
// Returns HSKD scenarios + last submission status
// Gates: hskd_required = true AND bot_cert_passed = true
certificationRouter.get(
  "/hskd",
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (!user.hskdRequired) {
      res.status(403).json({ error: "not_required", message: "HSKD Certification is not required for your account." });
      return;
    }
    if (!user.botCertPassed) {
      res.status(423).json({ error: "bot_cert_required", message: "Complete Bot Certification before starting HSKD." });
      return;
    }

    const questions   = await listHskdCertQuestions();
    const lastAttempt = await getLatestHskdCertResponse(user.id);

    res.json({
      questions,
      passed: user.hskdPassed ?? false,
      lastAttempt: lastAttempt
        ? {
            id:            lastAttempt.id,
            hasRejection:  lastAttempt.hasRejection,
            adminApproved: lastAttempt.adminApproved,
            flaggedAt:     lastAttempt.flaggedAt,
          }
        : null,
    });
  }
);

// ─── POST /api/certification/hskd ────────────────────────────────────────────
// Body: { answers: ("approve" | "reject")[] }
// Any REJECT → flagged for review
// All APPROVE → pending admin approval
certificationRouter.post(
  "/hskd",
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (!user.hskdRequired)  { res.status(403).json({ error: "not_required" }); return; }
    if (!user.botCertPassed) { res.status(423).json({ error: "bot_cert_required" }); return; }
    if (user.hskdPassed)     { res.status(400).json({ error: "already_passed", message: "HSKD Certification already passed." }); return; }

    const answers: unknown = req.body?.answers;
    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: "answers array is required" });
      return;
    }

    const validAnswers = (answers as string[]).every((a) => a === "approve" || a === "reject");
    if (!validAnswers) {
      res.status(400).json({ error: "Each answer must be 'approve' or 'reject'" });
      return;
    }

    const questions = await listHskdCertQuestions();
    if (answers.length !== questions.length) {
      res.status(400).json({ error: `Expected ${questions.length} answers, got ${answers.length}` });
      return;
    }

    const response = await saveHskdCertResponse(user.id, answers as ("approve" | "reject")[]);

    if (response.hasRejection) {
      res.json({
        status:  "flagged",
        message: "One or more scenarios were rejected. Your submission has been flagged for review. A WiBiz team member will contact you.",
      });
    } else {
      res.json({
        status:  "pending_approval",
        message: "All scenarios approved. Your submission is pending WiBiz admin review before certification is issued.",
      });
    }
  }
);

// ─── GET /api/certification/certificates ─────────────────────────────────────
certificationRouter.get(
  "/certificates",
  async (req: Request, res: Response): Promise<void> => {
    const certs = await getUserCertificates(req.user!.userId);
    res.json({ certificates: certs });
  }
);

// ─── GET /api/certification/download/:certId ─────────────────────────────────
certificationRouter.get(
  "/download/:certId",
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const cert   = await getCertificateById(req.params.certId!);

    if (!cert || cert.userId !== userId) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }

    const user = await getUserById(userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const pdfBytes = await buildCertPdf({
      certNumber: cert.certNumber ?? "—",
      type:       cert.type as "academy" | "bot_cert" | "hskd_cert" | "clearpath",
      firstName:  user.firstName ?? "",
      lastName:   user.lastName  ?? "",
      email:      user.email,
      vertical:   user.vertical  ?? "",
      issuedAt:   cert.issuedAt  ?? new Date(),
    });

    const typeLabel: Record<string, string> = {
      academy:   "Academy-Completion",
      bot_cert:  "Bot-Certification",
      hskd_cert: "HSKD-Certification",
      clearpath: "ClearPath-Certificate",
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="WiBiz-${typeLabel[cert.type] ?? cert.type}-${cert.certNumber}.pdf"`,
    );
    res.end(Buffer.from(pdfBytes));
  }
);

// ─── Admin: list pending HSKD responses ──────────────────────────────────────
certificationRouter.get(
  "/admin/hskd-pending",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await listPendingHskdResponses();
    res.json({ responses: rows });
  }
);

// ─── Admin: approve HSKD response ─────────────────────────────────────────────
certificationRouter.post(
  "/admin/hskd-approve/:responseId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const adminId    = req.user!.userId;
    const responseId = req.params.responseId!;

    const updated = await approveHskdResponse(responseId, adminId);
    if (!updated) {
      res.status(404).json({ error: "Response not found" });
      return;
    }

    await setHskdPassed(updated.userId);
    const certNumber = await generateCertNumber();
    await createCertificate(updated.userId, "hskd_cert", certNumber);

    const freshUser = await getUserById(updated.userId);
    if (freshUser) await checkAndIssueClearpath(updated.userId, freshUser);

    res.json({ message: "HSKD Certification approved. Certificate issued.", responseId });
  }
);

// ─── PDF builder ──────────────────────────────────────────────────────────────
async function buildCertPdf(data: {
  certNumber: string;
  type:       "academy" | "bot_cert" | "hskd_cert" | "clearpath";
  firstName:  string;
  lastName:   string;
  email:      string;
  vertical:   string;
  issuedAt:   Date;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([792, 612]); // landscape letter
  const { width, height } = page.getSize();

  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const navy  = rgb(0.067, 0.133, 0.267); // #112244
  const gold  = rgb(0.776, 0.620, 0.224); // #C69E39
  const grey  = rgb(0.4,   0.4,   0.4);
  const white = rgb(1,     1,     1);

  const certLabels: Record<string, string> = {
    academy:   "Academy Completion Certificate",
    bot_cert:  "Bot Certification",
    hskd_cert: "HSKD Certification",
    clearpath: "ClearPath Certificate",
  };
  const certLabel = certLabels[data.type] ?? data.type;

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: white });

  // Navy header band
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: navy });

  // Gold accent line
  page.drawRectangle({ x: 0, y: height - 84, width, height: 4, color: gold });

  // Navy footer band
  page.drawRectangle({ x: 0, y: 0, width, height: 50, color: navy });

  // Header text
  page.drawText("WiBiz Universe", {
    x: 40, y: height - 52,
    size: 26, font: fontBold, color: white,
  });
  page.drawText("WiBiz Academy", {
    x: width - 190, y: height - 52,
    size: 16, font: fontNormal, color: gold,
  });

  // Certificate body
  page.drawText("This is to certify that", {
    x: width / 2 - 80, y: height - 140,
    size: 13, font: fontNormal, color: grey,
  });

  const fullName = `${data.firstName} ${data.lastName}`.trim() || data.email;
  const nameSize = fullName.length > 30 ? 28 : 34;
  const nameWidth = fontBold.widthOfTextAtSize(fullName, nameSize);
  page.drawText(fullName, {
    x: (width - nameWidth) / 2, y: height - 195,
    size: nameSize, font: fontBold, color: navy,
  });

  // Gold underline beneath name
  page.drawRectangle({
    x: (width - nameWidth) / 2, y: height - 204,
    width: nameWidth, height: 2, color: gold,
  });

  page.drawText("has successfully completed the", {
    x: width / 2 - 102, y: height - 235,
    size: 13, font: fontNormal, color: grey,
  });

  const certLabelWidth = fontBold.widthOfTextAtSize(certLabel, 22);
  page.drawText(certLabel, {
    x: (width - certLabelWidth) / 2, y: height - 270,
    size: 22, font: fontBold, color: navy,
  });

  page.drawText("WiBiz Academy - 30-Module Activation Programme", {
    x: width / 2 - 167, y: height - 305,
    size: 12, font: fontNormal, color: grey,
  });

  if (data.vertical) {
    const vLabel = `Vertical: ${data.vertical.charAt(0).toUpperCase() + data.vertical.slice(1)}`;
    const vWidth = fontNormal.widthOfTextAtSize(vLabel, 11);
    page.drawText(vLabel, {
      x: (width - vWidth) / 2, y: height - 328,
      size: 11, font: fontNormal, color: grey,
    });
  }

  // Divider
  page.drawRectangle({ x: 60, y: height - 375, width: width - 120, height: 1, color: gold });

  // Date + cert number
  const dateStr = data.issuedAt.toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric",
  });
  page.drawText(`Date Issued: ${dateStr}`, {
    x: 80, y: height - 410,
    size: 11, font: fontNormal, color: grey,
  });
  page.drawText(`Certificate ID: ${data.certNumber}`, {
    x: width - 280, y: height - 410,
    size: 11, font: fontNormal, color: grey,
  });

  // Footer
  page.drawText("universe.wibiz.ai  ·  WiBiz Universe", {
    x: width / 2 - 105, y: 18,
    size: 10, font: fontNormal, color: white,
  });

  return pdfDoc.save();
}