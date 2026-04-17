export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0d1117)", color: "var(--tp, #e8edf5)", fontFamily: "'DM Sans', sans-serif" }}>
      <header style={{ borderBottom: "1px solid #1e2a3a", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/dashboard" style={{ color: "#8fa8c4", textDecoration: "none", fontSize: 13 }}>← Back to Dashboard</a>
        <span style={{ color: "#1e2a3a" }}>|</span>
        <span style={{ fontSize: 13, color: "#8fa8c4" }}>WiBiz Universe</span>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#e8edf5", margin: "0 0 8px" }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: "#8fa8c4", margin: 0 }}>Last Updated: April 17, 2026</p>

        </div>

        <p style={p}>
          Welcome to WiBiz Universe ("we", "our", "us"). We respect your privacy and are committed to
          protecting your personal information. This Privacy Policy explains how we collect, use, and
          safeguard your data when you use our platform.
        </p>

        <Section title="1. Information We Collect">
          <p style={p}>We may collect the following information when you use our platform:</p>
          <ul style={ul}>
            <li style={li}>Name and email address</li>
            <li style={li}>Account information and login credentials</li>
            <li style={li}>Activity within the platform (e.g. course progress, exercise submissions, quiz results)</li>
            <li style={li}>Support ticket content and communications</li>
            <li style={li}>Device and browser information for security purposes</li>
          </ul>
          <p style={p}>We only collect information that is necessary to provide and improve our services.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p style={p}>We use your information to:</p>
          <ul style={ul}>
            <li style={li}>Provide access to the WiBiz Universe platform and its features</li>
            <li style={li}>Track your progress through the 30-Module Activation Programme</li>
            <li style={li}>Issue certifications upon completion of required phases</li>
            <li style={li}>Improve user experience and platform functionality</li>
            <li style={li}>Send important updates, notifications, and support responses</li>
            <li style={li}>Respond to support requests in a timely manner</li>
          </ul>
        </Section>

        <Section title="3. Third-Party Services">
          <p style={p}>
            We may use trusted third-party tools to operate our platform, including:
          </p>
          <ul style={ul}>
            <li style={li}>CRM systems (e.g., GoHighLevel) — for contact management and workflow automation</li>
            <li style={li}>Hosting providers (e.g., Railway) — for platform infrastructure</li>
            <li style={li}>Cloud storage (e.g., Cloudinary) — for media uploads</li>
            <li style={li}>Analytics tools — for platform improvement</li>
          </ul>
          <p style={p}>These services may process your data on our behalf under their own privacy policies.</p>
        </Section>

        <Section title="4. Data Sharing">
          <p style={p}>We do <strong style={{ color: "#e8edf5" }}>NOT</strong> sell your personal information.</p>
          <p style={p}>We may share data only when necessary to:</p>
          <ul style={ul}>
            <li style={li}>Provide our services (e.g. passing data to hosting or CRM providers)</li>
            <li style={li}>Comply with legal obligations or respond to lawful requests</li>
          </ul>
        </Section>

        <Section title="5. Data Security">
          <p style={p}>
            We take reasonable technical and organisational steps to protect your information from
            unauthorised access, disclosure, or loss. However, no system is 100% secure, and we
            cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="6. Your Rights">
          <p style={p}>You have the right to:</p>
          <ul style={ul}>
            <li style={li}>Request access to the personal data we hold about you</li>
            <li style={li}>Request correction of inaccurate data</li>
            <li style={li}>Request deletion of your data</li>
          </ul>
          <p style={p}>
            To make a request, contact us at:{" "}
            <a href="mailto:support@wibiz.ai" style={{ color: "#c9a84c", textDecoration: "none" }}>
              support@wibiz.ai
            </a>
          </p>
        </Section>

        <Section title="7. Cookies">
          <p style={p}>
            Our platform uses session cookies to keep you logged in and to improve your experience.
            By using the platform, you agree to our use of cookies. You may disable cookies in your
            browser settings, but this may affect platform functionality.
          </p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p style={p}>
            We may update this Privacy Policy from time to time. Updates will be posted on this page
            with a revised "Last Updated" date. Continued use of the platform after changes constitutes
            acceptance of the updated policy.
          </p>
        </Section>

        <Section title="9. Contact Us">
          <p style={p}>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p style={{ ...p, marginTop: 0 }}>
            <a href="mailto:support@wibiz.ai" style={{ color: "#c9a84c", textDecoration: "none" }}>
              support@wibiz.ai
            </a>
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #1e2a3a", display: "flex", gap: 24 }}>
          <a href="/terms" style={{ fontSize: 13, color: "#8fa8c4", textDecoration: "none" }}>Terms &amp; Conditions</a>
          <a href="/dashboard" style={{ fontSize: 13, color: "#8fa8c4", textDecoration: "none" }}>Back to Dashboard</a>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "#e8edf5", margin: "0 0 12px", paddingBottom: 8, borderBottom: "1px solid #1e2a3a" }}>{title}</h2>
      {children}
    </div>
  );
}

const p: React.CSSProperties  = { fontSize: 15, color: "#8fa8c4", lineHeight: 1.75, margin: "0 0 12px" };
const ul: React.CSSProperties = { paddingLeft: 20, margin: "0 0 12px" };
const li: React.CSSProperties = { fontSize: 15, color: "#8fa8c4", lineHeight: 1.75, marginBottom: 4 };