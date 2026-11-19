import { type CSSProperties } from "react";
import { type HeroSceneProduct } from "@/lib/hero-scene";

export const ORBIT_SECONDS = 46;

export { AnimationLogo as LogoMark } from "../animation-logo";
import { AnimationLogo as LogoMark } from "../animation-logo";

/**
 * One app tile on the orbit ring. Layers: place on the ring → cancel the ring spin and tilt so the
 * tile always faces the viewer → dim while passing behind → entrance → gentle bob → tile.
 * Every second tile is hidden on phones, which keeps the rest evenly spaced. The product name
 * shows on the showcase card; ring tiles carry the logo only so passing tiles never overlap text.
 */
export function FloatingProductTile({ product, index, total, seconds = ORBIT_SECONDS }: { product: HeroSceneProduct; index: number; total: number; seconds?: number }) {
  const angle = (360 / total) * index;
  const style = {
    ["--a" as string]: `${angle}deg`,
    ["--fade-delay" as string]: `${-(angle / 360) * seconds}s`,
    ["--dur" as string]: `${8 + (index % 4) * 1.3}s`,
    ["--delay" as string]: `${-index * 1.7}s`,
    ["--amp" as string]: "8px",
    ["--rot" as string]: "2deg",
    ["--enter-delay" as string]: `${900 + index * 90}ms`,
    ["--from-z" as string]: "-160px",
  } as CSSProperties;
  return (
    <div className="hm-orbit-slot" style={style}>
      <div className="hm-orbit-counter hm-anim">
        <div className="hm-orbit-untilt">
          <div className="hm-orbit-fade hm-anim">
            <div className="hm-orbit-face">
              <div className="hm-enter hm-anim">
                <div className="hm-idle hm-anim relative">
                  <div className="hm-tile hm-orbit-tile">
                    <LogoMark product={product} className="hm-orbit-logo" />
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
