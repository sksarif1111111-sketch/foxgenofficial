import { heroGroupOf, type HeroSceneProduct } from "./hero-scene";
import { cleanProductText } from "./product-content";
import { SUPPLIED_ANIMATION_NAMES } from "@/config/animation-products";

export type AnimationProduct = HeroSceneProduct & { liveProductId?: string; stockReliable?: boolean; animationCategory?: string };

/**
 * Display-only brand label for the moving showcase and the orbit's featured card: logo + product
 * name only. Plan, duration, seat, credit, warranty and redemption wording is never shown, and the
 * original catalogue name is never rewritten.
 */
const SHOWCASE_NOISE = new Set([
  "pro", "lite", "plus", "business", "team", "edu", "standard", "starter", "max", "ultra", "creator", "premium",
  "basic", "hobby", "scale", "build", "core", "advanced", "essential", "essentials", "personal", "enterprise",
  "org", "e3", "invite", "invites", "panel", "redeem", "link", "links", "code", "coupon", "coupons", "account",
  "accounts", "slot", "slots", "seat", "seats", "user", "users", "credit", "credits", "token", "tokens",
  "warranty", "full", "nw", "fw", "on", "mail", "ready", "private", "new", "old", "advance", "admin", "plan",
  "plans", "offer", "offers", "all", "key", "keys", "pack", "lifetime", "available", "month", "months", "year",
  "years", "day", "days", "week", "weeks", "pc", "retail", "autopay", "discount", "renewal", "workspace",
  "career", "transactional", "and",
]);

export function showcaseName(name: string): string {
  let text = cleanProductText(name);
  // Keep only the leading identity: drop everything after a dash separator, bracket, slash (unless
  // it joins digits like "10/11") or a "+".
  for (const cut of [/\s+[—–]\s+/, /\s*\(/, /\/(?!\d)/, /\s+\+\s+/]) text = text.split(cut)[0] ?? "";
  text = text
    .replace(/\$\d[\d,]*/g, " ")
    .replace(/\b\d+[–—-][\d,]+\b/g, " ")
    .replace(/\b\d+\s*[–—-]?\s*(?:days?|months?|years?|weeks?)\b/gi, " ")
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirty)\s+(?:year|month|day|week)s?\b/gi, " ")
    .replace(/\b\d+[kmwy]\b/gi, " ")
    .replace(/\b\d+[A-Z]{2,}\b/g, " ")
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, " ");
  const words = text.split(/\s+/).filter((w) => w && /[A-Za-z0-9]/.test(w) && !SHOWCASE_NOISE.has(w.toLowerCase()) && !/^all[-\s]?in[-\s]?one$/i.test(w));
  return words.join(" ").trim() || cleanProductText(name).split(/\s+/)[0]!;
}

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