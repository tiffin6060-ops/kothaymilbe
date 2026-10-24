import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { readStorage, writeStorage } from "./storage";
import type { Product, UnitKind } from "./types";

/** What the cart remembers about a product, so it can still show it when the product is not on the current page. */
export type ProductSnap = Pick<
  Product,
  "name_bn" | "vendor_id" | "vendor_name" | "unit_label_bn" | "unit_kind" | "price" | "emoji" | "bg_color"
>;

export type CartLine = { productId: number; qty: number; snap: ProductSnap };

const STORAGE_KEY = "km-cart-v1";
const MAX_QTY = 99;

export function qtyStep(kind: UnitKind): number {
  return kind === "kg" ? 0.5 : 1;
}

function snapOf(p: Product): ProductSnap {
  return {
    name_bn: p.name_bn,
    vendor_id: p.vendor_id,
    vendor_name: p.vendor_name,
    unit_label_bn: p.unit_label_bn,
    unit_kind: p.unit_kind,
    price: p.price,
    emoji: p.emoji,
    bg_color: p.bg_color,
  };
}

function isValidLine(value: unknown): value is CartLine {
  const line = value as CartLine;
  return (
    !!line &&
    Number.isInteger(line.productId) &&
    typeof line.qty === "number" &&
    line.qty > 0 &&
    !!line.snap &&
    typeof line.snap.price === "string"
  );
}

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  qtyOf: (productId: number) => number;
  add: (product: Product) => void;
  increment: (productId: number) => void;
  decrement: (productId: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load after mount so the server-rendered HTML (empty cart) matches the first client render.
  useEffect(() => {
    const stored = readStorage<unknown>("local", STORAGE_KEY);
    if (Array.isArray(stored)) setLines(stored.filter(isValidLine));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeStorage("local", STORAGE_KEY, lines);
  }, [lines, ready]);

  // Keep several open tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const stored = readStorage<unknown>("local", STORAGE_KEY);
      setLines(Array.isArray(stored) ? stored.filter(isValidLine) : []);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const changeQty = useCallback((productId: number, direction: 1 | -1) => {
    setLines((prev) =>
      prev.flatMap((line) => {
        if (line.productId !== productId) return [line];
        const step = qtyStep(line.snap.unit_kind);
        const qty = Math.min(MAX_QTY, line.qty + direction * step);
        return qty < step ? [] : [{ ...line, qty }];
      }),
    );
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.length,
      qtyOf: (productId) => lines.find((l) => l.productId === productId)?.qty ?? 0,
      add: (product) =>
        setLines((prev) =>
          prev.some((l) => l.productId === product.id)
            ? prev
            : [...prev, { productId: product.id, qty: 1, snap: snapOf(product) }],
        ),
      increment: (productId) => changeQty(productId, 1),
      decrement: (productId) => changeQty(productId, -1),
      remove: (productId) => setLines((prev) => prev.filter((l) => l.productId !== productId)),
      clear: () => setLines([]),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [lines, ready, drawerOpen, changeQty],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
