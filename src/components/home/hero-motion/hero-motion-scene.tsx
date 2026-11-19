import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HERO_GROUPS, heroGroupOf, type HeroSceneProduct } from "@/lib/hero-scene";
import { GlassPlatform } from "./glass-platform";
import { FloatingProductTile, LogoMark, ORBIT_SECONDS } from "./floating-product-tile";
import { fullAnimationCatalogue, catalogueWindow, liveFeaturedProducts } from "@/lib/animation-catalogue";
import { cleanProductText } from "@/lib/product-content";

const CYCLE_MS = 6500;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Decorative white studio 3D scene for the homepage hero. Pure CSS 3D (no WebGL), real catalogue
 * products only, never covers content (pointer events off, aria hidden). Pauses off screen, goes
 * static under reduced motion or on low power devices, and tilts slightly with a desktop mouse.
 * Pass children (e.g. the festive offer card) to stand them on the platform instead of the showcase.
 */
export function HeroMotionScene<T extends HeroSceneProduct>({ products, loading, children }: { products: T[]; loading: boolean; children?: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const catalogue = useMemo(() => fullAnimationCatalogue(products), [products]);
  const [index, setIndex] = useState(0);
  const [ringIndex, setRingIndex] = useState(0);
  const featured = useMemo(() => liveFeaturedProducts(products), [products]);
  const floating = catalogueWindow(catalogue, ringIndex, 6);
  const inner = catalogueWindow(catalogue, ringIndex + 6, Math.max(0, Math.min(3, catalogue.length - 6)));

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

  // Slowly rotate the showcase through the featured products while the hero is on screen.
  useEffect(() => {
    if (featured.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (rootRef.current?.dataset.paused !== undefined || rootRef.current?.dataset.lite !== undefined || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setIndex((i) => (i + 1) % featured.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [featured.length]);

  useEffect(() => {
    if (catalogue.length < 2) return;
    const timer = window.setInterval(() => {
      if (rootRef.current?.dataset.paused !== undefined || rootRef.current?.dataset.lite !== undefined || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setRingIndex(i => (i + 9) % catalogue.length);
    }, 16000);
    return () => window.clearInterval(timer);
  }, [catalogue.length]);

  const current = featured.length > 0 ? featured[index % featured.length] : null;
  const groupLabel = (p: HeroSceneProduct) => HERO_GROUPS.find((g) => g.id === heroGroupOf(p.name))?.label;

  return (
    <div ref={rootRef} className={`hm-root hm-restored mx-auto w-full max-w-[640px] lg:max-w-none ${children ? "hm-with-offer" : ""}`}>
      <div aria-hidden="true" className="absolute inset-0">
        <div className="hm-backdrop" />
        <div className="hm-stage">
          <div className="hm-world">
            <GlassPlatform />
            {floating.length > 0 && (
              <div className="hm-orbit" style={{ ["--orbit-dur" as string]: `${ORBIT_SECONDS}s` }}>
                <div className="hm-orbit-spin hm-anim">
                  {floating.map((p, i) => <FloatingProductTile key={`outer-${i}`} product={p} index={i} total={floating.length} />)}
                </div>
              </div>
            )}
            {inner.length > 0 && <div className="hm-orbit hm-orbit-inner" style={{ ["--orbit-dur" as string]: "63s" }}><div className="hm-orbit-spin hm-anim">{inner.map((p, i) => <FloatingProductTile key={`inner-${i}`} product={p} index={i} total={inner.length} seconds={63} />)}</div></div>}

            {!children && (current || loading) && (
              <div className="hm-slot" style={{ left: "50%", top: "30%", ["--z" as string]: "0px", ["--dur" as string]: "12s", ["--delay" as string]: "-2s", ["--amp" as string]: "6px", ["--rot" as string]: "1deg", ["--enter-delay" as string]: "800ms", ["--enter-dur" as string]: "1200ms", ["--from-y" as string]: "60px", ["--from-z" as string]: "-60px" }}>
                <div className="hm-enter hm-anim">
                  <div className="hm-shadow hm-anim" style={{ ["--shadow-gap" as string]: "26px" }} />
                  <div className="hm-idle hm-anim">
                    <div className="hm-glass hm-featured">
                      {current ? (
                        <div key={current.id} data-featured-product={current.id} className={`hm-swap ${featured.length > 1 ? "hm-featured-cycle" : ""} hm-anim flex items-center gap-2 sm:gap-3`}>
                          <span className="hm-featured-logo">
                            <LogoMark product={current} className="size-9 sm:size-12" />
                          </span>
                          <span className="min-w-0">
                            <span className="caption-5 block text-studio-muted">{groupLabel(current)}</span>
                            <span className="hm-featured-name block text-studio-ink">{cleanProductText(current.name)}</span>
                            <span className="caption-5 mt-1 block text-success sm:caption-4">{current.stock_label}</span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className={`size-12 shrink-0 rounded-2xl bg-studio-grey sm:size-14 ${loading ? "animate-pulse" : ""}`} />
                          <span className="flex-1 space-y-2">
                            <span className={`block h-2.5 w-16 rounded bg-studio-grey ${loading ? "animate-pulse" : ""}`} />
                            <span className={`block h-3.5 w-28 rounded bg-studio-grey ${loading ? "animate-pulse" : ""}`} />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {children && <div className="relative z-10 mx-auto max-w-[460px]">{children}</div>}
    </div>
  );
}
