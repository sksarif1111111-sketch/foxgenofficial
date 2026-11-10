import { categoryOf, type StoreCategoryId } from "./store-categories";

/**
 * Pure rules for the homepage hero 3D scene. The scene only ever shows real catalogue
 * products that can be bought right now; nothing here invents products, prices or stock.
 */
export type HeroSceneProduct = {
  id: string;
  name: string;
  emoji: string | null;
  logo_url: string | null;
  purchasable: boolean;
  featured: boolean;
};

export type HeroGroupId = "ai" | "dev" | "productivity" | "ott" | "software";

export const HERO_GROUPS: Array<{ id: HeroGroupId; label: string; cats: StoreCategoryId[] }> = [
  { id: "ai", label: "AI Tools", cats: ["ai"] },
  { id: "dev", label: "Developer Tools", cats: ["build"] },
  { id: "productivity", label: "Productivity Tools", cats: ["office"] },
  { id: "ott", label: "OTT Platforms", cats: ["entertainment"] },
  { id: "software", label: "Premium Software", cats: ["creative", "learning", "security", "more"] },
];

export function heroGroupOf(name: string): HeroGroupId {
  const cat = categoryOf(name);
  return HERO_GROUPS.find((g) => g.cats.includes(cat))?.id ?? "software";
}

/** "Granola Business 12m NW" → "Granola Business"; keeps names readable on small tiles. */
export function shortProductName(name: string): string {
  const cleaned = name
    .replace(/\p{Extended_Pictographic}/gu, "")
    .split(/\s[–—|(]|\s-\s|\s•\s/)[0]!
    .replace(/\b\d+\s*(m|months?|yrs?|years?|days?|d)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name.trim();
}

/** Brand key used to avoid showing the same brand twice (e.g. two Mobbin plans). */
function brandKey(p: HeroSceneProduct) {
  return (p.logo_url ?? shortProductName(p.name).split(" ")[0] ?? p.name).toLowerCase();
}

/**
 * Picks the products for the floating tiles: purchasable only, one per brand, real logos first,
 * AI tools first (the hero's main focus), featured before the rest. Order is stable.
 */
export function pickHeroProducts<T extends HeroSceneProduct>(products: T[], count: number): T[] {
  const seen = new Set<string>();
  const rank = (p: T) => (p.logo_url ? 0 : 4) + (heroGroupOf(p.name) === "ai" ? 0 : 2) + (p.featured ? 0 : 1);
  return products
    .filter((p) => p.purchasable)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map(({ p }) => p)
    .filter((p) => {
      const key = brandKey(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count);
}

/** Category cards with the real number of products in stock; empty groups are left out. */
export function heroGroupCounts(products: HeroSceneProduct[]) {
  return HERO_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    count: products.filter((p) => p.purchasable && heroGroupOf(p.name) === g.id).length,
  })).filter((g) => g.count > 0);
}
