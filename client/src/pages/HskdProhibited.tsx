import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

interface ProhibitedItem {
  id:               string;
  item_number:      number;
  category:         string | null;
  restriction_text: string | null;
  confirmed:        boolean;
  confirmed_at:     string | null;
}

interface CertificationData {
  certification: {
    id:     string;
    status: string;
  } | null;
}

export default function HskdProhibitedPage() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const navigate = useNavigate();

  const [certId, setCertId]     = useState<string | null>(null);
  const [items, setItems]       = useState<ProhibitedItem[]>([]);
  const [confirming, setConf]   = useState<string | null>(null);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(true);

  // Step 1 — get certificationId from my-certification
  useEffect(() => {
    apiFetch<CertificationData>("/client/hskd/my-certification")
      .then((data) => {
        const cert = data.certification;
        if (!cert) {
          setError("No active certification found. Please start from the beginning.");
          setLoading(false);
          return;
        }

        // Redirect if not at the right stage
        if (cert.status === "TRAINING") {
          navigate(`/hskd/certify/${industrySlug}/training`, { replace: true });
          return;
        }
        if (cert.status === "SCENARIOS") {
          navigate(`/hskd/certify/${industrySlug}/scenarios`, { replace: true });
          return;
        }
        if (cert.status === "AFFIRMATION") {
          navigate(`/hskd/certify/${industrySlug}/affirmation`, { replace: true });
          return;
        }
        if (cert.status === "OPS_REVIEW" || cert.status === "CERTIFIED") {
          navigate(`/hskd/certify/${industrySlug}/status`, { replace: true });
          return;
        }

        setCertId(cert.id);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load certification. Please refresh.");
          setLoading(false);
        }
      });
  }, [industrySlug]);

  // Step 2 — once we have certId, fetch prohibited items
  useEffect(() => {
    if (!certId) return;

    apiFetch<{ items: any[]; confirmed_ids: string[] }>(
      `/client/hskd/prohibited/${certId}`
    )
      .then(({ items: rawItems, confirmed_ids }) => {
        const mapped: ProhibitedItem[] = rawItems.map((item) => ({
          id:               item.id,
          item_number:      item.item_number,
          category:         item.category ?? null,
          restriction_text: item.restriction_text ?? null,
          confirmed:        confirmed_ids.includes(item.id),
          confirmed_at:     confirmed_ids.includes(item.id)
            ? new Date().toISOString()
            : null,
        }));
        setItems(mapped);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load prohibited items. Please refresh.");
          setLoading(false);
        }
      });
  }, [certId]);

  const confirm = async (itemId: string) => {
    if (!certId) return;
    setConf(itemId);
    try {
      const result = await apiFetch<{ status?: string; remaining?: number }>(
        `/client/hskd/prohibited/${certId}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ prohibited_item_id: itemId }),
        }
      );

      // Mark item as confirmed in local state
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, confirmed: true, confirmed_at: new Date().toISOString() }
            : i
        )
      );

      // If all confirmed, backend returns status = AFFIRMATION — navigate
      if (result.status === "AFFIRMATION") {
        setTimeout(() => {
          navigate(`/hskd/certify/${industrySlug}/affirmation`);
        }, 600);
      }
    } catch {
      setError("Failed to confirm item. Please try again.");
    } finally {
      setConf(null);
    }
  };

  const allConfirmed = items.length > 0 && items.every((i) => i.confirmed);
  const confirmedCount = items.filter((i) => i.confirmed).length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (!certId && error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-sm text-destructive max-w-md text-center">
          {error}
          <br />
          <button
            onClick={() => navigate("/hskd")}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
          >
            Back to Industry Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold text-foreground">WiBiz Universe</span>
        <span className="text-sm text-muted-foreground">
          {confirmedCount} of {items.length} confirmed
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Title card */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-2">
          <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">
            Prohibited Content Declaration
          </h1>
          <p className="text-sm text-muted-foreground">
            Each item below must be confirmed individually. You cannot bundle
            confirmations. Click <strong>Confirm</strong> for each item after
            reading it carefully.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Items list */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-card rounded-xl border p-5 space-y-3 transition-colors ${
                item.confirmed ? "border-green-500/30" : "border-border"
              }`}
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Item {item.item_number}
                  {item.category ? ` — ${item.category}` : ""}
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {item.restriction_text}
                </p>
              </div>

              {item.confirmed ? (
                <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
                  <span>✓ Confirmed</span>
                  {item.confirmed_at && (
                    <span className="text-muted-foreground">
                      at {new Date(item.confirmed_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => confirm(item.id)}
                  disabled={confirming === item.id}
                  className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {confirming === item.id ? "Confirming…" : "Confirm"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Next button */}
        <div className="flex justify-end">
          <button
            disabled={!allConfirmed}
            onClick={() => navigate(`/hskd/certify/${industrySlug}/affirmation`)}
            className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next: ClearPath Affirmation →
          </button>
        </div>
      </main>
    </div>
  );
}
