import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("wibiz_cookies_accepted");
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("wibiz_cookies_accepted", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#131f2e",
      borderTop: "1px solid #1e2a3a",
      padding: "14px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap" as const,
      gap: 12,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <p style={{ fontSize: 13, color: "#8fa8c4", margin: 0, lineHeight: 1.5 }}>
        This site uses cookies to improve your experience and keep you logged in.{" "}
        <a href="/privacy-policy" style={{ color: "#c9a84c", textDecoration: "none" }}>
          Learn more
        </a>
      </p>
      <button
        onClick={accept}
        style={{
          background: "#c9a84c",
          color: "#0d1825",
          border: "none",
          borderRadius: 8,
          padding: "8px 20px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          whiteSpace: "nowrap" as const,
        }}
      >
        Accept
      </button>
    </div>
  );
}