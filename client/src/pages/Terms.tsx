export default function Terms() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0d1117)", color: "var(--tp, #e8edf5)", fontFamily: "'DM Sans', sans-serif" }}>
      <header style={{ borderBottom: "1px solid #1e2a3a", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/dashboard" style={{ color: "#8fa8c4", textDecoration: "none", fontSize: 13 }}>← Back to Dashboard</a>
        <span style={{ color: "#1e2a3a" }}>|</span>
        <span style={{ fontSize: 13, color: "#8fa8c4" }}>WiBiz Universe</span>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#e8edf5", margin: "0 0 8px" }}>Terms &amp; Conditions</h1>
          <p style={{ fontSize: 13, color: "#8fa8c4", margin: 0 }}>Last Updated: April 17, 2026</p>
        </div>

        <p style={p}>
          Welcome to WiBiz Universe. By accessing or using our platform, you agree to be bound by
          these Terms and Conditions. Please read them carefully before using the platform.
        </p>

        <Section title="1. Use of the Platform">
          <p style={p}>You agree to use the platform only for lawful purposes. You must not:</p>
          <ul style={ul}>
            <li style={li}>Use the platform for fraudulent, harmful, or illegal activities</li>
            <li style={li}>Attempt to access accounts or data that are not yours</li>
            <li style={li}>Disrupt, interfere with, or damage the system or its users</li>
            <li style={li}>Share your login credentials with unauthorised parties</li>
            <li style={li}>Reverse-engineer, copy, or redistribute platform content without permission</li>
          </ul>
        </Section>

        <Section title="2. Accounts">
          <p style={p}>
            You are responsible for maintaining the confidentiality of your account credentials.
            You agree to notify us immediately at{" "}
            <a href="mailto:support@wibiz.ai" style={{ color: "#c9a84c", textDecoration: "none" }}>support@wibiz.ai</a>{" "}
            if you suspect any unauthorised access to your account.
          </p>
          <p style={p}>
            We reserve the right to suspend or terminate accounts that violate these Terms, at our
            sole discretion and without prior notice.
          </p>
        </Section>

        <Section title="3. No Guarantees">
          <p style={p}>
            WiBiz Universe provides educational, training, and AI system management content.
            We do <strong style={{ color: "#e8edf5" }}>NOT</strong> guarantee:
          </p>
          <ul style={ul}>
            <li style={li}>Specific business results or revenue outcomes</li>
            <li style={li}>Financial performance improvements</li>
            <li style={li}>Specific performance results from using the AI system</li>
            <li style={li}>Continued availability of any particular feature or content</li>
          </ul>
          <p style={p}>
            Results vary based on individual effort, business context, and market conditions.
          </p>
        </Section>

        <Section title="4. Limitation of Liability">
          <p style={p}>
            To the maximum extent permitted by applicable law, WiBiz Universe and its operators
            shall not be liable for:
          </p>
          <ul style={ul}>
            <li style={li}>Any indirect, incidental, special, or consequential damages</li>
            <li style={li}>Loss of data, profits, revenue, or business opportunities</li>
            <li style={li}>Damages arising from your use of or inability to use the platform</li>
            <li style={li}>Third-party actions or content</li>
          </ul>
        </Section>

        <Section title="5. Intellectual Property">
          <p style={p}>
            All content on the WiBiz Universe platform — including modules, exercises, scenarios,
            training materials, and certifications — is the intellectual property of WiBiz and its
            licensors. You may not reproduce, distribute, or create derivative works without
            express written permission.
          </p>
        </Section>

        <Section title="6. Third-Party Services">
          <p style={p}>
            Our platform integrates with third-party tools including CRM systems, hosting providers,
            and payment processors. We are not responsible for the availability, accuracy, or
            practices of these third-party services.
          </p>
        </Section>

        <Section title="7. Termination">
          <p style={p}>
            We may suspend or terminate your access to the platform at any time if these Terms are
            violated, or for any other reason at our discretion. Upon termination, your right to use
            the platform ceases immediately.
          </p>
        </Section>

        <Section title="8. Changes to Terms">
          <p style={p}>
            We may update these Terms at any time. We will notify users of material changes via
            email or platform notification. Continued use of the platform after changes constitutes
            acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="9. Age Requirement">
          <p style={p}>
            You must be at least <strong style={{ color: "#e8edf5" }}>18 years old</strong> to use
            this platform. By using WiBiz Universe, you confirm that you meet this age requirement.
          </p>
        </Section>

        <Section title="10. Governing Law">
          <p style={p}>
            These Terms shall be governed by and construed in accordance with the laws of the
            United States. Any disputes arising under these Terms shall be subject to the exclusive
            jurisdiction of the applicable US courts.
          </p>
        </Section>

        <Section title="11. Contact Information">
          <p style={p}>For any questions regarding these Terms, please contact us at:</p>
          <p style={{ ...p, marginTop: 0 }}>
            <a href="mailto:support@wibiz.ai" style={{ color: "#c9a84c", textDecoration: "none" }}>
              support@wibiz.ai
            </a>
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #1e2a3a", display: "flex", gap: 24 }}>
          <a href="/privacy-policy" style={{ fontSize: 13, color: "#8fa8c4", textDecoration: "none" }}>Privacy Policy</a>
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