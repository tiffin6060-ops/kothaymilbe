// Server-side only (getServerSideProps and /pages/api). The browser never calls Django directly.

export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL || "http://127.0.0.1:8020").replace(/\/+$/, "");

export async function djangoGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${API_INTERNAL_URL}/api/v1/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Django GET ${url.pathname} failed with ${res.status}`);
  return (await res.json()) as T;
}

export const SERVER_ERROR_BN = "সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
