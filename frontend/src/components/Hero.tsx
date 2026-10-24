export default function Hero() {
  return (
    <section className="relative mt-5 grid overflow-hidden rounded-3xl bg-hero sm:mt-6 md:min-h-[314px] md:grid-cols-[1fr_0.9fr]">
      <div className="z-10 px-6 pt-7 md:py-11 md:pl-[52px] md:pr-0">
        <div className="text-[11px] font-extrabold tracking-[0.15em] text-[#348c66]">তাজা • স্থানীয় • বিশ্বস্ত</div>
        <h1 className="my-3 font-bn text-[34px] font-bold leading-[1.18] tracking-tight sm:text-[44px] lg:text-[53px]">
          ভালো খাবার,
          <br />
          এবার <span className="text-[#28885c]">হাতের নাগালে!</span>
        </h1>
        <p className="mb-4 max-w-[440px] text-[13px] text-[#467665] sm:mb-6 sm:text-base">
          বিশ্বস্ত খামার ও বিক্রেতার তাজা খাবার, সরাসরি আপনার বাসায় পৌঁছে যাবে।
        </p>
        <a
          href="#products"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-white transition-transform hover:-translate-y-px"
        >
          কেনাকাটা শুরু করুন <span aria-hidden>↗</span>
        </a>
      </div>

      <div
        aria-hidden
        className="relative min-h-[160px] md:min-h-0"
        style={{ background: "radial-gradient(ellipse at 58% 59%, #f7ffe8 0%, #c8e6cc 50%, transparent 66%)" }}
      >
        <div className="absolute left-[55%] top-[-25%] size-[150px] rounded-full bg-[#f1d487] opacity-40 md:left-[31%] md:top-[14%] md:size-[210px]" />
        <div className="emoji-shadow absolute bottom-[-14px] left-[58%] rotate-[-11deg] text-[110px] leading-none md:bottom-[-10px] md:left-[27%] md:text-[180px]">
          🧺
        </div>
        <div className="emoji-shadow absolute left-[24%] top-[2%] rotate-[-22deg] text-[70px] leading-none md:left-[3%] md:top-[28%] md:text-[104px]">
          🥬
        </div>
        <div className="emoji-shadow absolute right-[10%] top-[-6%] rotate-[15deg] text-[66px] leading-none md:right-[11%] md:top-[17%] md:text-[97px]">
          🥕
        </div>
        <div className="emoji-shadow absolute bottom-[6%] right-[44%] rotate-[-12deg] text-[58px] leading-none md:bottom-[13%] md:right-[8%] md:text-[70px]">
          🍅
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-[#0b6c50] shadow-card md:right-6 md:top-6">
          ✓ বাছাই করা বিক্রেতা
        </div>
      </div>
    </section>
  );
}
