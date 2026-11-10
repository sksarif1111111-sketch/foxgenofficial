import { describe, expect, it } from "bun:test";
import { brandLogoFor, resolveProductLogo } from "./brand-logos";

describe("official product logos", () => {
  it("finds the brand logo from a product name with no logo set", () => {
    expect(resolveProductLogo("Netflix Admin 5 Profile Premium 4K UHD 1 month", null)).toBe("https://cdn.simpleicons.org/netflix");
    expect(resolveProductLogo("API CODEX-10M Token-1Day", null)).toContain("openai.com");
    expect(resolveProductLogo("Gro.k super 9-10 Days", null)).toContain("grok.com");
  });
  it("uses the brand named first when a name mentions two brands", () => {
    expect(brandLogoFor("Coursera Premium Org + Gemini 3M")).toContain("coursera.org");
  });
  it("keeps a custom logo set in Admin", () => {
    expect(resolveProductLogo("Notion Plus", "/foxgen-logo.png")).toBe("/foxgen-logo.png");
  });
  it("upgrades an old small site icon for unknown brands", () => {
    expect(resolveProductLogo("Acme Pro", "https://www.google.com/s2/favicons?sz=128&domain=acme.com")).toBe("https://www.google.com/s2/favicons?sz=256&domain=acme.com");
  });
  it("returns nothing for an unknown brand without a logo", () => {
    expect(resolveProductLogo("Mystery Bundle", null)).toBeNull();
  });
});
