import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import type { AnimationProduct } from "@/lib/animation-catalogue";
import { AnimationLogo } from "./animation-logo";
import { cleanProductText } from "@/lib/product-content";

const TILES = ["bg-card", "bg-accent", "bg-muted"] as const;

function ShowcaseTile({ product, index }: { product: AnimationProduct; index: number }) {
  const content = <>
    <span className="showcase-logo"><AnimationLogo product={product} className="size-7 sm:size-9" /></span>
    <span className="showcase-name">{cleanProductText(product.name)}</span>
  </>;
  const className = `showcase-compact ${TILES[index % TILES.length] ?? "bg-card"}`;
  return product.liveProductId ? <Link to="/product/$productId" params={{ productId: product.liveProductId }} aria-label={`${product.name} details`} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

/** Native scrolling owns swipe/touch input; automatic scroll yields to pointer, focus and wheel. */
function Row({ items, reverse = false }: { items: AnimationProduct[]; reverse?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false, active = false, until = 0, raf = 0, last = 0;
    const observer = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; }, { rootMargin: "100px" });
    observer.observe(el);
    const pause = () => { until = performance.now() + 3500; };
    const enter = () => { active = true; };
    const leave = () => { active = false; pause(); };
    const down = () => { active = true; pause(); };
    const up = () => { active = false; pause(); };
    const focus = () => { active = true; };
    const blur = () => { active = false; pause(); };
    el.addEventListener("pointerenter", enter); el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down); window.addEventListener("pointerup", up);
    el.addEventListener("wheel", pause, { passive: true }); el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("focusin", focus); el.addEventListener("focusout", blur);
    const loop = (now: number) => {
      const dt = Math.min(now - last, 50); last = now;
      const segment = el.querySelector<HTMLElement>(".showcase-segment");
      const distance = segment?.getBoundingClientRect().width ?? 0;
      if (visible && !document.hidden && !reduce.matches && !active && now > until && distance > el.clientWidth) {
        el.scrollLeft += (reverse ? -1 : 1) * dt * 0.018;
        if (el.scrollLeft >= distance) el.scrollLeft -= distance;
        if (el.scrollLeft <= 0 && reverse) el.scrollLeft = distance;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); el.removeEventListener("pointerenter", enter); el.removeEventListener("pointerleave", leave); el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); el.removeEventListener("wheel", pause); el.removeEventListener("touchstart", pause); el.removeEventListener("focusin", focus); el.removeEventListener("focusout", blur); };
  }, [items.length, reverse]);
  return <div ref={ref} className="showcase-scroll no-scrollbar" aria-label="Sliding product showcase">
    <div className="showcase-track">
      <div className="showcase-segment">{items.map((p, i) => <ShowcaseTile key={p.id} product={p} index={i} />)}</div>
      <div aria-hidden="true" inert className="showcase-segment showcase-copy">{items.map((p, i) => <ShowcaseTile key={p.id} product={p} index={i} />)}</div>
    </div>
  </div>;
}

export function ShowcaseMarquee({ products, loading }: { products: AnimationProduct[]; loading: boolean }) {
  if (loading) return <div className="showcase-scroll flex gap-2" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="showcase-compact animate-pulse bg-muted" />)}</div>;
  if (!products.length) return null;
  return <div className="space-y-3" aria-label="Products in the store"><Row items={products.filter((_, i) => i % 2 === 0)} /><Row items={products.filter((_, i) => i % 2 === 1)} reverse /></div>;
}
