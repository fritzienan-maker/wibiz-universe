import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginPage           from "./pages/Login";
import ClientPortal        from "./pages/ClientPortal";
import AdminPage           from "./pages/Admin";
import InviteAccept        from "./pages/InviteAccept";
import PrivacyPolicy       from "./pages/PrivacyPolicy";
import Terms               from "./pages/Terms";
import HskdPage            from "./pages/Hskd";
import HskdTraining        from "./pages/HskdTraining";
import HskdScenarios       from "./pages/HskdScenarios";
import HskdProhibited      from "./pages/HskdProhibited";
import HskdAffirmation     from "./pages/HskdAffirmation";
import HskdCertificate     from "./pages/HskdCertificate";
import BotCertification    from "./pages/BotCertification";
import { apiFetch, ApiError } from "./lib/api";
import CookieBanner from "../components/CookieBanner";

// ─── Auth state hook ──────────────────────────────────────────────────────────
type Status = "loading" | "authed" | "unauthed";

interface MeResponse {
  id:    string;
  email: string;
  role:  string;
}

function useMe() {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser]     = useState<MeResponse | null>(null);

  useEffect(() => {
    apiFetch<MeResponse>("/auth/me")
      .then((u) => { setUser(u); setStatus("authed"); })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setStatus("unauthed");
        else setStatus("unauthed");
      });
  }, []);

  return { status, user };
}

// ─── Route guards ─────────────────────────────────────────────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { status } = useMe();
  if (status === "loading")  return <Spinner />;
  if (status === "unauthed") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { status, user } = useMe();
  if (status === "loading")         return <Spinner />;
  if (status === "unauthed")        return <Navigate to="/login"     replace />;
  if (user?.role !== "wibiz_admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/invite/:token"  element={<InviteAccept />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms"          element={<Terms />} />

        <Route path="/dashboard" element={<PrivateRoute><ClientPortal /></PrivateRoute>} />
        <Route path="/admin"     element={<AdminRoute><AdminPage /></AdminRoute>} />

        {/* ── Phase 2: Bot Certification ── */}
        <Route path="/bot-certification"
          element={<PrivateRoute><BotCertification /></PrivateRoute>} />

        {/* ── Phase 3: HSKD ClearPath Certification ── */}
        <Route path="/hskd"
          element={<PrivateRoute><HskdPage /></PrivateRoute>} />
        <Route path="/hskd/certify/:industrySlug/training"
          element={<PrivateRoute><HskdTraining /></PrivateRoute>} />
        <Route path="/hskd/certify/:industrySlug/scenarios"
          element={<PrivateRoute><HskdScenarios /></PrivateRoute>} />
        <Route path="/hskd/certify/:industrySlug/prohibited"
          element={<PrivateRoute><HskdProhibited /></PrivateRoute>} />
        <Route path="/hskd/certify/:industrySlug/affirmation"
          element={<PrivateRoute><HskdAffirmation /></PrivateRoute>} />
        <Route path="/hskd/certify/:industrySlug/status"
          element={<PrivateRoute><HskdCertificate /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <CookieBanner />
    </BrowserRouter>
  );
}