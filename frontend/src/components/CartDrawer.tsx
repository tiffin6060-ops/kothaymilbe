import Link from "next/link";
import { useEffect } from "react";

import { useCart } from "@/lib/cart";
import { taka } from "@/lib/money";
import type { CartSummary } from "@/lib/summary";

import VendorGroupBlock from "./VendorGroupBlock";

export default function CartDrawer({ summary }: { summary: CartSummary }) {
  const cart = useCart();
  const { drawerOpen, closeDrawer } = cart;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;
  const empty = cart.lines.length === 0;
  const blocked = summary.problems.length > 0;

  return (
    <div className="fixed inset-0 z-[60] bg-[#001a1190]" onClick={(e) => e.target === e.currentTarget && closeDrawer()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-cream shadow-[-10px_0_40px_#001f1730]"
      >
        <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-6 sm:py-5">
          <h2 id="cart-title" className="font-bn text-[22px] font-bold">
            আপনার কার্ট
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="কার্ট বন্ধ করুন"
            className="grid size-9 place-items-center rounded-[10px] bg-[#edf5ee] text-lg text-brand"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {empty ? (
            <div className="rounded-2xl border border-dashed border-[#c7d7c8] bg-[#f7fbf5] p-8 text-center text-[#64776c]">
              কার্ট খালি। পছন্দের পণ্যে <strong>+</strong> চাপুন।
            </div>
          ) : (
            summary.groups.map((g) => <VendorGroupBlock key={g.vendorId} group={g} editable />)
          )}
          {!empty && (
            <p className="text-xs text-muted">প্রতিটি বিক্রেতা নিজে আলাদাভাবে ডেলিভারি দেবে। পেমেন্ট: ক্যাশ অন ডেলিভারি।</p>
          )}
        </div>

        {!empty && (
          <div className="border-t border-line bg-white px-5 pb-6 pt-4 sm:px-6">
            <div className="mb-3 flex justify-between text-lg font-extrabold">
              <span>সর্বমোট</span>
              <span className="tabular-nums">{taka(summary.grandPaisa)}</span>
            </div>
            {blocked && <p className="mb-2 text-xs font-semibold text-danger">{summary.problems[0]}</p>}
            {blocked ? (
              <button type="button" disabled className="w-full rounded-xl bg-brand/40 px-5 py-3 font-bold text-white">
                চেকআউটে যান
              </button>
            ) : (
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="block w-full rounded-xl bg-brand px-5 py-3 text-center font-bold text-white hover:bg-[#12674b]"
              >
                চেকআউটে যান — ক্যাশ অন ডেলিভারি
              </Link>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
