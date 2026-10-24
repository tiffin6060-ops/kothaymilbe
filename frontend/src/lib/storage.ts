// Browser storage can be missing or throw (private mode, blocked site data); never let that break the page.

type Kind = "local" | "session";

function store(kind: Kind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStorage<T>(kind: Kind, key: string): T | null {
  try {
    const raw = store(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStorage(kind: Kind, key: string, value: unknown): void {
  try {
    store(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: the page keeps working without persistence
  }
}

export function removeStorage(kind: Kind, key: string): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

export const AREA_KEY = "km-area";
export const CHECKOUT_KEY = "km-checkout-idempotency-key";
export const orderPhoneKey = (number: string) => `km-order-phone:${number}`;
