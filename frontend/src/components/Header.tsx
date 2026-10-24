import Link from "next/link";

import { useCart } from "@/lib/cart";
import type { Area } from "@/lib/types";

type Props = {
  areas?: Area[];
  areaId?: number | null;
  onAreaChange?: (areaId: number) => void;
  /** Home page opens the drawer; other pages link back to the shop. */
  onCartClick?: () => void;
  showNav?: boolean;
};

export default function Header({ areas, areaId, onAreaChange, onCartClick, showNav = false }: Props) {
  const { count, ready } = useCart();
  const cartLabel = (
    <>
      <span aria-hidden>🛒</span> কার্ট <span className="font-sans">{ready ? count : 0}</span>
    </>
  );
  const cartClass =
    "whitespace-nowrap rounded-xl bg-brand px-2.5 py-2.5 text-xs font-bold text-white hover:bg-[#12674b] sm:px-4 sm:py-3 sm:text-sm";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex min-h-[64px] w-full max-w-[1200px] items-center gap-2 px-4 sm:min-h-[76px] sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3" aria-label="কোথায় মিলবে — হোম">
          <span className="relative grid size-9 place-items-center rounded-[12px] bg-brand font-bn text-[21px] font-bold text-white sm:size-[42px] sm:rounded-[13px] sm:text-2xl">
            ক
            <span aria-hidden className="absolute -right-1 -top-2 text-xs text-[#e9a93d]">
              ✦
            </span>
          </span>
          <span className="leading-tight">
            <span className="block font-bn text-[17px] font-bold text-brand sm:text-[22px]">কোথায় মিলবে</span>
            <span className="hidden text-[9px] font-medium tracking-[0.17em] text-[#79958b] min-[400px]:block">
              KOTHAY MILBE
            </span>
          </span>
        </Link>

        {showNav && (
          <nav className="ml-8 hidden gap-6 text-sm font-semibold md:flex">
            <a href="#categories" className="hover:text-brand2">ক্যাটাগরি</a>
            <a href="#products" className="hover:text-brand2">পণ্য</a>
            <a href="#vendors" className="hover:text-brand2">বিক্রেতা</a>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          {areas && areas.length > 0 && onAreaChange && (
            <select
              aria-label="ডেলিভারির এলাকা"
              value={areaId ?? ""}
              onChange={(e) => onAreaChange(Number(e.target.value))}
              className="max-w-[118px] rounded-xl border border-line bg-white px-2 py-2 text-xs outline-none focus:border-brand2 sm:max-w-[200px] sm:px-3 sm:py-2.5 sm:text-sm"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  📍 {a.name_bn}
                </option>
              ))}
            </select>
          )}
          {onCartClick ? (
            <button type="button" onClick={onCartClick} className={cartClass}>
              {cartLabel}
            </button>
          ) : (
            <Link href="/" className={cartClass}>
              {cartLabel}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
