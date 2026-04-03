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

interface ModuleRow {
  id:          string;
  title:       string;
  description: string | null;
  dayStart:    number | null;
  dayEnd:      number | null;
  orderIndex:  number;
  isActive:    boolean;
  createdAt:   string | null;
  updatedAt:   string | null;
}

interface ExerciseRow {
  id:          string;
  moduleId:    string;
  title:       string;
  description: string | null;
  dayNumber:   number | null;
  orderIndex:  number;
  isActive:    boolean;
}

interface ExerciseFormValues {
  title:       string;
  description: string;
  dayNumber:   string;
  orderIndex:  string;
  isActive:    boolean;
}

interface ModuleFormValues {
  title:       string;
  description: string;
  dayStart:    string;
  dayEnd:      string;
  orderIndex:  string;
  isActive:    boolean;
}

type Tab = "users" | "sync" | "webhooks" | "modules";

const emptyExForm = (): ExerciseFormValues => ({
  title: "", description: "", dayNumber: "", orderIndex: "0", isActive: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString() : "—";

const emptyForm = (): ModuleFormValues => ({
  title: "", description: "", dayStart: "", dayEnd: "", orderIndex: "0", isActive: true,
});

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
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

// ─── Module modal form ────────────────────────────────────────────────────────
function ModuleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: ModuleFormValues;
  onSave:  (values: ModuleFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form,    setForm]    = useState<ModuleFormValues>(initial);
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState("");

  const set = (k: keyof ModuleFormValues, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormErr("Title is required."); return; }
    setSaving(true);
    setFormErr("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setFormErr(err instanceof ApiError ? err.message : "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <form onSubmit={submit}>
          <div className="px-6 py-5 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold text-foreground text-base">
              {initial.title ? "Edit Module" : "Create Module"}
            </h2>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {formErr && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{formErr}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Module 1 — Foundation & Setup"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Short description shown to clients"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Day Start</label>
                <input
                  type="number"
                  min={1}
                  value={form.dayStart}
                  onChange={(e) => set("dayStart", e.target.value)}
                  placeholder="1"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Day End</label>
                <input
                  type="number"
                  min={1}
                  value={form.dayEnd}
                  onChange={(e) => set("dayEnd", e.target.value)}
                  placeholder="6"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Order</label>
                <input
                  type="number"
                  min={0}
                  value={form.orderIndex}
                  onChange={(e) => set("orderIndex", e.target.value)}
                  placeholder="0"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="isActive" className="text-sm text-foreground">
                Active (visible to clients)
              </label>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Module"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Exercise panel (shown inline under a module row) ─────────────────────────
function ExercisePanel({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const [exercises,  setExercises]  = useState<ExerciseRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<ExerciseRow | null>(null);
  const [form,       setForm]       = useState<ExerciseFormValues>(emptyExForm());
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [formErr,    setFormErr]    = useState("");

  const loadExercises = async () => {
    const data = await apiFetch<{ exercises: ExerciseRow[] }>(`/admin/modules/${moduleId}/exercises`);
    setExercises(data.exercises);
  };

  useEffect(() => {
    loadExercises().finally(() => setLoading(false));
  }, [moduleId]);

  const openCreate = () => { setEditTarget(null); setForm(emptyExForm()); setFormErr(""); setShowForm(true); };
  const openEdit   = (ex: ExerciseRow) => {
    setEditTarget(ex);
    setForm({ title: ex.title, description: ex.description ?? "", dayNumber: ex.dayNumber?.toString() ?? "", orderIndex: ex.orderIndex.toString(), isActive: ex.isActive });
    setFormErr("");
    setShowForm(true);
  };

  const saveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormErr("Title is required."); return; }
    setSaving(true); setFormErr("");
    try {
      const body = {
        title:       form.title.trim(),
        description: form.description.trim() || null,
        dayNumber:   form.dayNumber ? parseInt(form.dayNumber) : null,
        orderIndex:  parseInt(form.orderIndex) || 0,
        isActive:    form.isActive,
      };
      if (editTarget) {
        await apiFetch(`/admin/exercises/${editTarget.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/admin/modules/${moduleId}/exercises`, { method: "POST", body: JSON.stringify(body) });
      }
      await loadExercises();
      setShowForm(false);
    } catch {
      setFormErr("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEx = async (id: string) => {
    if (!confirm("Delete this exercise?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/admin/exercises/${id}`, { method: "DELETE" });
      setExercises((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mt-2 ml-4 border-l-2 border-primary/30 pl-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exercises</span>
        <div className="flex gap-2">
          <button onClick={openCreate} className="text-xs px-3 py-1 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20">
            + Add Exercise
          </button>
          <button onClick={onClose} className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground">
            ✕ Close
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveExercise} className="bg-muted/20 border border-border rounded-lg p-4 mb-4 space-y-3">
          {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm((f) => ({...f, title: e.target.value}))}
                placeholder="Day 1 — System orientation and dashboard overview"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Day Number</label>
              <input type="number" min={1} value={form.dayNumber} onChange={(e) => setForm((f) => ({...f, dayNumber: e.target.value}))}
                placeholder="1" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Order</label>
              <input type="number" min={0} value={form.orderIndex} onChange={(e) => setForm((f) => ({...f, orderIndex: e.target.value}))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm((f) => ({...f, description: e.target.value}))}
                placeholder="Optional description shown to clients"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="ex-active" checked={form.isActive} onChange={(e) => setForm((f) => ({...f, isActive: e.target.checked}))} className="w-4 h-4 accent-primary" />
              <label htmlFor="ex-active" className="text-sm text-foreground">Active (visible to clients)</label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save Exercise"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading exercises…</p>
      ) : exercises.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No exercises yet. <button onClick={openCreate} className="text-primary underline">Add the first one.</button></p>
      ) : (
        <table className="w-full text-xs mb-2">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              {["Day", "Title", "Order", "Active", ""].map((h) => (
                <th key={h} className="pb-1.5 pr-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exercises.map((ex) => (
              <tr key={ex.id} className="border-b border-border/40 hover:bg-muted/10">
                <td className="py-1.5 pr-3 text-muted-foreground">{ex.dayNumber ?? "—"}</td>
                <td className="py-1.5 pr-3 text-foreground max-w-xs truncate">{ex.title}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{ex.orderIndex}</td>
                <td className="py-1.5 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${ex.isActive ? "bg-green-900/40 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {ex.isActive ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="py-1.5 flex gap-2">
                  <button onClick={() => openEdit(ex)} className="text-muted-foreground hover:text-foreground">Edit</button>
                  <button onClick={() => deleteEx(ex.id)} disabled={deleting === ex.id} className="text-destructive/70 hover:text-destructive disabled:opacity-50">
                    {deleting === ex.id ? "…" : "Del"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab,         setTab]         = useState<Tab>("users");
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [syncEvents,  setSyncEvents]  = useState<SyncEventRow[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogRow[]>([]);
  const [modules,        setModules]        = useState<ModuleRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Module modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<ModuleRow | null>(null);
  const [deleting,    setDeleting]    = useState<string | null>(null);

  const navigate = useNavigate();

  const loadAll = async () => {
    const [u, s, w, m] = await Promise.all([
      apiFetch<{ users: UserRow[] }>("/admin/users"),
      apiFetch<{ events: SyncEventRow[] }>("/admin/sync-events"),
      apiFetch<{ logs: WebhookLogRow[] }>("/admin/webhook-log"),
      apiFetch<{ modules: ModuleRow[] }>("/admin/modules"),
    ]);
    setUsers(u.users);
    setSyncEvents(s.events);
    setWebhookLogs(w.logs);
    setModules(m.modules);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
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

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit   = (m: ModuleRow) => { setEditTarget(m); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const saveModule = async (values: ModuleFormValues) => {
    const body = {
      title:       values.title.trim(),
      description: values.description.trim() || null,
      dayStart:    values.dayStart ? parseInt(values.dayStart) : null,
      dayEnd:      values.dayEnd   ? parseInt(values.dayEnd)   : null,
      orderIndex:  parseInt(values.orderIndex) || 0,
      isActive:    values.isActive,
    };
    if (editTarget) {
      await apiFetch(`/admin/modules/${editTarget.id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/admin/modules", { method: "POST", body: JSON.stringify(body) });
    }
    const m = await apiFetch<{ modules: ModuleRow[] }>("/admin/modules");
    setModules(m.modules);
  };

  const deleteModuleById = async (id: string) => {
    if (!confirm("Delete this module? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await apiFetch(`/admin/modules/${id}`, { method: "DELETE" });
      setModules((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeleting(null);
    }
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
    modules:  `Modules (${modules.length})`,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Module modal */}
      {modalOpen && (
        <ModuleModal
          initial={
            editTarget
              ? {
                  title:       editTarget.title,
                  description: editTarget.description ?? "",
                  dayStart:    editTarget.dayStart?.toString() ?? "",
                  dayEnd:      editTarget.dayEnd?.toString() ?? "",
                  orderIndex:  editTarget.orderIndex.toString(),
                  isActive:    editTarget.isActive,
                }
              : emptyForm()
          }
          onSave={saveModule}
          onClose={closeModal}
        />
      )}

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
          {(["users", "modules", "sync", "webhooks"] as Tab[]).map((t) => (
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
                      <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "wibiz_admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
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

        {/* ── Modules ── */}
        {tab === "modules" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Manage the 30-day programme modules. Changes reflect immediately on the client dashboard.
              </p>
              <button
                onClick={openCreate}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                + Create Module
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    {["Order", "Title", "Days", "Description", "Status", "Actions"].map((h) => (
                      <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <>
                    <tr key={m.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{m.orderIndex}</td>
                      <td className="py-3 pr-4 font-medium text-foreground max-w-xs">
                        {m.title}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {m.dayStart && m.dayEnd ? `Day ${m.dayStart}–${m.dayEnd}` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground max-w-xs truncate">
                        {m.description ?? "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge ok={m.isActive} label={m.isActive ? "Active" : "Hidden"} />
                      </td>
                      <td className="py-3 flex gap-2">
                        <button
                          onClick={() => setExpandedModule(expandedModule === m.id ? null : m.id)}
                          className={`text-xs px-3 py-1 border rounded-lg ${expandedModule === m.id ? "border-primary/50 text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-muted/40"}`}
                        >
                          Exercises
                        </button>
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs px-3 py-1 border border-border rounded-lg text-foreground hover:bg-muted/40"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteModuleById(m.id)}
                          disabled={deleting === m.id}
                          className="text-xs px-3 py-1 border border-destructive/40 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {deleting === m.id ? "…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                    {expandedModule === m.id && (
                      <tr key={`${m.id}-ex`} className="bg-muted/10">
                        <td colSpan={6} className="pb-4 pt-1 px-2">
                          <ExercisePanel moduleId={m.id} onClose={() => setExpandedModule(null)} />
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                  {modules.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        No modules yet.{" "}
                        <button onClick={openCreate} className="text-primary underline">
                          Create the first one.
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Sync Events ── */}
        {tab === "sync" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  {["Event Type", "Entity", "Status", "Error", "Time"].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncEvents.map((e) => (
                  <tr key={e.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 pr-4 font-mono text-xs">{e.eventType ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{e.entityType ?? "—"}</td>
                    <td className="py-2 pr-4"><SyncStatusBadge status={e.status} /></td>
                    <td className="py-2 pr-4 text-xs text-destructive max-w-xs truncate">{e.errorMessage ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(e.createdAt)}</td>
                  </tr>
                ))}
                {syncEvents.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No sync events yet</td></tr>
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
                    <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>
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
                    <td className="py-2 pr-4 text-xs text-destructive max-w-sm truncate">{w.error ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(w.receivedAt)}</td>
                  </tr>
                ))}
                {webhookLogs.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No webhook events yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
