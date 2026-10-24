import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";

import Header from "@/components/Header";
import { formatBnDate } from "@/lib/dhakaTime";
import { takaFromString } from "@/lib/money";
import { orderPhoneKey, readStorage, writeStorage } from "@/lib/storage";
import type { ApiError, Order } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "need-phone"; error?: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; order: Order };

export default function OrderPage() {
  const router = useRouter();
  const number = typeof router.query.number === "string" ? router.query.number : "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [phoneInput, setPhoneInput] = useState("");

  async function load(phone: string) {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(number)}`, { headers: { "X-Customer-Phone": phone } });
      const data = (await res.json().catch(() => null)) as (Order & ApiError) | null;
      if (res.ok && data?.number) {
        writeStorage("session", orderPhoneKey(number), phone);
        setState({ kind: "ok", order: data });
      } else if (res.status === 404) {
        setState({ kind: "need-phone", error: data?.detail });
      } else {
        setState({ kind: "error", message: data?.detail || "অর্ডার দেখানো যাচ্ছে না। কিছুক্ষণ পরে চেষ্টা করুন।" });
      }
    } catch {
      setState({ kind: "error", message: "ইন্টারনেট সংযোগে সমস্যা। আবার চেষ্টা করুন।" });
    }
  }

  useEffect(() => {
    if (!router.isReady || !number) return;
    const phone = readStorage<string>("session", orderPhoneKey(number));
    if (phone) load(phone);
    else setState({ kind: "need-phone" });
  }, [router.isReady, number]); // load() is recreated each render; run once per order number

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    load(phoneInput.trim());
  };

  return (
    <>
      <Head>
        <title>অর্ডার {number} — কোথায় মিলবে (ডেমো)</title>
      </Head>
      <Header />
      <main className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-6 sm:px-6">
        {state.kind === "loading" && <p className="py-16 text-center font-bn text-lg font-bold">লোড হচ্ছে…</p>}

        {state.kind === "error" && (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <p className="font-bn text-lg font-bold">{state.message}</p>
          </div>
        )}

        {state.kind === "need-phone" && (
          <form onSubmit={submitPhone} className="mx-auto max-w-[420px] rounded-2xl border border-line bg-white p-6 shadow-card">
            <h1 className="mb-1 font-bn text-xl font-bold">অর্ডার দেখুন</h1>
            <p className="mb-4 text-sm text-muted">
              অর্ডার <span className="font-sans font-bold">{number}</span> দেখতে অর্ডারের সময় দেওয়া মোবাইল নম্বর লিখুন।
            </p>
            {state.error && <p className="mb-3 rounded-lg bg-[#ffeae5] px-3 py-2 text-sm text-danger">{state.error}</p>}
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="01XXXXXXXXX"
              inputMode="numeric"
              aria-label="মোবাইল নম্বর"
              className="mb-3 w-full rounded-[10px] border border-[#dfe5de] px-3 py-3 font-sans tracking-wide outline-none focus:border-[#5ba87a]"
            />
            <button type="submit" className="w-full rounded-xl bg-brand px-5 py-3 font-bold text-white">
              দেখুন
            </button>
          </form>
        )}

        {state.kind === "ok" && <OrderSummary order={state.order} />}
      </main>
    </>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <>
      <div className="rounded-3xl bg-hero p-6 text-center sm:p-8">
        <div aria-hidden className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-brand text-3xl text-white">
          ✓
        </div>
        <h1 className="font-bn text-2xl font-bold sm:text-3xl">ধন্যবাদ! আপনার অর্ডার নেওয়া হয়েছে</h1>
        <p className="mt-2 text-sm text-[#467665]">অর্ডার নম্বর</p>
        <p className="font-sans text-2xl font-extrabold tracking-wide text-brand">{order.number}</p>
        <p className="mt-2 text-sm text-[#467665]">
          ডেলিভারি: {formatBnDate(order.delivery_date)} • {order.area_name_bn}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {order.vendor_orders.map((vo) => (
          <section key={vo.vendor_id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-extrabold">🏪 {vo.vendor_name}</h2>
                <p className="text-sm text-muted">ডেলিভারির সময়: {vo.slot_label_bn}</p>
              </div>
              <span className="rounded-lg bg-[#fff3df] px-2.5 py-1 text-xs font-bold text-[#be822f]">{vo.status_bn}</span>
            </div>
            <ul className="my-3 divide-y divide-line text-sm">
              {vo.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-bn font-semibold">{item.name_snapshot}</span>{" "}
                    <span className="text-xs text-muted">
                      ({item.unit_snapshot}) {takaFromString(item.unit_price)} × {Number(item.qty)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{takaFromString(item.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line pt-3 text-sm">
              <Row label="সাবটোটাল" value={takaFromString(vo.subtotal)} />
              <Row label="ডেলিভারি চার্জ" value={Number(vo.delivery_fee) === 0 ? "ফ্রি ডেলিভারি" : takaFromString(vo.delivery_fee)} />
              <Row label="এই বিক্রেতার মোট" value={takaFromString(vo.total)} bold />
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex justify-between text-xl font-extrabold">
          <span>সর্বমোট</span>
          <span className="tabular-nums text-brand">{takaFromString(order.grand_total)}</span>
        </div>
        <p className="mt-3 rounded-xl bg-[#f5f9f1] p-3 text-sm text-[#56715d]">
          <strong className="text-brand">ক্যাশ অন ডেলিভারি</strong> — প্রতিটি বিক্রেতা নিজে ডেলিভারি দেবে; পণ্য হাতে পেয়ে সেই
          বিক্রেতার অংশের টাকা দেবেন।
        </p>
        <p className="mt-2 text-xs text-muted">এটি একটি ডেমো অর্ডার — কোনো আসল ডেলিভারি হবে না।</p>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="inline-block rounded-xl bg-brand px-6 py-3 font-bold text-white hover:bg-[#12674b]">
          আরও কেনাকাটা করুন
        </Link>
      </div>
    </>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <dt className={bold ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
