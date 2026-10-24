import type { Category } from "@/lib/types";

type Props = {
  categories: Category[];
  selected: number | null;
  onSelect: (categoryId: number | null) => void;
};

export default function CategoryChips({ categories, selected, onSelect }: Props) {
  const chips: { id: number | null; name: string; emoji: string }[] = [
    { id: null, name: "সব পণ্য", emoji: "🛍️" },
    ...categories.map((c) => ({ id: c.id, name: c.name_bn, emoji: c.emoji })),
  ];
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
      {chips.map((chip) => {
        const active = chip.id === selected;
        return (
          <button
            key={chip.id ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(chip.id)}
            className={`min-h-[88px] rounded-[11px] border px-1 py-2.5 text-center transition sm:min-h-[110px] sm:rounded-[17px] sm:pb-3 sm:pt-5 ${
              active
                ? "-translate-y-0.5 border-[#5cab81] bg-[#f0fbf1]"
                : "border-line bg-white hover:-translate-y-0.5 hover:border-[#5cab81] hover:bg-[#f0fbf1]"
            }`}
          >
            <span aria-hidden className="mb-2 block text-[27px] leading-none sm:text-[33px]">
              {chip.emoji}
            </span>
            <span className="font-bn text-[11px] font-bold sm:text-xs">{chip.name}</span>
          </button>
        );
      })}
    </div>
  );
}
