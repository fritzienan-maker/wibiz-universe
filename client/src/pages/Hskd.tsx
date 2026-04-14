import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

interface Industry {
  id:          string;
  slug:        string;
  name:        string;
  tier:        "TIER_0" | "TIER_1";
  description: string | null;
  is_active:   boolean;
  certification?: {
    id:     string;
    status: "IN_PROGRESS" | "PENDING_OPS_REVIEW" | "CERTIFIED" | "REJECTED";
  } | null;
}

export default function HskdPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ industries: Industry[] }>("/client/hskd/industries")
      .then((d) => setIndustries(d.industries))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load certification options. Please refresh.");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleBegin = async (industry: Industry) => {
    try {
      await apiFetch("/client/hskd/certifications", {
        method: "POST",
        body: JSON.stringify({ industry_id: industry.id }),
      });
      navigate(`/hskd/certify/${industry.slug}/training`);
    } catch {
      setError("Failed to start certification. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Dashboard
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h1 className="text-2xl font-bold text-foreground">ClearPath Certification</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete your industry certification to unlock Specialist Mode. You must complete
            training before certification unlocks. Select your industry below to begin.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Industry Cards */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Select Your Industry
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {industries.map((industry) => {
              const cert = industry.certification;
              const isTier0 = industry.tier === "TIER_0";

              return (
                <div
                  key={industry.id}
                  className="bg-card rounded-xl border border-border p-5 space-y-3"
                >
                  {/* Tier badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isTier0
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {industry.tier}
                    </span>
                    {cert?.status === "CERTIFIED" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-500/10 text-green-600">
                        ✓ Certified
                      </span>
                    )}
                    {cert?.status === "PENDING_OPS_REVIEW" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-600">
                        Under Review
                      </span>
                    )}
                    {cert?.status === "IN_PROGRESS" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
                        In Progress
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">{industry.name}</p>
                    {industry.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {industry.description}
                      </p>
                    )}
                  </div>

                  {/* TIER 0 warning */}
                  {isTier0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive font-medium">
                      ⚠ TIER 0: Highest Risk — Pro Plan Required
                    </div>
                  )}

                  {/* Action button */}
                  {cert?.status === "CERTIFIED" ? (
                    <Link
                      to={`/hskd/certify/${industry.slug}/status`}
                      className="block text-center text-xs px-4 py-2 rounded-lg bg-green-500/10 text-green-700 font-medium hover:bg-green-500/20 transition-colors"
                    >
                      View Certificate
                    </Link>
                  ) : cert?.status === "PENDING_OPS_REVIEW" ? (
                    <Link
                      to={`/hskd/certify/${industry.slug}/status`}
                      className="block text-center text-xs px-4 py-2 rounded-lg bg-muted text-muted-foreground font-medium"
                    >
                      View Status
                    </Link>
                  ) : cert?.status === "IN_PROGRESS" ? (
                    <Link
                      to={`/hskd/certify/${industry.slug}/training`}
                      className="block text-center text-xs px-4 py-2 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                    >
                      Continue →
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleBegin(industry)}
                      className="w-full text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                    >
                      Begin Certification
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}