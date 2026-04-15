import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id:              string;
  question_number: number;
  question_text:   string;
  option_a:        string;
  option_b:        string;
  option_c:        string;
  option_d:        string;
  // Only present in results
  correct_option?: string;
  explanation?:    string;
}

interface ScoredAnswer {
  given:      string;
  correct:    string;
  is_correct: boolean;
}

interface SubmitResult {
  passed:           boolean;
  score:            number;
  total_questions:  number;
  pass_threshold:   number;
  status:           string;
  scored_answers:   Record<string, ScoredAnswer>;
  questions:        Question[];
  attempt_number:   number;
}

type PageState =
  | "loading"
  | "already_passed"
  | "intro"
  | "questions"
  | "submitting"
  | "result_pass"
  | "result_fail"
  | "error";

const OPTIONS = ["A", "B", "C", "D"] as const;
type Option = typeof OPTIONS[number];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BotCertificationPage() {
  const navigate = useNavigate();

  const [pageState,    setPageState]    = useState<PageState>("loading");
  const [questions,    setQuestions]    = useState<Question[]>([]);
  const [current,      setCurrent]      = useState(0);
  const [answers,      setAnswers]      = useState<Record<string, Option>>({});
  const [selected,     setSelected]     = useState<Option | null>(null);
  const [result,       setResult]       = useState<SubmitResult | null>(null);
  const [certId,       setCertId]       = useState<string | null>(null);
  const [attemptNum,   setAttemptNum]   = useState(1);
  const [errorMsg,     setErrorMsg]     = useState("");

  // ── Load status on mount ────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<{ status: string; attempt_number: number }>("/client/bot-cert/status")
      .then((data) => {
        if (data.status === "passed") {
          setPageState("already_passed");
        } else {
          setPageState("intro");
          setAttemptNum(data.attempt_number ?? 0);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setErrorMsg("Failed to load certification status.");
          setPageState("error");
        }
      });
  }, []);

  // ── Start attempt ───────────────────────────────────────────────────────────
  const startAttempt = async () => {
    setPageState("loading");
    try {
      // Create attempt
      const startRes = await apiFetch<{ certification: { id: string; attempt_number: number } }>(
        "/client/bot-cert/start",
        { method: "POST", body: JSON.stringify({}) }
      );
      setCertId(startRes.certification.id);
      setAttemptNum(startRes.certification.attempt_number);

      // Load questions
      const qRes = await apiFetch<{ questions: Question[] }>("/client/bot-cert/questions");
      setQuestions(qRes.questions);
      setAnswers({});
      setSelected(null);
      setCurrent(0);
      setPageState("questions");
    } catch (err) {
      setErrorMsg("Failed to start. Please try again.");
      setPageState("error");
    }
  };

  // ── Select answer for current question ─────────────────────────────────────
  const selectOption = (opt: Option) => {
    setSelected(opt);
  };

  // ── Confirm answer and advance ──────────────────────────────────────────────
  const confirmAnswer = () => {
    if (!selected || !questions[current]) return;
    const q = questions[current]!;
    const newAnswers = { ...answers, [q.id]: selected };
    setAnswers(newAnswers);
    setSelected(null);

    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
    } else {
      // All answered — submit
      submitAnswers(newAnswers);
    }
  };

  // ── Submit all answers ──────────────────────────────────────────────────────
  const submitAnswers = async (finalAnswers: Record<string, Option>) => {
    setPageState("submitting");
    try {
      const res = await apiFetch<SubmitResult>("/client/bot-cert/submit", {
        method: "POST",
        body: JSON.stringify({ answers: finalAnswers }),
      });
      setResult(res);
      setPageState(res.passed ? "result_pass" : "result_fail");
    } catch {
      setErrorMsg("Failed to submit. Please try again.");
      setPageState("error");
    }
  };

  // ─── Renders ────────────────────────────────────────────────────────────────

  const q = questions[current];
  const progressPct = questions.length > 0 ? Math.round((current / questions.length) * 100) : 0;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (pageState === "loading" || pageState === "submitting") {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        {pageState === "submitting" ? "Scoring your answers…" : "Loading…"}
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 max-w-md text-center space-y-4">
          <p className="text-sm text-destructive font-medium">{errorMsg}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Already passed ──────────────────────────────────────────────────────────
  if (pageState === "already_passed") {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
          <span className="text-sm text-muted-foreground">Bot Certification</span>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-12 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-foreground">Bot Certification Complete</h1>
          <p className="text-sm text-muted-foreground">
            You have already passed your Bot Certification. This phase is complete.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
          >
            Return to Dashboard
          </button>
        </main>
      </div>
    );
  }

  // ── Intro ───────────────────────────────────────────────────────────────────
  if (pageState === "intro") {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
          <span className="text-sm text-muted-foreground">Phase 2 — Bot Certification</span>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          {/* Title card */}
          <div className="bg-card rounded-2xl border border-border p-8 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              <div>
                <h1 className="text-xl font-bold text-foreground">Bot Certification</h1>
                <p className="text-sm text-muted-foreground">Phase 2 — 10-Question System Test</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3 text-sm text-foreground">
              <p>
                Bot Certification verifies that you understand how your AI system must operate
                within approved boundaries. Every client on every plan must complete this before
                Specialist Mode can activate.
              </p>
              <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">10</span>
                  <span className="text-muted-foreground">questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">8/10</span>
                  <span className="text-muted-foreground">required to pass</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">Retry</span>
                  <span className="text-muted-foreground">allowed if you do not pass — no limit on attempts</span>
                </div>
              </div>
              {attemptNum > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-700 dark:text-amber-400 text-xs">
                  This will be attempt #{attemptNum + 1}. Review your previous attempt results before retrying.
                </div>
              )}
            </div>

            <button
              onClick={startAttempt}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Begin Bot Certification →
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Questions ───────────────────────────────────────────────────────────────
  if (pageState === "questions" && q) {
    const optionLabels: Record<Option, string> = {
      A: q.option_a,
      B: q.option_b,
      C: q.option_c,
      D: q.option_d,
    };

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
          <span className="text-sm text-muted-foreground">
            Question {current + 1} of {questions.length}
          </span>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-8 space-y-5">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Question card */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Question {q.question_number}
              </p>
              <p className="text-base font-medium text-foreground leading-relaxed">
                {q.question_text}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => selectOption(opt)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    selected === opt
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <span className="font-semibold mr-2 text-primary">{opt}.</span>
                  {optionLabels[opt]}
                </button>
              ))}
            </div>

            {/* Confirm button */}
            <button
              onClick={confirmAnswer}
              disabled={!selected}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {current + 1 < questions.length ? "Confirm & Next →" : "Submit Answers →"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Result: PASS ────────────────────────────────────────────────────────────
  if (pageState === "result_pass" && result) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
          <span className="text-sm text-muted-foreground">Bot Certification — Result</span>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          {/* Pass banner */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-2">
            <div className="text-4xl">🎉</div>
            <h1 className="text-2xl font-bold text-green-700 dark:text-green-400">
              Bot Certification Passed!
            </h1>
            <p className="text-sm text-muted-foreground">
              You scored <strong className="text-foreground">{result.score} / {result.total_questions}</strong>.
              Pass threshold: {result.pass_threshold}/10.
            </p>
          </div>

          {/* What happens next */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-foreground text-sm">What happens next</h2>
            <p className="text-sm text-muted-foreground">
              Your Bot Certification is complete. Depending on your industry vertical:
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Standard verticals:</strong> Specialist Mode
                  is now unlocked. Your ClearPath Certificate will be issued.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">→</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">HSKD verticals</strong> (Clinics, Legal,
                  Real Estate, Social Welfare, Restaurants): You now proceed to Phase 3 — HSKD
                  Certification inside WiBiz Universe.
                </span>
              </div>
            </div>
          </div>

          {/* Answer review */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Answer Review
            </h2>
            {result.questions.map((q) => {
              const scored = result.scored_answers[q.id];
              if (!scored) return null;
              return (
                <div
                  key={q.id}
                  className={`bg-card rounded-xl border p-4 space-y-2 ${
                    scored.is_correct ? "border-green-500/20" : "border-destructive/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      Q{q.question_number}. {q.question_text}
                    </p>
                    <span className={`text-xs font-bold shrink-0 ${scored.is_correct ? "text-green-500" : "text-destructive"}`}>
                      {scored.is_correct ? "✓" : "✗"}
                    </span>
                  </div>
                  {!scored.is_correct && (
                    <p className="text-xs text-muted-foreground">
                      Your answer: <strong>{scored.given}</strong> · Correct: <strong>{scored.correct}</strong>
                    </p>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-muted-foreground border-t border-border pt-2">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
          >
            Return to Dashboard →
          </button>
        </main>
      </div>
    );
  }

  // ── Result: FAIL ────────────────────────────────────────────────────────────
  if (pageState === "result_fail" && result) {
    const missed = result.questions.filter((q) => {
      const s = result.scored_answers[q.id];
      return s && !s.is_correct;
    });

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
          <span className="text-sm text-muted-foreground">Bot Certification — Result</span>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          {/* Fail banner */}
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center space-y-2">
            <div className="text-4xl">📋</div>
            <h1 className="text-xl font-bold text-foreground">Not Passed This Time</h1>
            <p className="text-sm text-muted-foreground">
              You scored <strong className="text-foreground">{result.score} / {result.total_questions}</strong>.
              You need <strong>{result.pass_threshold}</strong> correct to pass.
            </p>
          </div>

          {/* Retry info */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-2">
            <h2 className="font-semibold text-foreground text-sm">What to do next</h2>
            <p className="text-sm text-muted-foreground">
              Review the questions you missed below, then retry. There is no limit on retries.
              Take your time — the questions test real operational knowledge you need to run your AI correctly.
            </p>
          </div>

          {/* Missed questions */}
          {missed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Questions to Review ({missed.length})
              </h2>
              {missed.map((q) => {
                const scored = result.scored_answers[q.id];
                if (!scored) return null;
                const optionText = (opt: string) => {
                  if (opt === "A") return q.option_a;
                  if (opt === "B") return q.option_b;
                  if (opt === "C") return q.option_c;
                  if (opt === "D") return q.option_d;
                  return opt;
                };
                return (
                  <div key={q.id} className="bg-card rounded-xl border border-destructive/20 p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Q{q.question_number}. {q.question_text}
                    </p>
                    <div className="text-xs space-y-1">
                      <p className="text-destructive">
                        ✗ Your answer: <strong>{scored.given}</strong> — {optionText(scored.given)}
                      </p>
                      <p className="text-green-600 dark:text-green-400">
                        ✓ Correct: <strong>{scored.correct}</strong> — {optionText(scored.correct)}
                      </p>
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-muted-foreground border-t border-border pt-2">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={startAttempt}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
            >
              Retry Bot Certification →
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-5 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}