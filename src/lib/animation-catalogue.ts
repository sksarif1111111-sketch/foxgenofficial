import { heroGroupOf, type HeroSceneProduct } from "./hero-scene";
import { SUPPLIED_ANIMATION_NAMES } from "@/config/animation-products";

export type AnimationProduct = HeroSceneProduct & { liveProductId?: string; stockReliable?: boolean; animationCategory?: string };

export function showcaseRows<T>(products: T[]) {
  return [20, 24, 18, 22].map((speed, row) => ({ speed, reverse: row % 2 === 1, items: products.filter((_, i) => i % 4 === row) }));
}

/** Only the catalogue's tracked-stock label verifies a positive quantity; manual availability is not a count. */
export function liveFeaturedProducts<T extends HeroSceneProduct>(products: T[]): T[] {
  return animationCatalogue(products).filter(p => {
    const quantity = /^In stock — (\d+) available$/.exec(p.stock_label ?? "")?.[1];
    return p.availability === "in_stock" && quantity !== undefined && Number(quantity) > 0;
  });
}

/** Supplied names are a decorative showcase, never store listings or inventory. Exact matches only. */
export function fullAnimationCatalogue(products: HeroSceneProduct[]): AnimationProduct[] {
  const live = animationCatalogue(products);
  const claimed = new Set<string>();
  const names = SUPPLIED_ANIMATION_NAMES.map((name, i): AnimationProduct => {
    const match = live.find(p => p.name === name);
    if (match) claimed.add(match.id);
    const animationCategory = i < 51 ? "AI & Developer Tools" : i < 86 ? "Design, Video & Audio" : i < 119 ? "Productivity & Collaboration" : i < 134 ? "Entertainment & Media" : i < 137 ? "Education & Learning" : "VPN & Security";
    return { id: `showcase-${i + 1}`, name, emoji: null, logo_url: match?.logo_url ?? null, featured: match?.featured ?? false, purchasable: match?.purchasable ?? false, liveProductId: match?.id, stockReliable: Boolean(match), animationCategory };
  });
  const groups = [...new Set(names.map(p => p.animationCategory))].map(category => names.filter(p => p.animationCategory === category));
  const balanced: AnimationProduct[] = [];
  while (groups.some(group => group.length)) for (const group of groups) { const next = group.shift(); if (next) balanced.push(next); }
  return [...balanced, ...live.filter(p => !claimed.has(p.id)).map(p => ({ ...p, liveProductId: p.id, stockReliable: true }))];
}

/** Shared catalogue order, independent animation clocks; IDs (not brands/names) identify variants. */
export function animationCatalogue<T extends HeroSceneProduct>(products: T[]): T[] {
  const seen = new Set<string>();
  const queues = ["ai", "dev", "productivity", "ott", "software"].map(group => products.filter(p => p.purchasable && heroGroupOf(p.name) === group));
  const result: T[] = [];
  while (queues.some(q => q.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && !seen.has(next.id)) { seen.add(next.id); result.push(next); }
    }
  }
  return result;
}

export function catalogueWindow<T>(catalogue: T[], offset: number, size: number): T[] {
  if (!catalogue.length) return [];
  return Array.from({ length: Math.min(size, catalogue.length) }, (_, i) => catalogue[(offset + i) % catalogue.length]).filter((p): p is T => p !== undefined);
}