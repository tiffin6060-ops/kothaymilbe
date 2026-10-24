// All delivery times are Asia/Dhaka (UTC+6, no daylight saving), whatever the visitor's clock zone.

import type { Slot } from "./types";

const DHAKA = "Asia/Dhaka";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type DhakaNow = { date: string; minutes: number }; // date "2026-10-23", minutes since midnight

export function dhakaNow(epochMs: number): DhakaNow {
  const parts = Object.fromEntries(partsFormatter.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function timeToMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

/** Same rule as the server: for today a slot closes cutoff_minutes before it ends; tomorrow is open. */
export function isSlotOpen(slot: Slot, deliveryDate: string, now: DhakaNow): boolean {
  if (deliveryDate > now.date) return true;
  if (deliveryDate < now.date) return false;
  return now.minutes < timeToMinutes(slot.end_time) - slot.cutoff_minutes;
}

const longDate = new Intl.DateTimeFormat("bn-BD", { timeZone: "UTC", day: "numeric", month: "long", weekday: "long" });

/** "2026-10-23" -> "শুক্রবার, ২৩ অক্টোবর" */
export function formatBnDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`));
}
