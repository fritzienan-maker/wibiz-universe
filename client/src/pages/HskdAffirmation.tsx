import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

interface AffirmationData {
  certification_id: string;
  industry_slug:    string;
  industry_name:    string;
}

export default function HskdAffirmationPage() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const [data, setData]         = useState<AffirmationData | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSub]    = useState(false);
  const [error, setError]       = useState("");
  const navigate = useNavigate();

  // Form fields
  const [fullName,       setFullName]       = useState("");
  const [title,          setTitle]          = useState("");
  const [oncallName,     setOncallName]     = useState("");
  const [oncallPhone,    setOncallPhone]    = useState("");
  const [licenseType,    setLicenseType]    = useState("");
  const [licenseState,   setLicenseState]   = useState("");
  const [licenseNumber,  setLicenseNumber]  = useState("");
  const [hipaaExecuted,  setHipaa]          = useState(false);
  const [hipaaDate,      setHipaaDate]      = useState("");
  const [mandatoryRep,   setMandatoryRep]   = useState("");

  useEffect(() => {
    apiFetch<AffirmationData>(`/client/hskd/affirmation?industry_slug=${industrySlug}`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load affirmation. Please refresh.");
        }
      });
  }, [industrySlug]);

  const handleSubmit = async () => {
    if (!data || !fullName.trim()) return;
    setSub(true);
    try {
      await apiFetch("/client/hskd/certify/affirmation", {
        method: "POST",
        body: JSON.stringify({
          certification_id:        data.certification_id,
          affirmation_full_name:   fullName.trim(),
          affirmation_title:       title.trim() || null,
          oncall_contact_name:     oncallName.trim(),
          oncall_contact_phone:    oncallPhone.trim(),
          affirmation_license_type:   licenseType  || null,
          affirmation_license_state:  licenseState  || null,
          affirmation_license_number: licenseNumber || null,
          hipaa_baa_executed:      hipaaExecuted,
          hipaa_baa_date:          hipaaDate || null,
          mandatory_reporter_status: mandatoryRep || null,
        }),
      });
      setSubmitted(true);
    } catch {
      setError("Failed to submit affirmation. Please try again.");
    } finally {
      setSub(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8 space-y-4 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-bold text-foreground">ClearPath Affirmation Submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your ClearPath Certification is submitted and pending WiBiz Ops sign-off.
            You will be notified within 1 business day.
          </p>
          <Link
            to="/dashboard"
            className="inline-block mt-2 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const slug = industrySlug ?? "";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
        <span className="text-sm text-muted-foreground">ClearPath Affirmation</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-2">
          <h1 className="text-xl font-bold text-foreground">ClearPath Affirmation</h1>
          <p className="text-sm text-muted-foreground">
            By typing your full legal name and submitting this form, you affirm that you have
            reviewed all certification scenarios and prohibited content declarations for{" "}
            <strong>{data.industry_name}</strong> and agree to operate your AI system
            within the certified parameters.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          {/* Always required */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Full Legal Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Type your full legal name"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Title / Role</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broker, CEO, Clinic Director"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">On-Call Contact Name <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={oncallName}
                onChange={(e) => setOncallName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">On-Call Phone <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={oncallPhone}
                onChange={(e) => setOncallPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Clinics */}
          {(slug === "clinics") && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Clinics — Professional License</p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">License Type</label>
                <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Select...</option>
                  {["MD/DO","DDS/DMD","NP","PA","PT/OT","LCSW/LPC","LAc","Other"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">State of Licensure</label>
                  <input type="text" value={licenseState} onChange={(e) => setLicenseState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">License Number</label>
                  <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={hipaaExecuted} onChange={(e) => setHipaa(e.target.checked)} className="rounded" />
                HIPAA BAA Executed
              </label>
              {hipaaExecuted && (
                <input type="date" value={hipaaDate} onChange={(e) => setHipaaDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              )}
            </div>
          )}

          {/* Legal Services */}
          {slug === "legal-services" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Legal Services — Bar License</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">State Bar License Number <span className="text-destructive">*</span></label>
                  <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">State(s) of Practice</label>
                  <input type="text" value={licenseState} onChange={(e) => setLicenseState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Social Welfare */}
          {slug === "social-welfare" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Social Welfare — TIER 0 Requirements</p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Mandatory Reporter Status <span className="text-destructive">*</span></label>
                <select value={mandatoryRep} onChange={(e) => setMandatoryRep(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Select...</option>
                  <option value="yes">Yes — I am a mandatory reporter</option>
                  <option value="no">No — Not required in my state</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={hipaaExecuted} onChange={(e) => setHipaa(e.target.checked)} className="rounded" />
                HIPAA BAA Executed
              </label>
              {hipaaExecuted && (
                <input type="date" value={hipaaDate} onChange={(e) => setHipaaDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              )}
            </div>
          )}

          {/* Real Estate */}
          {slug === "real-estate" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Real Estate — License Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">State(s) of Licensure</label>
                  <input type="text" value={licenseState} onChange={(e) => setLicenseState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">License Type</label>
                  <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="">Select...</option>
                    {["Agent","Broker","Property Manager"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !fullName.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Type my name above and submit to complete ClearPath Affirmation"}
          </button>
        </div>
      </main>
    </div>
  );
}