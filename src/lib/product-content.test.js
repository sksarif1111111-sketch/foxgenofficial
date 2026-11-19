import { describe, expect, it } from "bun:test";
import { cleanProductText, productSections, deliveryMethodLabel } from "./product-content";

describe("product documentation", () => {
  it("cleans emoji numbering without losing numbers, currencies or the original meaning", () => {
    expect(cleanProductText("✅ Access for ₹150\n1️⃣ Sign in\n2️⃣ Activate your account 🎉")).toBe("Access for ₹150\n1. Sign in\n2. Activate your account");
  });
  it("routes only explicit headings and preserves coverage and steps", () => {
    const sections = productSections({ description: "Premium plan\nHow It Works:\nUse your own account.\nWarranty & Support:\n30 days\nWhat is not covered:\nAccount sharing", installation_instructions: "1️⃣ Sign in\n2️⃣ Enter the key" });
    expect(sections.map(s => s.id)).toEqual(["overview", "how", "activation", "warranty"]);
    expect(sections.find(s => s.id === "warranty").text).toContain("Account sharing");
    expect(sections.find(s => s.id === "activation").text).toContain("2. Enter the key");
  });
  it("does not manufacture empty warranty, usage or activation sections", () => {
    expect(productSections({ description: "Overview:\nPremium plan\nWarranty:" }).map(s => s.id)).toEqual(["overview"]);
    expect(productSections({})).toEqual([]);
  });
  it("renders the stored warranty label exactly without inventing coverage", () => {
    expect(productSections({ warranty_label: "30 days replacement" })).toEqual([{ id: "warranty", title: "Warranty & support", text: "## Warranty duration\n30 days replacement" }]);
  });
  it("does not infer a warranty from casual prose or turn instructions into delivery", () => {
    const sections = productSections({ description: "Ask whether a warranty is available.", installation_instructions: "Sign in to activate." });
    expect(sections.map(s => s.id)).toEqual(["overview", "activation"]);
  });
  it("preserves duration and configured renewal without inventing a monthly interval", () => {
    const overview = productSections({ duration_label: "18 Months", credits_per_interval: 100 })[0];
    expect(overview.text).toContain("18 Months");
    expect(overview.text).toContain("100");
    expect(overview.text).not.toContain("month");
    expect(deliveryMethodLabel("unknown")).toBeNull();
  });
});