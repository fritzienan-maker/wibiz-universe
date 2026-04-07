import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Exercise {
  id:          string;
  title:       string;
  description: string | null;
  proofPrompt: string | null;
  dayNumber:   number | null;
  orderIndex:  number;
  isComplete:  boolean;
  isUnlocked:  boolean;
}

interface Module {
  id:                 string;
  title:              string;
  description:        string | null;
  dayStart:           number | null;
  dayEnd:             number | null;
  orderIndex:         number;
  status:             "available" | "locked" | "complete";
  gateSubmitted:      boolean;
  allExercisesDone:   boolean;
  quizPassed:         boolean;
  exercises:          Exercise[];
  completedExercises: number;
  totalExercises:     number;
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

type Tab = "dashboard" | "programme" | "team" | "resources";

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

// ─── Exercise proof form ──────────────────────────────────────────────────────
function ExerciseProofForm({
  exercise,
  onSubmit,
  submitting,
}: {
  exercise:   Exercise;
  onSubmit:   (exerciseId: string, proofText: string) => Promise<void>;
  submitting: string | null;
}) {
  const [open,      setOpen]      = useState(false);
  const [proofText, setProofText] = useState("");
  const [error,     setError]     = useState("");

  if (exercise.isComplete) {
    return (
      <div className="p-ex-row">
        <div className="p-ex-check ec-done">✓</div>
        <div className="p-ex-label">
          {exercise.dayNumber ? `Day ${exercise.dayNumber} — ` : ""}
          {exercise.title.replace(/^Day \d+ — /, "")}
        </div>
        <div className="p-ex-day" style={{ color: "var(--g-t)" }}>Done</div>
      </div>
    );
  }

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

  return (
    <div className="p-proof-wrap">
      <div
        className="p-ex-row"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="p-ex-check ec-active">{open ? "▾" : "○"}</div>
        <div className="p-ex-label">
          {exercise.dayNumber ? `Day ${exercise.dayNumber} — ` : ""}
          {exercise.title.replace(/^Day \d+ — /, "")}
        </div>
        <div className="p-ex-day" style={{ color: "var(--b400)" }}>
          {open ? "Collapse" : "Submit proof →"}
        </div>
      </div>

      {open && (
        <div className="p-proof-form">
          {exercise.description && (
            <div className="p-proof-desc">{exercise.description}</div>
          )}
          {exercise.proofPrompt && (
            <label className="p-proof-label">{exercise.proofPrompt}</label>
          )}
          <textarea
            className="p-proof-ta"
            rows={4}
            placeholder="Type your response here…"
            value={proofText}
            onChange={(e) => { setProofText(e.target.value); setError(""); }}
          />
          {error && <div className="p-proof-err">{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              className="p-btn-ghost"
              onClick={() => { setOpen(false); setError(""); setProofText(""); }}
            >
              Cancel
            </button>
            <button
              className="p-btn p-btn-blue"
              disabled={submitting === exercise.id}
              onClick={async () => {
                if (!proofText.trim()) {
                  setError("Your proof response is required before marking this exercise complete.");
                  return;
                }
                await onSubmit(exercise.id, proofText.trim());
              }}
            >
              {submitting === exercise.id ? "Saving…" : "Submit + Mark Complete →"}
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
  onExerciseComplete,
  onModuleGate,
  onReload,
  submitting,
}: {
  modules:            Module[];
  stats:              DashboardData["stats"];
  onExerciseComplete: (exerciseId: string, proofText: string) => Promise<void>;
  onModuleGate:       (moduleId: string) => Promise<void>;
  onReload:           () => void;
  submitting:         string | null;
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
          Work through your exercises in order. Each exercise requires a proof response before it can be marked complete.
          Complete all exercises, pass the module quiz, then submit the gate sign-off to unlock the next module.
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
                        onSubmit={onExerciseComplete}
                        submitting={submitting}
                      />
                    ))}

                    {/* Quiz section — appears after all exercises done */}
                    {mod.allExercisesDone && !mod.gateSubmitted && (
                      <div style={{ marginTop: 16 }}>
                        <QuizPanel
                          moduleId={mod.id}
                          onQuizPassed={onReload}
                        />
                      </div>
                    )}

                    {/* Gate sign-off — only after quiz passed */}
                    {mod.allExercisesDone && mod.quizPassed && !mod.gateSubmitted && (
                      <div className="p-gate-box" style={{ marginTop: 12 }}>
                        <div>
                          <div className="p-gate-text">All exercises complete + quiz passed — submit your module sign-off</div>
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
            <div className="p-ql"><div className="p-ql-dot" />Each exercise requires a proof response</div>
            <div className="p-ql"><div className="p-ql-dot" />Complete all exercises → module quiz unlocks</div>
            <div className="p-ql"><div className="p-ql-dot" />Pass quiz (60%+) → gate sign-off unlocks</div>
            <div className="p-ql"><div className="p-ql-dot" />Submit sign-off → next module unlocks</div>
            <div className="p-ql"><div className="p-ql-dot" />Contact WiBiz support if stuck</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Team tab ──────────────────────────────────────────────────────────────────
function TabTeam({ user }: { user: DashboardData["user"] }) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const av = initials(user.firstName, user.lastName, user.email);
  return (
    <>
      <div className="p-greet">
        <h2>My Team</h2>
        <p>Staff invite and team progress tracking is coming soon. Your account is active below.</p>
      </div>
      <div className="p-card" style={{ maxWidth: 700 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="p-card-title" style={{ margin: 0, padding: 0, border: "none" }}>Staff</div>
          <button className="p-btn-ghost" disabled style={{ opacity: .4, cursor: "not-allowed" }}>
            + Add staff member (coming soon)
          </button>
        </div>
        <table className="p-tt">
          <thead>
            <tr>
              <th style={{ width: "35%" }}>Staff member</th>
              <th>Programme</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="p-mem-cell">
                  <div className="p-sm-av">{av}</div>
                  {displayName} (you)
                </div>
              </td>
              <td>
                <div className="p-mini-bar">
                  <div className="p-mini-fill pf-blue" style={{ width: "30%" }} />
                </div>
              </td>
              <td style={{ fontSize: 11, color: "var(--ts)" }}>Account admin</td>
              <td><span className="p-badge b-prog">Active</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Resources tab ────────────────────────────────────────────────────────────
function TabResources({ user }: { user: DashboardData["user"] }) {
  return (
    <>
      <div className="p-greet">
        <h2>Resources</h2>
        <p>Everything you need to run your WiBiz system confidently. Available any time.</p>
      </div>
      <div className="p-two-col">
        <div>
          <div className="p-card">
            <div className="p-card-title">Loom Handover Videos</div>
            <div className="p-ci">
              <div className="p-ci-icon ic-loom">▶</div>
              <div className="p-ci-info">
                <div className="p-ci-name">Signal Launch — {capitalize(user.planTier)} Plan Walkthrough</div>
                <div className="p-ci-meta">Your plan · Personalised setup walkthrough</div>
              </div>
              <span className="p-badge b-prog">Watch</span>
            </div>
          </div>
          <div className="p-card">
            <div className="p-card-title">Support Documentation</div>
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
          </div>
        </div>
        <div>
          <div className="p-card">
            <div className="p-card-title">Platform Tutorial Videos</div>
            <div className="p-ql"><div className="p-ql-dot" />Dashboard orientation (5 min)</div>
            <div className="p-ql"><div className="p-ql-dot" />WhatsApp channel setup (8 min)</div>
            <div className="p-ql"><div className="p-ql-dot" />CRM and contact tagging (6 min)</div>
            <div className="p-ql"><div className="p-ql-dot" />Booking automation walkthrough (10 min)</div>
            <div className="p-ql"><div className="p-ql-dot" />Payment link activation (4 min)</div>
            <div className="p-ql"><div className="p-ql-dot" />Reporting dashboard (7 min)</div>
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

  const markExerciseComplete = async (exerciseId: string, proofText: string) => {
    setSubmitting(exerciseId);
    try {
      await apiFetch(`/progress/exercise/${exerciseId}`, {
        method: "POST",
        body:   JSON.stringify({ proofText }),
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
          <div className="p-av">{av}</div>
          <span>{displayName}</span>
          <span style={{ color: "var(--bdr)", margin: "0 2px" }}>·</span>
          <span
            style={{ cursor: "pointer", color: "var(--tm)" }}
            onClick={logout}
          >
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
            onExerciseComplete={markExerciseComplete}
            onModuleGate={submitModuleGate}
            onReload={load}
            submitting={submitting}
          />
        )}
        {tab === "team"      && <TabTeam      user={user} />}
        {tab === "resources" && <TabResources user={user} />}
      </div>
    </div>
  );
}
