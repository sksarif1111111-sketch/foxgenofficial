import { useState, type CSSProperties } from "react";
import { shortProductName, type HeroSceneProduct } from "@/lib/hero-scene";
import { resolveProductLogo } from "@/lib/brand-logos";

export const ORBIT_SECONDS = 46;

/** Official brand logo when the brand is known; otherwise the product emoji or first letter. */
export function LogoMark({ product, className }: { product: HeroSceneProduct; className: string }) {
  const [broken, setBroken] = useState(false);
  const src = resolveProductLogo(product.name, product.logo_url);
  if (src && !broken) {
    return <img src={src} alt="" loading="lazy" decoding="async" width={44} height={44} className={`${className} rounded-lg object-contain`} onError={() => setBroken(true)} />;
  }
  if (product.emoji) return <span className="text-2xl leading-none">{product.emoji}</span>;
  return <span className="text-xl font-semibold leading-none text-studio-ink">{shortProductName(product.name).charAt(0).toUpperCase()}</span>;
}

/** Two compact elliptical layers, bounded inside the actual scene rather than a fixed pixel orbit. */
export function FloatingProductTile({ product, index, total }: { product: HeroSceneProduct; index: number; total: number }) {
  const outerCount = Math.min(12, total);
  const outer = index < outerCount;
  const count = outer ? outerCount : total - outerCount;
  const slot = outer ? index : index - outerCount;
  const angle = (slot / count) * Math.PI * 2 - Math.PI / 2 + (outer ? 0 : 0.18);
  const style = {
    "--tile-x": `${50 + Math.cos(angle) * (outer ? 40 : 23)}%`,
    "--tile-y": `${46 + Math.sin(angle) * (outer ? 34 : 18)}%`,
    "--tile-turn": `${(index % 5 - 2) * 3}deg`,
    "--dur": `${14 + index % 5 * 2}s`,
    "--delay": `${-index * 2.3}s`,
  } as CSSProperties;
  return (
    <div className={`hm-universe-slot ${outer ? "is-outer" : "is-inner"}`} style={style}>
      <div className="hm-universe-drift hm-anim">
        <div className="hm-universe-tile" title={shortProductName(product.name)}>
          <LogoMark product={product} className="hm-universe-logo" />
        </div>
        <span className="hm-universe-name">{shortProductName(product.name)}</span>
      </div>
    </div>
  );
}
