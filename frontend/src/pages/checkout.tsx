import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import ErrorPanel from "@/components/ErrorPanel";
import Header from "@/components/Header";
import VendorGroupBlock from "@/components/VendorGroupBlock";
import { djangoGet, SERVER_ERROR_BN } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { addDays, dhakaNow, formatBnDate, isSlotOpen } from "@/lib/dhakaTime";
import { formatQty, taka } from "@/lib/money";
import { AREA_KEY, CHECKOUT_KEY, orderPhoneKey, readStorage, removeStorage, writeStorage } from "@/lib/storage";
import { indexById, summarizeCart, type VendorGroup } from "@/lib/summary";
import type { ApiError, Area, Product, Slot, Vendor } from "@/lib/types";

type Props =
  | { ok: true; areas: Area[]; vendors: Vendor[]; products: Product[]; slots: Slot[]; serverNowMs: number }
  | { ok: false; error: string };

type Day = "today" | "tomorrow";

const PHONE_RE = /^01[3-9]\d{8}$/;
const BN_TO_LATIN: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const [areas, vendors, products, slots] = await Promise.all([
      djangoGet<Area[]>("areas/"),
      djangoGet<Vendor[]>("vendors/"),
      djangoGet<Product[]>("products/"),
      djangoGet<Slot[]>("slots/"),
    ]);
    return { props: { ok: true, areas, vendors, products, slots, serverNowMs: Date.now() } };
  } catch (err) {
    console.error(err);
    return { props: { ok: false, error: SERVER_ERROR_BN } };
  }
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Server time, kept ticking, so a wrong clock on the visitor's phone cannot open a closed slot. */
function useServerClock(serverNowMs: number): number {
  const [nowMs, setNowMs] = useState(serverNowMs);
  useEffect(() => {
    const offset = serverNowMs - Date.now();
    const tick = () => setNowMs(Date.now() + offset);
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [serverNowMs]);
  return nowMs;
}

export default function CheckoutPage(props: Props) {
  if (!props.ok) return <ErrorPanel message={props.error} showHomeLink />;
  return <Checkout {...props} />;
}

function Checkout({ areas, vendors, products, slots, serverNowMs }: Extract<Props, { ok: true }>) {
  const router = useRouter();
  const cart = useCart();
  const nowMs = useServerClock(serverNowMs);
  const now = dhakaNow(nowMs);
  const dates: Record<Day, string> = { today: now.date, tomorrow: addDays(now.date, 1) };

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [areaId, setAreaId] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState<Day | null>(null);
  const [slotByVendor, setSlotByVendor] = useState<Record<number, number>>({});
  const [idemKey, setIdemKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const vendorsById = useMemo(() => indexById(vendors), [vendors]);
  const slotsById = useMemo(() => indexById(slots), [slots]);
  const summary = useMemo(
    () => summarizeCart(cart.lines, { vendorsById, productsById: indexById(products), areaId, completeCatalog: true }),
    [cart.lines, vendorsById, products, areaId],
  );

  // One Idempotency-Key per checkout: kept across reloads/retries, replaced after a successful order.
  useEffect(() => {
    let key = readStorage<string>("session", CHECKOUT_KEY);
    if (!key) {
      key = newIdempotencyKey();
      writeStorage("session", CHECKOUT_KEY, key);
    }
    setIdemKey(key);

    const storedArea = readStorage<number>("local", AREA_KEY);
    setAreaId(areas.some((a) => a.id === storedArea) ? storedArea : (areas[0]?.id ?? null));
  }, [areas]);

  const vendorSlots = (g: VendorGroup) => slots.filter((s) => g.vendor?.slot_ids.includes(s.id));

  // Default day: today if every vendor still has an open slot today, otherwise tomorrow.
  useEffect(() => {
    if (day !== null || !cart.ready || summary.groups.length === 0) return;
    const todayWorks = summary.groups.every((g) => vendorSlots(g).some((s) => isSlotOpen(s, dates.today, now)));
    setDay(todayWorks ? "today" : "tomorrow");
  });

  // Drop a chosen slot as soon as it closes (or the day changes to today).
  const deliveryDate = day ? dates[day] : null;
  useEffect(() => {
    if (!deliveryDate) return;
    setSlotByVendor((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, slotId]) => {
          const slot = slotsById.get(slotId);
          return slot && isSlotOpen(slot, deliveryDate, now);
        }),
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  });

  const firstProblem = (() => {
    if (!cart.ready) return "লোড হচ্ছে…";
    if (cart.lines.length === 0) return "কার্টে কোনো পণ্য নেই।";
    if (name.trim().length < 2) return "আপনার নাম লিখুন।";
    if (!PHONE_RE.test(phone)) return "সঠিক মোবাইল নম্বর দিন — ১১ সংখ্যা, 01 দিয়ে শুরু (যেমন 01712345678)।";
    if (!areaId) return "ডেলিভারির এলাকা বেছে নিন।";
    if (address.trim().length < 5) return "পূর্ণ ঠিকানা লিখুন (বাড়ি, রোড, ব্লক)।";
    if (!deliveryDate) return "ডেলিভারির দিন বেছে নিন — আজ বা আগামীকাল।";
    if (summary.problems.length) return summary.problems[0];
    for (const g of summary.groups) {
      const slot = slotsById.get(slotByVendor[g.vendorId]);
      if (!slot || !g.vendor?.slot_ids.includes(slot.id)) return `${g.vendorName}-এর ডেলিভারি সময় বেছে নিন।`;
      if (!isSlotOpen(slot, deliveryDate, now)) return `${g.vendorName}: "${slot.label_bn}" সময়টি বন্ধ হয়ে গেছে। অন্য সময় বেছে নিন।`;
    }
    if (!idemKey) return "লোড হচ্ছে…";
    return null;
  })();

  async function placeOrder() {
    if (firstProblem || submitting || !deliveryDate) return;
    setSubmitting(true);
    setServerErrors([]);
    const body = {
      customer_name: name.trim(),
      phone,
      area: areaId,
      address_text: address.trim(),
      note: note.trim(),
      delivery_date: deliveryDate,
      vendors: summary.groups.map((g) => ({
        vendor: g.vendorId,
        slot: slotByVendor[g.vendorId],
        items: g.lines.map((l) => ({ product: l.productId, qty: formatQty(l.qty) })),
      })),
    };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as (ApiError & { number?: string }) | null;
      if (res.ok && data?.number) {
        writeStorage("session", orderPhoneKey(data.number), phone);
        removeStorage("session", CHECKOUT_KEY);
        setPlaced(true);
        cart.clear();
        await router.push(`/order/${encodeURIComponent(data.number)}`);
        return;
      }
      setServerErrors(data?.errors?.length ? data.errors : [data?.detail || "অর্ডার করা যায়নি। আবার চেষ্টা করুন।"]);
    } catch {
      setServerErrors(["ইন্টারনেট সংযোগে সমস্যা। সংযোগ দেখে আবার চেষ্টা করুন।"]);
    }
    setSubmitting(false);
  }

  if (placed) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-[640px] px-4 py-16 text-center font-bn text-lg font-bold">অর্ডার নিশ্চিত হচ্ছে…</main>
      </>
    );
  }

  const inputClass =
    "w-full rounded-[10px] border border-[#dfe5de] bg-white px-3 py-3 text-[15px] outline-none focus:border-[#5ba87a] focus:ring-2 focus:ring-[#5ba87a]/20";

  return (
    <>
      <Head>
        <title>চেকআউট — কোথায় মিলবে (ডেমো)</title>
      </Head>
      <Header />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-brand2">
          ← কেনাকাটায় ফিরে যান
        </Link>
        <h1 className="mb-5 mt-2 font-bn text-[28px] font-bold">চেকআউট</h1>

        {cart.ready && cart.lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c7d7c8] bg-[#f7fbf5] p-9 text-center text-[#64776c]">
            কার্ট খালি।{" "}
            <Link href="/" className="font-bold text-brand underline">
              পণ্য বেছে নিন
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_440px]">
            <div className="space-y-5">
              <Card title="আপনার তথ্য">
                <Field label="নাম" htmlFor="name">
                  <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম" autoComplete="name" maxLength={100} />
                </Field>
                <Field label="মোবাইল নম্বর" htmlFor="phone" hint="১১ সংখ্যা, যেমন 01712345678">
                  <input
                    id="phone"
                    className={`${inputClass} font-sans tracking-wide`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[০-৯]/g, (d) => BN_TO_LATIN[d]).replace(/\D/g, "").slice(0, 11))}
                    placeholder="01XXXXXXXXX"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                  />
                </Field>
                <Field label="এলাকা" htmlFor="area">
                  <select
                    id="area"
                    className={inputClass}
                    value={areaId ?? ""}
                    onChange={(e) => {
                      setAreaId(Number(e.target.value));
                      writeStorage("local", AREA_KEY, Number(e.target.value));
                    }}
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name_bn}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="পূর্ণ ঠিকানা" htmlFor="address">
                  <textarea id="address" rows={3} className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="বাড়ি, রোড, ব্লক / সেক্টর" maxLength={500} />
                </Field>
                <Field label="নোট (ঐচ্ছিক)" htmlFor="note">
                  <input id="note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: গেটে ফোন দেবেন" maxLength={500} />
                </Field>
              </Card>

              <Card title="ডেলিভারির দিন">
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="ডেলিভারির দিন">
                  {(["today", "tomorrow"] as Day[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={day === d}
                      onClick={() => setDay(d)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        day === d ? "border-brand bg-[#f0fbf1] ring-2 ring-brand/20" : "border-line bg-white hover:border-[#5cab81]"
                      }`}
                    >
                      <span className="block font-bn font-bold">{d === "today" ? "আজ" : "আগামীকাল"}</span>
                      <span className="text-xs text-muted">{formatBnDate(dates[d])}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">আজকের কোনো সময়-স্লট শেষ হওয়ার ১ ঘণ্টা আগে বন্ধ হয়ে যায় (ঢাকা সময়)।</p>
              </Card>
            </div>

            <div className="space-y-4 lg:sticky lg:top-24">
              <h2 className="font-bn text-xl font-bold">অর্ডারের সারাংশ</h2>
              {summary.groups.map((g) => (
                <VendorGroupBlock key={g.vendorId} group={g} editable>
                  <div className="mt-2 border-t border-line pt-3">
                    <div className="mb-2 text-[13px] font-bold">ডেলিভারির সময়</div>
                    <div className="flex flex-wrap gap-2">
                      {vendorSlots(g).map((s) => {
                        const open = deliveryDate ? isSlotOpen(s, deliveryDate, now) : true;
                        const chosen = slotByVendor[g.vendorId] === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={!open}
                            aria-pressed={chosen}
                            onClick={() => setSlotByVendor((prev) => ({ ...prev, [g.vendorId]: s.id }))}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                              chosen
                                ? "border-brand bg-brand text-white"
                                : open
                                  ? "border-line bg-white hover:border-[#5cab81]"
                                  : "cursor-not-allowed border-line bg-[#f2f2ee] text-[#a3aaa5] line-through"
                            }`}
                          >
                            {s.label_bn}
                            {!open && <span className="ml-1 no-underline">(বন্ধ)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </VendorGroupBlock>
              ))}

              <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex justify-between text-lg font-extrabold">
                  <span>সর্বমোট</span>
                  <span className="tabular-nums">{taka(summary.grandPaisa)}</span>
                </div>
                <p className="mb-4 mt-1 text-xs text-muted">
                  পেমেন্ট: ক্যাশ অন ডেলিভারি। চূড়ান্ত দাম ও চার্জ সার্ভার যাচাই করে নির্ধারণ করবে।
                </p>
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={!!firstProblem || submitting}
                  className="w-full rounded-xl bg-brand px-5 py-3.5 font-bn text-base font-bold text-white transition hover:bg-[#12674b] disabled:cursor-not-allowed disabled:bg-brand/40"
                >
                  {submitting ? "অর্ডার পাঠানো হচ্ছে…" : "অর্ডার করুন"}
                </button>
                {firstProblem && <p className="mt-2 text-sm font-semibold text-[#9a6418]">{firstProblem}</p>}
                {serverErrors.length > 0 && (
                  <div role="alert" className="mt-3 rounded-lg bg-[#ffeae5] px-3 py-2 text-sm text-danger">
                    <strong className="block">অর্ডার নেওয়া যায়নি:</strong>
                    <ul className="ml-4 list-disc">
                      {serverErrors.map((msg) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="mb-4 font-bn text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-3.5 grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-bold">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
