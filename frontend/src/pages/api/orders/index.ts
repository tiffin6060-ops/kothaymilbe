import type { NextApiRequest, NextApiResponse } from "next";

import { API_INTERNAL_URL } from "@/lib/api";
import { clientIp, relay, sendError } from "@/lib/proxy";

export const config = { api: { bodyParser: { sizeLimit: "32kb" } } };

/** POST /api/orders → Django POST /api/v1/orders/ (the browser never calls Django directly). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "এই পদ্ধতিটি অনুমোদিত নয়।");
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, "অনুরোধটি সঠিক JSON নয়।");
  }

  const idempotencyKey = req.headers["idempotency-key"];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Client-IP": clientIp(req),
  };
  if (typeof idempotencyKey === "string") headers["Idempotency-Key"] = idempotencyKey;

  await relay(
    res,
    fetch(`${API_INTERNAL_URL}/api/v1/orders/`, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(15_000),
    }),
  );
}
