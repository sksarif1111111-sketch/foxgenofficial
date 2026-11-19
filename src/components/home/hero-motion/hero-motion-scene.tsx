import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { pickHeroProducts, type HeroSceneProduct } from "@/lib/hero-scene";
import { GlassPlatform } from "./glass-platform";
import { FloatingProductTile } from "./floating-product-tile";

const UNIVERSE_TILES = 20;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Decorative white studio 3D scene for the homepage hero. Pure CSS 3D (no WebGL), real catalogue
 * products only, never covers content (pointer events off, aria hidden). Pauses off screen, goes
 * static under reduced motion or on low power devices, and tilts slightly with a desktop mouse.
 * Pass children (e.g. the festive offer card) to stand them on the platform instead of the showcase.
 */
export function HeroMotionScene<T extends HeroSceneProduct>({ products, loading, children }: { products: T[]; loading: boolean; children?: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => pickHeroProducts(products, UNIVERSE_TILES), [products]);

  // Visibility pause, low power mode and desktop mouse parallax. Writes CSS variables only (no React state per frame).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const lite = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData === true;
    if (lite) root.dataset.lite = "";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)");
    let inView = true;
    const setPaused = () => {
      if (!inView || document.hidden) root.dataset.paused = "";
      else delete root.dataset.paused;
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      setPaused();
    }, { rootMargin: "120px" });
    io.observe(root);
    document.addEventListener("visibilitychange", setPaused);

    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      root.style.setProperty("--hm-px", cx.toFixed(4));
      root.style.setProperty("--hm-py", cy.toFixed(4));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !fine.matches || reduce.matches || lite || !inView) return;
      const r = root.getBoundingClientRect();
      tx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
      ty = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", setPaused);
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="hm-root hm-universe mx-auto w-full max-w-[640px] lg:max-w-none">
      <div aria-hidden="true" className="hm-universe-art absolute inset-0">
        <div className="hm-backdrop" />
        <div className="hm-platform-layer"><GlassPlatform /></div>
        {tiles.map((product, i) => (
          <FloatingProductTile key={product.id} product={product} index={i} total={tiles.length} />
        ))}
        {loading && tiles.length === 0 && Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="hm-universe-placeholder bg-muted animate-pulse" />
        ))}
      </div>
      {children && <div className="hm-universe-offer relative z-10 mx-auto max-w-[460px]">{children}</div>}
    </div>
  );
}
