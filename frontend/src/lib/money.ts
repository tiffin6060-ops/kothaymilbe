// Display-only arithmetic in whole paisa (integers), so totals never pick up float errors.
// The server recalculates every amount; these numbers are only a preview.

export function toPaisa(amount: string): number {
  const [whole, frac = ""] = amount.trim().split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const paisa = Math.abs(parseInt(whole, 10) || 0) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return sign * paisa;
}

/** price × qty, rounded half-up to the paisa like the server. qty is a multiple of 0.5. */
export function linePaisa(pricePaisa: number, qty: number): number {
  const halves = Math.round(qty * 2);
  return Math.round((pricePaisa * halves) / 2);
}

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 154500 -> "৳ 1,545"; 1250 -> "৳ 12.50" */
export function taka(paisa: number): string {
  const whole = Math.trunc(paisa / 100);
  const frac = Math.abs(paisa % 100);
  // Non-breaking space keeps "৳" and the amount on one line.
  return `৳ ${grouped.format(whole)}${frac ? "." + String(frac).padStart(2, "0") : ""}`;
}

export function takaFromString(amount: string): string {
  return taka(toPaisa(amount));
}

/** 1.5 -> "1.5", 2 -> "2" */
export function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function bnDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}
