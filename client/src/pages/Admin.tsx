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
  id:             string;
  scenario_number: number;
  scenario_title: string;
  decision:       string;
  decided_at:     string | null;
}

interface HskdProhibitedLog {
  id:               string;
  category:         string | null;
  restriction_text: string | null;
  confirmed_at:     string | null;
}

interface HskdCertDetail {
  certification:    HskdCertRow;
  scenario_logs:    HskdScenarioLog[];
  prohibited_logs:  HskdProhibitedLog[];
}

interface HskdCountRow {
  status: string;
  count:  string;
}

type Tab = "users" | "sync" | "webhooks" | "modules" | "submissions" | "provision" | "resources" | "hskd";

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
  const [certs,        setCerts]        = useState<HskdCertRow[]>([]);
  const [counts,       setCounts]       = useState<HskdCountRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [detail,       setDetail]       = useState<HskdCertDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sign-off state
  const [signoffName,   setSignoffName]   = useState("");
  const [signingOff,    setSigningOff]    = useState(false);
  const [signoffErr,    setSignoffErr]    = useState("");
  const [signoffOk,     setSignoffOk]     = useState<string | null>(null);

  // Checklist state per expanded cert
  const [checklist, setChecklist] = useState<Record<string, boolean[]>>({});

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
      // Initialise checklist for this cert (8 items, all unchecked)
      setChecklist((prev) => ({ ...prev, [cert.id]: prev[cert.id] ?? Array(8).fill(false) }));
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleCheck = (certId: string, idx: number) => {
    setChecklist((prev) => {
      const arr = [...(prev[certId] ?? Array(8).fill(false))];
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
    setSigningOff(true);
    setSignoffErr("");
    try {
      const result = await apiFetch<{ certificate_id: string }>(
        `/admin/hskd/certifications/${certId}/signoff`,
        { method: "PATCH", body: JSON.stringify({ ops_signoff_by: signoffName.trim() }) }
      );
      setSignoffOk(result.certificate_id);
      await load(filterStatus);
      // Re-fetch detail so status updates in view
      const data = await apiFetch<HskdCertDetail>(`/admin/hskd/certifications/${certId}`);
      setDetail(data);
    } catch (err) {
      setSignoffErr(err instanceof ApiError ? err.message : "Sign-off failed. Check compliance requirements.");
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
    if (cert.industry_slug === "clinics" || cert.industry_slug === "social-welfare") {
      base.push("HIPAA BAA executed and date on file");
    }
    if (cert.industry_slug === "legal-services") {
      base.push("State bar license number on file");
    }
    if (cert.industry_slug === "social-welfare") {
      base.push("Mandatory reporter status confirmed");
      base.push("ED/CEO sign-off noted");
    }
    base.push("30-day KB review task created (if applicable)");
    return base;
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Certified",       status: "CERTIFIED",  color: "text-green-400" },
          { label: "Pending Sign-Off", status: "OPS_REVIEW", color: "text-yellow-400" },
          { label: "In Progress",     status: "TRAINING",   color: "text-blue-400" },
          { label: "Rejected",        status: "REJECTED",   color: "text-red-400" },
        ].map(({ label, status, color }) => (
          <div key={status} className="bg-card border border-border rounded-xl p-4">
            <div className={`text-2xl font-bold ${color}`}>{getCount(status)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Filter:</span>
        {["all", "OPS_REVIEW", "CERTIFIED", "TRAINING", "SCENARIOS", "AFFIRMATION", "PROHIBITED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
              filterStatus === s
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {s === "all" ? "All" : s === "OPS_REVIEW" ? "Pending Sign-Off" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
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
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/20"
                  onClick={() => openDetail(cert)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{clientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {cert.industry_name}
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${cert.tier === "TIER_0" ? "bg-red-900/40 text-red-400" : "bg-amber-900/40 text-amber-400"}`}>
                        {cert.tier}
                      </span>
                    </div>
                  </div>
                  <HskdStatusBadge status={cert.status} />
                  <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                    {fmtDate(cert.created_at)}
                  </div>
                  {cert.certificate_id ? (
                    <div className="text-xs font-mono text-green-400 hidden md:block truncate max-w-[180px]">
                      {cert.certificate_id}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground/40 hidden md:block">No cert ID</div>
                  )}
                  <span className="text-muted-foreground text-sm">{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Detail panel */}
                {isOpen && (
                  <div className="border-t border-border bg-muted/10 px-5 py-5 space-y-5">
                    {detailLoading ? (
                      <p className="text-sm text-muted-foreground">Loading detail…</p>
                    ) : detail && detail.certification.id === cert.id ? (
                      <>
                        {/* Two-column layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Left: Client info */}
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

                          {/* Right: Scenario + Prohibited logs */}
                          <div className="space-y-4">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Scenario Logs ({detail.scenario_logs.length}/5)
                              </div>
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
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Prohibited Items Confirmed ({detail.prohibited_logs.length})
                              </div>
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

                        {/* Ops Sign-Off section — only for OPS_REVIEW status */}
                        {cert.status === "OPS_REVIEW" && (
                          <div className="border border-amber-700/40 bg-amber-900/10 rounded-xl p-4 space-y-4">
                            <div className="text-sm font-semibold text-amber-400">⚠ Ops Sign-Off Required</div>

                            {/* Checklist */}
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sign-Off Checklist</div>
                              {checklistItems(cert).map((item, idx) => (
                                <label key={idx} className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checklist[cert.id]?.[idx] ?? false}
                                    onChange={() => toggleCheck(cert.id, idx)}
                                    className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                                  />
                                  <span className="text-sm text-foreground">{item}</span>
                                </label>
                              ))}
                            </div>

                            {/* Name + button */}
                            <div className="flex items-end gap-3 flex-wrap">
                              <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Your name (ops sign-off)</label>
                                <input
                                  type="text"
                                  value={signoffName}
                                  onChange={(e) => setSignoffName(e.target.value)}
                                  placeholder="e.g. Aileen — WiBiz Ops"
                                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <button
                                disabled={!allChecked(cert.id) || signingOff || !signoffName.trim()}
                                onClick={() => doSignoff(cert.id)}
                                className="px-5 py-2 text-sm font-semibold bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {signingOff ? "Processing…" : "Complete Ops Sign-Off →"}
                              </button>
                            </div>

                            {signoffErr && (
                              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                                {signoffErr}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Certified confirmation */}
                        {cert.status === "CERTIFIED" && (
                          <div className="border border-green-700/40 bg-green-900/10 rounded-xl p-4 space-y-1">
                            <div className="text-sm font-semibold text-green-400">✓ Certified</div>
                            <div className="text-xs text-muted-foreground font-mono">{cert.certificate_id}</div>
                            <div className="text-xs text-muted-foreground">Signed off by {cert.ops_signoff_by} on {fmt(cert.ops_signoff_at)}</div>
                          </div>
                        )}

                        {/* Sign-off success flash */}
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
    setForm({ title: ex.title, description: ex.description ?? "", proofPrompt: (ex as any).proofPrompt ?? "", videoUrl: (ex as any).videoUrl ?? "", dayNumber: ex.dayNumber?.toString() ?? "", orderIndex: ex.orderIndex.toString(), isActive: ex.isActive });
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
        proofPrompt: form.proofPrompt.trim() || null,
        videoUrl:    form.videoUrl.trim() || null,
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
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Proof Prompt</label>
              <input type="text" value={form.proofPrompt} onChange={(e) => setForm((f) => ({...f, proofPrompt: e.target.value}))}
                placeholder="e.g. Upload a screenshot showing your dashboard is set up correctly"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Video URL (YouTube / Loom / Vimeo)</label>
              <input type="url" value={form.videoUrl} onChange={(e) => setForm((f) => ({...f, videoUrl: e.target.value}))}
                placeholder="https://www.loom.com/share/..."
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

// ─── Submissions review panel ─────────────────────────────────────────────────
function TabSubmissions() {
  const [rows,       setRows]       = useState<SubmissionRow[]>([]);
  const [filter,     setFilter]     = useState<"pending_review" | "approved" | "rejected" | "all">("pending_review");
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [reviewing,  setReviewing]  = useState<string | null>(null);
  const [noteMap,    setNoteMap]    = useState<Record<string, string>>({});

  const load = async (f: typeof filter) => {
    setLoading(true);
    try {
      const qs = f === "all" ? "" : `?status=${f}`;
      const data = await apiFetch<{ submissions: SubmissionRow[] }>(`/admin/submissions${qs}`);
      setRows(data.submissions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const review = async (id: string, status: "approved" | "rejected") => {
    setReviewing(id);
    try {
      await apiFetch(`/admin/submissions/${id}/review`, {
        method: "PUT",
        body: JSON.stringify({ status, note: noteMap[id] ?? null }),
      });
      await load(filter);
      setExpanded(null);
    } finally {
      setReviewing(null);
    }
  };

  const statusBadge = (s: SubmissionRow["submissionStatus"]) => {
    if (s === "approved") return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-900/40 text-green-400 border border-green-800/50">Approved</span>;
    if (s === "pending_review") return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">Pending Review</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-900/40 text-red-400 border border-red-800/50">Rejected</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          Review client exercise submissions. Approve or reject with feedback.
        </p>
        <div className="flex gap-1">
          {(["pending_review", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filter === f ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-muted/40"}`}
            >
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
                <div
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/20"
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {row.exerciseDayNum ? `Day ${row.exerciseDayNum} — ` : ""}{row.exerciseTitle}
                    </div>
                  </div>
                  {statusBadge(row.submissionStatus)}
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}
                  </div>
                  <span className="text-muted-foreground text-sm">{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 bg-muted/10">
                    {row.proofText && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Written proof</div>
                        <div className="text-sm text-foreground bg-background border border-border rounded-lg px-3 py-2 whitespace-pre-wrap">{row.proofText}</div>
                      </div>
                    )}
                    {row.proofImageUrl && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Screenshot</div>
                        <a href={row.proofImageUrl} target="_blank" rel="noopener noreferrer">
                          <img src={row.proofImageUrl} alt="Proof screenshot" className="max-h-48 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90" />
                        </a>
                      </div>
                    )}
                    {row.reviewNote && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Previous feedback</div>
                        <div className="text-xs text-foreground bg-background border border-border rounded-lg px-3 py-2">{row.reviewNote}</div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Feedback / note to client (optional)</label>
                      <textarea
                        rows={2}
                        value={noteMap[row.id] ?? ""}
                        onChange={(e) => setNoteMap((m) => ({ ...m, [row.id]: e.target.value }))}
                        placeholder="e.g. Please re-upload a clearer screenshot showing the campaign is active."
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button disabled={reviewing === row.id} onClick={() => review(row.id, "rejected")} className="px-4 py-1.5 text-sm font-medium border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-50">
                        {reviewing === row.id ? "…" : "Reject"}
                      </button>
                      <button disabled={reviewing === row.id} onClick={() => review(row.id, "approved")} className="px-4 py-1.5 text-sm font-medium bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
                        {reviewing === row.id ? "…" : "Approve"}
                      </button>
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
  const [resources,     setResources]     = useState<ResourceRow[]>([]);
  const [tutorials,     setTutorials]     = useState<TutorialRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [section,       setSection]       = useState<"resources" | "tutorials">("resources");

  const [resModal,      setResModal]      = useState(false);
  const [resEdit,       setResEdit]       = useState<ResourceRow | null>(null);
  const [resForm,       setResForm]       = useState<ResourceFormValues>(emptyResourceForm());
  const [resSaving,     setResSaving]     = useState(false);
  const [resErr,        setResErr]        = useState("");
  const [resDeleting,   setResDeleting]   = useState<string | null>(null);

  const [tutModal,      setTutModal]      = useState(false);
  const [tutEdit,       setTutEdit]       = useState<TutorialRow | null>(null);
  const [tutForm,       setTutForm]       = useState<TutorialFormValues>(emptyTutorialForm());
  const [tutSaving,     setTutSaving]     = useState(false);
  const [tutErr,        setTutErr]        = useState("");
  const [tutDeleting,   setTutDeleting]   = useState<string | null>(null);

  const loadAll = async () => {
    const [r, t] = await Promise.all([
      apiFetch<{ resources: ResourceRow[] }>("/staff/resources"),
      apiFetch<{ tutorials: TutorialRow[] }>("/staff/tutorials"),
    ]);
    setResources(r.resources);
    setTutorials(t.tutorials);
  };

  useEffect(() => { loadAll().finally(() => setLoading(false)); }, []);

  const openResCreate = () => { setResEdit(null); setResForm(emptyResourceForm()); setResErr(""); setResModal(true); };
  const openResEdit   = (r: ResourceRow) => {
    setResEdit(r);
    setResForm({ title: r.title, description: r.description ?? "", category: r.category ?? "guide", url: r.url ?? "", icon: r.icon ?? "", orderIndex: r.orderIndex.toString(), isActive: r.isActive });
    setResErr(""); setResModal(true);
  };
  const closeResModal = () => { setResModal(false); setResEdit(null); };

  const saveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.title.trim()) { setResErr("Title is required."); return; }
    setResSaving(true); setResErr("");
    try {
      const body = {
        title:       resForm.title.trim(),
        description: resForm.description.trim() || null,
        category:    resForm.category || null,
        url:         resForm.url.trim() || null,
        icon:        resForm.icon.trim() || null,
        orderIndex:  parseInt(resForm.orderIndex) || 0,
        isActive:    resForm.isActive,
      };
      if (resEdit) {
        await apiFetch(`/staff/resources/${resEdit.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/staff/resources", { method: "POST", body: JSON.stringify(body) });
      }
      const data = await apiFetch<{ resources: ResourceRow[] }>("/staff/resources");
      setResources(data.resources);
      closeResModal();
    } catch (err) {
      setResErr(err instanceof ApiError ? err.message : "Save failed. Try again.");
    } finally {
      setResSaving(false);
    }
  };

  const deleteResource = async (id: string) => {
    if (!confirm("Delete this resource? This cannot be undone.")) return;
    setResDeleting(id);
    try {
      await apiFetch(`/staff/resources/${id}`, { method: "DELETE" });
      setResources((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setResDeleting(null);
    }
  };

  const openTutCreate = () => { setTutEdit(null); setTutForm(emptyTutorialForm()); setTutErr(""); setTutModal(true); };
  const openTutEdit   = (t: TutorialRow) => {
    setTutEdit(t);
    setTutForm({ title: t.title, duration: t.duration ?? "", videoUrl: t.videoUrl ?? "", orderIndex: t.orderIndex.toString(), isActive: t.isActive });
    setTutErr(""); setTutModal(true);
  };
  const closeTutModal = () => { setTutModal(false); setTutEdit(null); };

  const saveTutorial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutForm.title.trim()) { setTutErr("Title is required."); return; }
    setTutSaving(true); setTutErr("");
    try {
      const body = {
        title:      tutForm.title.trim(),
        duration:   tutForm.duration.trim() || null,
        videoUrl:   tutForm.videoUrl.trim() || null,
        orderIndex: parseInt(tutForm.orderIndex) || 0,
        isActive:   tutForm.isActive,
      };
      if (tutEdit) {
        await apiFetch(`/staff/tutorials/${tutEdit.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/staff/tutorials", { method: "POST", body: JSON.stringify(body) });
      }
      const data = await apiFetch<{ tutorials: TutorialRow[] }>("/staff/tutorials");
      setTutorials(data.tutorials);
      closeTutModal();
    } catch (err) {
      setTutErr(err instanceof ApiError ? err.message : "Save failed. Try again.");
    } finally {
      setTutSaving(false);
    }
  };

  const deleteTutorial = async (id: string) => {
    if (!confirm("Delete this tutorial video? This cannot be undone.")) return;
    setTutDeleting(id);
    try {
      await apiFetch(`/staff/tutorials/${id}`, { method: "DELETE" });
      setTutorials((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setTutDeleting(null);
    }
  };

  const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {(["resources", "tutorials"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${section === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {s === "resources" ? `Academy Resources (${resources.length})` : `Tutorial Videos (${tutorials.length})`}
          </button>
        ))}
      </div>

      {section === "resources" && (
        <>
          {resModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4">
                <form onSubmit={saveResource}>
                  <div className="px-6 py-5 border-b border-border flex justify-between items-center">
                    <h2 className="font-semibold text-foreground text-base">{resEdit ? "Edit Resource" : "Add Resource"}</h2>
                    <button type="button" onClick={closeResModal} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    {resErr && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{resErr}</p>}
                    <div><label className="block text-sm font-medium text-foreground mb-1">Title *</label><input type="text" value={resForm.title} onChange={(e) => setResForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. WhatsApp Setup Guide" className={inputCls} required /></div>
                    <div><label className="block text-sm font-medium text-foreground mb-1">Description</label><textarea value={resForm.description} onChange={(e) => setResForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Short description shown to clients" className={`${inputCls} resize-none`} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-sm font-medium text-foreground mb-1">Category</label><select value={resForm.category} onChange={(e) => setResForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}><option value="guide">Guide</option><option value="video">Video</option><option value="document">Document</option><option value="tool">Tool</option></select></div>
                      <div><label className="block text-sm font-medium text-foreground mb-1">Icon (1 char)</label><input type="text" maxLength={10} value={resForm.icon} onChange={(e) => setResForm((f) => ({ ...f, icon: e.target.value }))} placeholder="▶ T W B" className={inputCls} /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-foreground mb-1">URL / Link</label><input type="text" value={resForm.url} onChange={(e) => setResForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." className={inputCls} /></div>
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div><label className="block text-sm font-medium text-foreground mb-1">Order</label><input type="number" min={0} value={resForm.orderIndex} onChange={(e) => setResForm((f) => ({ ...f, orderIndex: e.target.value }))} className={inputCls} /></div>
                      <div className="flex items-center gap-2 pb-2"><input type="checkbox" id="res-active" checked={resForm.isActive} onChange={(e) => setResForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-primary" /><label htmlFor="res-active" className="text-sm text-foreground">Active</label></div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                    <button type="button" onClick={closeResModal} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
                    <button type="submit" disabled={resSaving} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{resSaving ? "Saving…" : "Save Resource"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Manage Academy Resources visible on the client Resources tab.</p>
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
                  <div className="px-6 py-5 border-b border-border flex justify-between items-center">
                    <h2 className="font-semibold text-foreground text-base">{tutEdit ? "Edit Tutorial Video" : "Add Tutorial Video"}</h2>
                    <button type="button" onClick={closeTutModal} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>
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
                  <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                    <button type="button" onClick={closeTutModal} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
                    <button type="submit" disabled={tutSaving} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{tutSaving ? "Saving…" : "Save Tutorial"}</button>
                  </div>
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

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<ModuleRow | null>(null);
  const [deleting,    setDeleting]    = useState<string | null>(null);

  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

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
    users:       `Users (${users.length})`,
    modules:     `Modules (${modules.length})`,
    submissions: "Submissions",
    resources:   "Resources",
    hskd:        "HSKD Certifications",
    sync:        "Sync Events",
    webhooks:    "Webhook Log",
    provision:   "Provision Client",
  };

  return (
    <div className="min-h-screen bg-background">
      {modalOpen && (
        <ModuleModal
          initial={
            editTarget
              ? { title: editTarget.title, description: editTarget.description ?? "", dayStart: editTarget.dayStart?.toString() ?? "", dayEnd: editTarget.dayEnd?.toString() ?? "", orderIndex: editTarget.orderIndex.toString(), isActive: editTarget.isActive }
              : emptyForm()
          }
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
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(["users", "modules", "submissions", "resources", "hskd", "sync", "webhooks", "provision"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
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
                  {["Email", "Name", "Role", "Plan", "Vertical", "Active", "GHL ID", "Provisioned"].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
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
              <p className="text-sm text-muted-foreground">Manage the 30-day programme modules. Changes reflect immediately on the client dashboard.</p>
              <button onClick={openCreate} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">+ Create Module</button>
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
                    <Fragment key={m.id}>
                      <tr className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{m.orderIndex}</td>
                        <td className="py-3 pr-4 font-medium text-foreground max-w-xs">{m.title}</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">{m.dayStart && m.dayEnd ? `Day ${m.dayStart}–${m.dayEnd}` : "—"}</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground max-w-xs truncate">{m.description ?? "—"}</td>
                        <td className="py-3 pr-4"><StatusBadge ok={m.isActive} label={m.isActive ? "Active" : "Hidden"} /></td>
                        <td className="py-3 flex gap-2">
                          <button onClick={() => setExpandedModule(expandedModule === m.id ? null : m.id)} className={`text-xs px-3 py-1 border rounded-lg ${expandedModule === m.id ? "border-primary/50 text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-muted/40"}`}>Exercises</button>
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
                    </Fragment>
                  ))}
                  {modules.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No modules yet. <button onClick={openCreate} className="text-primary underline">Create the first one.</button></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Submissions ── */}
        {tab === "submissions" && <TabSubmissions />}

        {/* ── Resources ── */}
        {tab === "resources" && <TabResources />}

        {/* ── HSKD Certifications ── */}
        {tab === "hskd" && <TabHskdCertifications />}

        {/* ── Sync Events ── */}
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

        {/* ── Webhook Log ── */}
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

        {/* ── Provision Client ── */}
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
  const [result,    setResult]    = useState<{
    action: "created" | "re-provisioned";
    email: string;
    tempPassword: string;
    userId: string;
    note: string;
  } | null>(null);
  const [err, setErr] = useState("");

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setResult(null);
    if (!email.trim()) { setErr("Email is required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch<{
        action: "created" | "re-provisioned";
        email: string;
        tempPassword: string;
        userId: string;
        note: string;
      }>("/admin/provision-override", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), firstName: firstName.trim() || null, lastName: lastName.trim() || null, planTier: planTier || null }),
      });
      setResult(res);
      setEmail(""); setFirstName(""); setLastName(""); setPlanTier("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Provision failed. Check the email and try again.");
    } finally {
      setSaving(false);
    }
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
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Temp password:</span>
              <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">{result.tempPassword}</span>
              <button className="text-xs text-primary underline" onClick={() => navigator.clipboard.writeText(result.tempPassword)}>Copy</button>
            </div>
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