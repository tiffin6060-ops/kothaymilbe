import { formatQty } from "@/lib/money";

type Props = {
  qty: number;
  unitKind: string;
  onIncrement: () => void;
  onDecrement: () => void;
  size?: "sm" | "md";
  label: string;
};

export default function QtyStepper({ qty, unitKind, onIncrement, onDecrement, size = "md", label }: Props) {
  const btn =
    size === "md"
      ? "grid h-[35px] w-[34px] place-items-center rounded-[10px] bg-brand text-xl leading-none text-white hover:bg-[#12674b]"
      : "grid size-7 place-items-center rounded-lg bg-[#e9f4ea] text-base font-bold leading-none text-brand hover:bg-leaf";
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`${label} — পরিমাণ`}>
      <button type="button" className={btn} onClick={onDecrement} aria-label={`${label} কমান`}>
        −
      </button>
      <span className="min-w-[2.6rem] text-center text-sm font-bold tabular-nums" aria-live="polite">
        {formatQty(qty)}
        {unitKind === "kg" && <span className="ml-0.5 text-[11px] font-semibold text-muted">কেজি</span>}
      </span>
      <button type="button" className={btn} onClick={onIncrement} aria-label={`${label} বাড়ান`}>
        +
      </button>
    </div>
  );
}
