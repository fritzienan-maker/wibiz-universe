export default function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid #1e2a3a",
      padding: "20px 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap" as const,
      gap: 12,
      fontSize: 12,
      color: "#4d6680",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <span>© {new Date().getFullYear()} WiBiz Universe. All rights reserved.</span>
      <div style={{ display: "flex", gap: 20 }}>
        <a href="/privacy-policy" style={{ color: "#4d6680", textDecoration: "none" }}>
          Privacy Policy
        </a>
        <a href="/terms" style={{ color: "#4d6680", textDecoration: "none" }}>
          Terms &amp; Conditions
        </a>
        <a href="mailto:support@wibiz.ai" style={{ color: "#4d6680", textDecoration: "none" }}>
          support@wibiz.ai
        </a>
      </div>
    </footer>
  );
}