/**
 * HskdCertificate.tsx — Task 4.4 (Updated)
 * Route: /hskd/certify/:industrySlug/status
 *
 * ADDITIONS over previous version:
 *   - Download as PNG image (html2canvas)
 *   - Download as PDF (html2canvas + jsPDF)
 *   - Visual certificate uses a ref'd div — exported exactly as it looks
 *
 * INSTALL (run once in the client folder):
 *   npm install html2canvas jspdf
 *   npm install --save-dev @types/html2canvas  (if using strict TS)
 *
 * No server-side dependency. Everything runs in the browser.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  scenarios_approved: number;
  prohibited_confirmed: number;
  affirmation_submitted: boolean;
  rejection_note: string | null;
}

// ─── Step tracker ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Industry Selection',     key: 'industry' },
  { label: 'Training Modules',       key: 'training' },
  { label: 'HSKD Scenarios',         key: 'scenarios' },
  { label: 'Prohibited Content',     key: 'prohibited' },
  { label: 'ClearPath Affirmation',  key: 'affirmation' },
  { label: 'WiBiz Ops Review',       key: 'ops_review' },
  { label: 'Certification Issued',   key: 'certified' },
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

// ─── Download helpers ─────────────────────────────────────────────────────────

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: 3,           // 3x resolution — crisp on retina and print
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
}

async function downloadAsPNG(el: HTMLElement, filename: string) {
  const canvas = await captureElement(el);
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function downloadAsPDF(el: HTMLElement, filename: string) {
  const canvas = await captureElement(el);
  const imgData = canvas.toDataURL('image/png');

  // A4 landscape for certificate feel (297mm × 210mm)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth  = pdf.internal.pageSize.getWidth();   // 297
  const pageHeight = pdf.internal.pageSize.getHeight();  // 210

  // Scale image to fit page with 10mm margins
  const margin = 10;
  const availW = pageWidth  - margin * 2;
  const availH = pageHeight - margin * 2;

  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = Math.min(availW / imgW, availH / imgH);

  const drawW = imgW * ratio;
  const drawH = imgH * ratio;
  const offsetX = margin + (availW - drawW) / 2;
  const offsetY = margin + (availH - drawH) / 2;

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);
  pdf.save(`${filename}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HskdCertificate() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const navigate = useNavigate();

  const certRef = useRef<HTMLDivElement>(null);
  const [cert, setCert] = useState<CertificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'png' | null>(null);

  useEffect(() => {
    fetch(`/api/client/hskd/certify/${industrySlug}/status`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : r.json().then((b: any) => Promise.reject(b.message)))
      .then(setCert)
      .catch((msg: string) => setError(msg || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [industrySlug]);

  const handleDownload = async (type: 'pdf' | 'png') => {
    if (!certRef.current || !cert) return;
    setDownloading(type);
    try {
      const filename = `WiBiz-ClearPath-${cert.certificate_id || 'Certificate'}`;
      if (type === 'pdf') {
        await downloadAsPDF(certRef.current, filename);
      } else {
        await downloadAsPNG(certRef.current, filename);
      }
    } finally {
      setDownloading(null);
    }
  };

  // ── Loading / Error ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.centeredPage}>
        <div style={s.spinner} />
        <p style={s.mutedText}>Loading certification…</p>
      </div>
    );
  }
  if (error || !cert) {
    return (
      <div style={s.centeredPage}>
        <div style={s.errorBox}>
          <p style={s.errorTitle}>Unable to Load Certification</p>
          <p style={s.mutedText}>{error || 'Not found.'}</p>
          <button style={s.btnPrimary} onClick={() => navigate('/hskd')}>
            Back to Industry Selection
          </button>
        </div>
      </div>
    );
  }

  // ── REJECTED ────────────────────────────────────────────────────────────
  if (cert.status === 'REJECTED') {
    return (
      <div style={s.page}>
        <div style={{ ...s.banner, ...s.bannerRed }}>
          <span>⛔</span> Certification Flagged for Review
        </div>
        <div style={s.card}>
          <h2 style={s.cardTitle}>A Scenario Was Rejected</h2>
          <p style={s.cardText}>
            One or more HSKD scenario responses was flagged REJECT. WiBiz Ops will contact you
            within 1 business day to resolve the flagged scenario before certification can proceed.
          </p>
          {cert.rejection_note && (
            <p style={{ ...s.cardText, color: '#dc2626', fontStyle: 'italic' }}>
              {cert.rejection_note}
            </p>
          )}
          <div style={s.infoBox}>
            Contact WiBiz Ops: <strong>ops@wibiz.ai</strong>
          </div>
        </div>
      </div>
    );
  }

  // ── IN_PROGRESS ─────────────────────────────────────────────────────────
  if (cert.status === 'IN_PROGRESS') {
    const step = getCurrentStep(cert);
    return (
      <div style={s.page}>
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>ClearPath Certification</h1>
          <p style={s.pageSubtitle}>
            {cert.industry_name}&nbsp;
            <span style={cert.tier === 'TIER_0' ? s.tier0Badge : s.tier1Badge}>{cert.tier}</span>
          </p>
        </div>
        <div style={s.card}>
          <h2 style={s.cardTitle}>Certification In Progress</h2>
          <p style={s.cardText}>Step <strong>{step}</strong> of <strong>{STEPS.length}</strong> complete.</p>
          <div style={s.stepTracker}>
            {STEPS.map((st, i) => {
              const n = i + 1;
              const done = n < step;
              const cur = n === step;
              return (
                <div key={st.key} style={s.stepRow}>
                  <div style={{ ...s.stepCircle, ...(done ? s.stepDone : {}), ...(cur ? s.stepCurrent : {}) }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ ...s.stepLabel, ...(cur ? { fontWeight: 700, color: '#1e40af' } : {}), ...(done ? { color: '#16a34a' } : {}) }}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
          <button style={s.btnPrimary} onClick={() => navigate(getNextStepUrl(cert))}>
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── PENDING_OPS_REVIEW ──────────────────────────────────────────────────
  if (cert.status === 'PENDING_OPS_REVIEW') {
    return (
      <div style={s.page}>
        <div style={{ ...s.banner, ...s.bannerAmber }}>
          <span>⏳</span> Submitted — Pending WiBiz Ops Sign-Off
        </div>
        <div style={s.card}>
          <h2 style={s.cardTitle}>Under Review</h2>
          <p style={s.cardText}>
            Your ClearPath Certification for <strong>{cert.industry_name}</strong> has been
            submitted and is pending WiBiz Ops sign-off. You will be notified within 1 business day.
          </p>
          <div style={s.summaryBox}>
            {cert.client_full_name && <SummaryRow label="Affirmation Name" value={cert.client_full_name} />}
            {cert.business_name && <SummaryRow label="Business" value={cert.business_name} />}
            <SummaryRow label="Industry" value={cert.industry_name} />
            <SummaryRow label="Scenarios" value="All 5 Approved ✓" valueColor="#16a34a" />
            <SummaryRow label="Status" value="Pending Ops Review" valueColor="#d97706" />
          </div>
        </div>
      </div>
    );
  }

  // ── CERTIFIED ───────────────────────────────────────────────────────────
  const certDate = cert.ops_signoff_at
    ? new Date(cert.ops_signoff_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const industryCode = {
    'real-estate':    'RE',
    'clinics':        'CL',
    'legal-services': 'LS',
    'social-welfare': 'SW',
    'restaurants':    'RS',
  }[cert.industry_slug] || 'XX';

  return (
    <div style={s.page}>

      {/* ── Action buttons (not captured in download) ── */}
      <div style={s.actionBar} className="no-capture">
        <button
          style={s.btnPDF}
          onClick={() => handleDownload('pdf')}
          disabled={!!downloading}
        >
          {downloading === 'pdf' ? '⏳ Generating…' : '⬇ Download PDF'}
        </button>
        <button
          style={s.btnPNG}
          onClick={() => handleDownload('png')}
          disabled={!!downloading}
        >
          {downloading === 'png' ? '⏳ Generating…' : '🖼 Download Image (PNG)'}
        </button>
        <button style={s.btnPrint} onClick={() => window.print()}>
          🖨 Print
        </button>
        <button style={s.btnBack} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
      </div>

      {/* ── Certificate (captured by html2canvas via ref) ── */}
      <div ref={certRef} style={s.certificate}>

        {/* Decorative top bar */}
        <div style={s.certTopBar} />

        {/* Header */}
        <div style={s.certHeader}>
          <div style={s.certLogoBlock}>
            <div style={s.certLogoMark}>W</div>
            <div>
              <div style={s.certLogoName}>WiBiz Universe</div>
              <div style={s.certLogoSub}>ClearPath Certification Programme</div>
            </div>
          </div>
          <div style={s.certHeaderRight}>
            <div style={s.certEditionBadge}>US Edition</div>
            <div style={cert.tier === 'TIER_0' ? s.certTier0 : s.certTier1}>{cert.tier}</div>
          </div>
        </div>

        {/* Divider */}
        <div style={s.certRuler} />

        {/* Hero */}
        <div style={s.certHero}>
          <p style={s.certSuperLabel}>This is to certify that</p>
          <p style={s.certRecipientName}>{cert.client_full_name || '—'}</p>
          {cert.business_name && (
            <p style={s.certBusinessName}>{cert.business_name}</p>
          )}
          <p style={s.certIndustryLine}>
            {cert.industry_name} Vertical
          </p>
        </div>

        {/* Statement */}
        <div style={s.certStatement}>
          <p style={s.certStatementText}>
            has successfully completed all required phases of the WiBiz ClearPath Certification
            Programme — including HSKD scenario review, prohibited content declaration, ClearPath
            Affirmation, and WiBiz Ops sign-off — and is hereby authorised to operate in Specialist
            Mode for the {cert.industry_name} vertical.
          </p>
        </div>

        {/* Divider */}
        <div style={s.certRuler} />

        {/* Meta grid */}
        <div style={s.certMetaGrid}>
          <CertMetaCell label="Certificate ID"   value={cert.certificate_id || 'PENDING'} mono />
          <CertMetaCell label="Date Issued"       value={certDate} />
          <CertMetaCell label="Industry Code"     value={`WBZ-${industryCode}`} />
          <CertMetaCell label="Specialist Mode"   value="ACTIVE ✓" green />
        </div>

        {/* Seal / stamp area */}
        <div style={s.certSealRow}>
          <div style={s.certSeal}>
            <div style={s.certSealInner}>
              <div style={s.certSealText}>CERTIFIED</div>
              <div style={s.certSealYear}>{new Date().getFullYear()}</div>
            </div>
          </div>
          <div style={s.certSignatureLine}>
            <div style={s.certSignatureBar} />
            <div style={s.certSignatureLabel}>WiBiz Operations — Authorised Sign-Off</div>
          </div>
        </div>

        {/* Footer */}
        <div style={s.certFooter}>
          <span>WiBiz Universe · universe.wibiz.ai</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <span>Document Code: WBZ-HSKD-CERT-US-V1</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <span>This certificate is a legally admissible record of professional due diligence</span>
        </div>

        {/* Decorative bottom bar */}
        <div style={s.certBottomBar} />
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          .no-capture { display: none !important; }
          body { margin: 0; background: white; }
        }
      `}</style>
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.875rem' }}>
      <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}</span>
      <span style={{ color: valueColor || '#111827' }}>{value}</span>
    </div>
  );
}

function CertMetaCell({ label, value, mono, green }: { label: string; value: string; mono?: boolean; green?: boolean }) {
  return (
    <div style={{ textAlign: 'center' as const }}>
      <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.8rem',
        fontWeight: 700,
        color: green ? '#16a34a' : '#1e3a5f',
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  centeredPage: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem',
  },
  spinner: {
    width: 36, height: 36,
    border: '3px solid #e5e7eb', borderTopColor: '#1e40af',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },
  mutedText: { color: '#9ca3af', fontSize: '0.875rem', margin: 0 },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
    padding: '2rem', textAlign: 'center', maxWidth: 480,
  },
  errorTitle: { fontWeight: 700, color: '#dc2626', fontSize: '1.1rem', margin: '0 0 0.5rem' },

  // Page
  pageHeader: { marginBottom: '1.5rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 },
  pageSubtitle: { color: '#6b7280', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: 8 },

  // Badges
  tier0Badge: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 },
  tier1Badge: { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 },

  // Banners
  banner: { display: 'flex', alignItems: 'center', gap: 10, padding: '0.875rem 1.25rem', borderRadius: 8, fontWeight: 600, marginBottom: '1.5rem' },
  bannerRed: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  bannerAmber: { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' },

  // Card
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem' },
  cardText: { color: '#374151', lineHeight: 1.6, margin: '0 0 1rem' },
  summaryBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.875rem 1rem', margin: '0.75rem 0' },
  infoBox: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.875rem 1rem', color: '#1e40af', fontSize: '0.875rem' },

  // Steps
  stepTracker: { display: 'flex', flexDirection: 'column', gap: 8, margin: '1.25rem 0' },
  stepRow: { display: 'flex', alignItems: 'center', gap: 10 },
  stepCircle: { width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0, border: '2px solid #d1d5db' },
  stepDone: { background: '#dcfce7', color: '#16a34a', borderColor: '#86efac' },
  stepCurrent: { background: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' },
  stepLabel: { fontSize: '0.875rem', color: '#6b7280' },

  // Action bar
  actionBar: { display: 'flex', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  btnPDF: { background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' },
  btnPNG: { background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' },
  btnPrint: { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' },
  btnBack: { background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' },
  btnPrimary: { background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1.4rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },

  // ── Certificate visual ──────────────────────────────────────────────────
  certificate: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 12px 48px rgba(30,58,95,0.15)',
    maxWidth: 860,
    margin: '0 auto',
  },

  // Top colour bar
  certTopBar: {
    height: 10,
    background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 50%, #1e3a5f 100%)',
  },

  // Header row
  certHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1.75rem 2.5rem 0',
  },
  certLogoBlock: { display: 'flex', alignItems: 'center', gap: 12 },
  certLogoMark: {
    width: 44, height: 44, borderRadius: 10,
    background: '#1e3a5f', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: '1.3rem', flexShrink: 0,
  },
  certLogoName: { fontWeight: 800, fontSize: '1.1rem', color: '#1e3a5f' },
  certLogoSub: { fontSize: '0.75rem', color: '#64748b', fontWeight: 500 },
  certHeaderRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  certEditionBadge: {
    background: '#eff6ff', color: '#1e40af',
    border: '1px solid #bfdbfe', borderRadius: 20,
    padding: '3px 12px', fontSize: '0.72rem', fontWeight: 700,
  },
  certTier1: {
    background: '#fffbeb', color: '#b45309',
    border: '1px solid #fde68a', borderRadius: 4,
    padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
  },
  certTier0: {
    background: '#fef2f2', color: '#dc2626',
    border: '1px solid #fecaca', borderRadius: 4,
    padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
  },

  // Ruler
  certRuler: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, #cbd5e1 20%, #cbd5e1 80%, transparent)',
    margin: '1.5rem 2.5rem',
  },

  // Hero
  certHero: {
    textAlign: 'center',
    padding: '0.5rem 2.5rem 0',
  },
  certSuperLabel: {
    fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600,
    letterSpacing: 2.5, textTransform: 'uppercase',
    margin: '0 0 0.75rem',
  },
  certRecipientName: {
    fontSize: '2.25rem', fontWeight: 900, color: '#0f172a',
    margin: '0 0 0.25rem', letterSpacing: '-0.5px',
  },
  certBusinessName: {
    fontSize: '1.05rem', color: '#475569', margin: '0 0 0.5rem', fontWeight: 500,
  },
  certIndustryLine: {
    display: 'inline-block',
    background: '#f0f4ff', color: '#1e40af',
    border: '1px solid #c7d7fd', borderRadius: 20,
    padding: '4px 18px', fontSize: '0.8rem', fontWeight: 700,
    margin: '0 0 0.25rem',
  },

  // Statement
  certStatement: {
    padding: '1.25rem 3.5rem',
    textAlign: 'center',
  },
  certStatementText: {
    fontSize: '0.875rem', color: '#64748b', lineHeight: 1.75, margin: 0,
  },

  // Meta grid
  certMetaGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 0,
    margin: '0 2.5rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '1rem 0.5rem',
  },

  // Seal row
  certSealRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.5rem 2.5rem',
    gap: '2rem',
  },
  certSeal: {
    width: 80, height: 80, borderRadius: '50%',
    border: '3px solid #1e3a5f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    background: 'radial-gradient(circle, #eff6ff, #dbeafe)',
    boxShadow: '0 0 0 4px rgba(30,58,95,0.08)',
  },
  certSealInner: { textAlign: 'center' },
  certSealText: { fontSize: '0.6rem', fontWeight: 900, color: '#1e3a5f', letterSpacing: 1.5, textTransform: 'uppercase' },
  certSealYear: { fontSize: '0.9rem', fontWeight: 800, color: '#1e3a5f' },
  certSignatureLine: { flex: 1 },
  certSignatureBar: { height: 1, background: '#94a3b8', marginBottom: 6 },
  certSignatureLabel: { fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 },

  // Footer
  certFooter: {
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    padding: '0.75rem 2.5rem',
    fontSize: '0.7rem',
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Bottom bar
  certBottomBar: {
    height: 6,
    background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 50%, #1e3a5f 100%)',
  },
};
