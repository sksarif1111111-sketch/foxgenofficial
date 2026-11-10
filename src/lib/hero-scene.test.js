import { describe, expect, it } from "bun:test";
import { heroGroupCounts, pickHeroProducts, shortProductName } from "./hero-scene";

const p = (name, extra = {}) => ({ id: name, name, emoji: null, logo_url: null, purchasable: true, featured: false, ...extra });

describe("hero scene products", () => {
  it("never shows products that cannot be bought", () => {
    const picked = pickHeroProducts([p("Netflix Admin 1 month", { purchasable: false }), p("Gemini AI Pro")], 5);
    expect(picked.map((x) => x.name)).toEqual(["Gemini AI Pro"]);
  });
  it("shows each brand once", () => {
    const logo = "https://example.com/mobbin.png";
    const picked = pickHeroProducts([p("Mobbin Pro 12m", { logo_url: logo }), p("Mobbin Team 12m", { logo_url: logo })], 5);
    expect(picked).toHaveLength(1);
  });
  it("puts AI tools with real logos first", () => {
    const picked = pickHeroProducts([p("Notion Plus 12M", { logo_url: "n" }), p("Windows 11 Pro"), p("Gemini AI Pro", { logo_url: "g" })], 3);
    expect(picked.map((x) => x.name)).toEqual(["Gemini AI Pro", "Notion Plus 12M", "Windows 11 Pro"]);
  });
  it("counts only in stock products per category and hides empty ones", () => {
    const groups = heroGroupCounts([p("Gemini AI Pro"), p("ChatGPT Plus"), p("Netflix 1 month", { purchasable: false })]);
    expect(groups).toEqual([{ id: "ai", label: "AI Tools", count: 2 }]);
  });
  it("shortens plan names for small tiles", () => {
    expect(shortProductName("Granola Business 12m NW")).toBe("Granola Business");
    expect(shortProductName("Gemini AI Pro — 18 Months")).toBe("Gemini AI Pro");
    expect(shortProductName("👋Duolingo Super – 12 Months | Activation Link")).toBe("Duolingo Super");
  });
});
