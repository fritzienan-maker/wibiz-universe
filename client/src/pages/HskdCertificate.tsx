/**
 * HskdCertificate.tsx — Task 4.4: Certification Status & Certificate View
 * Route: /hskd/certify/:industrySlug/status
 *
 * REDESIGNED: Premium dark luxury minimal credential
 *
 * ARCHITECTURE RULES:
 *  - Uses pool.query() not db.execute()
 *  - Auth: req.user?.userId
 *  - No email. HSKD only in Phase 3 portal UI.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type CertStatus = 'IN_PROGRESS' | 'OPS_REVIEW' | 'CERTIFIED' | 'REJECTED';

interface CertificationData {
  id: string;
  status: CertStatus;
  industry_name: string;
  industry_slug: string;
  tier: 'TIER_0' | 'TIER_1';
  certificate_id: string | null;
  client_full_name: string | null;
  business_name: string | null;
  specialist_mode_activated_at: string | null;
  ops_signoff_at: string | null;
  training_completed_at: string | null;
  scenarios_approved: number;
  prohibited_confirmed: number;
  affirmation_submitted: boolean;
  rejection_note: string | null;
}

// ─── Step tracker config ──────────────────────────────────────────────────────

const STEPS = [
  { label: 'Industry Selection',    key: 'industry' },
  { label: 'Training Modules',      key: 'training' },
  { label: 'HSKD Scenarios',        key: 'scenarios' },
  { label: 'Prohibited Content',    key: 'prohibited' },
  { label: 'ClearPath Affirmation', key: 'affirmation' },
  { label: 'WiBiz Ops Review',      key: 'ops_review' },
  { label: 'Certification Issued',  key: 'certified' },
];

function getCurrentStep(cert: CertificationData): number {
  if (cert.status === 'CERTIFIED') return 7;
  if (cert.status === 'OPS_REVIEW') return 6;
  if (cert.affirmation_submitted) return 5;
  if (cert.prohibited_confirmed > 0) return 4;
  if (cert.scenarios_approved > 0) return 3;
  if (cert.training_completed_at) return 2;
  return 1;
}

function getNextStepUrl(cert: CertificationData): string {
  const slug = cert.industry_slug;
  if (!cert.training_completed_at) return `/hskd/certify/${slug}/training`;
  if (cert.scenarios_approved < 10) return `/hskd/certify/${slug}/scenarios`;
  if (!cert.affirmation_submitted) return `/hskd/certify/${slug}/prohibited`;
  return `/hskd/certify/${slug}/affirmation`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HskdCertificate() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const navigate = useNavigate();

  const [cert, setCert] = useState<CertificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/client/hskd/my-certification`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.message || 'Failed to load certification status');
        }
        const { certification, scenario_logs, prohibited_logs } = await res.json();
        if (!certification) throw new Error('No certification found.');
        const scenariosApproved   = (scenario_logs || []).filter((l: any) => l.decision === 'APPROVED').length;
        const prohibitedConfirmed = (prohibited_logs || []).length;
        const affirmationSubmitted = ['OPS_REVIEW', 'CERTIFIED', 'REJECTED'].includes(certification.status);
        setCert({
          id:                           certification.id,
          status:                       certification.status,
          industry_name:                certification.industry_name,
          industry_slug:                certification.industry_slug,
          tier:                         certification.tier,
          certificate_id:               certification.certificate_id,
          client_full_name:             certification.affirmation_legal_name,
          business_name:                null,
          specialist_mode_activated_at: certification.specialist_mode_activated_at,
          ops_signoff_at:               certification.ops_signoff_at,
          training_completed_at:        certification.training_completed_at,
          scenarios_approved:           scenariosApproved,
          prohibited_confirmed:         prohibitedConfirmed,
          affirmation_submitted:        affirmationSubmitted,
          rejection_note:               certification.status === 'REJECTED' ? certification.notes : null,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [industrySlug]);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.centeredPage}>
        <div style={s.spinner} />
        <p style={s.spinnerText}>Loading certification…</p>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (error || !cert) {
    return (
      <div style={s.centeredPage}>
        <div style={s.errorBox}>
          <p style={s.errorTitle}>Unable to Load Certification</p>
          <p style={s.errorSub}>{error || 'Certification not found.'}</p>
          <button style={s.btnPrimary} onClick={() => navigate('/hskd')}>
            Return to Industry Selection
          </button>
        </div>
      </div>
    );
  }

  // ─── REJECTED ────────────────────────────────────────────────────────────
  if (cert.status === 'REJECTED') {
    return (
      <div style={s.page}>
        <div style={{ ...s.statusBanner, ...s.bannerRed }}>
          <span>⛔</span>
          <span>Certification Flagged for Review</span>
        </div>
        <div style={s.statusCard}>
          <h2 style={s.statusTitle}>A Scenario Was Rejected</h2>
          <p style={s.statusText}>
            One or more of your HSKD scenario responses was flagged as REJECT during your
            certification session. Your certification is currently paused pending WiBiz Ops review.
          </p>
          {cert.rejection_note && (
            <p style={{ ...s.statusText, color: '#f87171', fontStyle: 'italic' }}>
              Note: {cert.rejection_note}
            </p>
          )}
          <p style={s.statusText}>
            A WiBiz Ops team member will contact you within 1 business day to resolve the flagged
            scenario before your certification can proceed.
          </p>
          <div style={s.contactBox}>
            <strong>Need to reach us sooner?</strong> Contact WiBiz Ops at ops@wibiz.ai
          </div>
        </div>
      </div>
    );
  }

  // ─── IN_PROGRESS ─────────────────────────────────────────────────────────
  if (cert.status === 'IN_PROGRESS') {
    const currentStep = getCurrentStep(cert);
    const nextUrl     = getNextStepUrl(cert);
    return (
      <div style={s.page}>
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>ClearPath Certification</h1>
          <p style={s.pageSubtitle}>
            {cert.industry_name}&nbsp;
            <span style={cert.tier === 'TIER_0' ? s.tier0Badge : s.tier1Badge}>
              {cert.tier}
            </span>
          </p>
        </div>
        <div style={s.statusCard}>
          <h2 style={s.statusTitle}>Certification In Progress</h2>
          <p style={s.statusText}>
            You have completed <strong style={{ color: '#b5a06a' }}>{currentStep} of {STEPS.length}</strong> steps.
          </p>
          <div style={s.stepTracker}>
            {STEPS.map((step, i) => {
              const stepNum   = i + 1;
              const isDone    = stepNum < currentStep;
              const isCurrent = stepNum === currentStep;
              return (
                <div key={step.key} style={s.stepRow}>
                  <div style={{
                    ...s.stepCircle,
                    ...(isDone    ? s.stepDone    : {}),
                    ...(isCurrent ? s.stepCurrent : {}),
                  }}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span style={{
                    ...s.stepLabel,
                    ...(isDone    ? { color: '#4ade80' }  : {}),
                    ...(isCurrent ? { color: '#e8d5a0', fontWeight: 700 } : {}),
                  }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <button style={s.btnPrimary} onClick={() => navigate(nextUrl)}>
            Continue Certification →
          </button>
        </div>
      </div>
    );
  }

  // ─── OPS_REVIEW ──────────────────────────────────────────────────
  if (cert.status === 'OPS_REVIEW') {
    return (
      <div style={s.page}>
        <div style={{ ...s.statusBanner, ...s.bannerAmber }}>
          <span>⏳</span>
          <span>Certification Submitted — Pending WiBiz Ops Sign-Off</span>
        </div>
        <div style={s.statusCard}>
          <h2 style={s.statusTitle}>Under Review</h2>
          <p style={s.statusText}>
            Your ClearPath Certification for <strong style={{ color: '#e8d5a0' }}>{cert.industry_name}</strong> is
            complete and currently pending WiBiz Ops sign-off. You will be notified within 1 business day.
          </p>
          {cert.client_full_name && (
            <div style={s.summaryBox}>
              {[
                ['Affirmation Name', cert.client_full_name],
                cert.business_name ? ['Business', cert.business_name] : null,
                ['Industry', cert.industry_name],
                ['Scenarios', 'All Approved ✓'],
                ['Status', 'Pending Ops Review'],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label as string} style={s.summaryRow}>
                  <span style={s.summaryLabel}>{label}</span>
                  <span style={s.summaryValue}>{value}</span>
                </div>
              ))}
            </div>
          )}
          <p style={{ ...s.statusText, color: '#6b7280', fontSize: '0.83rem', marginTop: '1rem' }}>
            Specialist Mode will activate automatically once WiBiz Ops completes the sign-off
            checklist. You will receive a notification when your certificate is issued.
          </p>
        </div>
      </div>
    );
  }

  // ─── CERTIFIED ───────────────────────────────────────────────────────────
  const certDate = cert.ops_signoff_at
    ? new Date(cert.ops_signoff_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={s.page}>
      {/* Injected fonts + print styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .cert-fadein { animation: fadeUp 0.7s ease both; }
        .cert-fadein-delay { animation: fadeUp 0.7s ease 0.15s both; }
        .cert-fadein-delay2 { animation: fadeUp 0.7s ease 0.3s both; }

        .cert-gold-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, #c9a84c, #e8d5a0, #c9a84c, transparent);
          margin: 1.75rem 0;
          border: none;
        }
        .cert-corner {
          position: absolute;
          width: 28px; height: 28px;
          border-color: #c9a84c;
          border-style: solid;
          opacity: 0.7;
        }
        .cert-corner-tl { top: 18px; left: 18px; border-width: 2px 0 0 2px; }
        .cert-corner-tr { top: 18px; right: 18px; border-width: 2px 2px 0 0; }
        .cert-corner-bl { bottom: 18px; left: 18px; border-width: 0 0 2px 2px; }
        .cert-corner-br { bottom: 18px; right: 18px; border-width: 0 2px 2px 0; }

        .cert-seal {
          width: 80px; height: 80px;
          border-radius: 50%;
          border: 2px solid #c9a84c;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: radial-gradient(circle, #1a2535 60%, #0d1825 100%);
          box-shadow: 0 0 0 4px rgba(201,168,76,0.15), 0 0 20px rgba(201,168,76,0.1);
          margin: 0 auto 1.5rem;
          font-family: 'Cormorant Garamond', serif;
        }

        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #0d1825 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #clearpath-certificate { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* Print controls */}
      <div style={s.printControls} className="no-print">
        <button style={s.btnPrimary} onClick={() => window.print()}>
          ↓ Download / Print Certificate
        </button>
        <button style={s.btnGhost} onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </button>
      </div>

      {/* ─── Certificate ─────────────────────────────────────────────── */}
      <div style={s.certWrap} id="clearpath-certificate">
        {/* Corner ornaments */}
        <div className="cert-corner cert-corner-tl" />
        <div className="cert-corner cert-corner-tr" />
        <div className="cert-corner cert-corner-bl" />
        <div className="cert-corner cert-corner-br" />

        {/* Header */}
        <div style={s.certHeader} className="cert-fadein">
          <div style={s.certBrand}>
            <div style={s.certBrandMark}>W</div>
            <div>
              <div style={s.certBrandName}>WiBiz Universe</div>
              <div style={s.certBrandSub}>ClearPath Certification Programme</div>
            </div>
          </div>
          <div style={s.certEditionPill}>
            US&nbsp;Edition&nbsp;·&nbsp;v1
          </div>
        </div>

        <hr className="cert-gold-line" />

        {/* Seal + Title */}
        <div style={{ textAlign: 'center', padding: '0.5rem 0 0' }} className="cert-fadein-delay">
          <div className="cert-seal">
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>✦</span>
            <span style={{ fontSize: '0.55rem', letterSpacing: 2, color: '#c9a84c', textTransform: 'uppercase', marginTop: 3 }}>Verified</span>
          </div>
          <p style={s.certSuperLabel}>This Certificate is Awarded to</p>
          <p style={s.certRecipientName}>{cert.client_full_name || '—'}</p>
          {cert.business_name && (
            <p style={s.certBusinessName}>{cert.business_name}</p>
          )}
        </div>

        <hr className="cert-gold-line" />

        {/* Statement */}
        <div style={s.certStatementBlock} className="cert-fadein-delay2">
          <p style={s.certStatement}>
            has successfully completed all phases of the{' '}
            <span style={{ color: '#e8d5a0' }}>WiBiz ClearPath Certification Programme</span>{' '}
            for the <span style={{ color: '#e8d5a0' }}>{cert.industry_name}</span> vertical,
            including HSKD scenario review, prohibited content declaration, ClearPath Affirmation,
            and WiBiz Ops sign-off. Specialist Mode is hereby active for this account.
          </p>
        </div>

        {/* Tier + vertical badge */}
        <div style={s.certBadgeRow}>
          <div style={s.certVerticalBadge}>{cert.industry_name}</div>
          <div style={cert.tier === 'TIER_0' ? s.certTier0 : s.certTier1}>{cert.tier}</div>
          <div style={s.certSpecialistBadge}>Specialist Mode Active</div>
        </div>

        <hr className="cert-gold-line" />

        {/* Metadata row */}
        <div style={s.certMetaRow}>
          {[
            { label: 'Certificate ID',   value: cert.certificate_id || 'PENDING' },
            { label: 'Date Issued',      value: certDate },
            { label: 'Document Code',    value: 'WBZ-HSKD-CERT-US-V1' },
          ].map(({ label, value }) => (
            <div key={label} style={s.certMetaItem}>
              <span style={s.certMetaLabel}>{label}</span>
              <span style={s.certMetaValue}>{value}</span>
            </div>
          ))}
        </div>

        <hr className="cert-gold-line" />

        {/* Footer */}
        <div style={s.certFooter}>
          <p style={s.certFooterLine}>
            WiBiz Universe · universe.wibiz.ai
          </p>
          <p style={s.certFooterLine}>
            This certificate is a legally admissible record of professional due diligence.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD   = '#c9a84c';
