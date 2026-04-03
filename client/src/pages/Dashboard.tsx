import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

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
  modules: { id: number; title: string; status: string; description: string }[];
}

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

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }
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
        <span className="text-lg font-bold text-foreground">WiBiz Academy</span>
        <div className="flex items-center gap-4">
          {user.role === "wibiz_admin" && (
            <Link
              to="/admin"
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
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
          <h2 className="text-xl font-semibold text-foreground">
            Welcome, {displayName}
          </h2>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              Plan:{" "}
              <strong className="text-foreground capitalize">
                {user.planTier ?? "—"}
              </strong>
            </span>
            <span>
              Vertical:{" "}
              <strong className="text-foreground capitalize">
                {user.vertical ?? "—"}
              </strong>
            </span>
            <span>
              Role:{" "}
              <strong className="text-foreground capitalize">
                {user.role.replace(/_/g, " ")}
              </strong>
            </span>
          </div>
        </div>

        {/* Modules */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Your Programme
          </h3>
          <div className="grid gap-3">
            {modules.map((m) => (
              <div
                key={m.id}
                className="bg-card rounded-xl border border-border p-4 flex justify-between items-center opacity-60"
              >
                <div>
                  <p className="font-medium text-foreground">{m.title}</p>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                  Locked
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Change password note */}
        <p className="text-xs text-muted-foreground text-center">
          To change your password, ask your administrator or use the{" "}
          <code className="font-mono bg-muted px-1 rounded">
            POST /api/auth/change-password
          </code>{" "}
          endpoint. {/* Phase 2: add /settings page */}
        </p>
      </main>
    </div>
  );
}
