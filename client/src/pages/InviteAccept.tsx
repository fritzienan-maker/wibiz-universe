import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { useTheme } from "../lib/theme";

interface InviteInfo {
  email:     string;
  firstName: string | null;
  lastName:  string | null;
}

export default function InviteAccept() {
  const { token }    = useParams<{ token: string }>();
  const navigate     = useNavigate();
  const { theme, toggle } = useTheme();

  const [info,      setInfo]      = useState<InviteInfo | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [invalid,   setInvalid]   = useState(false);
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    apiFetch<InviteInfo>(`/auth/invite/${token}`)
      .then((d) => { setInfo(d); setLoading(false); })
      .catch(() => { setInvalid(true); setLoading(false); });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      await apiFetch("/auth/invite/accept", {
        method: "POST",
        body:   JSON.stringify({ token, password }),
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? (err.message ?? "Failed to activate account.") : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--s0)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Theme toggle */}
      <div style={{ position: "fixed", top: 16, right: 16 }}>
        <button className="p-theme-btn" onClick={toggle}>{theme === "dark" ? "☀ Light" : "☾ Dark"}</button>
      </div>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span className="p-logo" style={{ fontSize: 22 }}>
            WiBiz <span>Academy</span>
          </span>
        </div>

        <div className="p-card" style={{ padding: "28px 28px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--ts)", fontSize: 13, padding: "20px 0" }}>Validating invite…</div>
          ) : invalid ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tp)", marginBottom: 8 }}>Invite expired or invalid</div>
              <div style={{ fontSize: 12, color: "var(--ts)" }}>
                This invite link has expired or is no longer valid. Ask your account admin to send a new one.
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: "var(--b200)", marginBottom: 6 }}>
                  You've been invited
                </h2>
                <p style={{ fontSize: 12, color: "var(--ts)", lineHeight: 1.6 }}>
                  Set a password to activate your WiBiz Universe account for <strong style={{ color: "var(--tp)" }}>{info!.email}</strong>.
                </p>
              </div>

              <form onSubmit={submit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 5 }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Min. 8 characters"
                    required
                    autoFocus
                    style={{ width: "100%", background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--tp)", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ts)", marginBottom: 5 }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                    placeholder="Re-enter password"
                    required
                    style={{ width: "100%", background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--tp)", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                  />
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: "var(--r-t)", background: "var(--r-bg)", border: "1px solid var(--r-b)", borderRadius: 7, padding: "8px 12px", marginBottom: 14 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="p-btn p-btn-blue"
                  style={{ width: "100%", padding: "10px", fontSize: 13 }}
                >
                  {submitting ? "Activating…" : "Activate account →"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
