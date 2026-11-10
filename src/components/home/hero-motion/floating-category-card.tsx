import { AppWindow, Briefcase, Code, Sparkle, TelevisionSimple } from "@phosphor-icons/react/dist/ssr";
import type { HeroGroupId } from "@/lib/hero-scene";
import { slotStyle, visibility, type Slot } from "./slots";

const ICON = { ai: Sparkle, dev: Code, productivity: Briefcase, ott: TelevisionSimple, software: AppWindow } as const;

/** Small glass card naming a store category with its real in-stock count. Rotates into place on entry. */
export function FloatingCategoryCard({ id, label, count, slot }: { id: HeroGroupId; label: string; count: number; slot: Slot }) {
  const Icon = ICON[id];
  const style = {
    ...slotStyle(slot, "hm-tilt"),
    ["--amp" as string]: "6px",
    ["--rot" as string]: "3deg",
    ["--enter-dur" as string]: "1600ms",
    ["--from-ry" as string]: `${slot.ry > 0 ? 55 : -55}deg`,
    ["--from-rx" as string]: "-18deg",
    ["--from-z" as string]: "-80px",
    ["--from-y" as string]: "12px",
  };
  return (
    <div className={`hm-slot ${visibility[slot.from]}`} style={style}>
      <div className="hm-enter hm-anim">
        <div className="hm-idle hm-anim">
          <div className="hm-glass flex items-center gap-2 whitespace-nowrap rounded-xl py-1.5 pl-1.5 pr-3 sm:rounded-2xl sm:py-2 sm:pl-2 sm:pr-4">
            <span className="flex size-6 items-center justify-center rounded-lg bg-studio-grey text-studio-ink sm:size-8 sm:rounded-xl">
              <Icon size={14} weight="bold" />
            </span>
            <span className="leading-tight">
              <span className="title-5 block text-studio-ink sm:title-4">{label}</span>
              <span className="caption-5 hidden tabular-nums text-studio-muted sm:block">{count} in stock</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
