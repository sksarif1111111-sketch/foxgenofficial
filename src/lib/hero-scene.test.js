import { describe, expect, it } from "bun:test";
import { heroGroupCounts, pickHeroProducts, pickShowcaseProducts, shortProductName } from "./hero-scene";

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
  it("keeps the small universe diverse instead of filling it with AI plans", () => {
    const picked = pickHeroProducts([
      p("Gemini AI Pro"), p("ChatGPT Plus"), p("Claude Pro"), p("Grok Super"),
      p("Notion Plus"), p("Netflix Premium"), p("Canva Pro"), p("Lovable Pro"),
    ], 5);
    expect(picked.map((x) => x.name)).toEqual(["Gemini AI Pro", "Lovable Pro", "Notion Plus", "Netflix Premium", "Canva Pro"]);
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
  it("removes plan length and warranty tags from showcase names", () => {
    expect(shortProductName("Resend Pro 12m FW")).toBe("Resend Pro");
    expect(shortProductName("Notion Business 3m")).toBe("Notion Business");
    expect(shortProductName("Magic Patterns 12m NW")).toBe("Magic Patterns");
    expect(shortProductName("Capcut Pro 1 Month FW")).toBe("Capcut Pro");
    expect(shortProductName("YouTube Premium • 3 Months")).toBe("YouTube Premium");
    expect(shortProductName("Gro.k super 9-10 Days")).toBe("Gro.k super");
    expect(shortProductName("Windows 11+ 10 Pro")).toBe("Windows 11+ 10 Pro");
  });
});

describe("showcase rows", () => {
  it("only shows products that can be bought", () => {
    const picked = pickShowcaseProducts([p("Netflix 1 month", { purchasable: false }), p("Notion Plus 12M")], 10);
    expect(picked.map((x) => x.name)).toEqual(["Notion Plus 12M"]);
  });
  it("shows a product once even when it has several plan lengths", () => {
    const picked = pickShowcaseProducts([p("Notion Business 3m"), p("Notion Business 3 Months")], 10);
    expect(picked).toHaveLength(1);
  });
  it("puts products with an official logo first, then emoji, then the rest", () => {
    const picked = pickShowcaseProducts([p("Mystery Bundle"), p("Acme Kit", { emoji: "🎵" }), p("Netflix Premium 1 month")], 10);
    expect(picked.map((x) => x.name)).toEqual(["Netflix Premium 1 month", "Acme Kit", "Mystery Bundle"]);
  });
});
