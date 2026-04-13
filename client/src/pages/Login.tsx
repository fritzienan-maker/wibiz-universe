import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [consent,  setConsent]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError("You must agree to the Privacy Policy and Terms to continue.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body:   JSON.stringify({ email, password }),
      });
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("Invalid email or password.");
        else if (err.status === 403) setError("Your account is inactive. Contact support.");
        else setError("Login failed. Please try again.");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Universe</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Your temporary password"
            />
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 cursor-pointer"
            />
            <label htmlFor="consent" className="text-sm text-muted-foreground">
              I agree to the{" "}
              <a href="/privacy-policy" className="underline text-primary" target="_blank">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="underline text-primary" target="_blank">
                Terms and Conditions
              </a>
            </label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Footer Links */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/privacy-policy" className="underline hover:text-foreground">
            Privacy Policy
          </a>
          {" | "}
          <a href="/terms" className="underline hover:text-foreground">
            Terms & Conditions
          </a>
        </div>

      </div>
    </div>
  );
}