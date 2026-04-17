import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { ENV, validateEnv } from "./env";
import { authRouter }        from "../routes/auth";
import { webhookRouter }     from "../routes/webhooks";
import { dashboardRouter }   from "../routes/dashboard";
import { adminRouter }       from "../routes/admin";
import { hskdRouter }        from "../routes/hskd";
import { hskdClientRouter }  from "../routes/hskd-client";
import { botCertRouter }     from "../routes/bot-cert";
import { progressRouter }    from "../routes/progress";
import { quizRouter }        from "../routes/quiz";
import { teamRouter, inviteRouter } from "../routes/team";
import { supportRouter }     from "../routes/support";
import { resourcesPublicRouter, staffRouter } from "../routes/resources";
import { certificationRouter } from "../routes/certification";
import { setupVite, serveStatic } from "./vite";

validateEnv();

const app = express();
const server = createServer(app);

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(cors({
  origin: ENV.isProduction ? ENV.appBaseUrl : true,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ─── Health check (Railway uses this) ────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status:         "ok",
    timestamp:      new Date().toISOString(),
    nodeEnv:        process.env.NODE_ENV,
    ghlConfigured:  Boolean(ENV.ghlWebhookSecret && ENV.ghlApiKey),
  });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",           authRouter);
app.use("/api/auth/invite",    inviteRouter);
app.use("/api/webhooks",       webhookRouter);
app.use("/api/dashboard",      dashboardRouter);
app.use("/api/admin",          adminRouter);
app.use("/api/admin/hskd",     hskdRouter);
app.use("/api/client/hskd",    hskdClientRouter);
app.use("/api/client/bot-cert", botCertRouter);
app.use("/api/progress",       progressRouter);
app.use("/api/quiz",           quizRouter);
app.use("/api/team",           teamRouter);
app.use("/api/support",        supportRouter);
app.use("/api/resources",      resourcesPublicRouter);
app.use("/api/staff",          staffRouter);
app.use("/api/certification",  certificationRouter);

// ─── Frontend (Vite dev middleware or static build) ───────────────────────────
async function startServer(): Promise<void> {
  if (ENV.isProduction) {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  server.listen(ENV.port, () => {
    console.log(`[server] WiBiz Academy listening on http://localhost:${ENV.port} - index.ts:71`);
    console.log(`[server] Mode: ${ENV.isProduction ? "production" : "development"} - index.ts:72`);
  });
}

startServer().catch((err) => {
  console.error("[server] Fatal startup error: - index.ts:77", err);
  process.exit(1);
});