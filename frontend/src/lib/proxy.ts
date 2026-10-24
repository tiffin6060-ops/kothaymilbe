// Helpers for the /pages/api routes that forward to Django.

import { isIP } from "node:net";

import type { NextApiRequest, NextApiResponse } from "next";

import { SERVER_ERROR_BN } from "./api";

/** Real visitor IP: first entry of X-Forwarded-For (set by Caddy), else the socket address. */
export function clientIp(req: NextApiRequest): string {
  const header = req.headers["x-forwarded-for"];
  const first = (Array.isArray(header) ? header[0] : header)?.split(",")[0]?.trim() ?? "";
  if (isIP(first)) return first;
  const remote = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  return isIP(remote) ? remote : "";
}

export function sendError(res: NextApiResponse, status: number, message: string) {
  res.status(status).json({ detail: message, errors: [message] });
}

/** Relay Django's status and JSON body (Bengali error messages included) to the browser. */
export async function relay(res: NextApiResponse, upstream: Promise<Response>) {
  let djangoRes: Response;
  try {
    djangoRes = await upstream;
  } catch (err) {
    console.error("Django request failed:", err);
    return sendError(res, 502, SERVER_ERROR_BN);
  }
  const text = await djangoRes.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`Django returned non-JSON (${djangoRes.status}):`, text.slice(0, 300));
    return sendError(res, 502, SERVER_ERROR_BN);
  }
  const retryAfter = djangoRes.headers.get("retry-after");
  if (retryAfter) res.setHeader("Retry-After", retryAfter);
  res.setHeader("Cache-Control", "no-store");
  res.status(djangoRes.status).json(data);
}
