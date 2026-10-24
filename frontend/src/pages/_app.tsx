import type { AppProps } from "next/app";
import { DM_Sans, Hind_Siliguri } from "next/font/google";
import Head from "next/head";

import DemoBanner from "@/components/DemoBanner";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart";
import "@/styles/globals.css";

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dm",
  display: "swap",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CartProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>কোথায় মিলবে — ডেমো</title>
      </Head>
      <div className={`${hind.variable} ${dmSans.variable} flex min-h-screen flex-col font-sans text-[15px] leading-normal`}>
        <DemoBanner />
        <Component {...pageProps} />
        <Footer />
      </div>
    </CartProvider>
  );
}
