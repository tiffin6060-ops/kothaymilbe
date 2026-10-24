import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import CartDrawer from "@/components/CartDrawer";
import CategoryChips from "@/components/CategoryChips";
import ErrorPanel from "@/components/ErrorPanel";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import VendorCards from "@/components/VendorCards";
import { djangoGet, SERVER_ERROR_BN } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { bnDigits, toPaisa } from "@/lib/money";
import { AREA_KEY, readStorage, writeStorage } from "@/lib/storage";
import { indexById, summarizeCart } from "@/lib/summary";
import type { Area, Category, Product, Vendor } from "@/lib/types";

type Props =
  | {
      ok: true;
      areas: Area[];
      areaId: number;
      areaFromUrl: boolean;
      categories: Category[];
      vendors: Vendor[];
      products: Product[];
    }
  | { ok: false; error: string };

type Sort = "featured" | "low" | "high";

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  try {
    const areas = await djangoGet<Area[]>("areas/");
    if (areas.length === 0) return { props: { ok: false, error: "এখন কোনো এলাকায় ডেলিভারি চালু নেই।" } };
    const requested = Number(query.area);
    const areaFromUrl = areas.some((a) => a.id === requested);
    const areaId = areaFromUrl ? requested : areas[0].id;
    const [categories, vendors, products] = await Promise.all([
      djangoGet<Category[]>("categories/"),
      djangoGet<Vendor[]>("vendors/"), // all active vendors; the cart may hold items from any of them
      djangoGet<Product[]>("products/", { area: areaId }),
    ]);
    return { props: { ok: true, areas, areaId, areaFromUrl, categories, vendors, products } };
  } catch (err) {
    console.error(err);
    return { props: { ok: false, error: SERVER_ERROR_BN } };
  }
};

export default function Home(props: Props) {
  if (!props.ok) return <ErrorPanel message={props.error} />;
  return <Shop {...props} />;
}

function Shop({ areas, areaId, areaFromUrl, categories, vendors, products }: Extract<Props, { ok: true }>) {
  const router = useRouter();
  const cart = useCart();
  const [category, setCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("featured");

  // Area lives in the URL (?area=) and is remembered in localStorage for the next visit.
  useEffect(() => {
    const stored = readStorage<number>("local", AREA_KEY);
    if (!areaFromUrl && stored && stored !== areaId && areas.some((a) => a.id === stored)) {
      router.replace({ pathname: "/", query: { area: stored } }, undefined, { scroll: false });
    } else {
      writeStorage("local", AREA_KEY, areaId);
    }
  }, [areaId, areaFromUrl]); // router and areas are stable for this render; re-run only when the area changes

  const changeArea = (id: number) => {
    writeStorage("local", AREA_KEY, id);
    router.push({ pathname: "/", query: { area: id } }, undefined, { scroll: false });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter(
      (p) =>
        (category === null || p.category_id === category) &&
        (!q ||
          p.name_bn.toLowerCase().includes(q) ||
          p.category_name_bn.toLowerCase().includes(q) ||
          p.vendor_name.toLowerCase().includes(q)),
    );
    if (sort === "low") list.sort((a, b) => toPaisa(a.price) - toPaisa(b.price));
    if (sort === "high") list.sort((a, b) => toPaisa(b.price) - toPaisa(a.price));
    return list;
  }, [products, category, search, sort]);

  const summary = useMemo(
    () =>
      summarizeCart(cart.lines, {
        vendorsById: indexById(vendors),
        productsById: indexById(products),
        areaId,
        completeCatalog: false,
      }),
    [cart.lines, vendors, products, areaId],
  );

  const areaVendors = vendors.filter((v) => v.area_ids.includes(areaId));

  return (
    <>
      <Head>
        <title>কোথায় মিলবে — তাজা খাবার, হাতের নাগালে (ডেমো)</title>
      </Head>
      <Header areas={areas} areaId={areaId} onAreaChange={changeArea} onCartClick={cart.openDrawer} showNav />

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6">
        <Hero />

        <section id="categories" className="mt-7 scroll-mt-24 sm:mt-9">
          <SectionHead title="কী খুঁজছেন আজ?" subtitle="পছন্দের ক্যাটাগরি বেছে নিন">
            <button type="button" onClick={() => setCategory(null)} className="text-[13px] font-bold text-brand2">
              সব দেখুন ↗
            </button>
          </SectionHead>
          <CategoryChips categories={categories} selected={category} onSelect={setCategory} />
        </section>

        <section id="products" className="mt-7 scroll-mt-24 sm:mt-9">
          <SectionHead title="আজকের নির্বাচিত পণ্য" subtitle="আপনার এলাকার অনুমোদিত বিক্রেতাদের পণ্য">
            <span className="text-[13px] font-bold text-brand2">{bnDigits(visible.length)}টি পণ্য</span>
          </SectionHead>

          <div className="mb-4 mt-5 flex items-center gap-2 sm:gap-3.5">
            <label className="flex flex-1 items-center gap-2 rounded-[13px] border border-line bg-white px-3.5 focus-within:border-brand2">
              <span aria-hidden className="text-muted">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="পণ্য, ক্যাটাগরি বা বিক্রেতা খুঁজুন…"
                aria-label="পণ্য খুঁজুন"
                className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="সাজানোর ধরন"
              className="w-[118px] rounded-[13px] border border-line bg-white px-2 py-3 text-xs outline-none sm:w-auto sm:px-3.5 sm:text-sm"
            >
              <option value="featured">বাছাই করা</option>
              <option value="low">দাম: কম থেকে বেশি</option>
              <option value="high">দাম: বেশি থেকে কম</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#c7d7c8] bg-[#f7fbf5] p-9 text-center text-[#64776c]">
              কোনো পণ্য পাওয়া যায়নি। অন্য কিছু লিখে খুঁজুন বা অন্য ক্যাটাগরি দেখুন।
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
          <p className="mt-3 flex items-center gap-2.5 text-xs text-[#63796c]">
            <span aria-hidden className="size-[7px] rounded-full bg-[#48aa77]" /> ডেমো পণ্যের দাম ও প্রাপ্যতা আসল নয়
          </p>
        </section>

        <section id="vendors" className="mt-7 scroll-mt-24 sm:mt-9">
          <SectionHead title="আমাদের নির্বাচিত বিক্রেতা" subtitle="প্রতিটি বিক্রেতা নিজে ডেলিভারি দেয়" />
          <VendorCards vendors={areaVendors} products={products} />
        </section>
      </main>

      <CartDrawer summary={summary} />
    </>
  );
}

function SectionHead({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-bn text-[22px] font-bold leading-tight sm:text-2xl">{title}</h2>
        <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
