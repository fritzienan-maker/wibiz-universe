import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { useTheme } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Exercise {
  id:               string;
  title:            string;
  description:      string | null;
  proofPrompt:      string | null;
  videoUrl:         string | null;
  dayNumber:        number | null;
  orderIndex:       number;
  isComplete:       boolean;
  isUnlocked:       boolean;
  submissionStatus: "pending_review" | "approved" | "rejected" | null;
  proofText:        string | null;
  proofImageUrl:    string | null;
  reviewNote:       string | null;
}

interface Module {
  id:                    string;
  title:                 string;
  description:           string | null;
  dayStart:              number | null;
  dayEnd:                number | null;
  orderIndex:            number;
  status:                "available" | "locked" | "complete";
  gateSubmitted:         boolean;
  allExercisesDone:      boolean;
  allExercisesSubmitted: boolean;
  quizPassed:            boolean;
  exercises:             Exercise[];
  completedExercises:    number;
  totalExercises:        number;
}

interface DashboardData {
  user: {
    id:           string;
    firstName:    string | null;
    lastName:     string | null;
    email:        string;
    role:         string;
    planTier:     string | null;
    vertical:     string | null;
    hskdRequired: boolean | null;
    avatarUrl:    string | null;
  };
  modules: Module[];
  stats: {
    totalExercises:     number;
    completedExercises: number;
    completedModules:   number;
    totalModules:       number;
    progressPct:        number;
  };
}

interface QuizQuestion {
  id:         string;
  question:   string;
  options:    string[];
  orderIndex: number;
}

interface QuizState {
  moduleId:    string;
  questions:   QuizQuestion[];
  lastAttempt: { score: number; totalQuestions: number; passed: boolean; passedAt: string | null } | null;
}

type Tab = "dashboard" | "programme" | "team" | "resources" | "support" | "account";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(first: string | null, last: string | null, email: string) {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function capitalize(s: string | null) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Video embed helper ───────────────────────────────────────────────────────
function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("loom.com")) {
      return url.replace("loom.com/share/", "loom.com/embed/");
    }
    if (u.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Cloudinary unsigned upload ───────────────────────────────────────────────
async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
  const preset    = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string) ?? "wibiz_academy";
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", preset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body:   fd,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url as string;
}

