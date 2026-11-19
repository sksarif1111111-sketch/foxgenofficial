import { describe, expect, it } from "bun:test";
import { animationCatalogue, fullAnimationCatalogue, catalogueWindow } from "./animation-catalogue";
import { SUPPLIED_ANIMATION_NAMES } from "../config/animation-products";
const product = (id, name, purchasable = true) => ({ id, name, purchasable, emoji: null, logo_url: null, featured: false });
describe("shared animation catalogue", () => {
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
});