// ─── Cookie options (BC360 pattern, verbatim) ─────────────────────────────────
// sameSite: "none" is required for cross-origin cookie delivery.
// secure: true whenever the request arrived over HTTPS (including Railway's
// reverse proxy which sets x-forwarded-proto).

import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  if (!forwarded) return false;
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
  return proto.trim().toLowerCase() === "https";
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path:     "/",
    sameSite: "none",
    secure:   isSecureRequest(req),
  };
}

export const COOKIE_NAME = "wibiz_session";
