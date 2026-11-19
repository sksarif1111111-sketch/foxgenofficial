import { describe, expect, it } from "bun:test";
import { animationCatalogue, fullAnimationCatalogue, catalogueWindow, liveFeaturedProducts, showcaseName, showcaseRows } from "./animation-catalogue";
import { SUPPLIED_ANIMATION_NAMES } from "../config/animation-products";
const product = (id, name, purchasable = true) => ({ id, name, purchasable, emoji: null, logo_url: null, featured: false });
describe("shared animation catalogue", () => {
  it("distributes every supplied variant into exactly four independent alternating rows", () => {
    const rows = showcaseRows(SUPPLIED_ANIMATION_NAMES);
    expect(rows).toHaveLength(4);
    expect(rows.map(r => r.reverse)).toEqual([false, true, false, true]);
    expect(new Set(rows.map(r => r.speed)).size).toBe(4);
    expect(rows.flatMap(r => r.items).sort()).toEqual([...SUPPLIED_ANIMATION_NAMES].sort());
  });
  it("features only verified quantities greater than zero, not manual or unknown stock", () => {
    const stock = (id, label, purchasable = true, availability = "in_stock") => ({ ...product(id, "Gemini", purchasable), stock_label: label, availability });
    expect(liveFeaturedProducts([stock("positive", "In stock — 5 available"), stock("zero", "In stock — 0 available"), stock("manual", "In stock"), stock("unknown", undefined), stock("negative", "In stock — -1 available")]).map(p => p.id)).toEqual(["positive"]);
  });
  it("excludes unavailable and archived products even with a stale positive stock label", () => {
    const positive = { ...product("live", "Gemini"), availability: "in_stock", stock_label: "In stock — 1 available" };
    expect(liveFeaturedProducts([positive, { ...positive, id: "archived", purchasable: false }, { ...positive, id: "sold", availability: "out_of_stock" }, { ...positive, id: "soon", availability: "coming_soon" }]).map(p => p.id)).toEqual(["live"]);
  });
  it("removes a featured product when refreshed stock reaches zero", () => {
    const p = { ...product("live", "Gemini"), availability: "in_stock", stock_label: "In stock — 1 available" };
    expect(liveFeaturedProducts([p])).toHaveLength(1);
    expect(liveFeaturedProducts([{ ...p, stock_label: "In stock — 0 available" }])).toHaveLength(0);
  });
  it("includes every supplied exact entry and does not invent live stock or checkout links", () => {
    const items = fullAnimationCatalogue([product("real", "Gemini AI Pro — 18 Months")]);
    expect(SUPPLIED_ANIMATION_NAMES).toHaveLength(142);
    expect(new Set(items.map(p => p.name))).toEqual(new Set(SUPPLIED_ANIMATION_NAMES));
    expect(items.filter(p => p.stockReliable).map(p => p.liveProductId)).toEqual(["real"]);
    expect(items.find(p => p.name === "Nord VPN — 3-Month Accounts").liveProductId).toBeUndefined();
  });
  it("preserves separate plans and exact names instead of merging brands", () => {
    const variants = [product("one", "Notion Business 3m FW"), product("two", "Notion Business 12m NW")];
    expect(animationCatalogue(variants)).toEqual(variants);
  });
  it("gives all 142 distinct entries a turn in bounded windows", () => {
    const catalogue = animationCatalogue(Array.from({ length: 142 }, (_, i) => product(String(i), `Software plan ${i}`)));
    const seen = new Set();
    for (let i = 0; i < 142; i++) catalogueWindow(catalogue, i, 12).forEach(p => seen.add(p.id));
    expect(seen.size).toBe(142);
    expect(catalogueWindow(catalogue, 141, 12)).toHaveLength(12);
  });
  it("excludes unavailable products and repeats neither IDs nor short-catalogue window entries", () => {
    const items = animationCatalogue([product("a", "Gemini"), product("a", "Gemini"), product("b", "Netflix", false)]);
    expect(items.map(p => p.id)).toEqual(["a"]);
    expect(catalogueWindow(items, 20, 12)).toHaveLength(1);
  });
  it("shows only the product's own name: no plan, duration or variant wording", () => {
    expect(showcaseName("Gemini AI Pro — 18 Months")).toBe("Gemini AI");
    expect(showcaseName("Gemini 18 Months Redeem Link 12HW")).toBe("Gemini");
    expect(showcaseName("Google AI Pro — 12 Months")).toBe("Google AI");
    expect(showcaseName("Outlook Mail")).toBe("Outlook");
    expect(showcaseName("Lovable Pro Lite — 12 Months")).toBe("Lovable");
    expect(showcaseName("Windows 10/11 Pro — 1 PC Retail Key (Lifetime)")).toBe("Windows 10/11");
    expect(showcaseName("KEY HMA AND/PC — 20–30 Days")).toBe("HMA");
    expect(showcaseName("Eleven Reader Ultra Plan — 12 Months")).toBe("Eleven Reader");
  });
  it("keeps every supplied showcase label free of plan and duration words", () => {
    const noise = /\b(pro|lite|plus|premium|business|team|edu|starter|standard|max|ultra|creator|basic|hobby|scale|build|core|advanced|essential|personal|enterprise|org|panel|redeem|link|coupon|account|slot|seat|credit|warranty|month|months|year|years|day|days|plan|offer|key|pack)\b/i;
    for (const name of SUPPLIED_ANIMATION_NAMES) {
      const label = showcaseName(name);
      expect(label.length).toBeGreaterThan(0);
      expect(noise.test(label)).toBe(false);
    }
  });
});