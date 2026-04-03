/**
 * Webhook provisioning tests
 *
 * Uses vitest module mocking so no real DB or network connection is needed.
 * All db functions are mocked; the Express route logic is tested via supertest.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

// ─── Mock DB module ───────────────────────────────────────────────────────────
// vi.mock paths are relative to this test file (server/webhooks.test.ts)
// → resolves to server/db.ts ✓
vi.mock("./db", () => ({
  logWebhookReceived:      vi.fn().mockResolvedValue({ id: "log-123" }),
  markWebhookProcessed:    vi.fn().mockResolvedValue(undefined),
  getUserByGhlContactId:   vi.fn().mockResolvedValue(null),
  createUser:              vi.fn().mockResolvedValue({ id: "user-abc", email: "test@example.com" }),
  logSyncEvent:            vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock ENV ─────────────────────────────────────────────────────────────────
vi.mock("./_core/env", () => ({
  ENV: {
    ghlWebhookSecret: "test-secret",
    ghlLocationId:    "test-location",
    isProduction:     false,
    jwtSecret:        "test-jwt-secret-that-is-long-enough",
    jwtExpiresIn:     "7d",
    databaseUrl:      "",
    port:             3000,
    appBaseUrl:       "http://localhost:3000",
    ghlApiKey:        "",
  },
  validateEnv: vi.fn(),
}));

// ─── Test app factory ─────────────────────────────────────────────────────────
// Import AFTER mocks are registered
const { webhookRouter } = await import("./routes/webhooks");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/webhooks", webhookRouter);
  return app;
}

// ─── Valid payload ────────────────────────────────────────────────────────────
const validPayload = {
  contact_id:     "ghl-contact-001",
  email:          "jane@example.com",
  first_name:     "Jane",
  last_name:      "Doe",
  plan_tier:      "standard",
  vertical:       "dental",
  hskd_required:  false,
  temporary_pass: "TempPass123!",
  location_id:    "loc-001",
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /api/webhooks/ghl/provision", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset getUserByGhlContactId to return null (no existing user)
    const db = await import("./db");
    vi.mocked(db.getUserByGhlContactId).mockResolvedValue(null);
    vi.mocked(db.logWebhookReceived).mockResolvedValue({ id: "log-123" } as any);
    vi.mocked(db.createUser).mockResolvedValue({ id: "user-abc", email: "jane@example.com" } as any);
    app = makeApp();
  });

  it("returns 401 when x-wibiz-secret header is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/ghl/provision")
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("returns 401 when x-wibiz-secret header is wrong", async () => {
    const res = await request(app)
      .post("/api/webhooks/ghl/provision")
      .set("x-wibiz-secret", "wrong-secret")
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it("returns 400 when temporary_pass is missing", async () => {
    const { temporary_pass: _, ...noPass } = validPayload;
    const res = await request(app)
      .post("/api/webhooks/ghl/provision")
      .set("x-wibiz-secret", "test-secret")
      .send(noPass);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid payload");
  });

  it("returns 400 when contact_id is missing", async () => {
    const { contact_id: _, ...noId } = validPayload;
    const res = await request(app)
      .post("/api/webhooks/ghl/provision")
      .set("x-wibiz-secret", "test-secret")
      .send(noId);

    expect(res.status).toBe(400);
  });

  it("provisions a new user and returns 200", async () => {
    const res = await request(app)
      .post("/api/webhooks/ghl/provision")
      .set("x-wibiz-secret", "test-secret")
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("provisioned");
    expect(res.body.userId).toBe("user-abc");
  });

  it("does NOT create a duplicate user when contact_id already exists", async () => {
    const db = await import("./db");
    // Simulate existing user
    vi.mocked(db.getUserByGhlContactId).mockResolvedValue({
      id: "existing-user",
      email: "jane@example.com",
    } as any);

    const res = await request(app)
      .post("/api/webhooks/ghl/provision")
      .set("x-wibiz-secret", "test-secret")
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("already_provisioned");
    // createUser must NOT have been called
    expect(vi.mocked(db.createUser)).not.toHaveBeenCalled();
  });

  it("returns 200 on GET (health ping)", async () => {
    const res = await request(app).get("/api/webhooks/ghl/provision");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
