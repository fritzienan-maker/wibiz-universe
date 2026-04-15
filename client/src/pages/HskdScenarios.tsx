import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

interface Scenario {
  id:                      string;
  scenario_number:         number;
  title:                   string;
  scenario_text:           string | null;
  danger_text:             string | null;
  prescribed_bot_response: string | null;
  mandatory_bot_action:    string | null;
  certification_prompt:    string | null;
}

export default function HskdScenariosPage() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const [certificationId, setCertificationId] = useState<string | null>(null);
  const [scenarios, setScenarios]             = useState<Scenario[]>([]);
  const [current, setCurrent]                 = useState(0);
  const [submitting, setSub]                  = useState(false);
  const [rejected, setRejected]               = useState(false);
  const [error, setError]                     = useState("");
  const [loading, setLoading]                 = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ certification: { id: string; status: string } | null }>("/client/hskd/my-certification")
      .then((d) => {
        if (!d.certification) { navigate("/hskd", { replace: true }); return null; }
        setCertificationId(d.certification.id);
        return apiFetch<{ scenarios: Scenario[] }>(`/client/hskd/scenarios/${d.certification.id}`);
      })
      .then((res) => {
        if (!res) return;
        setScenarios(res.scenarios);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load scenarios. Please refresh.");
        }
      })
      .finally(() => setLoading(false));
  }, [industrySlug]);

  const handleDecision = async (decision: "APPROVED" | "REJECTED") => {
    if (!certificationId || !scenarios[current]) return;
    setSub(true);
    try {
      const res = await apiFetch<{ status?: string; remaining?: number }>(
        `/client/hskd/scenarios/${certificationId}/decision?scenario_id=${scenarios[current]!.id}`,
        {
          method: "POST",
          body: JSON.stringify({ decision }),
        }
      );
      if (decision === "REJECTED") {
        setRejected(true);
      } else if (res.status === "PROHIBITED" || current + 1 >= scenarios.length) {
        navigate(`/hskd/certify/${industrySlug}/prohibited`);
      } else {
        setCurrent((c) => c + 1);
      }
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSub(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-lg w-full bg-card border border-destructive/30 rounded-2xl p-8 space-y-4 text-center">
          <div className="text-4xl">🚫</div>
          <h2 className="text-xl font-bold text-foreground">Scenario Flagged for Review</h2>
          <p className="text-sm text-muted-foreground">
            Your response for Scenario {current + 1} has been flagged. WiBiz Ops will contact
            you within 1 business day to resolve this before you can proceed.
          </p>
          <Link
            to="/dashboard"
            className="inline-block mt-2 text-sm px-4 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const scenario = scenarios[current];
  if (!scenario) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
        <span className="text-sm text-muted-foreground">
          Scenario {current + 1} of {scenarios.length}
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(current / scenarios.length) * 100}%` }}
          />
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
            Scenario {scenario.scenario_number} — {scenario.title}
          </h2>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">The Scenario</p>
            <p className="text-sm text-foreground leading-relaxed">{scenario.scenario_text}</p>
          </div>

          {scenario.danger_text && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest">⚠ The Danger</p>
              <p className="text-sm text-foreground leading-relaxed">{scenario.danger_text}</p>
            </div>
          )}

          {scenario.prescribed_bot_response && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Prescribed Bot Response</p>
              <div className="bg-muted rounded-lg p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap border border-border">
                {scenario.prescribed_bot_response}
              </div>
            </div>
          )}

          {scenario.mandatory_bot_action && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Mandatory Bot Action</p>
              <p className="text-sm text-foreground leading-relaxed">{scenario.mandatory_bot_action}</p>
            </div>
          )}

          {scenario.certification_prompt && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-foreground font-medium">{scenario.certification_prompt}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleDecision("REJECTED")}
              disabled={submitting}
              className="py-3 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors disabled:opacity-60"
            >
              ❌ Reject — Escalate to Human
            </button>
            <button
              onClick={() => handleDecision("APPROVED")}
              disabled={submitting}
              className="py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              ✅ Approve Response
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}