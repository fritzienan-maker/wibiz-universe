import { useEffect, useState, Fragment } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { useTheme } from "../lib/theme";

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
  proofPrompt: string;
  videoUrl:    string;
  dayNumber:   string;
  orderIndex:  string;
  isActive:    boolean;
}

interface SubmissionRow {
  id:               string;
  userId:           string;
  exerciseId:       string;
  proofText:        string | null;
  proofImageUrl:    string | null;
  submissionStatus: "pending_review" | "approved" | "rejected";
  submittedAt:      string | null;
  reviewedAt:       string | null;
  reviewNote:       string | null;
  userEmail:        string;
  userFirstName:    string | null;
  userLastName:     string | null;
  exerciseTitle:    string;
  exerciseDayNum:   number | null;
}

interface ModuleFormValues {
  title:       string;
  description: string;
  dayStart:    string;
  dayEnd:      string;
  orderIndex:  string;
  isActive:    boolean;
}

// ─── HSKD Types ───────────────────────────────────────────────────────────────
interface HskdCertRow {
  id:                          string;
  client_id:                   string;
  status:                      string;
  industry_name:               string;
  industry_slug:               string;
  tier:                        string;
  certificate_id:              string | null;
  affirmation_legal_name:      string | null;
  affirmation_license_type:    string | null;
  affirmation_license_number:  string | null;
  affirmation_license_state:   string | null;
  oncall_contact_name:         string | null;
  oncall_contact_phone:        string | null;
  mandatory_reporter_status:   string | null;
  hipaa_baa_executed:          boolean | null;
  hipaa_baa_date:              string | null;
  training_completed_at:       string | null;
  affirmation_submitted_at:    string | null;
  ops_signoff_by:              string | null;
  ops_signoff_at:              string | null;
  specialist_mode_activated_at: string | null;
  kb_review_due_at:            string | null;
  created_at:                  string | null;
  updated_at:                  string | null;
}

interface HskdScenarioLog {
  id:              string;
  scenario_number: number;
  scenario_title:  string;
  decision:        string;
  decided_at:      string | null;
}

interface HskdProhibitedLog {
  id:               string;
  category:         string | null;
  restriction_text: string | null;
  confirmed_at:     string | null;
}

interface HskdCertDetail {
  certification:   HskdCertRow;
  scenario_logs:   HskdScenarioLog[];
  prohibited_logs: HskdProhibitedLog[];
}

interface HskdCountRow {
  status: string;
  count:  string;
}

type Tab = "users" | "sync" | "webhooks" | "modules" | "submissions" | "provision" | "resources" | "hskd" | "certifications";

interface ResourceRow {
  id:          string;
  title:       string;
  description: string | null;
  category:    string | null;
  url:         string | null;
  icon:        string | null;
  orderIndex:  number;
  isActive:    boolean;
  createdAt:   string | null;
}

interface ResourceFormValues {
  title:       string;
  description: string;
  category:    string;
  url:         string;
  icon:        string;
  orderIndex:  string;
  isActive:    boolean;
}

interface TutorialRow {
  id:         string;
  title:      string;
  duration:   string | null;
  videoUrl:   string | null;
  orderIndex: number;
  isActive:   boolean;
  createdAt:  string | null;
}

interface TutorialFormValues {
  title:      string;
  duration:   string;
  videoUrl:   string;
  orderIndex: string;
  isActive:   boolean;
}

const emptyResourceForm = (): ResourceFormValues => ({
  title: "", description: "", category: "guide", url: "", icon: "", orderIndex: "0", isActive: true,
});

const emptyTutorialForm = (): TutorialFormValues => ({
  title: "", duration: "", videoUrl: "", orderIndex: "0", isActive: true,
});

const emptyExForm = (): ExerciseFormValues => ({
  title: "", description: "", proofPrompt: "", videoUrl: "", dayNumber: "", orderIndex: "0", isActive: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString() : "—";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const emptyForm = (): ModuleFormValues => ({
  title: "", description: "", dayStart: "", dayEnd: "", orderIndex: "0", isActive: true,
});

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? "bg-green-900/40 text-green-400 border border-green-800/50" : "bg-red-900/40 text-red-400 border border-red-800/50"}`}>
      {label}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: string | null }) {
  const cfg = {
    success: "bg-green-900/40 text-green-400",
    failed:  "bg-red-900/40 text-red-400",
    pending: "bg-yellow-900/40 text-yellow-400",
  }[status ?? "pending"] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg}`}>
      {status ?? "pending"}
    </span>
  );
}

function HskdStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    CERTIFIED:   "bg-green-900/40 text-green-400 border border-green-800/50",
    OPS_REVIEW:  "bg-yellow-900/40 text-yellow-400 border border-yellow-800/50",
    AFFIRMATION: "bg-blue-900/40 text-blue-400 border border-blue-800/50",
    PROHIBITED:  "bg-blue-900/40 text-blue-400 border border-blue-800/50",
    SCENARIOS:   "bg-blue-900/40 text-blue-400 border border-blue-800/50",
    TRAINING:    "bg-muted text-muted-foreground",
    REJECTED:    "bg-red-900/40 text-red-400 border border-red-800/50",
  };
  const labelMap: Record<string, string> = {
    CERTIFIED:   "Certified",
    OPS_REVIEW:  "Pending Sign-Off",
    AFFIRMATION: "Affirmation",
    PROHIBITED:  "Prohibited",
    SCENARIOS:   "Scenarios",
    TRAINING:    "Training",
    REJECTED:    "Rejected",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg[status] ?? "bg-muted text-muted-foreground"}`}>
      {labelMap[status] ?? status}
    </span>
  );
}

// ─── HSKD Certifications Tab ──────────────────────────────────────────────────
function TabHskdCertifications() {
  const [certs,         setCerts]         = useState<HskdCertRow[]>([]);
  const [counts,        setCounts]        = useState<HskdCountRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterStatus,  setFilterStatus]  = useState<string>("all");
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [detail,        setDetail]        = useState<HskdCertDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [signoffName,   setSignoffName]   = useState("");
  const [signingOff,    setSigningOff]    = useState(false);
  const [signoffErr,    setSignoffErr]    = useState("");
  const [signoffOk,     setSignoffOk]     = useState<string | null>(null);
  const [checklist,     setChecklist]     = useState<Record<string, boolean[]>>({});

  const load = async (status?: string) => {
    setLoading(true);
    try {
      const qs = status && status !== "all" ? `?status=${status}` : "";
      const data = await apiFetch<{ certifications: HskdCertRow[]; counts: HskdCountRow[] }>(
        `/admin/hskd/certifications${qs}`
      );
      setCerts(data.certifications);
      setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filterStatus); }, [filterStatus]);

  const openDetail = async (cert: HskdCertRow) => {
    if (expanded === cert.id) { setExpanded(null); setDetail(null); return; }
    setExpanded(cert.id);
    setDetail(null);
    setSignoffErr("");
    setSignoffOk(null);
    setSignoffName("");
    setDetailLoading(true);
    try {
      const data = await apiFetch<HskdCertDetail>(`/admin/hskd/certifications/${cert.id}`);
      setDetail(data);
      const itemCount = (() => {
        const base = 4;
        const slug = cert.industry_slug;
        let count = base;
        if (slug === "clinics" || slug === "social-welfare") count++;
        if (slug === "legal-services") count++;
        if (slug === "social-welfare") count += 2;
        count++; // "30-day KB review task"
        return count;
      })();
      setChecklist((prev) => ({ ...prev, [cert.id]: prev[cert.id] ?? Array(itemCount).fill(false) }));
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleCheck = (certId: string, idx: number) => {
    setChecklist((prev) => {
      const cert = certs.find((c) => c.id === certId);
      const itemCount = cert ? checklistItems(cert).length : 8;
      const arr = [...(prev[certId] ?? Array(itemCount).fill(false))];
      arr[idx] = !arr[idx];
      return { ...prev, [certId]: arr };
    });
  };

  const allChecked = (certId: string) => {
    const arr = checklist[certId] ?? [];
    return arr.length > 0 && arr.every(Boolean);
  };

  const doSignoff = async (certId: string) => {
    if (!signoffName.trim()) { setSignoffErr("Enter your name to sign off."); return; }
    const items = checklistItems(certs.find((c) => c.id === certId)!);
    const checked = checklist[certId] ?? [];
    const unchecked = items.filter((_, i) => !checked[i]);
    if (unchecked.length > 0) { setSignoffErr(`Please check all items: ${unchecked[0]}`); return; }
    setSigningOff(true);
    setSignoffErr("");
    try {
      const result = await apiFetch<{ certificate_id: string }>(
        `/admin/hskd/certifications/${certId}/signoff`,
        { method: "PATCH", body: JSON.stringify({ ops_signoff_by: signoffName.trim() }) }
      );
      setSignoffOk(result.certificate_id);
      await load(filterStatus);
      const data = await apiFetch<HskdCertDetail>(`/admin/hskd/certifications/${certId}`);
      setDetail(data);
    } catch (err) {
      setSignoffErr(err instanceof ApiError ? err.message : "Sign-off failed.");
    } finally {
      setSigningOff(false);
    }
  };

  const getCount = (status: string) => {
    const row = counts.find((c) => c.status === status);
    return row ? parseInt(row.count) : 0;
  };

  const checklistItems = (cert: HskdCertRow) => {
    const base = [
      "All 5 scenarios confirmed APPROVED",
      "All prohibited items individually confirmed",
      "On-call contact verified",
      "ClearPath Affirmation submitted with legal name",
    ];
    if (cert.industry_slug === "clinics" || cert.industry_slug === "social-welfare") base.push("HIPAA BAA executed and date on file");
    if (cert.industry_slug === "legal-services") base.push("State bar license number on file");
    if (cert.industry_slug === "social-welfare") { base.push("Mandatory reporter status confirmed"); base.push("ED/CEO sign-off noted"); }
    base.push("30-day KB review task created (if applicable)");
    return base;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Certified",        status: "CERTIFIED",  color: "text-green-400" },
          { label: "Pending Sign-Off", status: "OPS_REVIEW", color: "text-yellow-400" },
          { label: "In Progress",      status: "TRAINING",   color: "text-blue-400" },
          { label: "Rejected",         status: "REJECTED",   color: "text-red-400" },
        ].map(({ label, status, color }) => (
          <div key={status} className="bg-card border border-border rounded-xl p-4">
            <div className={`text-2xl font-bold ${color}`}>{getCount(status)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Filter:</span>
        {["all", "OPS_REVIEW", "CERTIFIED", "TRAINING", "SCENARIOS", "AFFIRMATION", "PROHIBITED", "REJECTED"].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${filterStatus === s ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
            {s === "all" ? "All" : s === "OPS_REVIEW" ? "Pending Sign-Off" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : certs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No certifications found.</p>
      ) : (
        <div className="space-y-2">
          {certs.map((cert) => {
            const isOpen = expanded === cert.id;
            const clientName = cert.affirmation_legal_name ?? `Client ${cert.client_id.slice(0, 8)}`;
            return (
              <div key={cert.id} className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/20" onClick={() => openDetail(cert)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{clientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {cert.industry_name}
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${cert.tier === "TIER_0" ? "bg-red-900/40 text-red-400" : "bg-amber-900/40 text-amber-400"}`}>{cert.tier}</span>
                    </div>
                  </div>
                  <HskdStatusBadge status={cert.status} />
                  <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">{fmtDate(cert.created_at)}</div>
                  {cert.certificate_id ? (
                    <div className="text-xs font-mono text-green-400 hidden md:block truncate max-w-[180px]">{cert.certificate_id}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground/40 hidden md:block">No cert ID</div>
                  )}
                  <span className="text-muted-foreground text-sm">{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <div className="border-t border-border bg-muted/10 px-5 py-5 space-y-5">
                    {detailLoading ? (
                      <p className="text-sm text-muted-foreground">Loading detail…</p>
                    ) : detail && detail.certification.id === cert.id ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-4">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Client Info</div>
                              <dl className="space-y-1 text-sm">
                                <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">Legal Name</dt><dd className="text-foreground">{cert.affirmation_legal_name ?? "—"}</dd></div>
                                <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">License Type</dt><dd className="text-foreground">{cert.affirmation_license_type ?? "—"}</dd></div>
                                <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">License #</dt><dd className="text-foreground font-mono">{cert.affirmation_license_number ?? "—"}</dd></div>
                                <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">License State</dt><dd className="text-foreground">{cert.affirmation_license_state ?? "—"}</dd></div>
                                <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">On-Call</dt><dd className="text-foreground">{cert.oncall_contact_name ?? "—"}</dd></div>
                                <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">On-Call Phone</dt><dd className="text-foreground">{cert.oncall_contact_phone ?? "—"}</dd></div>
                                {(cert.industry_slug === "clinics" || cert.industry_slug === "social-welfare") && (
                                  <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">HIPAA BAA</dt><dd className={cert.hipaa_baa_executed ? "text-green-400" : "text-red-400"}>{cert.hipaa_baa_executed ? `Yes — ${fmtDate(cert.hipaa_baa_date)}` : "Not executed"}</dd></div>
                                )}
                                {cert.industry_slug === "social-welfare" && (
                                  <div className="flex gap-2"><dt className="text-muted-foreground w-32 shrink-0">Mandatory Reporter</dt><dd className="text-foreground">{cert.mandatory_reporter_status ?? "—"}</dd></div>
                                )}
                              </dl>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</div>
                              <dl className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex gap-2"><dt className="w-36 shrink-0">Started</dt><dd>{fmt(cert.created_at)}</dd></div>
                                <div className="flex gap-2"><dt className="w-36 shrink-0">Training Complete</dt><dd>{fmt(cert.training_completed_at)}</dd></div>
                                <div className="flex gap-2"><dt className="w-36 shrink-0">Affirmation Submitted</dt><dd>{fmt(cert.affirmation_submitted_at)}</dd></div>
                                {cert.ops_signoff_at && <div className="flex gap-2"><dt className="w-36 shrink-0">Ops Sign-Off</dt><dd>{fmt(cert.ops_signoff_at)} by {cert.ops_signoff_by}</dd></div>}
                                {cert.kb_review_due_at && <div className="flex gap-2"><dt className="w-36 shrink-0">KB Review Due</dt><dd className={new Date(cert.kb_review_due_at) < new Date() ? "text-red-400" : "text-foreground"}>{fmtDate(cert.kb_review_due_at)}</dd></div>}
                              </dl>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scenario Logs ({detail.scenario_logs.length}/5)</div>
                              {detail.scenario_logs.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No scenario decisions logged yet.</p>
                              ) : (
                                <div className="space-y-1">
                                  {detail.scenario_logs.map((log) => (
                                    <div key={log.id} className="flex items-center gap-2 text-xs">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${log.decision === "APPROVED" ? "bg-green-400" : "bg-red-400"}`} />
                                      <span className="text-foreground">S{log.scenario_number} — {log.scenario_title}</span>
                                      <span className={`ml-auto font-medium ${log.decision === "APPROVED" ? "text-green-400" : "text-red-400"}`}>{log.decision}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prohibited Items Confirmed ({detail.prohibited_logs.length})</div>
                              {detail.prohibited_logs.length === 0 ? (
                                <p className="text-xs text-muted-foreground">None confirmed yet.</p>
                              ) : (
                                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                  {detail.prohibited_logs.map((log, i) => (
                                    <div key={log.id} className="flex items-center gap-2 text-xs">
                                      <span className="text-green-400">✓</span>
                                      <span className="text-muted-foreground">{log.category ?? `Item ${i + 1}`}</span>
                                      <span className="ml-auto text-muted-foreground/60">{log.confirmed_at ? new Date(log.confirmed_at).toLocaleTimeString() : ""}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {cert.status === "OPS_REVIEW" && (
                          <div className="border border-amber-700/40 bg-amber-900/10 rounded-xl p-4 space-y-4">
                            <div className="text-sm font-semibold text-amber-400">⚠ Ops Sign-Off Required</div>
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sign-Off Checklist</div>
                              {checklistItems(cert).map((item, idx) => (
                                <label key={idx} className="flex items-start gap-2 cursor-pointer">
                                  <input type="checkbox" checked={checklist[cert.id]?.[idx] ?? false} onChange={() => toggleCheck(cert.id, idx)} className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
                                  <span className="text-sm text-foreground">{item}</span>
                                </label>
                              ))}
                            </div>
                            <div className="flex items-end gap-3 flex-wrap">
                              <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Your name (ops sign-off)</label>
                                <input type="text" value={signoffName} onChange={(e) => setSignoffName(e.target.value)} placeholder="e.g. Aileen — WiBiz Ops" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                              </div>
                              <button disabled={signingOff || !signoffName.trim()} onClick={() => doSignoff(cert.id)} className="px-5 py-2 text-sm font-semibold bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                {signingOff ? "Processing…" : "Complete Ops Sign-Off →"}
                              </button>
                            </div>
                            {signoffErr && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{signoffErr}</div>}
                          </div>
                        )}
                        {cert.status === "CERTIFIED" && (
                          <div className="border border-green-700/40 bg-green-900/10 rounded-xl p-4 space-y-1">
                            <div className="text-sm font-semibold text-green-400">✓ Certified</div>
                            <div className="text-xs text-muted-foreground font-mono">{cert.certificate_id}</div>
                            <div className="text-xs text-muted-foreground">Signed off by {cert.ops_signoff_by} on {fmt(cert.ops_signoff_at)}</div>
                          </div>
                        )}
                        {signoffOk && (
                          <div className="border border-green-700/40 bg-green-900/10 rounded-xl p-3 text-sm text-green-400 font-medium">
                            ✓ Certified! Certificate ID: <span className="font-mono">{signoffOk}</span>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Module modal form ────────────────────────────────────────────────────────
function ModuleModal({ initial, onSave, onClose }: { initial: ModuleFormValues; onSave: (values: ModuleFormValues) => Promise<void>; onClose: () => void }) {
  const [form,    setForm]    = useState<ModuleFormValues>(initial);
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState("");

  const set = (k: keyof ModuleFormValues, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormErr("Title is required."); return; }
    setSaving(true); setFormErr("");
    try { await onSave(form); onClose(); }
    catch (err) { setFormErr(err instanceof ApiError ? err.message : "Save failed. Try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <form onSubmit={submit}>
          <div className="px-6 py-5 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold text-foreground text-base">{initial.title ? "Edit Module" : "Create Module"}</h2>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
          </div>
          <div className="px-6 py-5 space-y-4">
            {formErr && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{formErr}</p>}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
              <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Module 1 — Foundation & Setup" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Short description shown to clients" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-foreground mb-1">Day Start</label><input type="number" min={1} value={form.dayStart} onChange={(e) => set("dayStart", e.target.value)} placeholder="1" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1">Day End</label><input type="number" min={1} value={form.dayEnd} onChange={(e) => set("dayEnd", e.target.value)} placeholder="6" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1">Order</label><input type="number" min={0} value={form.orderIndex} onChange={(e) => set("orderIndex", e.target.value)} placeholder="0" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="w-4 h-4 accent-primary" />
              <label htmlFor="isActive" className="text-sm text-foreground">Active (visible to clients)</label>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{saving ? "Saving…" : "Save Module"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Exercise panel ───────────────────────────────────────────────────────────
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

  useEffect(() => { loadExercises().finally(() => setLoading(false)); }, [moduleId]);

  const openCreate = () => { setEditTarget(null); setForm(emptyExForm()); setFormErr(""); setShowForm(true); };
  const openEdit = (ex: ExerciseRow) => {
    setEditTarget(ex);
    setForm({ title: ex.title, description: ex.description ?? "", proofPrompt: (ex as any).proofPrompt ?? "", videoUrl: (ex as any).videoUrl ?? "", dayNumber: ex.dayNumber?.toString() ?? "", orderIndex: ex.orderIndex.toString(), isActive: ex.isActive });
    setFormErr(""); setShowForm(true);
  };

  const saveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormErr("Title is required."); return; }
    setSaving(true); setFormErr("");
    try {
      const body = { title: form.title.trim(), description: form.description.trim() || null, proofPrompt: form.proofPrompt.trim() || null, videoUrl: form.videoUrl.trim() || null, dayNumber: form.dayNumber ? parseInt(form.dayNumber) : null, orderIndex: parseInt(form.orderIndex) || 0, isActive: form.isActive };
      if (editTarget) { await apiFetch(`/admin/exercises/${editTarget.id}`, { method: "PUT", body: JSON.stringify(body) }); }
      else { await apiFetch(`/admin/modules/${moduleId}/exercises`, { method: "POST", body: JSON.stringify(body) }); }
      await loadExercises(); setShowForm(false);
    } catch { setFormErr("Save failed. Try again."); }
    finally { setSaving(false); }
  };

  const deleteEx = async (id: string) => {
    if (!confirm("Delete this exercise?")) return;
    setDeleting(id);
    try { await apiFetch(`/admin/exercises/${id}`, { method: "DELETE" }); setExercises((prev) => prev.filter((e) => e.id !== id)); }
    finally { setDeleting(null); }
  };

  return (
    <div className="mt-2 ml-4 border-l-2 border-primary/30 pl-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exercises</span>
        <div className="flex gap-2">
          <button onClick={openCreate} className="text-xs px-3 py-1 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20">+ Add Exercise</button>
          <button onClick={onClose} className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground">✕ Close</button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={saveExercise} className="bg-muted/20 border border-border rounded-lg p-4 mb-4 space-y-3">
          {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="block text-xs font-medium text-foreground mb-1">Title *</label><input type="text" value={form.title} onChange={(e) => setForm((f) => ({...f, title: e.target.value}))} placeholder="Module 1 — System orientation" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" required /></div>
            <div><label className="block text-xs font-medium text-foreground mb-1">Day Number</label><input type="number" min={1} value={form.dayNumber} onChange={(e) => setForm((f) => ({...f, dayNumber: e.target.value}))} placeholder="1" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div><label className="block text-xs font-medium text-foreground mb-1">Order</label><input type="number" min={0} value={form.orderIndex} onChange={(e) => setForm((f) => ({...f, orderIndex: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-foreground mb-1">Description</label><input type="text" value={form.description} onChange={(e) => setForm((f) => ({...f, description: e.target.value}))} placeholder="Optional description" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-foreground mb-1">Proof Prompt</label><input type="text" value={form.proofPrompt} onChange={(e) => setForm((f) => ({...f, proofPrompt: e.target.value}))} placeholder="e.g. Upload a screenshot showing your dashboard" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-foreground mb-1">Video URL (YouTube / Loom / Vimeo)</label><input type="url" value={form.videoUrl} onChange={(e) => setForm((f) => ({...f, videoUrl: e.target.value}))} placeholder="https://www.loom.com/share/..." className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="col-span-2 flex items-center gap-2"><input type="checkbox" id="ex-active" checked={form.isActive} onChange={(e) => setForm((f) => ({...f, isActive: e.target.checked}))} className="w-4 h-4 accent-primary" /><label htmlFor="ex-active" className="text-sm text-foreground">Active (visible to clients)</label></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{saving ? "Saving…" : "Save Exercise"}</button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading exercises…</p>
      ) : exercises.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No exercises yet. <button onClick={openCreate} className="text-primary underline">Add the first one.</button></p>
      ) : (
        <table className="w-full text-xs mb-2">
          <thead><tr className="text-left text-muted-foreground border-b border-border">{["Day","Title","Order","Active",""].map((h) => <th key={h} className="pb-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {exercises.map((ex) => (
              <tr key={ex.id} className="border-b border-border/40 hover:bg-muted/10">
                <td className="py-1.5 pr-3 text-muted-foreground">{ex.dayNumber ?? "—"}</td>
                <td className="py-1.5 pr-3 text-foreground max-w-xs truncate">{ex.title}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{ex.orderIndex}</td>
                <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-xs ${ex.isActive ? "bg-green-900/40 text-green-400" : "bg-muted text-muted-foreground"}`}>{ex.isActive ? "Active" : "Hidden"}</span></td>
                <td className="py-1.5 flex gap-2">
                  <button onClick={() => openEdit(ex)} className="text-muted-foreground hover:text-foreground">Edit</button>
                  <button onClick={() => deleteEx(ex.id)} disabled={deleting === ex.id} className="text-destructive/70 hover:text-destructive disabled:opacity-50">{deleting === ex.id ? "…" : "Del"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Quiz panel ───────────────────────────────────────────────────────────────
function QuizPanel({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  interface QuizQuestionRow {
    id:                 string;
    moduleId:           string;
    question:           string;
    options:            string[];
    correctAnswerIndex: number;
    orderIndex:         number;
    isActive:           boolean;
  }
  interface QuizQuestionForm {
    question:           string;
    option0:            string;
    option1:            string;
    option2:            string;
    option3:            string;
    correctAnswerIndex: string;
    orderIndex:         string;
    isActive:           boolean;
  }
  const emptyQForm = (): QuizQuestionForm => ({ question: "", option0: "", option1: "", option2: "", option3: "", correctAnswerIndex: "0", orderIndex: "0", isActive: true });

  const [questions,  setQuestions]  = useState<QuizQuestionRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<QuizQuestionRow | null>(null);
  const [form,       setForm]       = useState<QuizQuestionForm>(emptyQForm());
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [formErr,    setFormErr]    = useState("");

  const loadQuestions = async () => {
    try {
      const data = await apiFetch<{ questions: QuizQuestionRow[] }>(`/admin/modules/${moduleId}/quiz-questions`);
      setQuestions(data.questions);
    } catch { setQuestions([]); }
  };

  useEffect(() => { loadQuestions().finally(() => setLoading(false)); }, [moduleId]);

  const openCreate = () => { setEditTarget(null); setForm(emptyQForm()); setFormErr(""); setShowForm(true); };
  const openEdit = (q: QuizQuestionRow) => {
    setEditTarget(q);
    setForm({ question: q.question, option0: q.options[0] ?? "", option1: q.options[1] ?? "", option2: q.options[2] ?? "", option3: q.options[3] ?? "", correctAnswerIndex: q.correctAnswerIndex.toString(), orderIndex: q.orderIndex.toString(), isActive: q.isActive });
    setFormErr(""); setShowForm(true);
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim()) { setFormErr("Question text is required."); return; }
    if (!form.option0.trim() || !form.option1.trim()) { setFormErr("At least 2 options are required."); return; }
    setSaving(true); setFormErr("");
    try {
      const options = [form.option0, form.option1, form.option2, form.option3].map((o) => o.trim()).filter(Boolean);
      const body = { question: form.question.trim(), options, correctAnswerIndex: parseInt(form.correctAnswerIndex) || 0, orderIndex: parseInt(form.orderIndex) || 0, isActive: form.isActive };
      if (editTarget) { await apiFetch(`/admin/quiz-questions/${editTarget.id}`, { method: "PUT", body: JSON.stringify(body) }); }
      else { await apiFetch(`/admin/modules/${moduleId}/quiz-questions`, { method: "POST", body: JSON.stringify(body) }); }
      await loadQuestions(); setShowForm(false);
    } catch { setFormErr("Save failed. Try again."); }
    finally { setSaving(false); }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this quiz question?")) return;
    setDeleting(id);
    try { await apiFetch(`/admin/quiz-questions/${id}`, { method: "DELETE" }); setQuestions((prev) => prev.filter((q) => q.id !== id)); }
    finally { setDeleting(null); }
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="mt-2 ml-4 border-l-2 border-amber-500/30 pl-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Quiz Questions ({questions.length})</span>
        <div className="flex gap-2">
          <button onClick={openCreate} className="text-xs px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20">+ Add Question</button>
          <button onClick={onClose} className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground">✕ Close</button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={saveQuestion} className="bg-muted/20 border border-border rounded-lg p-4 mb-4 space-y-3">
          {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Question *</label>
            <textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} rows={2} placeholder="e.g. What should you do if a customer sends a complaint?" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([0, 1, 2, 3] as const).map((i) => (
              <div key={i}>
                <label className="block text-xs font-medium text-foreground mb-1">Option {optionLabels[i]} {i < 2 ? "*" : "(optional)"}</label>
                <input type="text" value={form[`option${i}` as keyof QuizQuestionForm] as string} onChange={(e) => setForm((f) => ({ ...f, [`option${i}`]: e.target.value }))} placeholder={`Option ${optionLabels[i]}`} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" required={i < 2} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Correct Answer *</label>
              <select value={form.correctAnswerIndex} onChange={(e) => setForm((f) => ({ ...f, correctAnswerIndex: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {optionLabels.map((label, i) => <option key={i} value={i}>Option {label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Order</label>
              <input type="number" min={0} value={form.orderIndex} onChange={(e) => setForm((f) => ({ ...f, orderIndex: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="q-active" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-primary" />
            <label htmlFor="q-active" className="text-sm text-foreground">Active (shown to clients)</label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{saving ? "Saving…" : "Save Question"}</button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading questions…</p>
      ) : questions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No quiz questions yet. <button onClick={openCreate} className="text-primary underline">Add the first one.</button></p>
      ) : (
        <table className="w-full text-xs mb-2">
          <thead><tr className="text-left text-muted-foreground border-b border-border">{["#","Question","Options","Correct","Active",""].map((h) => <th key={h} className="pb-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.id} className="border-b border-border/40 hover:bg-muted/10">
                <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                <td className="py-1.5 pr-3 text-foreground max-w-xs truncate">{q.question}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{q.options.length} options</td>
                <td className="py-1.5 pr-3 text-amber-400 font-medium">{optionLabels[q.correctAnswerIndex] ?? "?"}</td>
                <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-xs ${q.isActive ? "bg-green-900/40 text-green-400" : "bg-muted text-muted-foreground"}`}>{q.isActive ? "Active" : "Hidden"}</span></td>
                <td className="py-1.5 flex gap-2">
                  <button onClick={() => openEdit(q)} className="text-muted-foreground hover:text-foreground">Edit</button>
                  <button onClick={() => deleteQuestion(q.id)} disabled={deleting === q.id} className="text-destructive/70 hover:text-destructive disabled:opacity-50">{deleting === q.id ? "…" : "Del"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Submissions review panel ─────────────────────────────────────────────────
function TabSubmissions() {
  const [rows,      setRows]      = useState<SubmissionRow[]>([]);
  const [filter,    setFilter]    = useState<"pending_review" | "approved" | "rejected" | "all">("pending_review");
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [noteMap,   setNoteMap]   = useState<Record<string, string>>({});

  const load = async (f: typeof filter) => {
    setLoading(true);
    try {
      const qs = f === "all" ? "" : `?status=${f}`;
      const data = await apiFetch<{ submissions: SubmissionRow[] }>(`/admin/submissions${qs}`);
      setRows(data.submissions);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(filter); }, [filter]);

  const review = async (id: string, status: "approved" | "rejected") => {
    setReviewing(id);
    try {
      await apiFetch(`/admin/submissions/${id}/review`, { method: "PUT", body: JSON.stringify({ status, note: noteMap[id] ?? null }) });
      await load(filter); setExpanded(null);
    } finally { setReviewing(null); }
  };

  const statusBadge = (s: SubmissionRow["submissionStatus"]) => {
    if (s === "approved") return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-900/40 text-green-400 border border-green-800/50">Approved</span>;
    if (s === "pending_review") return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">Pending Review</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-900/40 text-red-400 border border-red-800/50">Rejected</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">Review client exercise submissions. Approve or reject with feedback.</p>
        <div className="flex gap-1">
          {(["pending_review", "approved", "rejected", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filter === f ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
              {f === "pending_review" ? "Pending" : f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No submissions match this filter.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const name = [row.userFirstName, row.userLastName].filter(Boolean).join(" ") || row.userEmail;
            const isOpen = expanded === row.id;
            return (
              <div key={row.id} className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/20" onClick={() => setExpanded(isOpen ? null : row.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate">{row.exerciseDayNum ? `Day ${row.exerciseDayNum} — ` : ""}{row.exerciseTitle}</div>
                  </div>
                  {statusBadge(row.submissionStatus)}
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}</div>
                  <span className="text-muted-foreground text-sm">{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 bg-muted/10">
                    {row.proofText && <div><div className="text-xs font-medium text-muted-foreground mb-1">Written proof</div><div className="text-sm text-foreground bg-background border border-border rounded-lg px-3 py-2 whitespace-pre-wrap">{row.proofText}</div></div>}
                    {row.proofImageUrl && <div><div className="text-xs font-medium text-muted-foreground mb-1">Screenshot</div><a href={row.proofImageUrl} target="_blank" rel="noopener noreferrer"><img src={row.proofImageUrl} alt="Proof screenshot" className="max-h-48 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90" /></a></div>}
                    {row.reviewNote && <div><div className="text-xs font-medium text-muted-foreground mb-1">Previous feedback</div><div className="text-xs text-foreground bg-background border border-border rounded-lg px-3 py-2">{row.reviewNote}</div></div>}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Feedback / note to client (optional)</label>
                      <textarea rows={2} value={noteMap[row.id] ?? ""} onChange={(e) => setNoteMap((m) => ({ ...m, [row.id]: e.target.value }))} placeholder="e.g. Please re-upload a clearer screenshot." className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button disabled={reviewing === row.id} onClick={() => review(row.id, "rejected")} className="px-4 py-1.5 text-sm font-medium border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-50">{reviewing === row.id ? "…" : "Reject"}</button>
                      <button disabled={reviewing === row.id} onClick={() => review(row.id, "approved")} className="px-4 py-1.5 text-sm font-medium bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">{reviewing === row.id ? "…" : "Approve"}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Resources + Tutorial Videos CRUD tab ────────────────────────────────────
function TabResources() {
  const [resources,   setResources]   = useState<ResourceRow[]>([]);
  const [tutorials,   setTutorials]   = useState<TutorialRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [section,     setSection]     = useState<"resources" | "tutorials">("resources");
  const [resModal,    setResModal]    = useState(false);
  const [resEdit,     setResEdit]     = useState<ResourceRow | null>(null);
  const [resForm,     setResForm]     = useState<ResourceFormValues>(emptyResourceForm());
  const [resSaving,   setResSaving]   = useState(false);
  const [resErr,      setResErr]      = useState("");
  const [resDeleting, setResDeleting] = useState<string | null>(null);
  const [tutModal,    setTutModal]    = useState(false);
  const [tutEdit,     setTutEdit]     = useState<TutorialRow | null>(null);
  const [tutForm,     setTutForm]     = useState<TutorialFormValues>(emptyTutorialForm());
  const [tutSaving,   setTutSaving]   = useState(false);
  const [tutErr,      setTutErr]      = useState("");
  const [tutDeleting, setTutDeleting] = useState<string | null>(null);

  const loadAll = async () => {
    const [r, t] = await Promise.all([apiFetch<{ resources: ResourceRow[] }>("/staff/resources"), apiFetch<{ tutorials: TutorialRow[] }>("/staff/tutorials")]);
    setResources(r.resources); setTutorials(t.tutorials);
  };

  useEffect(() => { loadAll().finally(() => setLoading(false)); }, []);

  const openResCreate = () => { setResEdit(null); setResForm(emptyResourceForm()); setResErr(""); setResModal(true); };
  const openResEdit = (r: ResourceRow) => { setResEdit(r); setResForm({ title: r.title, description: r.description ?? "", category: r.category ?? "guide", url: r.url ?? "", icon: r.icon ?? "", orderIndex: r.orderIndex.toString(), isActive: r.isActive }); setResErr(""); setResModal(true); };
  const closeResModal = () => { setResModal(false); setResEdit(null); };

  const saveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.title.trim()) { setResErr("Title is required."); return; }
    setResSaving(true); setResErr("");
    try {
      const body = { title: resForm.title.trim(), description: resForm.description.trim() || null, category: resForm.category || null, url: resForm.url.trim() || null, icon: resForm.icon.trim() || null, orderIndex: parseInt(resForm.orderIndex) || 0, isActive: resForm.isActive };
      if (resEdit) { await apiFetch(`/staff/resources/${resEdit.id}`, { method: "PUT", body: JSON.stringify(body) }); }
      else { await apiFetch("/staff/resources", { method: "POST", body: JSON.stringify(body) }); }
      const data = await apiFetch<{ resources: ResourceRow[] }>("/staff/resources");
      setResources(data.resources); closeResModal();
    } catch (err) { setResErr(err instanceof ApiError ? err.message : "Save failed."); }
    finally { setResSaving(false); }
  };

  const deleteResource = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    setResDeleting(id);
    try { await apiFetch(`/staff/resources/${id}`, { method: "DELETE" }); setResources((prev) => prev.filter((r) => r.id !== id)); }
    finally { setResDeleting(null); }
  };

  const openTutCreate = () => { setTutEdit(null); setTutForm(emptyTutorialForm()); setTutErr(""); setTutModal(true); };
  const openTutEdit = (t: TutorialRow) => { setTutEdit(t); setTutForm({ title: t.title, duration: t.duration ?? "", videoUrl: t.videoUrl ?? "", orderIndex: t.orderIndex.toString(), isActive: t.isActive }); setTutErr(""); setTutModal(true); };
  const closeTutModal = () => { setTutModal(false); setTutEdit(null); };

  const saveTutorial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutForm.title.trim()) { setTutErr("Title is required."); return; }
    setTutSaving(true); setTutErr("");
    try {
      const body = { title: tutForm.title.trim(), duration: tutForm.duration.trim() || null, videoUrl: tutForm.videoUrl.trim() || null, orderIndex: parseInt(tutForm.orderIndex) || 0, isActive: tutForm.isActive };
      if (tutEdit) { await apiFetch(`/staff/tutorials/${tutEdit.id}`, { method: "PUT", body: JSON.stringify(body) }); }
      else { await apiFetch("/staff/tutorials", { method: "POST", body: JSON.stringify(body) }); }
      const data = await apiFetch<{ tutorials: TutorialRow[] }>("/staff/tutorials");
      setTutorials(data.tutorials); closeTutModal();
    } catch (err) { setTutErr(err instanceof ApiError ? err.message : "Save failed."); }
    finally { setTutSaving(false); }
  };

  const deleteTutorial = async (id: string) => {
    if (!confirm("Delete this tutorial?")) return;
    setTutDeleting(id);
    try { await apiFetch(`/staff/tutorials/${id}`, { method: "DELETE" }); setTutorials((prev) => prev.filter((t) => t.id !== id)); }
    finally { setTutDeleting(null); }
  };

  const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {(["resources", "tutorials"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${section === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {s === "resources" ? `Universe Resources (${resources.length})` : `Tutorial Videos (${tutorials.length})`}
          </button>
        ))}
      </div>

      {section === "resources" && (
        <>
          {resModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4">
                <form onSubmit={saveResource}>
                  <div className="px-6 py-5 border-b border-border flex justify-between items-center"><h2 className="font-semibold text-foreground text-base">{resEdit ? "Edit Resource" : "Add Resource"}</h2><button type="button" onClick={closeResModal} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button></div>
                  <div className="px-6 py-5 space-y-4">
                    {resErr && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{resErr}</p>}
                    <div><label className="block text-sm font-medium text-foreground mb-1">Title *</label><input type="text" value={resForm.title} onChange={(e) => setResForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. WhatsApp Setup Guide" className={inputCls} required /></div>
                    <div><label className="block text-sm font-medium text-foreground mb-1">Description</label><textarea value={resForm.description} onChange={(e) => setResForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Short description" className={`${inputCls} resize-none`} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-sm font-medium text-foreground mb-1">Category</label><select value={resForm.category} onChange={(e) => setResForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}><option value="guide">Guide</option><option value="video">Video</option><option value="document">Document</option><option value="tool">Tool</option></select></div>
                      <div><label className="block text-sm font-medium text-foreground mb-1">Icon</label><input type="text" maxLength={10} value={resForm.icon} onChange={(e) => setResForm((f) => ({ ...f, icon: e.target.value }))} placeholder="▶ T W B" className={inputCls} /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-foreground mb-1">URL / Link</label><input type="text" value={resForm.url} onChange={(e) => setResForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." className={inputCls} /></div>
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div><label className="block text-sm font-medium text-foreground mb-1">Order</label><input type="number" min={0} value={resForm.orderIndex} onChange={(e) => setResForm((f) => ({ ...f, orderIndex: e.target.value }))} className={inputCls} /></div>
                      <div className="flex items-center gap-2 pb-2"><input type="checkbox" id="res-active" checked={resForm.isActive} onChange={(e) => setResForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-primary" /><label htmlFor="res-active" className="text-sm text-foreground">Active</label></div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-border flex justify-end gap-3"><button type="button" onClick={closeResModal} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button><button type="submit" disabled={resSaving} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{resSaving ? "Saving…" : "Save Resource"}</button></div>
                </form>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Manage Universe Resources visible on the client Resources tab.</p>
            <button onClick={openResCreate} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">+ Add Resource</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border">{["Order","Icon","Title","Category","URL","Status","Actions"].map((h) => <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{r.orderIndex}</td>
                    <td className="py-3 pr-4 text-base">{r.icon ?? "—"}</td>
                    <td className="py-3 pr-4 font-medium text-foreground max-w-xs truncate">{r.title}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground capitalize">{r.category ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[160px] truncate">{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{r.url}</a> : "—"}</td>
                    <td className="py-3 pr-4"><StatusBadge ok={r.isActive} label={r.isActive ? "Active" : "Hidden"} /></td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => openResEdit(r)} className="text-xs px-3 py-1 border border-border rounded-lg text-foreground hover:bg-muted/40">Edit</button>
                      <button onClick={() => deleteResource(r.id)} disabled={resDeleting === r.id} className="text-xs px-3 py-1 border border-destructive/40 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50">{resDeleting === r.id ? "…" : "Delete"}</button>
                    </td>
                  </tr>
                ))}
                {resources.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No resources yet. <button onClick={openResCreate} className="text-primary underline">Add the first one.</button></td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === "tutorials" && (
        <>
          {tutModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4">
                <form onSubmit={saveTutorial}>
                  <div className="px-6 py-5 border-b border-border flex justify-between items-center"><h2 className="font-semibold text-foreground text-base">{tutEdit ? "Edit Tutorial Video" : "Add Tutorial Video"}</h2><button type="button" onClick={closeTutModal} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button></div>
                  <div className="px-6 py-5 space-y-4">
                    {tutErr && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{tutErr}</p>}
                    <div><label className="block text-sm font-medium text-foreground mb-1">Title *</label><input type="text" value={tutForm.title} onChange={(e) => setTutForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Dashboard orientation" className={inputCls} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-sm font-medium text-foreground mb-1">Duration</label><input type="text" value={tutForm.duration} onChange={(e) => setTutForm((f) => ({ ...f, duration: e.target.value }))} placeholder="5 min" className={inputCls} /></div>
                      <div><label className="block text-sm font-medium text-foreground mb-1">Order</label><input type="number" min={0} value={tutForm.orderIndex} onChange={(e) => setTutForm((f) => ({ ...f, orderIndex: e.target.value }))} className={inputCls} /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-foreground mb-1">Video URL</label><input type="text" value={tutForm.videoUrl} onChange={(e) => setTutForm((f) => ({ ...f, videoUrl: e.target.value }))} placeholder="https://www.loom.com/share/..." className={inputCls} /></div>
                    <div className="flex items-center gap-2"><input type="checkbox" id="tut-active" checked={tutForm.isActive} onChange={(e) => setTutForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-primary" /><label htmlFor="tut-active" className="text-sm text-foreground">Active (visible to clients)</label></div>
                  </div>
                  <div className="px-6 py-4 border-t border-border flex justify-end gap-3"><button type="button" onClick={closeTutModal} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button><button type="submit" disabled={tutSaving} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{tutSaving ? "Saving…" : "Save Tutorial"}</button></div>
                </form>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Manage Platform Tutorial Videos shown in the client Resources tab.</p>
            <button onClick={openTutCreate} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">+ Add Tutorial</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border">{["Order","Title","Duration","Video URL","Status","Actions"].map((h) => <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {tutorials.map((t) => (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{t.orderIndex}</td>
                    <td className="py-3 pr-4 font-medium text-foreground max-w-xs truncate">{t.title}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{t.duration ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">{t.videoUrl ? <a href={t.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t.videoUrl}</a> : <span className="text-muted-foreground/50">No URL</span>}</td>
                    <td className="py-3 pr-4"><StatusBadge ok={t.isActive} label={t.isActive ? "Active" : "Hidden"} /></td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => openTutEdit(t)} className="text-xs px-3 py-1 border border-border rounded-lg text-foreground hover:bg-muted/40">Edit</button>
                      <button onClick={() => deleteTutorial(t.id)} disabled={tutDeleting === t.id} className="text-xs px-3 py-1 border border-destructive/40 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50">{tutDeleting === t.id ? "…" : "Delete"}</button>
                    </td>
                  </tr>
                ))}
                {tutorials.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No tutorial videos yet. <button onClick={openTutCreate} className="text-primary underline">Add the first one.</button></td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Certifications Tab ───────────────────────────────────────────────────────

interface CertRow {
  id:         string;
  type:       string;
  certNumber: string | null;
  issuedAt:   string | null;
  userId:     string;
  userEmail:  string;
  firstName:  string | null;
  lastName:   string | null;
  vertical:   string | null;
}

interface BotQ {
  id:                 string;
  question:           string;
  options:            string[];
  correctAnswerIndex: number;
  orderIndex:         number;
  isActive:           boolean;
}

interface HskdQ {
  id:         string;
  scenario:   string;
  orderIndex: number;
  isActive:   boolean;
}

type CertSection = "certs" | "bot-quiz" | "hskd-quiz";

function TabCertifications() {
  const [section,  setSection]  = useState<CertSection>("certs");
  const [certs,    setCerts]    = useState<CertRow[]>([]);
  const [botQs,    setBotQs]    = useState<BotQ[]>([]);
  const [hskdQs,   setHskdQs]  = useState<HskdQ[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  const emptyBotForm  = () => ({ question: "", options: ["", "", "", ""], correctAnswerIndex: 0, orderIndex: 0, isActive: true });
  const emptyHskdForm = () => ({ scenario: "", orderIndex: 0, isActive: true });

  const [botModal,  setBotModal]  = useState(false);
  const [botEdit,   setBotEdit]   = useState<BotQ | null>(null);
  const [botForm,   setBotForm]   = useState(emptyBotForm());

  const [hskdModal, setHskdModal] = useState(false);
  const [hskdEdit,  setHskdEdit]  = useState<HskdQ | null>(null);
  const [hskdForm,  setHskdForm]  = useState(emptyHskdForm());

  const loadAll = async () => {
    const [c, b, h] = await Promise.all([
      apiFetch<{ certificates: CertRow[] }>("/admin/certificates"),
      apiFetch<{ questions: BotQ[] }>("/admin/bot-cert-questions"),
      apiFetch<{ questions: HskdQ[] }>("/admin/hskd-cert-questions"),
    ]);
    setCerts(c.certificates);
    setBotQs(b.questions);
    setHskdQs(h.questions);
  };

  useEffect(() => { loadAll().finally(() => setLoading(false)); }, []);

  const typeLabel: Record<string, string> = {
    academy:   "Academy",
    bot_cert:  "Bot Cert",
    hskd_cert: "HSKD Cert",
    clearpath: "ClearPath",
  };

  // ── Bot question handlers ──────────────────────────────────────────────────
  const openBotCreate = () => { setBotEdit(null); setBotForm(emptyBotForm()); setErr(""); setBotModal(true); };
  const openBotEdit   = (q: BotQ) => {
    setBotEdit(q);
    setBotForm({ question: q.question, options: [...q.options], correctAnswerIndex: q.correctAnswerIndex, orderIndex: q.orderIndex, isActive: q.isActive });
    setErr(""); setBotModal(true);
  };
  const saveBotQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botForm.question.trim())             { setErr("Question is required."); return; }
    if (botForm.options.some((o) => !o.trim())) { setErr("All 4 options must be filled in."); return; }
    setSaving(true); setErr("");
    try {
      const body = { ...botForm, options: botForm.options.map((o) => o.trim()) };
      if (botEdit) {
        await apiFetch(`/admin/bot-cert-questions/${botEdit.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/admin/bot-cert-questions", { method: "POST", body: JSON.stringify(body) });
      }
      const data = await apiFetch<{ questions: BotQ[] }>("/admin/bot-cert-questions");
      setBotQs(data.questions); setBotModal(false);
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : "Save failed."); }
    finally { setSaving(false); }
  };
  const deleteBotQ = async (id: string) => {
    if (!confirm("Delete this question? Learners who have not yet attempted the quiz will no longer see it.")) return;
    await apiFetch(`/admin/bot-cert-questions/${id}`, { method: "DELETE" });
    setBotQs((prev) => prev.filter((q) => q.id !== id));
  };

  // ── HSKD question handlers ─────────────────────────────────────────────────
  const openHskdCreate = () => { setHskdEdit(null); setHskdForm(emptyHskdForm()); setErr(""); setHskdModal(true); };
  const openHskdEdit   = (q: HskdQ) => {
    setHskdEdit(q); setHskdForm({ scenario: q.scenario, orderIndex: q.orderIndex, isActive: q.isActive });
    setErr(""); setHskdModal(true);
  };
  const saveHskdQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hskdForm.scenario.trim()) { setErr("Scenario is required."); return; }
    setSaving(true); setErr("");
    try {
      const body = { ...hskdForm, scenario: hskdForm.scenario.trim() };
      if (hskdEdit) {
        await apiFetch(`/admin/hskd-cert-questions/${hskdEdit.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/admin/hskd-cert-questions", { method: "POST", body: JSON.stringify(body) });
      }
      const data = await apiFetch<{ questions: HskdQ[] }>("/admin/hskd-cert-questions");
      setHskdQs(data.questions); setHskdModal(false);
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : "Save failed."); }
    finally { setSaving(false); }
  };
  const deleteHskdQ = async (id: string) => {
    if (!confirm("Delete this scenario?")) return;
    await apiFetch(`/admin/hskd-cert-questions/${id}`, { method: "DELETE" });
    setHskdQs((prev) => prev.filter((q) => q.id !== id));
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const sections: CertSection[] = ["certs", "bot-quiz", "hskd-quiz"];
  const sectionLabels: Record<CertSection, string> = {
    "certs":     `Issued Certificates (${certs.length})`,
    "bot-quiz":  `Bot Cert Questions (${botQs.length})`,
    "hskd-quiz": `HSKD Cert Scenarios (${hskdQs.length})`,
  };

  return (
    <div className="space-y-4">
      {/* Section switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {sections.map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${s === section ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {sectionLabels[s]}
          </button>
        ))}
      </div>

      {/* ── Issued Certificates ── */}
      {section === "certs" && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            All certificates issued to learners. Click Download to retrieve a PDF.
          </p>
          {certs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certificates issued yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  {["Type", "Cert #", "Learner", "Vertical", "Issued", ""].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {typeLabel[c.type] ?? c.type}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{c.certNumber ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.userEmail}
                      <br />
                      <span className="text-xs text-muted-foreground">{c.userEmail}</span>
                    </td>
                    <td className="py-2 pr-4 capitalize text-muted-foreground text-xs">{c.vertical ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                      {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2">
                      <a href={`/api/certification/download/${c.id}`} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90">
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Bot Cert Questions ── */}
      {section === "bot-quiz" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">
              10-question quiz — pass threshold is 8/10. Changes apply immediately to all future attempts.
            </p>
            <button onClick={openBotCreate}
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              + Add Question
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                {["#", "Question", "Options", "Correct", "Active", ""].map((h) => (
                  <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {botQs.map((q, i) => (
                <tr key={q.id} className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4 text-muted-foreground">{q.orderIndex ?? i + 1}</td>
                  <td className="py-2 pr-4 max-w-xs">{q.question}</td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                    {q.options.map((o, oi) => (
                      <div key={oi}>{oi === q.correctAnswerIndex ? "✓ " : "  "}{o}</div>
                    ))}
                  </td>
                  <td className="py-2 pr-4 text-xs">{q.options[q.correctAnswerIndex] ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {q.isActive
                      ? <span className="text-xs text-green-600">Yes</span>
                      : <span className="text-xs text-muted-foreground">No</span>}
                  </td>
                  <td className="py-2 flex gap-2">
                    <button onClick={() => openBotEdit(q)}
                      className="px-2 py-1 text-xs border border-border rounded hover:bg-muted">Edit</button>
                    <button onClick={() => deleteBotQ(q.id)}
                      className="px-2 py-1 text-xs border border-destructive/40 text-destructive rounded hover:bg-destructive/10">Del</button>
                  </td>
                </tr>
              ))}
              {botQs.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No questions yet. Run <code className="text-xs bg-muted px-1 rounded">npx tsx scripts/seed-bot-cert.ts</code> to seed 10 default questions.
                </td></tr>
              )}
            </tbody>
          </table>

          {/* Bot Q modal */}
          {botModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <form onSubmit={saveBotQ}
                className="bg-card border border-border rounded-xl p-6 w-full max-w-lg space-y-3 shadow-xl">
                <h3 className="font-semibold text-foreground">{botEdit ? "Edit Question" : "New Question"}</h3>
                <div>
                  <label className="text-xs text-muted-foreground">Question</label>
                  <textarea value={botForm.question}
                    onChange={(e) => setBotForm((f) => ({ ...f, question: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg" rows={2} />
                </div>
                {[0, 1, 2, 3].map((oi) => (
                  <div key={oi}>
                    <label className="text-xs text-muted-foreground flex items-center gap-2">
                      <input type="radio" name="correct" checked={botForm.correctAnswerIndex === oi}
                        onChange={() => setBotForm((f) => ({ ...f, correctAnswerIndex: oi }))} />
                      Option {oi + 1} {botForm.correctAnswerIndex === oi && <span className="text-green-600 text-xs">(correct)</span>}
                    </label>
                    <input value={botForm.options[oi] ?? ""}
                      onChange={(e) => setBotForm((f) => { const o = [...f.options]; o[oi] = e.target.value; return { ...f, options: o }; })}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg" />
                  </div>
                ))}
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground">Order index</label>
                  <input type="number" value={botForm.orderIndex}
                    onChange={(e) => setBotForm((f) => ({ ...f, orderIndex: parseInt(e.target.value) || 0 }))}
                    className="w-20 px-2 py-1 text-sm bg-background border border-border rounded-lg" />
                  <label className="text-xs text-muted-foreground ml-4 flex items-center gap-1">
                    <input type="checkbox" checked={botForm.isActive}
                      onChange={(e) => setBotForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active
                  </label>
                </div>
                {err && <p className="text-xs text-destructive">{err}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setBotModal(false)}
                    className="px-4 py-2 text-sm border border-border rounded-lg">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── HSKD Cert Scenarios ── */}
      {section === "hskd-quiz" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">
              APPROVE/REJECT scenarios — any REJECT flags the submission for admin review. Changes apply immediately.
            </p>
            <button onClick={openHskdCreate}
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              + Add Scenario
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                {["#", "Scenario", "Active", ""].map((h) => (
                  <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hskdQs.map((q, i) => (
                <tr key={q.id} className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4 text-muted-foreground">{q.orderIndex ?? i + 1}</td>
                  <td className="py-2 pr-4 text-sm max-w-lg">{q.scenario}</td>
                  <td className="py-2 pr-4">
                    {q.isActive
                      ? <span className="text-xs text-green-600">Yes</span>
                      : <span className="text-xs text-muted-foreground">No</span>}
                  </td>
                  <td className="py-2 flex gap-2">
                    <button onClick={() => openHskdEdit(q)}
                      className="px-2 py-1 text-xs border border-border rounded hover:bg-muted">Edit</button>
                    <button onClick={() => deleteHskdQ(q.id)}
                      className="px-2 py-1 text-xs border border-destructive/40 text-destructive rounded hover:bg-destructive/10">Del</button>
                  </td>
                </tr>
              ))}
              {hskdQs.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No HSKD scenarios yet. Add them above to enable HSKD Certification for qualifying users.
                </td></tr>
              )}
            </tbody>
          </table>

          {/* HSKD Q modal */}
          {hskdModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <form onSubmit={saveHskdQ}
                className="bg-card border border-border rounded-xl p-6 w-full max-w-lg space-y-3 shadow-xl">
                <h3 className="font-semibold text-foreground">{hskdEdit ? "Edit Scenario" : "New Scenario"}</h3>
                <div>
                  <label className="text-xs text-muted-foreground">Scenario text</label>
                  <textarea value={hskdForm.scenario}
                    onChange={(e) => setHskdForm((f) => ({ ...f, scenario: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg" rows={4}
                    placeholder="Describe the scenario the user must APPROVE or REJECT…" />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground">Order index</label>
                  <input type="number" value={hskdForm.orderIndex}
                    onChange={(e) => setHskdForm((f) => ({ ...f, orderIndex: parseInt(e.target.value) || 0 }))}
                    className="w-20 px-2 py-1 text-sm bg-background border border-border rounded-lg" />
                  <label className="text-xs text-muted-foreground ml-4 flex items-center gap-1">
                    <input type="checkbox" checked={hskdForm.isActive}
                      onChange={(e) => setHskdForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active
                  </label>
                </div>
                {err && <p className="text-xs text-destructive">{err}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setHskdModal(false)}
                    className="px-4 py-2 text-sm border border-border rounded-lg">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab,            setTab]            = useState<Tab>("users");
  const [users,          setUsers]          = useState<UserRow[]>([]);
  const [syncEvents,     setSyncEvents]     = useState<SyncEventRow[]>([]);
  const [webhookLogs,    setWebhookLogs]    = useState<WebhookLogRow[]>([]);
  const [modules,        setModules]        = useState<ModuleRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedQuiz,   setExpandedQuiz]   = useState<string | null>(null);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editTarget,     setEditTarget]     = useState<ModuleRow | null>(null);
  const [deleting,       setDeleting]       = useState<string | null>(null);

  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const loadAll = async () => {
    const [u, s, w, m] = await Promise.all([
      apiFetch<{ users: UserRow[] }>("/admin/users"),
      apiFetch<{ events: SyncEventRow[] }>("/admin/sync-events"),
      apiFetch<{ logs: WebhookLogRow[] }>("/admin/webhook-log"),
      apiFetch<{ modules: ModuleRow[] }>("/admin/modules"),
    ]);
    setUsers(u.users); setSyncEvents(s.events); setWebhookLogs(w.logs); setModules(m.modules);
  };

  useEffect(() => {
    (async () => {
      try { await loadAll(); }
      catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) navigate("/dashboard", { replace: true });
        else setError("Failed to load admin data. Please refresh.");
      } finally { setLoading(false); }
    })();
  }, [navigate]);

  const logout = async () => { await apiFetch("/auth/logout", { method: "POST" }).catch(() => null); navigate("/login", { replace: true }); };
  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit   = (m: ModuleRow) => { setEditTarget(m); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const saveModule = async (values: ModuleFormValues) => {
    const body = { title: values.title.trim(), description: values.description.trim() || null, dayStart: values.dayStart ? parseInt(values.dayStart) : null, dayEnd: values.dayEnd ? parseInt(values.dayEnd) : null, orderIndex: parseInt(values.orderIndex) || 0, isActive: values.isActive };
    if (editTarget) { await apiFetch(`/admin/modules/${editTarget.id}`, { method: "PUT", body: JSON.stringify(body) }); }
    else { await apiFetch("/admin/modules", { method: "POST", body: JSON.stringify(body) }); }
    const m = await apiFetch<{ modules: ModuleRow[] }>("/admin/modules");
    setModules(m.modules);
  };

  const deleteModuleById = async (id: string) => {
    if (!confirm("Delete this module? This cannot be undone.")) return;
    setDeleting(id);
    try { await apiFetch(`/admin/modules/${id}`, { method: "DELETE" }); setModules((prev) => prev.filter((m) => m.id !== id)); }
    finally { setDeleting(null); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  const tabLabels: Record<Tab, string> = {
    users:          `Users (${users.length})`,
    modules:        `Modules (${modules.length})`,
    submissions:    "Submissions",
    resources:      "Resources",
    hskd:           "HSKD Certifications",
    certifications: "Certifications",
    sync:           "Sync Events",
    webhooks:       "Webhook Log",
    provision:      "Provision Client",
  };

  return (
    <div className="min-h-screen bg-background">
      {modalOpen && (
        <ModuleModal
          initial={editTarget ? { title: editTarget.title, description: editTarget.description ?? "", dayStart: editTarget.dayStart?.toString() ?? "", dayEnd: editTarget.dayEnd?.toString() ?? "", orderIndex: editTarget.orderIndex.toString(), isActive: editTarget.isActive } : emptyForm()}
          onSave={saveModule}
          onClose={closeModal}
        />
      )}

      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-foreground">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-theme-btn" onClick={toggle} title="Toggle light/dark mode">{theme === "dark" ? "☀ Light" : "☾ Dark"}</button>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(["users", "modules", "submissions", "resources", "hskd", "sync", "webhooks", "provision"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* ── Users ── */}
        {tab === "users" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border">{["Email","Name","Role","Plan","Vertical","Active","GHL ID","Provisioned"].map((h) => <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 pr-4 font-mono text-xs">{u.email}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "wibiz_admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{u.role}</span></td>
                    <td className="py-2 pr-4 capitalize">{u.planTier ?? "—"}</td>
                    <td className="py-2 pr-4 capitalize">{u.vertical ?? "—"}</td>
                    <td className="py-2 pr-4"><StatusBadge ok={Boolean(u.isActive)} label={u.isActive ? "Yes" : "No"} /></td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{u.ghlContactId ? `${u.ghlContactId.slice(0, 8)}…` : "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(u.createdAt)}</td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">No users provisioned yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Modules ── */}
        {tab === "modules" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Manage the 30-Module Activation Programme. Changes reflect immediately on the client portal.</p>
              <button onClick={openCreate} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">+ Create Module</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    {["Order","Title","Days","Description","Status","Actions"].map((h) => <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <Fragment key={m.id}>
                      <tr className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{m.orderIndex}</td>
                        <td className="py-3 pr-4 font-medium text-foreground max-w-xs">{m.title}</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">{m.dayStart && m.dayEnd ? `Modules ${m.dayStart}–${m.dayEnd}` : "—"}</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground max-w-xs truncate">{m.description ?? "—"}</td>
                        <td className="py-3 pr-4"><StatusBadge ok={m.isActive} label={m.isActive ? "Active" : "Hidden"} /></td>
                        <td className="py-3 flex gap-2">
                          <button
                            onClick={() => { setExpandedModule(expandedModule === m.id ? null : m.id); setExpandedQuiz(null); }}
                            className={`text-xs px-3 py-1 border rounded-lg ${expandedModule === m.id ? "border-primary/50 text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-muted/40"}`}
                          >Exercises</button>
                          <button
                            onClick={() => { setExpandedQuiz(expandedQuiz === m.id ? null : m.id); setExpandedModule(null); }}
                            className={`text-xs px-3 py-1 border rounded-lg ${expandedQuiz === m.id ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-border text-muted-foreground hover:bg-muted/40"}`}
                          >Quiz</button>
                          <button onClick={() => openEdit(m)} className="text-xs px-3 py-1 border border-border rounded-lg text-foreground hover:bg-muted/40">Edit</button>
                          <button onClick={() => deleteModuleById(m.id)} disabled={deleting === m.id} className="text-xs px-3 py-1 border border-destructive/40 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50">{deleting === m.id ? "…" : "Delete"}</button>
                        </td>
                      </tr>
                      {expandedModule === m.id && (
                        <tr className="bg-muted/10">
                          <td colSpan={6} className="pb-4 pt-1 px-2">
                            <ExercisePanel moduleId={m.id} onClose={() => setExpandedModule(null)} />
                          </td>
                        </tr>
                      )}
                      {expandedQuiz === m.id && (
                        <tr className="bg-amber-950/10">
                          <td colSpan={6} className="pb-4 pt-1 px-2">
                            <QuizPanel moduleId={m.id} onClose={() => setExpandedQuiz(null)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {modules.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No modules yet. <button onClick={openCreate} className="text-primary underline">Create the first one.</button></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "submissions"     && <TabSubmissions />}
        {tab === "resources"       && <TabResources />}
        {tab === "hskd"            && <TabHskdCertifications />}
        {tab === "certifications"  && <TabCertifications />}

        {tab === "sync" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border">{["Event Type","Entity","Status","Error","Time"].map((h) => <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
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
                {syncEvents.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No sync events yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "webhooks" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border">{["Source","Processed","Error","Received"].map((h) => <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {webhookLogs.map((w) => (
                  <tr key={w.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 pr-4">{w.source ?? "—"}</td>
                    <td className="py-2 pr-4"><StatusBadge ok={Boolean(w.processed)} label={w.processed ? "Yes" : "No"} /></td>
                    <td className="py-2 pr-4 text-xs text-destructive max-w-sm truncate">{w.error ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(w.receivedAt)}</td>
                  </tr>
                ))}
                {webhookLogs.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No webhook events yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "provision" && <ProvisionOverride />}
      </main>
    </div>
  );
}

// ─── Provision Override panel ──────────────────────────────────────────────────
function ProvisionOverride() {
  const [email,     setEmail]     = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [planTier,  setPlanTier]  = useState<"" | "lite" | "standard" | "pro">("");
  const [saving,    setSaving]    = useState(false);
  const [result,    setResult]    = useState<{ action: "created" | "re-provisioned"; email: string; tempPassword: string; userId: string; note: string } | null>(null);
  const [err,       setErr]       = useState("");

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setResult(null);
    if (!email.trim()) { setErr("Email is required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch<{ action: "created" | "re-provisioned"; email: string; tempPassword: string; userId: string; note: string }>("/admin/provision-override", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), firstName: firstName.trim() || null, lastName: lastName.trim() || null, planTier: planTier || null }),
      });
      setResult(res); setEmail(""); setFirstName(""); setLastName(""); setPlanTier("");
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Provision failed."); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Provision Client Access Override</h2>
        <p className="text-sm text-muted-foreground">Use this for clients who paid before this platform existed. Creates or re-activates a client account and generates a temporary password.</p>
      </div>
      {result && (
        <div className="rounded-lg border border-green-700/40 bg-green-900/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">✓ {result.action === "created" ? "Account created" : "Account re-provisioned"}</div>
          <div className="text-sm text-muted-foreground">{result.note}</div>
          <div className="rounded-lg border border-border bg-background p-3 space-y-2 text-sm">
            <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{result.email}</span></div>
            <div className="flex items-center gap-3"><span className="text-muted-foreground">Temp password:</span><span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">{result.tempPassword}</span><button className="text-xs text-primary underline" onClick={() => navigator.clipboard.writeText(result.tempPassword)}>Copy</button></div>
          </div>
          <button className="text-xs text-muted-foreground underline" onClick={() => setResult(null)}>Provision another client</button>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div><label className="block text-xs font-medium text-muted-foreground mb-1">Email address <span className="text-destructive">*</span></label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" required className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">First name (optional)</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">Last name (optional)</label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" className={inputCls} /></div>
        </div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1">Plan tier (optional)</label><select value={planTier} onChange={(e) => setPlanTier(e.target.value as "" | "lite" | "standard" | "pro")} className={inputCls}><option value="">No plan assigned</option><option value="lite">Lite</option><option value="standard">Standard</option><option value="pro">Pro</option></select></div>
        <div className="rounded-lg border border-yellow-700/30 bg-yellow-900/10 p-3 text-xs text-yellow-400 space-y-1">
          <div className="font-semibold">Before provisioning:</div>
          <div>• If the client has a GHL contact, use the normal GHL webhook instead.</div>
          <div>• If the account already exists, their previous data is preserved.</div>
          <div>• The temporary password is only shown once — copy it immediately.</div>
        </div>
        {err && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{saving ? "Provisioning…" : "Provision Access →"}</button>
      </form>
    </div>
  );
}