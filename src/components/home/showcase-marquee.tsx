import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { showcaseName, showcaseRows, type AnimationProduct } from "@/lib/animation-catalogue";
import { AnimationLogo } from "./animation-logo";

/** Keeps the first product per short name so a row never repeats the same label. */
function uniqueByName(items: AnimationProduct[]) {
  const seen = new Set<string>();
  return items.filter(p => { const k = showcaseName(p.name).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Every row is its own colour series (gold, violet, cyan, emerald) on the dark stage. */
const SERIES = ["gold", "violet", "cyan", "emerald"] as const;

function ShowcaseTile({ product, tone }: { product: AnimationProduct; tone: (typeof SERIES)[number] }) {
  const content = <>
    <span className="showcase-chip-logo"><AnimationLogo product={product} className="size-6 sm:size-7" /></span>
    <span className="showcase-chip-name">{showcaseName(product.name)}</span>
  </>;
  return product.liveProductId
    ? <Link to="/product/$productId" params={{ productId: product.liveProductId }} aria-label={`${product.name} details`} className="showcase-chip" data-tone={tone}>{content}</Link>
    : <div className="showcase-chip" data-tone={tone}>{content}</div>;
}

/** Native scrolling owns swipe/touch input; automatic scroll yields to pointer, focus and wheel. */
function Row({ items, reverse = false, speed = 20, row }: { items: AnimationProduct[]; reverse?: boolean; speed?: number; row: number }) {
  const ref = useRef<HTMLDivElement>(null);
  items = uniqueByName(items);
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
      <div className="showcase-segment">{items.map(p => <ShowcaseTile key={p.id} product={p} tone={SERIES[(row - 1) % SERIES.length]!} />)}</div>
      <div aria-hidden="true" inert className="showcase-segment showcase-copy">{items.map(p => <ShowcaseTile key={p.id} product={p} tone={SERIES[(row - 1) % SERIES.length]!} />)}</div>
    </div>
  </div>;
}

export function ShowcaseMarquee({ products, loading }: { products: AnimationProduct[]; loading: boolean }) {
  if (loading) return <div className="showcase-stage" aria-hidden="true"><div className="showcase-rows">{Array.from({ length: 4 }, (_, row) => <div key={row} className="showcase-scroll flex gap-2.5">{Array.from({ length: 8 }, (_, i) => <div key={i} className="showcase-chip showcase-chip-skeleton animate-pulse" />)}</div>)}</div></div>;
  if (!products.length) return null;
  return <div className="showcase-stage" aria-label="Products in the store">
    <div className="showcase-rows">{showcaseRows(products).map((config, row) => <Row key={row} row={row + 1} {...config} />)}</div>
  </div>;
}
