import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

interface TrainingModule {
  id:            string;
  module_number: number;
  title:         string;
  content:       string | null;
  video_url:     string | null;
  is_active:     boolean;
}

interface Certification {
  id:     string;
  status: string;
}

export default function HskdTrainingPage() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const [modules, setModules]           = useState<TrainingModule[]>([]);
  const [certification, setCertification] = useState<Certification | null>(null);
  const [activeModule, setActive]       = useState<TrainingModule | null>(null);
  const [completing, setCompleting]     = useState(false);
  const [allComplete, setAllComplete]   = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ certification: Certification | null }>("/client/hskd/my-certification")
      .then((d) => {
        if (!d.certification) {
          navigate("/hskd", { replace: true });
          return;
        }
        setCertification(d.certification);
        if (d.certification.status !== "TRAINING") {
          // Already past training — go to next step
          navigate(`/hskd/certify/${industrySlug}/scenarios`, { replace: true });
          return;
        }
        return apiFetch<{ modules: TrainingModule[] }>(`/client/hskd/training/${d.certification.id}`);
      })
      .then((res) => {
        if (!res) return;
        setModules(res.modules);
        setActive(res.modules[0] ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load training. Please refresh.");
        }
      })
      .finally(() => setLoading(false));
  }, [industrySlug]);

  const markComplete = async () => {
    if (!certification) return;
    setCompleting(true);
    try {
      await apiFetch(`/client/hskd/training/${certification.id}/complete`, { method: "POST" });
      setAllComplete(true);
    } catch {
      setError("Failed to complete training. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
        <Link to="/hskd" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Certification
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
          <h1 className="text-xl font-bold text-foreground">Training Modules</h1>
          <p className="text-sm text-muted-foreground">
            Complete all training modules before proceeding to certification scenarios.
          </p>
          {(allComplete || modules.length === 0) && (
            <div className="flex justify-end pt-2">
              <Link
                to={`/hskd/certify/${industrySlug}/scenarios`}
                className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Proceed to Certification →
              </Link>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {modules.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              No training modules have been configured for this industry yet.
            </p>
            <button
              onClick={markComplete}
              disabled={completing || allComplete}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {completing ? "Saving…" : allComplete ? "✓ Training Complete" : "Acknowledge & Continue →"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              {modules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActive(m)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    activeModule?.id === m.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <span className="text-sm font-medium text-foreground">
                    {m.module_number}. {m.title}
                  </span>
                </button>
              ))}
            </div>

            <div className="md:col-span-2">
              {activeModule ? (
                <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    Module {activeModule.module_number}: {activeModule.title}
                  </h2>
                  {activeModule.video_url && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <iframe src={activeModule.video_url} className="w-full h-full" allowFullScreen />
                    </div>
                  )}
                  {activeModule.content && (
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {activeModule.content}
                    </div>
                  )}
                  <button
                    onClick={markComplete}
                    disabled={completing || allComplete}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {completing ? "Saving…" : allComplete ? "✓ Training Complete" : "Complete Training & Continue →"}
                  </button>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                  Select a module to begin
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}