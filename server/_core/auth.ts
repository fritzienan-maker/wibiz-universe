// ─── Auth middleware ──────────────────────────────────────────────────────────
// requireAuth  — reads wibiz_session httpOnly cookie, verifies JWT, attaches req.user
// requireAdmin — chains after requireAuth, 403s if role !== 'wibiz_admin'

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "./env";
import { COOKIE_NAME } from "./cookies";

export interface AuthPayload {
  userId: string;
  email:  string;
  role:   string;
}

// Augment Express Request so downstream handlers get req.user typed
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, ENV.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Session expired or invalid" });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== "wibiz_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
