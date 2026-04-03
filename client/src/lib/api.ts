// ─── API client — cookie-based (no localStorage) ──────────────────────────────
// Sends credentials: 'include' on every request so the browser attaches the
// wibiz_session httpOnly cookie automatically.

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(res.status, (body as any).error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}
