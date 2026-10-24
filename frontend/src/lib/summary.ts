// Groups the cart by vendor and previews subtotals, delivery fees and minimum-order gaps.
// Same rules as the server (which recalculates everything when the order is placed).

import type { CartLine, ProductSnap } from "./cart";
import { linePaisa, taka, toPaisa } from "./money";
import type { Product, Vendor } from "./types";

export type SummaryLine = {
  productId: number;
  qty: number;
  product: ProductSnap;
  unavailable: boolean;
  linePaisa: number;
};

export type VendorGroup = {
  vendorId: number;
  vendorName: string;
  vendor: Vendor | undefined;
  lines: SummaryLine[];
  subtotalPaisa: number;
  feePaisa: number;
  freeDelivery: boolean;
  freeAbovePaisa: number;
  minOrderPaisa: number;
  shortPaisa: number;
  servesArea: boolean;
};

export type CartSummary = { groups: VendorGroup[]; grandPaisa: number; problems: string[] };

type Options = {
  vendorsById: Map<number, Vendor>;
  productsById: Map<number, Product>;
  areaId: number | null;
  /** true when productsById holds every active product (checkout). Missing products are then unavailable. */
  completeCatalog: boolean;
};

export function summarizeCart(cartLines: CartLine[], opts: Options): CartSummary {
  const byVendor = new Map<number, CartLine[]>();
  for (const line of cartLines) {
    const vendorId = opts.productsById.get(line.productId)?.vendor_id ?? line.snap.vendor_id;
    byVendor.set(vendorId, [...(byVendor.get(vendorId) ?? []), line]);
  }

  const groups: VendorGroup[] = [];
  const problems: string[] = [];

  for (const [vendorId, vendorLines] of byVendor) {
    const vendor = opts.vendorsById.get(vendorId);
    const lines = vendorLines.map((line): SummaryLine => {
      const live = opts.productsById.get(line.productId);
      const product = live ?? line.snap;
      const unavailable = !vendor || (live ? !live.in_stock : opts.completeCatalog);
      return {
        productId: line.productId,
        qty: line.qty,
        product,
        unavailable,
        linePaisa: unavailable ? 0 : linePaisa(toPaisa(product.price), line.qty),
      };
    });

    const subtotalPaisa = lines.reduce((sum, l) => sum + l.linePaisa, 0);
    const freeAbovePaisa = vendor ? toPaisa(vendor.free_delivery_above) : 0;
    const minOrderPaisa = vendor ? toPaisa(vendor.min_order) : 0;
    const freeDelivery = subtotalPaisa > 0 && subtotalPaisa >= freeAbovePaisa;
    const feePaisa = !vendor || subtotalPaisa === 0 || freeDelivery ? 0 : toPaisa(vendor.delivery_fee);
    const shortPaisa = subtotalPaisa > 0 ? Math.max(0, minOrderPaisa - subtotalPaisa) : 0;
    const servesArea = !vendor || opts.areaId === null || vendor.area_ids.includes(opts.areaId);
    const vendorName = vendor?.business_name ?? vendorLines[0].snap.vendor_name;

    if (!vendor) problems.push(`${vendorName} এখন অর্ডার নিচ্ছে না। কার্ট থেকে এই বিক্রেতার পণ্য সরান।`);
    else if (!servesArea) problems.push(`${vendorName} আপনার নির্বাচিত এলাকায় ডেলিভারি দেয় না।`);
    for (const l of lines) {
      if (l.unavailable && vendor) problems.push(`${l.product.name_bn} এখন পাওয়া যাচ্ছে না। কার্ট থেকে সরান।`);
    }
    if (shortPaisa > 0) {
      problems.push(`${vendorName}: ন্যূনতম অর্ডার ${taka(minOrderPaisa)} — আরও ${taka(shortPaisa)}-এর পণ্য যোগ করুন।`);
    }

    groups.push({
      vendorId,
      vendorName,
      vendor,
      lines,
      subtotalPaisa,
      feePaisa,
      freeDelivery,
      freeAbovePaisa,
      minOrderPaisa,
      shortPaisa,
      servesArea,
    });
  }

  const grandPaisa = groups.reduce((sum, g) => sum + g.subtotalPaisa + g.feePaisa, 0);
  return { groups, grandPaisa, problems };
}

export function indexById<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}
