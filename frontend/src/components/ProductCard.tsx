import { useCart } from "@/lib/cart";
import { takaFromString } from "@/lib/money";
import type { Product } from "@/lib/types";

import QtyStepper from "./QtyStepper";

export default function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const qty = cart.ready ? cart.qtyOf(product.id) : 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-[17px] border border-line bg-white shadow-soft">
      <div
        className="tile-circles relative grid h-32 place-items-center overflow-hidden sm:h-[164px]"
        style={{ backgroundColor: product.bg_color }}
      >
        {product.badge_bn && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-[10px] bg-white px-2.5 py-1 text-[11px] font-bold text-brand sm:left-3 sm:top-3">
            {product.badge_bn}
          </span>
        )}
        <span aria-hidden className="emoji-shadow z-[1] text-[64px] leading-none sm:text-[86px]">
          {product.emoji || "🛒"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-[15px]">
        <div className="truncate text-[11px] font-bold tracking-[0.02em] text-[#579176]">{product.vendor_name}</div>
        <h3 className="mb-1.5 mt-1 font-bn text-sm font-bold leading-snug sm:text-[17px]">{product.name_bn}</h3>
        <div className="text-xs text-[#7b857c]">{product.unit_label_bn}</div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 sm:pt-4">
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold text-brand sm:text-[21px]">{takaFromString(product.price)}</div>
            {product.previous_price && (
              <div className="text-xs text-muted line-through">{takaFromString(product.previous_price)}</div>
            )}
          </div>
          {!product.in_stock ? (
            <span className="rounded-lg bg-[#ffeae5] px-2 py-1 text-xs font-bold text-danger">স্টকে নেই</span>
          ) : qty > 0 ? (
            <QtyStepper
              qty={qty}
              unitKind={product.unit_kind}
              label={product.name_bn}
              onIncrement={() => cart.increment(product.id)}
              onDecrement={() => cart.decrement(product.id)}
            />
          ) : (
            <button
              type="button"
              onClick={() => cart.add(product)}
              aria-label={`${product.name_bn} কার্টে যোগ করুন`}
              className="grid h-[35px] w-[38px] place-items-center rounded-[10px] bg-brand text-[23px] leading-none text-white hover:bg-[#12674b]"
            >
              +
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
