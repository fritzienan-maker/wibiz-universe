// ─── Vite integration (BC360 pattern) ────────────────────────────────────────
// Dev:  setupVite()  — wraps Express in Vite middleware, serves HMR
// Prod: serveStatic() — serves pre-built dist/public/

import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config.ts";

export async function setupVite(app: Express, server: Server): Promise<void> {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Catch-all: transform and serve index.html for every non-API route
  app.use("*", async (req, res, next) => {
    try {
      const templatePath = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      const template = await fs.promises.readFile(templatePath, "utf-8");
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express): void {
  // In production the server bundle lives at dist/index.js so import.meta.dirname
  // is dist/ — dist/public is the Vite build output one folder down.
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.warn(
      `[server] Build directory not found at ${distPath} — run pnpm build first`
    );
  }

  app.use(express.static(distPath));

  // SPA fallback: any unmatched route serves index.html
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
