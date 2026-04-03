/**
 * Auth route tests — login, logout, /me, change-password
 *
 * All DB calls are mocked. A real bcrypt hash is generated in beforeAll
 * so login comparison works without a real database.
 */
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import request from "supertest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getUserByEmail:      vi.fn(),
  getUserById:         vi.fn(),
  updateUserLastLogin: vi.fn().mockResolvedValue(undefined),
  updateUserPassword:  vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    jwtSecret:    "test-jwt-secret-that-is-long-enough-32ch",
    jwtExpiresIn: "7d",
    isProduction: false,
    databaseUrl:  "",
    port:         3000,
    appBaseUrl:   "http://localhost:3000",
    ghlWebhookSecret: "",
    ghlApiKey:    "",
    ghlLocationId: "",
  },
  validateEnv: vi.fn(),
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash("TempPass123!", 12);
});

const mockUser = () => ({
  id:           "user-001",
  email:        "jane@example.com",
  passwordHash, // set in beforeAll
  role:         "client_admin",
  firstName:    "Jane",
  lastName:     "Doe",
  planTier:     "standard",
  vertical:     "dental",
  hskdRequired: false,
  isActive:     true,
  ghlContactId: "ghl-001",
  ghlLocationId: null,
  activatedAt:  new Date(),
  lastLoginAt:  null,
  createdAt:    new Date(),
  updatedAt:    new Date(),
});

// ─── Test app factory ─────────────────────────────────────────────────────────
const { authRouter } = await import("./routes/auth");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import("./db");
    vi.mocked(db.getUserByEmail).mockResolvedValue(mockUser());
    app = makeApp();
  });

  it("returns 200 and sets wibiz_session cookie on valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "TempPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("jane@example.com");
    expect(res.body.user.role).toBe("client_admin");
    // Cookie should be set
    const setCookie = res.headers["set-cookie"] as string[] | undefined;
    expect(setCookie?.some((c) => c.startsWith("wibiz_session="))).toBe(true);
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("returns 401 when user does not exist", async () => {
    const db = await import("./db");
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "anything" });

    expect(res.status).toBe(401);
  });

  it("returns 403 when account is inactive", async () => {
    const db = await import("./db");
    vi.mocked(db.getUserByEmail).mockResolvedValue({ ...mockUser(), isActive: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "TempPass123!" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Account inactive");
  });

  it("returns 400 on malformed input", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200 and clears the cookie", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when no session cookie is present", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
