/**
 * HskdCertificate.tsx — Task 4.4: Certification Status & Certificate View
 * Route: /hskd/certify/:industrySlug/status
 *
 * Shows different content based on certification status:
 *   IN_PROGRESS        → step tracker + continue button
 *   PENDING_OPS_REVIEW → amber banner + submitted summary
 *   CERTIFIED          → printable certificate view
 *   REJECTED           → red banner + contact ops
 *
 * ARCHITECTURE RULES:
 *  - Uses pool.query() not db.execute()
 *  - Auth: req.user?.userId
 *  - No email. HSKD only in Phase 3 portal UI.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type CertStatus = 'IN_PROGRESS' | 'PENDING_OPS_REVIEW' | 'CERTIFIED' | 'REJECTED';

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
  // Progress fields for IN_PROGRESS state
  scenarios_approved: number;
  prohibited_confirmed: number;
  affirmation_submitted: boolean;
  // Rejection reason
  rejection_note: string | null;
}

// ─── Step tracker config ──────────────────────────────────────────────────────

const STEPS = [
  { label: 'Industry Selection', key: 'industry' },
  { label: 'Training Modules', key: 'training' },
  { label: 'HSKD Scenarios', key: 'scenarios' },
  { label: 'Prohibited Content', key: 'prohibited' },
  { label: 'ClearPath Affirmation', key: 'affirmation' },
  { label: 'WiBiz Ops Review', key: 'ops_review' },
  { label: 'Certification Issued', key: 'certified' },
];

function getCurrentStep(cert: CertificationData): number {
  if (cert.status === 'CERTIFIED') return 7;
  if (cert.affirmation_submitted) return 5;
  if (cert.prohibited_confirmed > 0) return 4;
  if (cert.scenarios_approved > 0) return 3;
  if (cert.training_completed_at) return 2;
  return 1;
}

function getNextStepUrl(cert: CertificationData): string {
  const slug = cert.industry_slug;
  if (!cert.training_completed_at) return `/hskd/certify/${slug}/training`;
  if (cert.scenarios_approved < 5) return `/hskd/certify/${slug}/scenarios`;
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
        // Use my-certification so it works regardless of URL slug
        const res = await fetch(`/api/client/hskd/my-certification`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.message || 'Failed to load certification status');
        }
        const { certification, scenario_logs, prohibited_logs } = await res.json();
        if (!certification) {
          throw new Error('No certification found.');
        }
        const scenariosApproved = (scenario_logs || []).filter((l: any) => l.decision === 'APPROVED').length;
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

  if (loading) {
    return (
      <div style={styles.centeredPage}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Loading certification status…</p>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div style={styles.centeredPage}>
        <div style={styles.errorBox}>
          <p style={styles.errorTitle}>Unable to Load Certification</p>
          <p style={styles.errorText}>{error || 'Certification not found.'}</p>
          <button style={styles.btnPrimary} onClick={() => navigate('/hskd')}>
            Return to Industry Selection
          </button>
        </div>
      </div>
    );
  }

  // ─── Status: REJECTED ───────────────────────────────────────────────────
  if (cert.status === 'REJECTED') {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.banner, ...styles.bannerRed }}>
          <span style={styles.bannerIcon}>⛔</span>
          <span>Certification Flagged for Review</span>
        </div>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>A Scenario Was Rejected</h2>
          <p style={styles.cardText}>
            One or more of your HSKD scenario responses was flagged as REJECT during your
            certification session. Your certification is currently paused pending WiBiz Ops review.
          </p>
          {cert.rejection_note && (
            <p style={{ ...styles.cardText, color: '#dc2626', fontStyle: 'italic' }}>
              Note: {cert.rejection_note}
            </p>
          )}
          <p style={styles.cardText}>
            A WiBiz Ops team member will contact you within 1 business day to resolve the flagged
            scenario before your certification can proceed.
          </p>
          <div style={styles.contactBox}>
            <strong>Need to reach us sooner?</strong> Contact WiBiz Ops directly through your
            account dashboard or email ops@wibiz.ai
          </div>
        </div>
      </div>
    );
  }

  // ─── Status: IN_PROGRESS ────────────────────────────────────────────────
  if (cert.status === 'IN_PROGRESS') {
    const currentStep = getCurrentStep(cert);
    const nextUrl = getNextStepUrl(cert);
    return (
      <div style={styles.page}>
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>ClearPath Certification</h1>
          <p style={styles.pageSubtitle}>
            {cert.industry_name}&nbsp;
            <span style={cert.tier === 'TIER_0' ? styles.tier0Badge : styles.tier1Badge}>
              {cert.tier}
            </span>
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Certification In Progress</h2>
          <p style={styles.cardText}>
            You have completed <strong>{currentStep} of {STEPS.length}</strong> steps.
          </p>

          {/* Step tracker */}
          <div style={styles.stepTracker}>
            {STEPS.map((step, i) => {
              const stepNum = i + 1;
              const isDone = stepNum < currentStep;
              const isCurrent = stepNum === currentStep;
              return (
                <div key={step.key} style={styles.stepRow}>
                  <div
                    style={{
                      ...styles.stepCircle,
                      ...(isDone ? styles.stepDone : {}),
                      ...(isCurrent ? styles.stepCurrent : {}),
                    }}
                  >
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span
                    style={{
                      ...styles.stepLabel,
                      ...(isCurrent ? { fontWeight: 700, color: '#1e40af' } : {}),
                      ...(isDone ? { color: '#16a34a' } : {}),
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <button style={styles.btnPrimary} onClick={() => navigate(nextUrl)}>
            Continue Certification →
          </button>
        </div>
      </div>
    );
  }

  // ─── Status: PENDING_OPS_REVIEW ─────────────────────────────────────────
  if (cert.status === 'PENDING_OPS_REVIEW') {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.banner, ...styles.bannerAmber }}>
          <span style={styles.bannerIcon}>⏳</span>
          <span>Certification Submitted — Pending WiBiz Ops Sign-Off</span>
        </div>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Under Review</h2>
          <p style={styles.cardText}>
            Your ClearPath Certification for <strong>{cert.industry_name}</strong> is complete and
            is currently pending WiBiz Ops sign-off. You will be notified within 1 business day.
          </p>

          {cert.client_full_name && (
            <div style={styles.summaryBox}>
              <p style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Affirmation Name:</span>
                <span>{cert.client_full_name}</span>
              </p>
              {cert.business_name && (
                <p style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Business:</span>
                  <span>{cert.business_name}</span>
                </p>
              )}
              <p style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Industry:</span>
                <span>{cert.industry_name}</span>
              </p>
              <p style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Scenarios:</span>
                <span style={{ color: '#16a34a' }}>All 5 Approved ✓</span>
              </p>
              <p style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Status:</span>
                <span style={{ color: '#d97706', fontWeight: 700 }}>Pending Ops Review</span>
              </p>
            </div>
          )}

          <p style={{ ...styles.cardText, color: '#6b7280', fontSize: '0.85rem' }}>
            Specialist Mode will activate automatically once WiBiz Ops completes the sign-off
            checklist. You will receive a notification when your certificate is issued.
          </p>
        </div>
      </div>
    );
  }

  // ─── Status: CERTIFIED ──────────────────────────────────────────────────
  // Certificate format: WBZ-[INDUSTRY-CODE]-CERT-US-[YYYYMMDD]-[CLIENT-ID-SHORT]
  const certDate = cert.ops_signoff_at
    ? new Date(cert.ops_signoff_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={styles.page}>
      {/* Print trigger button — outside print area */}
      <div style={styles.printControls} className="no-print">
        <button style={styles.btnPrimary} onClick={() => window.print()}>
          ⬇ Download / Print Certificate
        </button>
        <button style={styles.btnSecondary} onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </button>
      </div>

      {/* ─── Printable Certificate ─────────────────────────────────────── */}
      <div style={styles.certificate} id="clearpath-certificate">
        {/* Header */}
        <div style={styles.certHeader}>
          <div style={styles.certLogo}>
            <span style={styles.certLogoMark}>W</span>
            <span style={styles.certLogoText}>WiBiz Universe</span>
          </div>
          <div style={styles.certHeaderRight}>
            <span style={styles.certEdition}>US Edition</span>
          </div>
        </div>

        <div style={styles.certDivider} />

        {/* Title */}
        <div style={styles.certTitleBlock}>
          <p style={styles.certSuperTitle}>ClearPath Certification Program</p>
          <h1 style={styles.certMainTitle}>CERTIFIED</h1>
          <p style={styles.certSubTitle}>
            {cert.industry_name}&nbsp;Vertical&nbsp;·&nbsp;
            <span style={cert.tier === 'TIER_0' ? { color: '#dc2626' } : { color: '#b45309' }}>
              {cert.tier}
            </span>
          </p>
        </div>

        <div style={styles.certDivider} />

        {/* Recipient block */}
        <div style={styles.certBody}>
          <p style={styles.certLabel}>THIS CERTIFIES THAT</p>
          <p style={styles.certName}>{cert.client_full_name || '—'}</p>
          {cert.business_name && (
            <p style={styles.certBusiness}>{cert.business_name}</p>
          )}

          <p style={styles.certStatement}>
            has successfully completed all phases of the WiBiz ClearPath Certification Programme
            for the <strong>{cert.industry_name}</strong> vertical, including HSKD scenario review,
            prohibited content declaration, ClearPath Affirmation, and WiBiz Ops sign-off.
            Specialist Mode is hereby active for this account.
          </p>
        </div>

        {/* Metadata */}
        <div style={styles.certMeta}>
          <div style={styles.certMetaItem}>
            <span style={styles.certMetaLabel}>Certificate ID</span>
            <span style={styles.certMetaValue}>{cert.certificate_id || 'PENDING'}</span>
          </div>
          <div style={styles.certMetaItem}>
            <span style={styles.certMetaLabel}>Date Issued</span>
            <span style={styles.certMetaValue}>{certDate}</span>
          </div>
          <div style={styles.certMetaItem}>
            <span style={styles.certMetaLabel}>Specialist Mode</span>
            <span style={{ ...styles.certMetaValue, color: '#16a34a', fontWeight: 700 }}>
              ACTIVE ✓
            </span>
          </div>
        </div>

        <div style={styles.certDivider} />

        {/* Footer */}
        <div style={styles.certFooter}>
          <p style={styles.certFooterText}>
            WiBiz Universe · ClearPath Certification Programme · universe.wibiz.ai
          </p>
          <p style={styles.certFooterText}>
            This certificate is a legally admissible record of professional due diligence.
            Document Code: WBZ-HSKD-CERT-US-V1
          </p>
        </div>
      </div>

      {/* Print styles injected */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          #clearpath-certificate {
            box-shadow: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  centeredPage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '1rem',
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    border: '4px solid #e5e7eb',
    borderTopColor: '#1e40af',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#6b7280', fontSize: '0.95rem' },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '2rem',
    textAlign: 'center',
    maxWidth: 480,
  },
  errorTitle: { fontWeight: 700, color: '#dc2626', fontSize: '1.1rem', margin: '0 0 0.5rem' },
  errorText: { color: '#6b7280', margin: '0 0 1.5rem' },

  // Page header
  pageHeader: { marginBottom: '1.5rem' },
  pageTitle: { fontSize: '1.6rem', fontWeight: 800, color: '#111827', margin: 0 },
  pageSubtitle: { color: '#6b7280', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: 8 },

  // Tier badges
  tier0Badge: {
    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
    borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700,
  },
  tier1Badge: {
    background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a',
    borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700,
  },

  // Banners
  banner: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.875rem 1.25rem', borderRadius: 8,
    fontWeight: 600, fontSize: '0.95rem', marginBottom: '1.5rem',
  },
  bannerRed: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  bannerAmber: { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' },
  bannerIcon: { fontSize: '1.25rem' },

  // Card
  card: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
  },
  cardTitle: { fontSize: '1.2rem', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem' },
  cardText: { color: '#374151', lineHeight: 1.6, margin: '0 0 1rem' },

  // Step tracker
  stepTracker: { margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  stepRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  stepCircle: {
    width: 28, height: 28, borderRadius: '50%',
    background: '#f3f4f6', color: '#6b7280',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
    border: '2px solid #d1d5db',
  },
  stepDone: { background: '#dcfce7', color: '#16a34a', borderColor: '#86efac' },
  stepCurrent: { background: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' },
  stepLabel: { color: '#6b7280', fontSize: '0.9rem' },

  // Summary
  summaryBox: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: '1rem 1.25rem', margin: '1rem 0',
  },
  summaryRow: { display: 'flex', justifyContent: 'space-between', margin: '0.35rem 0', fontSize: '0.9rem', color: '#374151' },
  summaryLabel: { fontWeight: 600, color: '#6b7280' },

  // Contact box
  contactBox: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
    padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1e40af',
  },

  // Buttons
  btnPrimary: {
    background: '#1e40af', color: '#fff', border: 'none',
    borderRadius: 8, padding: '0.7rem 1.5rem', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.95rem', marginRight: '0.75rem',
  },
  btnSecondary: {
    background: '#f9fafb', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: 8,
    padding: '0.7rem 1.5rem', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.95rem',
  },
  printControls: { marginBottom: '1.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: '0.5rem' },

  // ─── Certificate ──────────────────────────────────────────────────────
  certificate: {
    background: '#fff',
    border: '2px solid #1e3a5f',
    borderRadius: 12,
    padding: '3rem',
    boxShadow: '0 8px 32px rgba(30,58,95,0.12)',
    maxWidth: 720,
    margin: '0 auto',
  },
  certHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  certLogo: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  certLogoMark: {
    background: '#1e3a5f', color: '#fff', width: 36, height: 36,
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: '1.1rem',
  },
  certLogoText: { fontWeight: 800, fontSize: '1.05rem', color: '#1e3a5f' },
  certHeaderRight: {},
  certEdition: {
    background: '#f0f4ff', color: '#1e40af', padding: '4px 12px',
    borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, border: '1px solid #bfdbfe',
  },
  certDivider: { height: 2, background: 'linear-gradient(90deg, #1e3a5f, #3b82f6, #1e3a5f)', borderRadius: 1, margin: '1.25rem 0' },
  certTitleBlock: { textAlign: 'center', padding: '0.5rem 0' },
  certSuperTitle: { color: '#6b7280', fontSize: '0.875rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 0.5rem' },
  certMainTitle: { fontSize: '2.5rem', fontWeight: 900, color: '#1e3a5f', letterSpacing: 3, margin: '0 0 0.25rem' },
  certSubTitle: { color: '#374151', fontSize: '1rem', margin: 0 },
  certBody: { textAlign: 'center', padding: '1.5rem 0' },
  certLabel: { color: '#9ca3af', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 0.5rem' },
  certName: { fontSize: '1.75rem', fontWeight: 800, color: '#111827', margin: '0 0 0.25rem' },
  certBusiness: { fontSize: '1.05rem', color: '#4b5563', margin: '0 0 1.25rem' },
  certStatement: { fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' },
  certMeta: {
    display: 'flex', justifyContent: 'space-around',
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '1.25rem', margin: '1rem 0',
  },
  certMetaItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  certMetaLabel: { fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  certMetaValue: { fontSize: '0.875rem', color: '#111827', fontWeight: 600 },
  certFooter: { textAlign: 'center' },
  certFooterText: { fontSize: '0.7rem', color: '#9ca3af', margin: '0.2rem 0' },
};