// ─── Exercise proof form ──────────────────────────────────────────────────────
function ExerciseProofForm({
  exercise,
  onSubmit,
  submitting,
}: {
  exercise:   Exercise;
  onSubmit:   (exerciseId: string, proofText: string, proofImageUrl: string | null) => Promise<void>;
  submitting: string | null;
}) {
  const [open,      setOpen]      = useState(false);
  const [proofText, setProofText] = useState(exercise.proofText ?? "");
  const [imageUrl,  setImageUrl]  = useState(exercise.proofImageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [error,     setError]     = useState("");

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const status     = exercise.submissionStatus;
  const isApproved = status === "approved";
  const isPending  = status === "pending_review";
  const isRejected = status === "rejected";
  const hasSubmission = status !== null;

  // Keep form in sync if parent reloads data
  useEffect(() => {
    setProofText(exercise.proofText ?? "");
    setImageUrl(exercise.proofImageUrl ?? "");
  }, [exercise.proofText, exercise.proofImageUrl]);

  const embedUrl = exercise.videoUrl ? getVideoEmbedUrl(exercise.videoUrl) : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cloudName) return;
    setUploading(true);
    setUploadErr("");
    try {
      const url = await uploadToCloudinary(file);
      setImageUrl(url);
    } catch {
      setUploadErr("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!exercise.isUnlocked) {
    return (
      <div className="p-ex-row" style={{ opacity: 0.45 }}>
        <div className="p-ex-check ec-lock" />
        <div className="p-ex-label locked">
          {exercise.dayNumber ? `Day ${exercise.dayNumber} — ` : ""}
          {exercise.title.replace(/^Day \d+ — /, "")}
        </div>
        <div className="p-ex-day">Locked</div>
      </div>
    );
  }

  const checkClass = isApproved ? "ec-done" : isPending ? "ec-pend" : isRejected ? "ec-rej" : "ec-active";
  const checkIcon  = isApproved ? "✓"       : isPending ? "⋯"      : isRejected ? "!"      : open ? "▾" : "○";
  const rowColor   = isApproved ? "var(--g-t)" : isPending ? "var(--am)" : isRejected ? "var(--r-t)" : "var(--b400)";
  const rowLabel   = isApproved ? "Approved ✓" : isPending ? "Pending review…" : isRejected ? "Rejected — re-submit" : open ? "Collapse" : "Submit proof →";

  return (
    <div className="p-proof-wrap">
      <div className="p-ex-row" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div className={`p-ex-check ${checkClass}`}>{checkIcon}</div>
        <div className="p-ex-label">
          {exercise.dayNumber ? `Day ${exercise.dayNumber} — ` : ""}
          {exercise.title.replace(/^Day \d+ — /, "")}
        </div>
        <div className="p-ex-day" style={{ color: rowColor }}>{rowLabel}</div>
      </div>

      {open && (
        <div className="p-proof-form">
          {/* Video embed */}
          {exercise.videoUrl && (
            <div className="p-video-wrap">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Exercise video"
                />
              ) : (
                <a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer" className="p-video-link">
                  ▶ Watch Video
                </a>
              )}
            </div>
          )}

          {exercise.description && (
            <div className="p-proof-desc">{exercise.description}</div>
          )}

          {/* Status row */}
          <div className="p-sub-status-row">
            {isApproved && <span className="p-badge b-done">Approved</span>}
            {isPending  && <span className="p-badge b-pend">Pending Review</span>}
            {isRejected && <span className="p-badge b-rej">Rejected — Please Re-submit</span>}
            {!hasSubmission && <span style={{ fontSize: 12, color: "var(--ts)" }}>Not yet submitted</span>}
          </div>

          {/* Rejection feedback */}
          {isRejected && exercise.reviewNote && (
            <div className="p-reject-note">
              <strong>Staff feedback:</strong> {exercise.reviewNote}
            </div>
          )}

          {/* Screenshot preview */}
          {imageUrl && (
            <div className="p-img-preview">
              <img src={imageUrl} alt="Proof screenshot" />
              <button className="p-img-remove" onClick={() => setImageUrl("")}>✕ Remove</button>
            </div>
          )}

          {/* Proof text */}
          {exercise.proofPrompt && (
            <label className="p-proof-label">{exercise.proofPrompt}</label>
          )}
          <textarea
            className="p-proof-ta"
            rows={4}
            placeholder="Describe what you did, what you noticed, or paste your results here…"
            value={proofText}
            onChange={(e) => { setProofText(e.target.value); setError(""); }}
          />

          {/* Screenshot upload (only shown if Cloudinary is configured) */}
          {cloudName && (
            <div className="p-img-upload-row">
              <label className="p-img-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={handleFileChange}
                />
                {uploading ? "Uploading…" : imageUrl ? "Replace screenshot" : "📎 Attach screenshot"}
              </label>
              {uploadErr && <span style={{ fontSize: 12, color: "var(--r-t)" }}>{uploadErr}</span>}
            </div>
          )}

          {error && <div className="p-proof-err">{error}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
            <button className="p-btn-ghost" onClick={() => { setOpen(false); setError(""); }}>
              Collapse
            </button>
            <button
              className={`p-btn ${isRejected ? "p-btn-amber" : "p-btn-blue"}`}
              disabled={submitting === exercise.id || uploading}
              onClick={async () => {
                if (!proofText.trim()) {
                  setError("A written proof response is required.");
                  return;
                }
                await onSubmit(exercise.id, proofText.trim(), imageUrl || null);
              }}
            >
              {submitting === exercise.id
                ? "Saving…"
                : isApproved
                ? "Update Submission →"
                : hasSubmission
                ? "Re-submit for Review →"
                : "Submit for Review →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quiz panel ───────────────────────────────────────────────────────────────
function QuizPanel({
  moduleId,
  onQuizPassed,
}: {
  moduleId:     string;
  onQuizPassed: () => void;
}) {
  const [quiz,      setQuiz]      = useState<QuizState | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState<Record<string, number>>({});
  const [result,    setResult]    = useState<{ score: number; total: number; passed: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState("");

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<QuizState>(`/quiz/module/${moduleId}`);
      setQuiz(data);
      if (data.lastAttempt?.passed) {
        setResult({
          score:   data.lastAttempt.score,
          total:   data.lastAttempt.totalQuestions,
          passed:  true,
          message: "Quiz already passed.",
        });
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message ?? "Failed to load quiz.");
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  const submitQuiz = async () => {
    if (!quiz) return;
    const answers = quiz.questions.map((q) => selected[q.id] ?? -1);
    if (answers.some((a) => a === -1)) {
      setError("Answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch<{ score: number; totalQuestions: number; passed: boolean; message: string }>(
        `/quiz/module/${moduleId}`,
        { method: "POST", body: JSON.stringify({ answers }) }
      );
      setResult({ score: res.score, total: res.totalQuestions, passed: res.passed, message: res.message });
      if (res.passed) onQuizPassed();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message ?? "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-quiz-box"><div style={{ color: "var(--ts)", fontSize: 13 }}>Loading quiz…</div></div>;

  if (!quiz) {
    return (
      <div className="p-quiz-box">
        <div className="p-quiz-hdr">
          <span className="p-quiz-icon">?</span>
          <div>
            <div className="p-quiz-title">Module Quiz</div>
            <div className="p-quiz-sub">Unlock after completing all exercises</div>
          </div>
          <button className="p-btn p-btn-blue" onClick={loadQuiz}>Load Quiz →</button>
        </div>
        {error && <div className="p-proof-err" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div className="p-quiz-box">
      <div className="p-quiz-hdr">
        <span className="p-quiz-icon">?</span>
        <div>
          <div className="p-quiz-title">Module Quiz — {quiz.questions.length} questions</div>
          <div className="p-quiz-sub">Pass with 60%+ to unlock the module sign-off</div>
        </div>
        {result?.passed && <span className="p-badge b-done">Passed</span>}
        {result && !result.passed && <span className="p-badge b-warn">{result.score}/{result.total} — retry</span>}
      </div>

      {result && (
        <div className={`p-quiz-result ${result.passed ? "qr-pass" : "qr-fail"}`}>
          {result.message}
        </div>
      )}

      {(!result || !result.passed) && (
        <>
          {quiz.questions.map((q, qi) => (
            <div key={q.id} className="p-quiz-q">
              <div className="p-quiz-qtext">
                <span className="p-quiz-qnum">{qi + 1}.</span> {q.question}
              </div>
              <div className="p-quiz-opts">
                {q.options.map((opt, oi) => (
                  <label key={oi} className={`p-quiz-opt ${selected[q.id] === oi ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={oi}
                      checked={selected[q.id] === oi}
                      onChange={() => setSelected((s) => ({ ...s, [q.id]: oi }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {error && <div className="p-proof-err">{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              className="p-btn p-btn-amber"
              disabled={submitting}
              onClick={submitQuiz}
            >
              {submitting ? "Checking…" : "Submit Quiz →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────
function TabDashboard({ data, onTabChange }: { data: DashboardData; onTabChange: (t: Tab) => void }) {
  const { user, modules, stats } = data;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  const activeModule = modules.find((m) => m.status === "available");
  const nextExercise = activeModule?.exercises.find((e) => e.isUnlocked && !e.isComplete) ?? null;

  const programmeComplete = stats.totalModules > 0 && stats.completedModules === stats.totalModules;

  return (
    <>
      <div className="p-greet">
        <h2>Welcome back, {user.firstName ?? displayName}.</h2>
        <p>
          {programmeComplete
            ? "You have completed your 30-day programme. Congratulations!"
            : nextExercise
            ? `You are on Day ${nextExercise.dayNumber ?? "—"} of your 30-day programme. Keep going.`
            : stats.totalModules === 0
            ? "Your programme is being set up. Check back soon."
            : "Your programme is ready. Get started below."}
        </p>
      </div>

      <div className="p-stat-row">
        <div className="p-stat">
          <div className="p-stat-lbl">Programme</div>
          <div className="p-stat-val">{stats.progressPct}%</div>
          <div className="p-stat-sub">
            {stats.completedExercises} of {stats.totalExercises} exercises
          </div>
        </div>
        <div className="p-stat">
          <div className="p-stat-lbl">Modules</div>
          <div className={`p-stat-val ${stats.completedModules > 0 ? "green" : "amber"}`}>
            {stats.completedModules} of {stats.totalModules}
          </div>
          <div className="p-stat-sub">Gate sign-offs submitted</div>
        </div>
        <div className="p-stat">
          <div className="p-stat-lbl">Plan</div>
          <div className="p-stat-val sm">{capitalize(user.planTier)}</div>
          <div className="p-stat-sub">{capitalize(user.vertical)}</div>
        </div>
        <div className="p-stat">
          <div className="p-stat-lbl">Next Step</div>
          <div className="p-stat-val sm">
            {nextExercise ? `Day ${nextExercise.dayNumber ?? "—"}` : programmeComplete ? "Complete!" : "—"}
          </div>
          <div className="p-stat-sub">
            {nextExercise
              ? nextExercise.title.replace(/^Day \d+ — /, "").slice(0, 28)
              : "—"}
          </div>
        </div>
      </div>

      <div className="p-two-col">
        <div>
          <div className="p-card">
            <div className="p-card-title">Your Learning Path</div>

            <div className="p-ci" onClick={() => onTabChange("programme")} style={{ cursor: "pointer" }}>
              <div className="p-ci-icon ic-30">30</div>
              <div className="p-ci-info">
                <div className="p-ci-name">30-Day Programme</div>
                <div className="p-ci-meta">
                  {stats.completedExercises} of {stats.totalExercises} exercises ·{" "}
                  {stats.totalModules} module gate sign-offs
                </div>
                {stats.totalExercises > 0 && (
                  <div className="p-pbar">
                    <div className="p-pfill pf-blue" style={{ width: `${stats.progressPct}%` }} />
                  </div>
                )}
              </div>
              <span className={`p-badge ${stats.completedModules === stats.totalModules && stats.totalModules > 0 ? "b-done" : stats.completedExercises > 0 ? "b-prog" : "b-lock"}`}>
                {stats.completedModules === stats.totalModules && stats.totalModules > 0 ? "Complete" : stats.completedExercises > 0 ? "In progress" : "Not started"}
              </span>
            </div>

            <div className="p-ci">
              <div className="p-ci-icon ic-loom">▶</div>
              <div className="p-ci-info">
                <div className="p-ci-name">Loom Handover — {capitalize(user.planTier)} Plan</div>
                <div className="p-ci-meta">Your Signal Launch walkthrough video</div>
              </div>
              <span className="p-badge b-prog">Watch</span>
            </div>

            <div className="p-ci">
              <div className="p-ci-icon ic-test">✓</div>
              <div className="p-ci-info">
                <div className="p-ci-name">System Test — 10 Questions</div>
                <div className="p-ci-meta">
                  {capitalize(user.vertical)} vertical · Min 8/10 to pass
                </div>
              </div>
              <span className="p-badge b-lock">Locked</span>
            </div>

            {user.hskdRequired && (
              <div className="p-ci">
                <div className="p-ci-icon ic-hskd">H</div>
                <div className="p-ci-info">
                  <div className="p-ci-name">HSKD Liability Sign-Off</div>
                  <div className="p-ci-meta">
                    5 scenarios · {capitalize(user.vertical)} · DocuSeal required
                  </div>
                </div>
                <span className="p-badge b-lock">Locked</span>
              </div>
            )}

            <div className="p-ci" onClick={() => onTabChange("resources")} style={{ cursor: "pointer" }}>
              <div className="p-ci-icon ic-res">R</div>
              <div className="p-ci-info">
                <div className="p-ci-name">Resource Library</div>
                <div className="p-ci-meta">Support docs · Tutorials · Platform walkthroughs</div>
              </div>
              <span className="p-badge b-done">Open</span>
            </div>
          </div>

          {nextExercise && (
            <div className="p-card">
              <div className="p-card-title">Continue Where You Left Off</div>
              <div className="p-resume-box">
                <div>
                  <div className="p-rb-title">
                    {nextExercise.dayNumber ? `Day ${nextExercise.dayNumber} — ` : ""}{nextExercise.title.replace(/^Day \d+ — /, "")}
                  </div>
                  <div className="p-rb-meta">
                    Submit your proof response in My Programme to mark this complete
                  </div>
                </div>
                <button className="p-btn p-btn-blue" onClick={() => onTabChange("programme")}>
                  Resume →
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="p-card">
            <div className="p-card-title">Certifications &amp; Sign-Offs</div>
            <div className="p-cert-item">
              <div className="p-cert-icon cl">M</div>
              <div className="p-cert-info">
                <div className="p-cert-name">Client Success Manual</div>
                <div className="p-cert-sub">{capitalize(user.planTier)} plan · DocuSeal</div>
              </div>
              <span style={{ fontSize: "11px", color: "var(--tm)" }}>Pending</span>
            </div>
            <div className="p-cert-item">
              <div className="p-cert-icon cl">S</div>
              <div className="p-cert-info">
                <div className="p-cert-name">System Test</div>
                <div className="p-cert-sub">10 questions · 8/10 to pass</div>
              </div>
              <span style={{ fontSize: "11px", color: "var(--tm)" }}>Pending</span>
            </div>
            {user.hskdRequired && (
              <div className="p-cert-item">
                <div className="p-cert-icon cl">H</div>
                <div className="p-cert-info">
                  <div className="p-cert-name">HSKD Liability Sign-Off</div>
                  <div className="p-cert-sub">5 scenarios · DocuSeal required</div>
                </div>
                <span style={{ fontSize: "11px", color: "var(--tm)" }}>Pending</span>
              </div>
            )}
            <div className="p-cert-item">
              <div className="p-cert-icon cl">C</div>
              <div className="p-cert-info">
                <div className="p-cert-name">ClearPath Certificate</div>
                <div className="p-cert-sub">Issued when all gates pass</div>
              </div>
              <span style={{ fontSize: "11px", color: "var(--tm)" }}>Pending</span>
            </div>
            {user.hskdRequired && (
              <div className="p-adobe-note">
                <span style={{ fontSize: "14px" }}>✍</span>
                <span className="p-an-text">
                  HSKD sign-off requires formal approval via DocuSeal. All 5 scenarios must be confirmed before the document is issued.
                </span>
              </div>
            )}
          </div>

          <div className="p-card">
            <div className="p-card-title">Quick Links</div>
            <div className="p-ql"><div className="p-ql-dot" />Loom handover video — {capitalize(user.planTier)}</div>
            <div className="p-ql"><div className="p-ql-dot" />Client Success Manual PDF</div>
            <div className="p-ql"><div className="p-ql-dot" />Platform walkthrough videos</div>
            <div className="p-ql"><div className="p-ql-dot" />Support documentation</div>
            <div className="p-ql"><div className="p-ql-dot" />Contact WiBiz · support@wibiz.ai</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Programme tab ────────────────────────────────────────────────────────────
function TabProgramme({
  modules,
  stats,
  onExerciseSubmit,
  onModuleGate,
  onReload,
  submitting,
}: {
  modules:          Module[];
  stats:            DashboardData["stats"];
  onExerciseSubmit: (exerciseId: string, proofText: string, proofImageUrl: string | null) => Promise<void>;
  onModuleGate:     (moduleId: string) => Promise<void>;
  onReload:         () => void;
  submitting:       string | null;
}) {
  if (modules.length === 0) {
    return (
      <div className="p-empty">
        Your programme modules are being set up. Check back soon.
      </div>
    );
  }

  return (
    <>
      <div className="p-greet">
        <h2>30-Day Programme</h2>
        <p>
          Work through your exercises in order. Submit a written proof (and optionally a screenshot) for each exercise.
          Our team reviews each submission — you'll see Approved, Pending Review, or Rejected with feedback.
          Once all exercises are approved and you've passed the quiz, submit your module gate sign-off.
        </p>
      </div>

      <div className="p-two-col">
        <div>
          {modules.map((mod) => {
            const isLocked   = mod.status === "locked";
            const isComplete = mod.status === "complete";
            const isActive   = mod.status === "available";

            return (
              <div key={mod.id} className={`p-card ${isActive ? "hl" : ""} ${isLocked ? "dim" : ""}`}>
                <div className="p-mod-hdr">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className="p-mod-hdr-title"
                      style={{ color: isComplete ? "var(--g-t)" : isActive ? "var(--b200)" : "var(--tm)" }}
                    >
                      {mod.title}
                    </span>
                    <span className={`p-badge ${isComplete ? "b-done" : isActive ? "b-prog" : "b-lock"}`}>
                      {isComplete ? "Complete" : isActive ? "In progress" : "Locked"}
                    </span>
                  </div>
                  {mod.dayStart != null && mod.dayEnd != null && (
                    <span style={{ fontSize: 11, color: "var(--ts)" }}>
                      Days {mod.dayStart}–{mod.dayEnd}
                    </span>
                  )}
                </div>

                {mod.gateSubmitted && (
                  <div className="p-sign-banner" style={{ marginBottom: 10 }}>
                    <div className="p-sb-icon">✓</div>
                    <div>
                      <div className="p-sb-text">Module sign-off submitted and acknowledged</div>
                      <div className="p-sb-sub">Gate passed · Next module unlocked</div>
                    </div>
                    <span className="p-badge b-done">Signed</span>
                  </div>
                )}

                {!isLocked && mod.exercises.length > 0 && (
                  <>
                    {mod.exercises.map((ex) => (
                      <ExerciseProofForm
                        key={ex.id}
                        exercise={ex}
                        onSubmit={onExerciseSubmit}
                        submitting={submitting}
                      />
                    ))}

                    {/* Quiz section — appears after all exercises are submitted (pending OK) */}
                    {mod.allExercisesSubmitted && !mod.gateSubmitted && (
                      <div style={{ marginTop: 16 }}>
                        <QuizPanel
                          moduleId={mod.id}
                          onQuizPassed={onReload}
                        />
                      </div>
                    )}

                    {/* Gate sign-off — only after all exercises approved + quiz passed */}
                    {mod.allExercisesDone && mod.quizPassed && !mod.gateSubmitted && (
                      <div className="p-gate-box" style={{ marginTop: 12 }}>
                        <div>
                          <div className="p-gate-text">All exercises approved + quiz passed — submit your module sign-off</div>
                          <div className="p-gate-sub">
                            This confirms you have completed {mod.title.split("—")[0]?.trim()}. The next module unlocks on submission.
                          </div>
                        </div>
                        <button
                          className="p-btn p-btn-amber"
                          disabled={submitting === mod.id}
                          onClick={() => onModuleGate(mod.id)}
                        >
                          {submitting === mod.id ? "Submitting…" : "Submit Sign-Off →"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {isLocked && (
                  <div style={{ fontSize: 12, color: "var(--tm)", paddingTop: 4 }}>
                    Complete and submit the sign-off for the previous module to unlock.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <div>
          <div className="p-card">
            <div className="p-card-title">Module Gates</div>
            {modules.map((mod, i) => (
              <div key={mod.id} className="p-gate-item">
                <div className={`p-mod-num ${mod.gateSubmitted ? "mn-done" : mod.status === "available" ? "mn-active" : "mn-lock"}`}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tp)", marginBottom: 2 }}>
                    Gate {i + 1} — {mod.title.split("—")[1]?.trim() ?? mod.title} sign-off
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ts)" }}>
                    {mod.dayEnd ? `After Day ${mod.dayEnd}` : "Module completion"} · Quiz required
                  </div>
                </div>
                <span className={`p-badge ${mod.gateSubmitted ? "b-done" : mod.status === "available" ? "b-pend" : "b-lock"}`}>
                  {mod.gateSubmitted ? "Passed" : mod.status === "available" ? "Pending" : "Locked"}
                </span>
              </div>
            ))}
          </div>

          <div className="p-card">
            <div className="p-card-title">Progress Overview</div>
            <div className="p-prog-row">
              <div className="p-prog-labels">
                <span>Exercises complete</span>
                <span style={{ color: "var(--b400)" }}>
                  {stats.completedExercises} of {stats.totalExercises}
                </span>
              </div>
              <div className="p-prog-bar">
                <div className="p-prog-fill pf-blue" style={{ width: `${stats.progressPct}%` }} />
              </div>
            </div>
            <div className="p-prog-row">
              <div className="p-prog-labels">
                <span>Gate sign-offs</span>
                <span style={{ color: "var(--g-t)" }}>
                  {stats.completedModules} of {stats.totalModules}
                </span>
              </div>
              <div className="p-prog-bar">
                <div className="p-prog-fill pf-green" style={{ width: stats.totalModules > 0 ? `${(stats.completedModules / stats.totalModules) * 100}%` : "0%" }} />
              </div>
            </div>
          </div>

          <div className="p-card">
            <div className="p-card-title">How It Works</div>
            <div className="p-ql"><div className="p-ql-dot" />Submit proof + optional screenshot per exercise</div>
            <div className="p-ql"><div className="p-ql-dot" />Staff reviews each submission (Approved / Rejected)</div>
            <div className="p-ql"><div className="p-ql-dot" />All submitted → module quiz unlocks (60%+ to pass)</div>
            <div className="p-ql"><div className="p-ql-dot" />All approved + quiz passed → gate sign-off unlocks</div>
            <div className="p-ql"><div className="p-ql-dot" />Contact WiBiz support if stuck</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Team tab ──────────────────────────────────────────────────────────────────
interface TeamMember {
  id:                string;
  email:             string;
  firstName:         string | null;
  lastName:          string | null;
  isActive:          boolean;
  isPending:         boolean;
  lastLoginAt:       string | null;
  activatedAt:       string | null;
  approvedExercises: number;
  completedModules:  number;
  totalModules:      number;
}

function TabTeam({ user }: { user: DashboardData["user"] }) {
  const [team,        setTeam]        = useState<TeamMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [teamError,   setTeamError]   = useState("");
  const [showInvite,  setShowInvite]  = useState(false);
  const [invEmail,    setInvEmail]    = useState("");
  const [invFirst,    setInvFirst]    = useState("");
  const [invLast,     setInvLast]     = useState("");
  const [inviting,    setInviting]    = useState(false);
  const [inviteErr,   setInviteErr]   = useState("");
  const [invitedUrl,  setInvitedUrl]  = useState<string | null>(null);
  const [removing,    setRemoving]    = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setTeamError("");
    try {
      const d = await apiFetch<{ team: TeamMember[] }>("/team");
      setTeam(d.team);
    } catch {
      setTeamError("Failed to load team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteErr("");
    setInviting(true);
    try {
      const res = await apiFetch<{ inviteUrl: string }>("/team/invite", {
        method: "POST",
        body:   JSON.stringify({ email: invEmail, firstName: invFirst || null, lastName: invLast || null }),
      });
      setInvitedUrl(res.inviteUrl);
      setInvEmail(""); setInvFirst(""); setInvLast("");
      await loadTeam();
    } catch (err) {
      setInviteErr(err instanceof ApiError ? (err.message ?? "Failed to send invite.") : "Something went wrong.");
    } finally {
      setInviting(false);
    }
  };

  const deactivate = async (memberId: string) => {
    if (!confirm("Deactivate this staff member? They won't be able to log in.")) return;
    setRemoving(memberId);
    try {
      await apiFetch(`/team/${memberId}`, { method: "DELETE" });
      await loadTeam();
    } catch {
      // ignore, reload anyway
    } finally {
      setRemoving(null);
    }
  };

  const selfAv = initials(user.firstName, user.lastName, user.email);
  const selfName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <>
      <div className="p-greet">
        <h2>My Team</h2>
        <p>Invite staff members to join your WiBiz Universe portal. Track their programme progress below.</p>
      </div>

      {/* Invite form card */}
      <div className="p-card" style={{ maxWidth: 700, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showInvite ? 16 : 0 }}>
          <div className="p-card-title" style={{ margin: 0, padding: 0, border: "none" }}>Invite a Staff Member</div>
          {!showInvite && (
            <button className="p-btn p-btn-blue" style={{ fontSize: 12, padding: "7px 14px" }} onClick={() => { setShowInvite(true); setInvitedUrl(null); }}>
              + Add staff member
            </button>
          )}
        </div>

        {showInvite && (
          <>
            {invitedUrl ? (
              <div style={{ background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g-t)", marginBottom: 6 }}>Invite created — GHL workflow will email the invite link.</div>
                <div style={{ fontSize: 11, color: "var(--ts)", marginBottom: 8 }}>Or share this link directly:</div>
                <div style={{ fontSize: 11, background: "var(--s1)", padding: "6px 10px", borderRadius: 6, wordBreak: "break-all", color: "var(--b400)", fontFamily: "monospace" }}>
                  {invitedUrl}
                </div>
                <button
                  style={{ marginTop: 10, fontSize: 11, color: "var(--ts)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => { navigator.clipboard.writeText(invitedUrl); }}
                >
                  Copy link
                </button>
              </div>
            ) : null}

            <form onSubmit={sendInvite}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>First name</label>
                  <input
                    type="text"
                    value={invFirst}
                    onChange={(e) => setInvFirst(e.target.value)}
                    placeholder="Optional"
                    style={{ width: "100%", background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "8px 11px", fontSize: 13, color: "var(--tp)", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Last name</label>
                  <input
                    type="text"
                    value={invLast}
                    onChange={(e) => setInvLast(e.target.value)}
                    placeholder="Optional"
                    style={{ width: "100%", background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "8px 11px", fontSize: 13, color: "var(--tp)", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Email address <span style={{ color: "var(--r-t)" }}>*</span></label>
                <input
                  type="email"
                  value={invEmail}
                  onChange={(e) => { setInvEmail(e.target.value); setInviteErr(""); }}
                  placeholder="staff@yourbusiness.com"
                  required
                  style={{ width: "100%", background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "8px 11px", fontSize: 13, color: "var(--tp)", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                />
              </div>
              {inviteErr && (
                <div style={{ fontSize: 12, color: "var(--r-t)", background: "var(--r-bg)", border: "1px solid var(--r-b)", borderRadius: 7, padding: "7px 11px", marginBottom: 10 }}>
                  {inviteErr}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="p-btn-ghost" onClick={() => { setShowInvite(false); setInviteErr(""); setInvitedUrl(null); }}>Cancel</button>
                <button type="submit" className="p-btn p-btn-blue" disabled={inviting}>
                  {inviting ? "Sending…" : "Send Invite →"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Team table */}
      <div className="p-card" style={{ maxWidth: 700 }}>
        <div className="p-card-title">Staff Members</div>

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--ts)", padding: "12px 0" }}>Loading team…</div>
        ) : teamError ? (
          <div style={{ fontSize: 13, color: "var(--r-t)" }}>{teamError}</div>
        ) : (
          <table className="p-tt">
            <thead>
              <tr>
                <th style={{ width: "38%" }}>Staff member</th>
                <th>Progress</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {/* Self row */}
              <tr>
                <td>
                  <div className="p-mem-cell">
                    <div className="p-sm-av">{selfAv}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tp)" }}>{selfName}</div>
                      <div style={{ fontSize: 11, color: "var(--ts)" }}>Account admin</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 11, color: "var(--ts)" }}>—</td>
                <td><span className="p-badge b-done">Active</span></td>
                <td />
              </tr>

              {team.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ fontSize: 12, color: "var(--ts)", paddingTop: 10, paddingBottom: 4 }}>
                    No staff members yet. Invite someone above.
                  </td>
                </tr>
              )}

              {team.map((m) => {
                const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email;
                const av   = initials(m.firstName, m.lastName, m.email);
                const modPct = m.totalModules > 0 ? Math.round((m.completedModules / m.totalModules) * 100) : 0;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="p-mem-cell">
                        <div className="p-sm-av" style={{ opacity: m.isPending ? 0.5 : 1 }}>{av}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: m.isActive ? "var(--tp)" : "var(--ts)" }}>{name}</div>
                          <div style={{ fontSize: 11, color: "var(--ts)" }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {m.isPending ? (
                        <span style={{ fontSize: 11, color: "var(--ts)" }}>Invite pending</span>
                      ) : (
                        <div style={{ minWidth: 90 }}>
                          <div className="p-mini-bar">
                            <div className="p-mini-fill pf-blue" style={{ width: `${modPct}%` }} />
                          </div>
                          <div style={{ fontSize: 10, color: "var(--ts)", marginTop: 2 }}>
                            {m.completedModules}/{m.totalModules} modules · {m.approvedExercises} exercises
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`p-badge ${m.isPending ? "b-pend" : m.isActive ? "b-prog" : "b-lock"}`}>
                        {m.isPending ? "Invited" : m.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {m.isActive && (
                        <button
                          className="p-btn-ghost"
                          style={{ fontSize: 11, padding: "3px 8px", color: "var(--r-t)" }}
                          disabled={removing === m.id}
                          onClick={() => deactivate(m.id)}
                        >
                          {removing === m.id ? "…" : "Deactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── Support tab ──────────────────────────────────────────────────────────────
const SUPPORT_CATEGORIES = [
  "General question",
  "Technical issue",
  "Billing / account",
  "Programme / exercises",
  "Platform access",
  "Other",
];

function TabSupport({ user }: { user: DashboardData["user"] }) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "";
  const [subject,       setSubject]       = useState("");
  const [category,      setCategory]      = useState("");
  const [message,       setMessage]       = useState("");
  const [priority,      setPriority]      = useState<"low" | "normal" | "high">("normal");
  const [attachUrl,     setAttachUrl]     = useState("");
  const [uploading,     setUploading]     = useState(false);
  const [uploadErr,     setUploadErr]     = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [submitErr,     setSubmitErr]     = useState("");
  const [submitted,     setSubmitted]     = useState(false);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadErr("File must be under 5 MB."); return; }
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) { setUploadErr("Images only (PNG, JPG, GIF, WEBP)."); return; }
    setUploadErr("");
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setAttachUrl(url);
    } catch {
      setUploadErr("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErr("");
    if (!subject.trim()) { setSubmitErr("Please enter a subject."); return; }
    if (!message.trim()) { setSubmitErr("Please describe your issue."); return; }
    setSubmitting(true);
    try {
      await apiFetch("/support/ticket", {
        method: "POST",
        body: JSON.stringify({
          subject:       subject.trim(),
          category:      category || null,
          message:       message.trim(),
          priority,
          attachmentUrl: attachUrl || null,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitErr(err instanceof ApiError ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSubject(""); setCategory(""); setMessage(""); setPriority("normal");
    setAttachUrl(""); setUploadErr(""); setSubmitErr(""); setSubmitted(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--s3)", border: "1px solid var(--bdr)",
    borderRadius: 7, padding: "8px 11px", fontSize: 13, color: "var(--tp)",
    fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
  };

  return (
    <>
      <div className="p-greet">
        <h2>Get Support</h2>
        <p>Submit a support request and our team will get back to you. You can also browse our support articles for instant answers.</p>
      </div>

      <div className="p-two-col">
        <div>
          {/* Ticket form */}
          <div className="p-card">
            <div className="p-card-title">Submit a Support Ticket</div>
            <div style={{ fontSize: 12, color: "var(--ts)", marginBottom: 16 }}>
              Describe your issue below. Our team reviews tickets and responds by email.
            </div>

            {submitted ? (
              <div style={{ background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "20px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g-t)", marginBottom: 6 }}>Ticket submitted successfully</div>
                <div style={{ fontSize: 12, color: "var(--ts)", marginBottom: 16 }}>
                  We will respond to <strong>{user.email}</strong> as soon as possible.
                </div>
                <button className="p-btn p-btn-blue" style={{ fontSize: 12 }} onClick={reset}>
                  Submit another ticket
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Pre-filled user info (read-only) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Your name</label>
                    <input type="text" value={displayName} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "default" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Email</label>
                    <input type="email" value={user.email} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "default" }} />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>
                    Subject <span style={{ color: "var(--r-t)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    required
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                      <option value="">Select a category…</option>
                      {SUPPORT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")} style={inputStyle}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High — urgent issue</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>
                    Message <span style={{ color: "var(--r-t)" }}>*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail. Include any error messages or steps to reproduce."
                    rows={5}
                    required
                    style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
                  />
                </div>

                {cloudName && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>
                      Screenshot (optional)
                    </label>
                    {attachUrl ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={attachUrl} alt="Attachment preview" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--bdr)" }} />
                        <div>
                          <div style={{ fontSize: 11, color: "var(--g-t)", marginBottom: 4 }}>Uploaded</div>
                          <button type="button" style={{ fontSize: 11, color: "var(--ts)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }} onClick={() => setAttachUrl("")}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        onChange={handleFileChange}
                        style={{ fontSize: 12, color: "var(--ts)" }}
                      />
                    )}
                    {uploading && <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 4 }}>Uploading…</div>}
                    {uploadErr && <div style={{ fontSize: 11, color: "var(--r-t)", marginTop: 4 }}>{uploadErr}</div>}
                  </div>
                )}

                {submitErr && (
                  <div style={{ fontSize: 12, color: "var(--r-t)", background: "var(--r-bg)", border: "1px solid var(--r-b)", borderRadius: 7, padding: "7px 11px", marginBottom: 10 }}>
                    {submitErr}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="p-btn p-btn-blue" disabled={submitting || uploading}>
                    {submitting ? "Submitting…" : "Submit Ticket →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div>
          {/* Support articles */}
          <div className="p-card">
            <div className="p-card-title">Support Articles</div>
            <div style={{ fontSize: 12, color: "var(--ts)", marginBottom: 14 }}>
              Browse our knowledge base for instant answers to common questions.
            </div>
            <a
              href="https://start.wibiz.ai/support/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "12px 14px", cursor: "pointer", marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--b200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", flexShrink: 0 }}>?</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--b400)", marginBottom: 2 }}>Browse WiBiz Support Articles</div>
                  <div style={{ fontSize: 11, color: "var(--ts)" }}>Step-by-step guides, troubleshooting, platform walkthroughs</div>
                </div>
                <span style={{ fontSize: 14, color: "var(--ts)" }}>↗</span>
              </div>
            </a>
            <div style={{ fontSize: 11, color: "var(--ts)", padding: "4px 2px" }}>
              Can't find what you need? Use the form on the left to submit a ticket and our team will help.
            </div>
          </div>

          {/* What to expect */}
          <div className="p-card">
            <div className="p-card-title">What happens next?</div>
            <div className="p-ql"><div className="p-ql-dot" />Your ticket is sent to our support team</div>
            <div className="p-ql"><div className="p-ql-dot" />We reply to your email address</div>
            <div className="p-ql"><div className="p-ql-dot" />High priority tickets are handled first</div>
            <div className="p-ql"><div className="p-ql-dot" />You can submit multiple tickets any time</div>
          </div>

          {/* Direct contact */}
          <div className="p-card">
            <div className="p-card-title">Direct Contact</div>
            <div style={{ fontSize: 13, color: "var(--tp)", marginBottom: 6 }}>
              Email: <a href="mailto:support@wibiz.ai" style={{ color: "var(--b400)", textDecoration: "none" }}>support@wibiz.ai</a>
            </div>
            <div style={{ fontSize: 11, color: "var(--ts)" }}>
              For urgent issues, email us directly. For general questions, the ticket form above is the fastest way to get help.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Account tab ──────────────────────────────────────────────────────────────
function TabAccount({ user, onReload }: { user: DashboardData["user"]; onReload: () => void }) {
  // ── Profile section ──
  const [firstName,   setFirstName]   = useState(user.firstName ?? "");
  const [lastName,    setLastName]    = useState(user.lastName ?? "");
  const [avatarUrl,   setAvatarUrl]   = useState(user.avatarUrl ?? "");
  const [avatarUp,    setAvatarUp]    = useState(false);
  const [avatarErr,   setAvatarErr]   = useState("");
  const [profSaving,  setProfSaving]  = useState(false);
  const [profMsg,     setProfMsg]     = useState("");
  const [profErr,     setProfErr]     = useState("");

  // ── Password section ──
  const [currentPw,   setCurrentPw]   = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [pwSaving,    setPwSaving]    = useState(false);
  const [pwMsg,       setPwMsg]       = useState("");
  const [pwErr,       setPwErr]       = useState("");

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;

  const av = initials(user.firstName, user.lastName, user.email);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarErr("Photo must be under 5 MB."); return; }
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) { setAvatarErr("Images only (PNG, JPG, GIF, WEBP)."); return; }
    setAvatarErr("");
    setAvatarUp(true);
    try {
      const url = await uploadToCloudinary(file);
      setAvatarUrl(url);
    } catch {
      setAvatarErr("Upload failed. Please try again.");
    } finally {
      setAvatarUp(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfErr(""); setProfMsg("");
    setProfSaving(true);
    try {
      await apiFetch("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName:  lastName.trim() || null,
          avatarUrl: avatarUrl || null,
        }),
      });
      setProfMsg("Profile updated.");
      onReload();
    } catch (err) {
      setProfErr(err instanceof ApiError ? err.message : "Update failed.");
    } finally {
      setProfSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(""); setPwMsg("");
    if (newPw !== confirmPw) { setPwErr("New passwords do not match."); return; }
    if (newPw.length < 8) { setPwErr("New password must be at least 8 characters."); return; }
    setPwSaving(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setPwMsg("Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setPwErr(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--s3)", border: "1px solid var(--bdr)",
    borderRadius: 7, padding: "8px 11px", fontSize: 13, color: "var(--tp)",
    fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
  };

  return (
    <>
      <div className="p-greet">
        <h2>Account Settings</h2>
        <p>Update your profile, display name, and password.</p>
      </div>

      <div className="p-two-col">
        <div>
          {/* Profile card */}
          <div className="p-card">
            <div className="p-card-title">Your Profile</div>

            {/* Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile photo"
                  style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--bdr)" }}
                />
              ) : (
                <div className="p-av" style={{ width: 60, height: 60, fontSize: 22, flexShrink: 0 }}>{av}</div>
              )}
              <div>
                {cloudName ? (
                  <>
                    <label style={{ cursor: "pointer" }}>
                      <span className="p-btn p-btn-blue" style={{ fontSize: 11, padding: "5px 12px", display: "inline-block", cursor: "pointer" }}>
                        {avatarUp ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                      </span>
                      <input type="file" accept="image/*" disabled={avatarUp} onChange={handleAvatarChange} style={{ display: "none" }} />
                    </label>
                    {avatarUrl && (
                      <button type="button" style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--ts)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }} onClick={() => setAvatarUrl("")}>
                        Remove photo
                      </button>
                    )}
                    {avatarErr && <div style={{ fontSize: 11, color: "var(--r-t)", marginTop: 4 }}>{avatarErr}</div>}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--ts)" }}>Profile photo upload not configured.</div>
                )}
              </div>
            </div>

            <form onSubmit={saveProfile}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>First name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Last name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>Email address</label>
                <input type="email" value={user.email} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "default" }} />
                <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 4 }}>Email cannot be changed. Contact support if needed.</div>
              </div>
              {profMsg && <div style={{ fontSize: 12, color: "var(--g-t)", marginBottom: 8 }}>✓ {profMsg}</div>}
              {profErr && (
                <div style={{ fontSize: 12, color: "var(--r-t)", background: "var(--r-bg)", border: "1px solid var(--r-b)", borderRadius: 7, padding: "7px 11px", marginBottom: 10 }}>
                  {profErr}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="p-btn p-btn-blue" disabled={profSaving || avatarUp}>
                  {profSaving ? "Saving…" : "Save Profile →"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div>
          {/* Change password card */}
          <div className="p-card">
            <div className="p-card-title">Change Password</div>
            <div style={{ fontSize: 12, color: "var(--ts)", marginBottom: 14 }}>
              Your password must be at least 8 characters. You will stay logged in after changing it.
            </div>
            <form onSubmit={changePassword}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>
                  Current password <span style={{ color: "var(--r-t)" }}>*</span>
                </label>
                <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>
                  New password <span style={{ color: "var(--r-t)" }}>*</span>
                </label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 4 }}>
                  Confirm new password <span style={{ color: "var(--r-t)" }}>*</span>
                </label>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" required style={inputStyle} />
              </div>
              {pwMsg && <div style={{ fontSize: 12, color: "var(--g-t)", marginBottom: 8 }}>✓ {pwMsg}</div>}
              {pwErr && (
                <div style={{ fontSize: 12, color: "var(--r-t)", background: "var(--r-bg)", border: "1px solid var(--r-b)", borderRadius: 7, padding: "7px 11px", marginBottom: 10 }}>
                  {pwErr}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="p-btn p-btn-blue" disabled={pwSaving}>
                  {pwSaving ? "Changing…" : "Change Password →"}
                </button>
              </div>
            </form>
          </div>

          {/* Account info */}
          <div className="p-card">
            <div className="p-card-title">Account Info</div>
            <div style={{ fontSize: 13, color: "var(--tp)", marginBottom: 6 }}>
              <span style={{ color: "var(--ts)", fontSize: 11 }}>Plan</span><br />
              {capitalize(user.planTier)}
            </div>
            <div style={{ fontSize: 13, color: "var(--tp)", marginBottom: 6 }}>
              <span style={{ color: "var(--ts)", fontSize: 11 }}>Vertical</span><br />
              {capitalize(user.vertical)}
            </div>
            <div style={{ fontSize: 13, color: "var(--tp)" }}>
              <span style={{ color: "var(--ts)", fontSize: 11 }}>Role</span><br />
              {user.role === "client_admin" ? "Account owner" : user.role === "client_staff" ? "Staff member" : user.role}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Resources tab ────────────────────────────────────────────────────────────
interface ResourceItem {
  id:          string;
  title:       string;
  description: string | null;
  category:    string | null;
  url:         string | null;
  icon:        string | null;
  orderIndex:  number;
}

interface TutorialItem {
  id:         string;
  title:      string;
  duration:   string | null;
  videoUrl:   string | null;
  orderIndex: number;
}

function TabResources({ user, onTabChange }: { user: DashboardData["user"]; onTabChange: (t: Tab) => void }) {
  const [resources,  setResources]  = useState<ResourceItem[]>([]);
  const [tutorials,  setTutorials]  = useState<TutorialItem[]>([]);
  const [resLoading, setResLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ resources: ResourceItem[] }>("/resources"),
      apiFetch<{ tutorials: TutorialItem[] }>("/resources/tutorials"),
    ]).then(([r, t]) => {
      setResources(r.resources);
      setTutorials(t.tutorials);
    }).catch(() => {
      // silently degrade — static fallback still renders if API fails
    }).finally(() => setResLoading(false));
  }, []);

  return (
    <>
      <div className="p-greet">
        <h2>Resources</h2>
        <p>Academy materials, support articles, and sign-off documents — everything in one place.</p>
      </div>
      <div className="p-two-col">
        <div>
          <div className="p-card">
            <div className="p-card-title">Academy Resources</div>
            <div style={{ fontSize: 11, color: "var(--ts)", marginBottom: 12 }}>
              Your programme materials and walkthrough videos.
            </div>
            {resLoading ? (
              <div style={{ fontSize: 12, color: "var(--ts)", padding: "8px 0" }}>Loading…</div>
            ) : resources.length > 0 ? (
              resources.map((r) => (
                r.url ? (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="p-ci">
                      <div className={`p-ci-icon ${r.category === "video" ? "ic-loom" : "ic-res"}`}>
                        {r.icon || (r.category === "video" ? "▶" : "R")}
                      </div>
                      <div className="p-ci-info">
                        <div className="p-ci-name">{r.title}</div>
                        {r.description && <div className="p-ci-meta">{r.description}</div>}
                      </div>
                      <span className="p-badge b-prog">{r.category === "video" ? "Watch" : "Open"}</span>
                    </div>
                  </a>
                ) : (
                  <div key={r.id} className="p-ci">
                    <div className={`p-ci-icon ${r.category === "video" ? "ic-loom" : "ic-res"}`}>
                      {r.icon || (r.category === "video" ? "▶" : "R")}
                    </div>
                    <div className="p-ci-info">
                      <div className="p-ci-name">{r.title}</div>
                      {r.description && <div className="p-ci-meta">{r.description}</div>}
                    </div>
                    <span className="p-badge b-prog">{r.category === "video" ? "Watch" : "Open"}</span>
                  </div>
                )
              ))
            ) : (
              <>
                <div className="p-ci">
                  <div className="p-ci-icon ic-loom">▶</div>
                  <div className="p-ci-info">
                    <div className="p-ci-name">Signal Launch — {capitalize(user.planTier)} Plan Walkthrough</div>
                    <div className="p-ci-meta">Your plan · Personalised setup walkthrough</div>
                  </div>
                  <span className="p-badge b-prog">Watch</span>
                </div>
                <div className="p-ci">
                  <div className="p-ci-icon ic-res">S</div>
                  <div className="p-ci-info">
                    <div className="p-ci-name">Client Success Manual — {capitalize(user.planTier)}</div>
                    <div className="p-ci-meta">Your complete operating guide</div>
                  </div>
                  <span className="p-badge b-lock">Pending sign</span>
                </div>
                <div className="p-ci">
                  <div className="p-ci-icon ic-res">T</div>
                  <div className="p-ci-info">
                    <div className="p-ci-name">Troubleshooting Guide</div>
                    <div className="p-ci-meta">Common issues and how to fix them</div>
                  </div>
                  <span className="p-badge b-prog">Open</span>
                </div>
                <div className="p-ci">
                  <div className="p-ci-icon ic-res">W</div>
                  <div className="p-ci-info">
                    <div className="p-ci-name">WhatsApp Setup Guide</div>
                    <div className="p-ci-meta">WABA connection, templates, message limits</div>
                  </div>
                  <span className="p-badge b-prog">Open</span>
                </div>
                <div className="p-ci">
                  <div className="p-ci-icon ic-res">B</div>
                  <div className="p-ci-info">
                    <div className="p-ci-name">Booking Automation Tutorial</div>
                    <div className="p-ci-meta">Calendar, reminder sequences, no-show handling</div>
                  </div>
                  <span className="p-badge b-prog">Open</span>
                </div>
              </>
            )}
          </div>

          {/* Support Articles — clearly distinct from Academy resources */}
          <div className="p-card" style={{ border: "1px solid var(--bdr)" }}>
            <div className="p-card-title">Support Articles</div>
            <div style={{ fontSize: 11, color: "var(--ts)", marginBottom: 14 }}>
              Step-by-step guides and answers to common questions — separate from your Academy programme.
            </div>
            <a
              href="https://start.wibiz.ai/support/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", textDecoration: "none", marginBottom: 12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--b200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", flexShrink: 0 }}>?</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--b400)", marginBottom: 2 }}>Browse WiBiz Support Articles</div>
                  <div style={{ fontSize: 11, color: "var(--ts)" }}>Knowledge base · Platform guides · FAQs</div>
                </div>
                <span style={{ fontSize: 14, color: "var(--ts)" }}>↗</span>
              </div>
            </a>
            <div
              onClick={() => onTabChange("support")}
              style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "12px 14px", cursor: "pointer" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--b400)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", flexShrink: 0 }}>✉</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tp)", marginBottom: 2 }}>Submit a Support Ticket</div>
                <div style={{ fontSize: 11, color: "var(--ts)" }}>Can't find the answer? Our team will help.</div>
              </div>
              <span style={{ fontSize: 14, color: "var(--ts)" }}>→</span>
            </div>
          </div>
        </div>
        <div>
          <div className="p-card">
            <div className="p-card-title">Platform Tutorial Videos</div>
            {resLoading ? (
              <div style={{ fontSize: 12, color: "var(--ts)", padding: "8px 0" }}>Loading…</div>
            ) : tutorials.length > 0 ? (
              tutorials.map((t) =>
                t.videoUrl ? (
                  <a
                    key={t.id}
                    href={t.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="p-ql" style={{ cursor: "pointer" }}>
                      <div className="p-ql-dot" />
                      {t.title}{t.duration ? ` (${t.duration})` : ""}
                    </div>
                  </a>
                ) : (
                  <div key={t.id} className="p-ql">
                    <div className="p-ql-dot" />
                    {t.title}{t.duration ? ` (${t.duration})` : ""}
                  </div>
                )
              )
            ) : (
              <>
                <div className="p-ql"><div className="p-ql-dot" />Dashboard orientation (5 min)</div>
                <div className="p-ql"><div className="p-ql-dot" />WhatsApp channel setup (8 min)</div>
                <div className="p-ql"><div className="p-ql-dot" />CRM and contact tagging (6 min)</div>
                <div className="p-ql"><div className="p-ql-dot" />Booking automation walkthrough (10 min)</div>
                <div className="p-ql"><div className="p-ql-dot" />Payment link activation (4 min)</div>
                <div className="p-ql"><div className="p-ql-dot" />Reporting dashboard (7 min)</div>
              </>
            )}
          </div>
          <div className="p-card">
            <div className="p-card-title">Your Sign-Off Documents</div>
            <div className="p-cert-item">
              <div className="p-cert-icon cl">M</div>
              <div className="p-cert-info">
                <div className="p-cert-name">Client Success Manual</div>
                <div className="p-cert-sub">DocuSeal signature pending</div>
              </div>
              <span style={{ fontSize: 11, color: "var(--tm)" }}>Pending</span>
            </div>
            <div className="p-cert-item">
              <div className="p-cert-icon cl">S</div>
              <div className="p-cert-info">
                <div className="p-cert-name">System Test Certificate</div>
                <div className="p-cert-sub">Pass the System Test to receive</div>
              </div>
              <span style={{ fontSize: 11, color: "var(--tm)" }}>Pending</span>
            </div>
            {user.hskdRequired && (
              <div className="p-cert-item">
                <div className="p-cert-icon cl">H</div>
                <div className="p-cert-info">
                  <div className="p-cert-name">HSKD Liability Sign-Off</div>
                  <div className="p-cert-sub">5 scenarios · DocuSeal required</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--tm)" }}>Pending</span>
              </div>
            )}
            <div className="p-cert-item">
              <div className="p-cert-icon cl">C</div>
              <div className="p-cert-info">
                <div className="p-cert-name">ClearPath Certificate</div>
                <div className="p-cert-sub">Pending all gate completions</div>
              </div>
              <span style={{ fontSize: 11, color: "var(--tm)" }}>Pending</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main portal ──────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const [data,       setData]       = useState<DashboardData | null>(null);
  const [error,      setError]      = useState("");
  const [tab,        setTab]        = useState<Tab>("dashboard");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<DashboardData>("/dashboard");
      setData(d);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
      } else {
        setError("Failed to load. Please refresh.");
      }
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
    navigate("/login", { replace: true });
  };

  const submitExerciseProof = async (exerciseId: string, proofText: string, proofImageUrl: string | null) => {
    setSubmitting(exerciseId);
    try {
      await apiFetch(`/progress/exercise/${exerciseId}`, {
        method: "POST",
        body:   JSON.stringify({ proofText, proofImageUrl }),
      });
      await load();
    } finally {
      setSubmitting(null);
    }
  };

  const submitModuleGate = async (moduleId: string) => {
    setSubmitting(moduleId);
    try {
      await apiFetch(`/progress/module/${moduleId}`, { method: "POST" });
      await load();
    } finally {
      setSubmitting(null);
    }
  };

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--r-t)" }}>
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--ts)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  const { user } = data;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const av = initials(user.firstName, user.lastName, user.email);

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard",  label: "Dashboard"    },
    { id: "programme",  label: "My Programme" },
    { id: "team",       label: "My Team"      },
    { id: "resources",  label: "Resources"    },
    { id: "support",    label: "Get Support"  },
    { id: "account",    label: "My Account"   },
  ];

  const planLabel = user.planTier ? `${capitalize(user.planTier)} plan` : "";
  const vertLabel = user.vertical ? `${capitalize(user.vertical)} vertical` : "";

  return (
    <div>
      <nav className="p-nav">
        <span className="p-logo">
          WiBiz <span>Academy</span>
        </span>
        <div className="p-nav-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`p-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          {user.role === "wibiz_admin" && (
            <button className="p-tab" onClick={() => navigate("/admin")}>
              WiBiz Admin
            </button>
          )}
        </div>
        <div className="p-nav-user">
          <button className="p-theme-btn" onClick={toggle} title="Toggle light/dark mode">
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
          <div className="p-av">{av}</div>
          <span>{displayName}</span>
          <span style={{ color: "var(--bdr)", margin: "0 2px" }}>·</span>
          <span style={{ cursor: "pointer", color: "var(--tm)" }} onClick={logout}>
            Sign out
          </span>
        </div>
      </nav>

      <div className="p-role-banner">
        Client portal
        {planLabel && ` · ${planLabel}`}
        {vertLabel && ` · ${vertLabel}`}
        {" · Signal Launch confirmed"}
      </div>

      <div className="p-view">
        {tab === "dashboard" && (
          <TabDashboard data={data} onTabChange={setTab} />
        )}
        {tab === "programme" && (
          <TabProgramme
            modules={data.modules}
            stats={data.stats}
            onExerciseSubmit={submitExerciseProof}
            onModuleGate={submitModuleGate}
            onReload={load}
            submitting={submitting}
          />
        )}
        {tab === "team"      && <TabTeam      user={user} />}
        {tab === "resources" && <TabResources user={user} onTabChange={setTab} />}
        {tab === "support"   && <TabSupport   user={user} />}
        {tab === "account"   && <TabAccount   user={user} onReload={load} />}
      </div>
    </div>
  );
}
