import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("cookieAccepted");
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookieAccepted", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      background: "#1e293b",
      color: "#f8fafc",
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 9999,
      fontSize: "14px",
      gap: "16px",
    }}>
      <span>
        This site uses cookies to improve your experience. By using this site, you agree to our{" "}
        <a href="/privacy-policy" style={{ color: "#60a5fa", textDecoration: "underline" }}>
          Privacy Policy
        </a>.
      </span>
      <button
        onClick={accept}
        style={{
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          padding: "8px 20px",
          cursor: "pointer",
          fontSize: "14px",
          whiteSpace: "nowrap",
        }}
      >
        Accept
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CookieBanner />
    <App />
  </React.StrictMode>
);