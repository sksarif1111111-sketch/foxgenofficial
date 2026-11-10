import { useState } from "react";
import { heroGroupOf, shortProductName, type HeroSceneProduct } from "@/lib/hero-scene";
import { slotStyle, visibility, type Slot } from "./slots";

const IDLE = { ai: "hm-float", ott: "hm-depth", dev: "hm-tilt", productivity: "hm-float", software: "hm-depth" } as const;
const SIZE = {
  front: { box: "size-16 sm:size-20 lg:size-[92px]", img: "size-8 sm:size-10 lg:size-11", amp: 12, rot: 2.4, gap: 40 },
  mid: { box: "size-14 sm:size-16 lg:size-[72px]", img: "size-7 sm:size-8", amp: 9, rot: 3, gap: 34 },
  back: { box: "size-[54px]", img: "size-6", amp: 7, rot: 2, gap: 16 },
} as const;

/** Real brand logo when the store has one; otherwise the product emoji or first letter. */
export function LogoMark({ product, className }: { product: HeroSceneProduct; className: string }) {
  const [broken, setBroken] = useState(false);
  if (product.logo_url && !broken) {
    return <img src={product.logo_url} alt="" loading="lazy" decoding="async" width={44} height={44} className={`${className} rounded-lg object-contain`} onError={() => setBroken(true)} />;
  }
  if (product.emoji) return <span className="text-2xl leading-none">{product.emoji}</span>;
  return <span className="text-xl font-semibold leading-none text-studio-ink">{shortProductName(product.name).charAt(0).toUpperCase()}</span>;
}

/** One floating app tile: entrance, idle drift and its own soft floor shadow run on separate layers. */
export function FloatingProductTile({ product, slot }: { product: HeroSceneProduct; slot: Slot }) {
  const size = SIZE[slot.tier];
  const style = { ...slotStyle(slot, IDLE[heroGroupOf(product.name)]), ["--amp" as string]: `${size.amp}px`, ["--rot" as string]: `${size.rot}deg`, ["--shadow-gap" as string]: `${size.gap}px` };
  const tile = (
    <div className={`hm-tile ${slot.tier === "back" ? "is-glass opacity-80" : ""} ${size.box}`}>
      <LogoMark product={product} className={size.img} />
    </div>
  );
  return (
    <div className={`hm-slot ${visibility[slot.from]}`} style={style}>
      <div className="hm-enter hm-anim">
        <div className="hm-shadow hm-anim" />
        <div className="hm-idle hm-anim relative">
          {slot.approach !== undefined ? <div className="hm-approach hm-anim">{tile}</div> : tile}
          {slot.tier !== "back" && (
            <p className="caption-5 absolute left-1/2 top-full mt-2 hidden w-[104px] -translate-x-1/2 truncate text-center text-studio-muted lg:block">{shortProductName(product.name)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
