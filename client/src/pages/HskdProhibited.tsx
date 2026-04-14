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

interface ProhibitedData {
  items:            ProhibitedItem[];
  certification_id: string;
}

export default function HskdProhibitedPage() {
  const { industrySlug } = useParams<{ industrySlug: string }>();
  const [data, setData]         = useState<ProhibitedData | null>(null);
  const [confirming, setConf]   = useState<string | null>(null);
  const [error, setError]       = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<ProhibitedData>(`/client/hskd/prohibited?industry_slug=${industrySlug}`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          setError("Failed to load items. Please refresh.");
        }
      });
  }, [industrySlug]);

  const confirm = async (itemId: string) => {
    if (!data) return;
    setConf(itemId);
    try {
      await apiFetch("/client/hskd/certify/prohibited", {
        method: "POST",
        body: JSON.stringify({
          certification_id:   data.certification_id,
          prohibited_item_id: itemId,
        }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === itemId
                  ? { ...i, confirmed: true, confirmed_at: new Date().toISOString() }
                  : i
              ),
            }
          : prev
      );
    } catch {
      setError("Failed to confirm item. Please try again.");
    } finally {
      setConf(null);
    }
  };

  const allConfirmed = data?.items.every((i) => i.confirmed) ?? false;

  if (!data) {
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
        <span className="text-sm text-muted-foreground">
          {data.items.filter((i) => i.confirmed).length} of {data.items.length} confirmed
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-2">
          <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">
            Prohibited Content Declaration
          </h1>
          <p className="text-sm text-muted-foreground">
            Each item below must be confirmed individually. You cannot bundle confirmations.
            Click <strong>Confirm</strong> for each item after reading it carefully.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {data.items.map((item) => (
            <div
              key={item.id}
              className={`bg-card rounded-xl border p-5 space-y-3 transition-colors ${
                item.confirmed ? "border-green-500/30" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Item {item.item_number}{item.category ? ` — ${item.category}` : ""}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {item.restriction_text}
                  </p>
                </div>
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