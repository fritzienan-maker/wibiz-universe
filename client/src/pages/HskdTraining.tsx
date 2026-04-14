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
  completed:     boolean;
}

interface TrainingData {
  modules:              TrainingModule[];
  all_complete:         boolean;
  certification_id:     string;
}

export default function HskdTrainingPage() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const [data, setData]             = useState<TrainingData | null>(null);
  const [activeModule, setActive]   = useState<TrainingModule | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError]           = useState("");
  const navigate = useNavigate();

  const load = () => {
    apiFetch<TrainingData>(`/client/hskd/training?industry_slug=${industrySlug}`)
      .then((d) => {
        setData(d);
        if (!activeModule) {
          const first = d.modules.find((m) => !m.completed);
          setActive(first ?? d.modules[0] ?? null);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load training. Please refresh.");
        }
      });
  };

  useEffect(() => { load(); }, [industrySlug]);

  const markComplete = async (moduleId: string) => {
    setCompleting(true);
    try {
      await apiFetch(`/client/hskd/training/${moduleId}/complete`, { method: "POST" });
      load();
    } catch {
      setError("Failed to mark complete. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const completed = data.modules.filter((m) => m.completed).length;
  const total     = data.modules.length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
        <Link to="/hskd" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Certification
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Progress */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-foreground">Training Modules</h1>
            <span className="text-sm text-muted-foreground">{completed} of {total} complete</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {data.all_complete && (
            <div className="flex justify-end">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Module list */}
          <div className="space-y-2">
            {data.modules.map((m, idx) => {
              const unlocked = idx === 0 || data.modules[idx - 1]?.completed;
              return (
                <button
                  key={m.id}
                  onClick={() => unlocked && setActive(m)}
                  disabled={!unlocked}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    activeModule?.id === m.id
                      ? "border-primary/50 bg-primary/5"
                      : unlocked
                      ? "border-border bg-card hover:border-primary/30"
                      : "border-border bg-card opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {m.module_number}. {m.title}
                    </span>
                    {m.completed ? (
                      <span className="text-green-500 text-xs">✓</span>
                    ) : !unlocked ? (
                      <span className="text-muted-foreground text-xs">🔒</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Module content */}
          <div className="md:col-span-2">
            {activeModule ? (
              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Module {activeModule.module_number}: {activeModule.title}
                </h2>

                {activeModule.video_url && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      src={activeModule.video_url}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                )}

                {activeModule.content && (
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {activeModule.content}
                  </div>
                )}

                {!activeModule.completed ? (
                  <button
                    onClick={() => markComplete(activeModule.id)}
                    disabled={completing}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {completing ? "Saving…" : "Mark as Complete ✓"}
                  </button>
                ) : (
                  <div className="text-center text-sm text-green-600 font-medium py-2">
                    ✓ Module Complete
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                Select a module to begin
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}