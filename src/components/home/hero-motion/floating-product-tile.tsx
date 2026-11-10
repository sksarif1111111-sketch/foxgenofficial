import { useState, type CSSProperties } from "react";
import { shortProductName, type HeroSceneProduct } from "@/lib/hero-scene";

export const ORBIT_SECONDS = 46;

/** Real brand logo when the store has one; otherwise the product emoji or first letter. */
export function LogoMark({ product, className }: { product: HeroSceneProduct; className: string }) {
  const [broken, setBroken] = useState(false);
  if (product.logo_url && !broken) {
    return <img src={product.logo_url} alt="" loading="lazy" decoding="async" width={44} height={44} className={`${className} rounded-lg object-contain`} onError={() => setBroken(true)} />;
  }
  if (product.emoji) return <span className="text-2xl leading-none">{product.emoji}</span>;
  return <span className="text-xl font-semibold leading-none text-studio-ink">{shortProductName(product.name).charAt(0).toUpperCase()}</span>;
}

/**
 * One app tile on the orbit ring. Layers: place on the ring → cancel the ring spin and tilt so the
 * tile always faces the viewer → dim while passing behind → entrance → gentle bob → tile.
 * Every second tile is hidden on phones, which keeps the rest evenly spaced. The product name
 * shows on the showcase card; ring tiles carry the logo only so passing tiles never overlap text.
 */
export function FloatingProductTile({ product, index, total }: { product: HeroSceneProduct; index: number; total: number }) {
  const angle = (360 / total) * index;
  const style = {
    ["--a" as string]: `${angle}deg`,
    ["--fade-delay" as string]: `${-(angle / 360) * ORBIT_SECONDS}s`,
    ["--dur" as string]: `${8 + (index % 4) * 1.3}s`,
    ["--delay" as string]: `${-index * 1.7}s`,
    ["--amp" as string]: "8px",
    ["--rot" as string]: "2deg",
    ["--enter-delay" as string]: `${900 + index * 90}ms`,
    ["--from-z" as string]: "-160px",
  } as CSSProperties;
  return (
    <div className={`hm-orbit-slot ${index % 2 === 1 ? "hidden sm:block" : ""}`} style={style}>
      <div className="hm-orbit-counter hm-anim">
        <div className="hm-orbit-untilt">
          <div className="hm-orbit-fade hm-anim">
            <div className="hm-orbit-face">
              <div className="hm-enter hm-anim">
                <div className="hm-idle hm-anim relative">
                  <div className="hm-tile size-14 sm:size-[72px] lg:size-20">
                    <LogoMark product={product} className="size-7 sm:size-9 lg:size-10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
