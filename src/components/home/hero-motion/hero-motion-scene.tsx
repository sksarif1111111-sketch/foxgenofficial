import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HERO_GROUPS, heroGroupCounts, heroGroupOf, pickHeroProducts, shortProductName, type HeroSceneProduct } from "@/lib/hero-scene";
import { GlassPlatform } from "./glass-platform";
import { FloatingProductTile, LogoMark } from "./floating-product-tile";
import { FloatingCategoryCard } from "./floating-category-card";
import { CATEGORY_SLOTS, TILE_SLOTS } from "./slots";

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
  const tiles = useMemo(() => pickHeroProducts(products, TILE_SLOTS.length + 5), [products]);
  const groups = useMemo(() => heroGroupCounts(products), [products]);
  // The first few picks rotate slowly on the showcase card; the rest float as tiles.
  const featured = tiles.slice(0, children ? 0 : Math.min(5, Math.max(1, tiles.length - TILE_SLOTS.length)));
  const floating = tiles.slice(featured.length, featured.length + TILE_SLOTS.length);
  const [index, setIndex] = useState(0);

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
      if (rootRef.current?.dataset.paused !== undefined) return;
      setIndex((i) => (i + 1) % featured.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [featured.length]);

  const current = featured.length > 0 ? featured[index % featured.length] : null;
  const groupLabel = (p: HeroSceneProduct) => HERO_GROUPS.find((g) => g.id === heroGroupOf(p.name))?.label;

  return (
    <div ref={rootRef} className={`hm-root mx-auto w-full max-w-[640px] lg:max-w-none ${children ? "py-10 lg:py-16" : "h-[320px] sm:h-[420px] lg:h-[560px]"}`}>
      <div aria-hidden="true" className={children ? "absolute inset-x-[-8%] inset-y-0 hidden lg:block" : "absolute inset-0"}>
        <div className="hm-backdrop" />
        <div className="hm-stage">
          <div className="hm-world">
            <GlassPlatform />
            {floating.map((p, i) => (children && TILE_SLOTS[i]!.tier === "front" && i === 2 ? null : <FloatingProductTile key={p.id} product={p} slot={TILE_SLOTS[i]!} />))}
            {groups.slice(0, CATEGORY_SLOTS.length).map((g, i) => (
              <FloatingCategoryCard key={g.id} id={g.id} label={g.label} count={g.count} slot={CATEGORY_SLOTS[i]!} />
            ))}

            {!children && (
              <div className="hm-slot" style={{ left: "50%", top: "41%", ["--z" as string]: "60px", ["--dur" as string]: "12s", ["--delay" as string]: "-2s", ["--amp" as string]: "6px", ["--rot" as string]: "1deg", ["--enter-delay" as string]: "800ms", ["--enter-dur" as string]: "1200ms", ["--from-y" as string]: "60px", ["--from-z" as string]: "-60px" }}>
                <div className="hm-enter hm-anim">
                  <div className="hm-shadow hm-anim" style={{ ["--shadow-gap" as string]: "26px" }} />
                  <div className="hm-idle hm-anim">
                    <div className="hm-glass w-[196px] rounded-2xl p-3 sm:w-[236px] sm:rounded-3xl sm:p-4">
                      {current ? (
                        <div key={current.id} className="hm-swap flex items-center gap-3">
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-studio-silver bg-card sm:size-14">
                            <LogoMark product={current} className="size-7 sm:size-8" />
                          </span>
                          <span className="min-w-0">
                            <span className="caption-5 block text-studio-muted">{groupLabel(current)}</span>
                            <span className="title-4 block truncate text-studio-ink sm:title-3">{shortProductName(current.name)}</span>
                            <span className="caption-4 mt-1 inline-flex items-center gap-1.5 text-success">
                              <span className="size-1.5 rounded-full bg-current" /> In stock
                            </span>
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
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}
