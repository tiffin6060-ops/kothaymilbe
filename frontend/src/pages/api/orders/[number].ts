import type { NextApiRequest, NextApiResponse } from "next";

import { API_INTERNAL_URL } from "@/lib/api";
import { relay, sendError } from "@/lib/proxy";

const NOT_FOUND = "অর্ডার পাওয়া যায়নি। অর্ডার নম্বর ও মোবাইল নম্বর মিলিয়ে দেখুন।";

/** GET /api/orders/KM-YYMMDD-XXXX with header X-Customer-Phone → Django GET /api/v1/orders/<number>/?phone= */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "এই পদ্ধতিটি অনুমোদিত নয়।");
  }
  const number = String(req.query.number ?? "");
  const phone = req.headers["x-customer-phone"];
  if (!/^KM-\d{6}-\d{4}$/.test(number) || typeof phone !== "string" || !/^01[3-9]\d{8}$/.test(phone)) {
    return sendError(res, 404, NOT_FOUND);
  }

  const url = new URL(`${API_INTERNAL_URL}/api/v1/orders/${encodeURIComponent(number)}/`);
  url.searchParams.set("phone", phone);
  await relay(res, fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) }));
}