const GOLD_L = '#e8d5a0';
const DARK   = '#0d1825';
const DARK2  = '#131f2e';
const DARK3  = '#1e2f42';
const TEXT   = '#e8edf5';
const MUTED  = '#8fa8c4';

const s: Record<string, React.CSSProperties> = {
  // ── Shell ──────────────────────────────────────────────────────────────
  page: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '2rem 1rem 4rem',
    fontFamily: "'DM Sans', sans-serif",
  },
  centeredPage: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', gap: '1rem',
    fontFamily: "'DM Sans', sans-serif",
  },
  spinner: {
    width: 36, height: 36,
    border: `3px solid ${DARK3}`,
    borderTopColor: GOLD,
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  spinnerText: { color: MUTED, fontSize: '0.9rem' },
  errorBox: {
    background: DARK2, border: '1px solid #3d1515',
    borderRadius: 10, padding: '2rem',
    textAlign: 'center', maxWidth: 460,
  },
  errorTitle: { fontWeight: 700, color: '#f87171', fontSize: '1.05rem', margin: '0 0 0.5rem' },
  errorSub:   { color: MUTED, margin: '0 0 1.5rem', fontSize: '0.9rem' },

  // ── Page header (non-cert states) ──────────────────────────────────────
  pageHeader:   { marginBottom: '1.5rem' },
  pageTitle:    { fontSize: '1.5rem', fontWeight: 700, color: TEXT, margin: 0 },
  pageSubtitle: { color: MUTED, margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' },
  tier0Badge: {
    background: '#200f0f', color: '#f87171', border: '1px solid #3d1515',
    borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700,
  },
  tier1Badge: {
    background: '#231a05', color: '#f0a732', border: '1px solid #3d2e08',
    borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700,
  },

  // ── Status banners ─────────────────────────────────────────────────────
  statusBanner: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.875rem 1.25rem', borderRadius: 8,
    fontWeight: 600, fontSize: '0.92rem', marginBottom: '1.5rem',
  },
  bannerRed:   { background: '#200f0f', color: '#f87171',  border: '1px solid #3d1515' },
  bannerAmber: { background: '#231a05', color: '#f0a732',  border: '1px solid #3d2e08' },

  // ── Status card (non-cert states) ──────────────────────────────────────
  statusCard: {
    background: DARK2, border: `1px solid ${DARK3}`,
    borderRadius: 12, padding: '2rem',
  },
  statusTitle: { fontSize: '1.15rem', fontWeight: 700, color: TEXT,  margin: '0 0 0.75rem' },
  statusText:  { color: MUTED, lineHeight: 1.65, margin: '0 0 0.75rem', fontSize: '0.92rem' },

  // ── Step tracker ───────────────────────────────────────────────────────
  stepTracker: { margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  stepRow:     { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  stepCircle: {
    width: 28, height: 28, borderRadius: '50%',
    background: DARK3, color: MUTED,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
    border: `1px solid #243548`,
  },
  stepDone:    { background: '#0a2218', color: '#4ade9a', borderColor: '#0d3824' },
  stepCurrent: { background: '#1a1200', color: GOLD,     borderColor: '#3d2e08' },
  stepLabel:   { color: MUTED, fontSize: '0.88rem' },

  // ── Summary box ────────────────────────────────────────────────────────
  summaryBox: {
    background: DARK3, border: `1px solid #243548`,
    borderRadius: 8, padding: '1rem 1.25rem', margin: '1rem 0',
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '0.35rem 0', fontSize: '0.88rem',
    borderBottom: `1px solid #243548`,
  },
  summaryLabel: { color: MUTED,  fontWeight: 500 },
  summaryValue: { color: TEXT,   fontWeight: 500 },

  // ── Contact box ────────────────────────────────────────────────────────
  contactBox: {
    background: '#0a1e36', border: '1px solid #1e3050',
    borderRadius: 8, padding: '0.875rem 1rem',
    fontSize: '0.85rem', color: '#5fa3e8',
  },

  // ── Buttons ────────────────────────────────────────────────────────────
  btnPrimary: {
    background: GOLD, color: '#0d1825',
    border: 'none', borderRadius: 8,
    padding: '0.7rem 1.6rem', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.9rem',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnGhost: {
    background: 'transparent', color: MUTED,
    border: `1px solid ${DARK3}`, borderRadius: 8,
    padding: '0.7rem 1.4rem', cursor: 'pointer',
    fontWeight: 500, fontSize: '0.9rem',
    fontFamily: "'DM Sans', sans-serif",
  },
  printControls: {
    marginBottom: '1.75rem',
    display: 'flex', alignItems: 'center',
    gap: '0.75rem', flexWrap: 'wrap' as const,
  },

  // ── Certificate shell ──────────────────────────────────────────────────
  certWrap: {
    position: 'relative',
    background: `linear-gradient(160deg, #111c2a 0%, #0d1825 40%, #111c2a 100%)`,
    border: `1px solid #2a3d55`,
    borderRadius: 14,
    padding: '3rem 3.5rem',
    boxShadow: `0 0 0 1px rgba(201,168,76,0.12), 0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.08)`,
    maxWidth: 740,
    margin: '0 auto',
  },

  // ── Cert header ────────────────────────────────────────────────────────
  certHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  certBrand: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  certBrandMark: {
    width: 40, height: 40, borderRadius: 10,
    background: `linear-gradient(135deg, #1e3050, #0d1825)`,
    border: `1px solid ${GOLD}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: '1.1rem', color: GOLD,
    fontFamily: "'Cormorant Garamond', serif",
    boxShadow: `0 0 12px rgba(201,168,76,0.2)`,
  },
  certBrandName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 700, fontSize: '1.05rem', color: GOLD_L,
    letterSpacing: '0.02em',
  },
  certBrandSub: {
    fontSize: '0.68rem', color: MUTED,
    letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1,
  },
  certEditionPill: {
    background: 'rgba(201,168,76,0.08)',
    border: `1px solid rgba(201,168,76,0.25)`,
    borderRadius: 20, padding: '4px 14px',
    fontSize: '0.7rem', color: GOLD,
    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  },

  // ── Cert recipient ─────────────────────────────────────────────────────
  certSuperLabel: {
    fontSize: '0.68rem', color: MUTED,
    letterSpacing: '0.18em', textTransform: 'uppercase' as const,
    margin: '0 0 0.75rem', fontFamily: "'DM Sans', sans-serif",
  },
  certRecipientName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '2.6rem', fontWeight: 600,
    color: GOLD_L, margin: '0 0 0.25rem',
    letterSpacing: '0.01em',
    lineHeight: 1.15,
  },
  certBusinessName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.95rem', color: MUTED,
    margin: '0 0 0.5rem', fontWeight: 300,
  },

  // ── Cert statement ─────────────────────────────────────────────────────
  certStatementBlock: { textAlign: 'center', padding: '0 1rem' },
  certStatement: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.875rem', color: '#8fa8c4',
    lineHeight: 1.8, maxWidth: 560, margin: '0 auto',
    fontWeight: 300,
  },

  // ── Cert badges ────────────────────────────────────────────────────────
  certBadgeRow: {
    display: 'flex', justifyContent: 'center',
    gap: '0.75rem', flexWrap: 'wrap' as const,
    margin: '0.5rem 0',
  },
  certVerticalBadge: {
    background: 'rgba(201,168,76,0.08)',
    border: `1px solid rgba(201,168,76,0.25)`,
    borderRadius: 6, padding: '5px 14px',
    fontSize: '0.75rem', color: GOLD_L,
    fontWeight: 600, letterSpacing: '0.06em',
  },
  certTier0: {
    background: '#200f0f', color: '#f87171',
    border: '1px solid #3d1515',
    borderRadius: 6, padding: '5px 14px',
    fontSize: '0.75rem', fontWeight: 700,
  },
  certTier1: {
    background: '#231a05', color: '#f0a732',
    border: '1px solid #3d2e08',
    borderRadius: 6, padding: '5px 14px',
    fontSize: '0.75rem', fontWeight: 700,
  },
  certSpecialistBadge: {
    background: '#0a2218', color: '#4ade9a',
    border: '1px solid #0d3824',
    borderRadius: 6, padding: '5px 14px',
    fontSize: '0.75rem', fontWeight: 600,
  },

  // ── Cert metadata ──────────────────────────────────────────────────────
  certMetaRow: {
    display: 'flex', justifyContent: 'space-around',
    background: 'rgba(255,255,255,0.02)',
    border: `1px solid ${DARK3}`,
    borderRadius: 8, padding: '1.25rem',
  },
  certMetaItem: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 5,
  },
  certMetaLabel: {
    fontSize: '0.62rem', color: MUTED,
    fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
  },
  certMetaValue: {
    fontSize: '0.82rem', color: GOLD_L,
    fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
  },

  // ── Cert footer ────────────────────────────────────────────────────────
  certFooter: { textAlign: 'center' },
  certFooterLine: {
    fontSize: '0.67rem', color: '#4d6680',
    margin: '0.2rem 0', letterSpacing: '0.04em',
    fontFamily: "'DM Sans', sans-serif",
  },
};