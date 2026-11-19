import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { showcaseRows, type AnimationProduct } from "@/lib/animation-catalogue";
import { AnimationLogo } from "./animation-logo";
import { cleanProductText } from "@/lib/product-content";
import { heroGroupOf } from "@/lib/hero-scene";

const TILES = { ai: "bg-accent", dev: "bg-tint-violet", productivity: "bg-tint-green", ott: "bg-tint-rose", software: "bg-tint-amber" } as const;

function ShowcaseTile({ product }: { product: AnimationProduct }) {
  const content = <>
    <span className="showcase-logo"><AnimationLogo product={product} className="size-10 sm:size-12" /></span>
    <span className="showcase-name">{cleanProductText(product.name)}</span>
  </>;
  const className = `showcase-compact ${TILES[heroGroupOf(product.name)]}`;
  return product.liveProductId ? <Link to="/product/$productId" params={{ productId: product.liveProductId }} aria-label={`${product.name} details`} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

/** Native scrolling owns swipe/touch input; automatic scroll yields to pointer, focus and wheel. */
function Row({ items, reverse = false, speed = 20, row }: { items: AnimationProduct[]; reverse?: boolean; speed?: number; row: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false, active = false, until = 0, raf = 0, last = 0, position = el.scrollLeft;
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
        position = (position + (reverse ? -1 : 1) * dt * speed / 1000 + distance) % distance;
        el.scrollLeft = position;
      } else position = el.scrollLeft;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); el.removeEventListener("pointerenter", enter); el.removeEventListener("pointerleave", leave); el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); el.removeEventListener("wheel", pause); el.removeEventListener("touchstart", pause); el.removeEventListener("focusin", focus); el.removeEventListener("focusout", blur); };
  }, [items.length, reverse, speed]);
  return <div ref={ref} className="showcase-scroll no-scrollbar" data-direction={reverse ? "reverse" : "forward"} aria-label={`Sliding product showcase row ${row}`}>
    <div className="showcase-track">
      <div className="showcase-segment">{items.map(p => <ShowcaseTile key={p.id} product={p} />)}</div>
      <div aria-hidden="true" inert className="showcase-segment showcase-copy">{items.map(p => <ShowcaseTile key={p.id} product={p} />)}</div>
    </div>
  </div>;
}

export function ShowcaseMarquee({ products, loading }: { products: AnimationProduct[]; loading: boolean }) {
  if (loading) return <div className="space-y-3" aria-hidden="true">{Array.from({ length: 4 }, (_, row) => <div key={row} className="showcase-scroll flex gap-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="showcase-compact animate-pulse bg-muted" />)}</div>)}</div>;
  if (!products.length) return null;
  return <div className="space-y-3 sm:space-y-4" aria-label="Products in the store">{showcaseRows(products).map((config, row) => <Row key={row} row={row + 1} {...config} />)}</div>;
}
