import Link from "next/link";

import Header from "./Header";

export default function ErrorPanel({ message, showHomeLink = false }: { message: string; showHomeLink?: boolean }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[640px] px-4 py-16 text-center sm:px-6">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
          <div aria-hidden className="mb-3 text-5xl">🧺</div>
          <p className="font-bn text-lg font-bold">{message}</p>
          {showHomeLink && (
            <Link href="/" className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 font-bold text-white">
              দোকানে ফিরে যান
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
