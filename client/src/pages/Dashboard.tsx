import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Module {
  id:          string;
  title:       string;
  description: string | null;
  dayStart:    number | null;
  dayEnd:      number | null;
  orderIndex:  number;
  status:      "available" | "locked";
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
}

type HskdStatus = "not_started" | "in_progress" | "pending_review" | "certified";

interface HskdSummary {
  status:        HskdStatus;
  industry_name?: string;
  industry_slug?: string;
  certificate_id?: string;
  current_step?:  number;
  total_steps:    number;
}

// ─── HskdSummaryCard (inline — no separate components folder needed) ──────────

function HskdSummaryCard() {
  const navigate = useNavigate();
  const [summary,  setSummary]  = useState<HskdSummary | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiFetch<HskdSummary>("/client/hskd/summary")
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🛡️</span>
          <span className="font-semibold text-sm text-foreground">ClearPath Certification</span>
        </div>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // ── NOT STARTED ─────────────────────────────────────────────────────────────
  if (!summary || summary.status === "not_started") {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🛡️</span>
          <span className="font-semibold text-sm text-foreground">ClearPath Certification</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Protect your business and unlock Specialist Mode — complete HSKD certification for your
          industry vertical.
        </p>
        <button
          onClick={() => navigate("/hskd")}
          className="text-xs px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Get Started →
        </button>
      </div>
    );
  }

  // ── IN PROGRESS ─────────────────────────────────────────────────────────────
  if (summary.status === "in_progress") {
    const step  = summary.current_step ?? 1;
    const total = summary.total_steps;
    const pct   = Math.round((step / total) * 100);
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="font-semibold text-sm text-foreground">ClearPath Certification</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            In Progress
          </span>
        </div>
        {summary.industry_name && (
          <p className="text-xs text-muted-foreground mb-2">{summary.industry_name}</p>
        )}
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Step {step} of {total}
        </p>
        <button
          onClick={() =>
            navigate(
              summary.industry_slug
                ? `/hskd/certify/${summary.industry_slug}/status`
                : "/hskd"
            )
          }
          className="text-xs px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Continue →
        </button>
      </div>
    );
  }

  // ── PENDING OPS REVIEW ───────────────────────────────────────────────────────
  if (summary.status === "pending_review") {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="font-semibold text-sm text-foreground">ClearPath Certification</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">
            Under Review
          </span>
        </div>
        {summary.industry_name && (
          <p className="text-xs text-muted-foreground mb-2">{summary.industry_name}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Submitted — pending WiBiz Ops sign-off. You will be notified within 1 business day.
        </p>
      </div>
    );
  }

  // ── CERTIFIED ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-card rounded-xl border border-green-200 dark:border-green-800 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-base">🛡️</span>
          <span className="font-semibold text-sm text-foreground">ClearPath Certification</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-medium">
          Certified ✓
        </span>
      </div>
      {summary.industry_name && (
        <p className="text-xs text-muted-foreground mb-1">{summary.industry_name}</p>
      )}
      {summary.certificate_id && (
        <p className="text-xs font-mono text-muted-foreground mb-3">{summary.certificate_id}</p>
      )}
      <button
        onClick={() =>
          navigate(
            summary.industry_slug
              ? `/hskd/certify/${summary.industry_slug}/status`
              : "/hskd"
          )
        }
        className="text-xs px-4 py-2 rounded-full bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
      >
        View Certificate →
      </button>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data,  setData]  = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<DashboardData>("/dashboard")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load dashboard. Please refresh.");
        }
      });
  }, [navigate]);

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
    navigate("/login", { replace: true });
  };

  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const { user, modules } = data;
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
        <div className="flex items-center gap-4">
          {user.role === "wibiz_admin" && (
            <Link to="/admin" className="text-sm text-primary hover:text-primary/80 font-medium">
              Admin
            </Link>
          )}
          <button
            onClick={logout}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground">Welcome, {displayName}</h2>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {user.planTier && (
              <span>
                Plan: <strong className="text-foreground capitalize">{user.planTier}</strong>
              </span>
            )}
            {user.vertical && (
              <span>
                Vertical: <strong className="text-foreground capitalize">{user.vertical}</strong>
              </span>
            )}
          </div>
        </div>

        {/* ── ClearPath Certification card (NEW) ── */}
        {/* Only show if hskdRequired is true OR if they've already started */}
        {(user.hskdRequired || user.hskdRequired === null) && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              ClearPath Certification
            </h3>
            <HskdSummaryCard />
          </div>
        )}

        {/* Programme */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Your 30-Day Programme
          </h3>

          {modules.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
              Your programme modules are being set up. Check back soon.
            </div>
          ) : (
            <div className="grid gap-3">
              {modules.map((m) => {
                const available = m.status === "available";
                return (
                  <div
                    key={m.id}
                    className={`bg-card rounded-xl border p-4 flex justify-between items-center transition-opacity ${
                      available ? "border-primary/30" : "border-border opacity-60"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{m.title}</p>
                      {m.description && (
                        <p className="text-sm text-muted-foreground">{m.description}</p>
                      )}
                      {m.dayStart && m.dayEnd && (
                        <p className="text-xs text-muted-foreground">
                          Day {m.dayStart}–{m.dayEnd}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ml-4 ${
                        available
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {available ? "Available" : "Locked"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}