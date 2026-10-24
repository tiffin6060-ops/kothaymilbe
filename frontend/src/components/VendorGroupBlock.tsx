import type { ReactNode } from "react";

import { useCart } from "@/lib/cart";
import { formatQty, taka, toPaisa } from "@/lib/money";
import type { VendorGroup } from "@/lib/summary";

import QtyStepper from "./QtyStepper";

type Props = { group: VendorGroup; editable?: boolean; children?: ReactNode };

export default function VendorGroupBlock({ group, editable = false, children }: Props) {
  const cart = useCart();
  const toFree = group.freeAbovePaisa - group.subtotalPaisa;

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 text-[15px] font-extrabold">
        <span aria-hidden>🏪</span> {group.vendorName}
      </h3>

      <ul className="divide-y divide-line">
        {group.lines.map((line) => (
          <li key={line.productId} className="flex items-center gap-3 py-3">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-xl text-[28px]"
              style={{ backgroundColor: line.product.bg_color }}
            >
              {line.product.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`font-bn text-sm font-bold ${line.unavailable ? "text-muted line-through" : ""}`}>
                {line.product.name_bn}
              </div>
              <div className="text-xs text-muted">
                {line.product.unit_label_bn} • {taka(toPaisa(line.product.price))} × {formatQty(line.qty)}
              </div>
              {line.unavailable && <div className="text-xs font-bold text-danger">এখন পাওয়া যাচ্ছে না</div>}
              {editable && (
                <div className="mt-1.5 flex items-center gap-3">
                  {!line.unavailable && (
                    <QtyStepper
                      size="sm"
                      qty={line.qty}
                      unitKind={line.product.unit_kind}
                      label={line.product.name_bn}
                      onIncrement={() => cart.increment(line.productId)}
                      onDecrement={() => cart.decrement(line.productId)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => cart.remove(line.productId)}
                    className="text-xs font-semibold text-danger underline-offset-2 hover:underline"
                  >
                    সরান
                  </button>
                </div>
              )}
            </div>
            <div className="shrink-0 text-sm font-bold tabular-nums">{line.unavailable ? "—" : taka(line.linePaisa)}</div>
          </li>
        ))}
      </ul>

      {children}

      <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">সাবটোটাল</dt>
          <dd className="tabular-nums">{taka(group.subtotalPaisa)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">ডেলিভারি চার্জ</dt>
          <dd className="tabular-nums">
            {group.freeDelivery ? <span className="font-bold text-brand2">ফ্রি ডেলিভারি</span> : taka(group.feePaisa)}
          </dd>
        </div>
        <div className="flex justify-between font-bold">
          <dt>এই বিক্রেতার মোট</dt>
          <dd className="tabular-nums">{taka(group.subtotalPaisa + group.feePaisa)}</dd>
        </div>
      </dl>

      {!group.freeDelivery && group.subtotalPaisa > 0 && toFree > 0 && group.shortPaisa === 0 && (
        <p className="mt-2 rounded-lg bg-[#f5f9f1] px-3 py-2 text-xs text-[#56715d]">
          আরও {taka(toFree)}-এর পণ্য নিলে এই বিক্রেতার ডেলিভারি ফ্রি।
        </p>
      )}
      {group.shortPaisa > 0 && (
        <p className="mt-2 rounded-lg bg-[#fff3df] px-3 py-2 text-xs font-semibold text-[#9a6418]">
          ন্যূনতম অর্ডার {taka(group.minOrderPaisa)} — আরও {taka(group.shortPaisa)}-এর পণ্য যোগ করুন।
        </p>
      )}
      {!group.servesArea && (
        <p className="mt-2 rounded-lg bg-[#ffeae5] px-3 py-2 text-xs font-semibold text-danger">
          এই বিক্রেতা আপনার নির্বাচিত এলাকায় ডেলিভারি দেয় না।
        </p>
      )}
      {!group.vendor && (
        <p className="mt-2 rounded-lg bg-[#ffeae5] px-3 py-2 text-xs font-semibold text-danger">
          এই বিক্রেতা এখন অর্ডার নিচ্ছে না।
        </p>
      )}
    </section>
  );
}
