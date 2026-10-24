export const DEMO_TEXT = "ডেমো সাইট — এটি এখনো আসল দোকান নয়। আসল ব্যক্তিগত তথ্য দেবেন না।";

export default function DemoBanner() {
  return (
    <div role="note" className="bg-banner px-4 py-2 text-center font-bn text-[13px] font-semibold leading-snug text-[#eafff1]">
      <span className="text-[#ffd17e]">●</span> {DEMO_TEXT}
    </div>
  );
}
