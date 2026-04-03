// ─── Environment config (BC360 pattern) ──────────────────────────────────────
// All env vars are read once at startup. No zod schema — warns but does not
// crash so Railway restarts can surface config errors in logs.

export const ENV = {
  // App
  isProduction: process.env.NODE_ENV === "production",
  port:         parseInt(process.env.PORT ?? "3000", 10),
  appBaseUrl:   (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  // Database
  databaseUrl:  process.env.DATABASE_URL ?? "",
  // Auth
  jwtSecret:    process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  // GHL
  ghlApiKey:         process.env.GHL_API_KEY ?? "",
  ghlLocationId:     process.env.GHL_LOCATION_ID ?? "",
  ghlWebhookSecret:  process.env.GHL_WEBHOOK_SECRET ?? "",
};

// Startup validation — warns loudly but does not crash (BC360 pattern).
// Missing secrets surface in Railway deploy logs immediately.
export function validateEnv(): void {
  const required: Array<{ key: keyof typeof ENV; label: string }> = [
    { key: "databaseUrl",       label: "DATABASE_URL" },
    { key: "jwtSecret",         label: "JWT_SECRET" },
    { key: "ghlWebhookSecret",  label: "GHL_WEBHOOK_SECRET" },
  ];
  for (const { key, label } of required) {
    if (!ENV[key]) {
      console.warn(`[env] WARNING: ${label} is not set — some features will not work`);
    }
  }
  if (ENV.jwtSecret && ENV.jwtSecret.length < 32) {
    console.warn("[env] WARNING: JWT_SECRET should be at least 32 characters");
  }
}
