import { takaFromString } from "@/lib/money";
import type { Product, Vendor } from "@/lib/types";

export default function VendorCards({ vendors, products }: { vendors: Vendor[]; products: Product[] }) {
  if (vendors.length === 0) {
    return <p className="rounded-2xl border border-dashed border-[#c7d7c8] bg-[#f7fbf5] p-8 text-center text-[#64776c]">এই এলাকায় এখনো কোনো বিক্রেতা নেই।</p>;
  }
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
      {vendors.map((v) => {
        const icon = v.is_own_farm ? "🌱" : products.find((p) => p.vendor_id === v.id)?.emoji || "🛒";
        const isSample = v.business_name.includes("(Sample)");
        return (
          <div key={v.id} className="flex items-center gap-4 rounded-[17px] border border-line bg-white p-5 sm:p-[22px]">
            <div aria-hidden className="grid h-[59px] min-w-[59px] place-items-center rounded-2xl bg-[#e2f4e5] text-[31px]">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="text-[17px] font-extrabold">{v.business_name}</div>
              <div className="my-1 text-xs text-muted">
                ডেলিভারি চার্জ {takaFromString(v.delivery_fee)} • {takaFromString(v.free_delivery_above)}+ হলে ফ্রি •
                ন্যূনতম {takaFromString(v.min_order)}
              </div>
              <div className="w-max rounded-lg bg-[#ecf6ec] px-2 py-1 text-[11px] font-bold text-[#35825b]">
                {v.is_own_farm ? "নিজস্ব খামার" : isSample ? "নমুনা বিক্রেতা" : "যাচাই করা বিক্রেতা"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
