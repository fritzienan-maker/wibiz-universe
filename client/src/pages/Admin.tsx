import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRow {
  id:           string;
  email:        string;
  firstName:    string | null;
  lastName:     string | null;
  role:         string;
  planTier:     string | null;
  vertical:     string | null;
  isActive:     boolean | null;
  ghlContactId: string | null;
  activatedAt:  string | null;
  createdAt:    string | null;
}

interface SyncEventRow {
  id:           string;
  eventType:    string | null;
  entityType:   string | null;
  status:       string | null;
  errorMessage: string | null;
  createdAt:    string | null;
}

interface WebhookLogRow {
  id:         string;
  source:     string | null;
  processed:  boolean | null;
  error:      string | null;
  receivedAt: string | null;
}

type Tab = "users" | "sync" | "webhooks";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString() : "—";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        ok
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {label}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: string | null }) {
  const cfg = {
    success: "bg-green-100 text-green-700",
    failed:  "bg-red-100 text-red-700",
    pending: "bg-yellow-100 text-yellow-700",
  }[status ?? "pending"] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg}`}>
      {status ?? "pending"}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab,         setTab]         = useState<Tab>("users");
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [syncEvents,  setSyncEvents]  = useState<SyncEventRow[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [u, s, w] = await Promise.all([
          apiFetch<{ users: UserRow[] }>("/admin/users"),
          apiFetch<{ events: SyncEventRow[] }>("/admin/sync-events"),
          apiFetch<{ logs: WebhookLogRow[] }>("/admin/webhook-log"),
        ]);
        setUsers(u.users);
        setSyncEvents(s.events);
        setWebhookLogs(w.logs);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          navigate("/dashboard", { replace: true });
        } else {
          setError("Failed to load admin data. Please refresh.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  const tabLabels: Record<Tab, string> = {
    users:    `Users (${users.length})`,
    sync:     "Sync Events",
    webhooks: "Webhook Log",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-foreground">Admin</span>
        </div>
        <button
          onClick={logout}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["users", "sync", "webhooks"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* ── Users ── */}
        {tab === "users" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  {["Email", "Name", "Role", "Plan", "Vertical", "Active", "GHL ID", "Provisioned"].map(
                    (h) => (
                      <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 pr-4 font-mono text-xs">{u.email}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === "wibiz_admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-4 capitalize">{u.planTier ?? "—"}</td>
                    <td className="py-2 pr-4 capitalize">{u.vertical ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge ok={Boolean(u.isActive)} label={u.isActive ? "Yes" : "No"} />
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {u.ghlContactId ? `${u.ghlContactId.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(u.createdAt)}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      No users provisioned yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Sync Events ── */}
        {tab === "sync" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  {["Event Type", "Entity", "Status", "Error", "Time"].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncEvents.map((e) => (
                  <tr key={e.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 pr-4 font-mono text-xs">{e.eventType ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{e.entityType ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <SyncStatusBadge status={e.status} />
                    </td>
                    <td className="py-2 pr-4 text-xs text-destructive max-w-xs truncate">
                      {e.errorMessage ?? "—"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(e.createdAt)}
                    </td>
                  </tr>
                ))}
                {syncEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      No sync events yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Webhook Log ── */}
        {tab === "webhooks" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  {["Source", "Processed", "Error", "Received"].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {webhookLogs.map((w) => (
                  <tr key={w.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 pr-4">{w.source ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge ok={Boolean(w.processed)} label={w.processed ? "Yes" : "No"} />
                    </td>
                    <td className="py-2 pr-4 text-xs text-destructive max-w-sm truncate">
                      {w.error ?? "—"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(w.receivedAt)}
                    </td>
                  </tr>
                ))}
                {webhookLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-muted-foreground">
                      No webhook events yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
