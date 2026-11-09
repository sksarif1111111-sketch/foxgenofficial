import { describe, expect, it } from "bun:test";
import { categoryOf } from "./store-categories";

describe("storefront categories", () => {
  it("groups AI assistants", () => {
    expect(categoryOf("Gemini AI Pro — 18 Months")).toBe("ai");
    expect(categoryOf("ChatGPT Business Invite – 1 Month")).toBe("ai");
  });
  it("groups builder tools before office keywords", () => {
    expect(categoryOf("Lovable Pro — 1 Year Workspace")).toBe("build");
    expect(categoryOf("Windows 11+ 10 Pro")).toBe("office");
  });
  it("falls back to more software", () => {
    expect(categoryOf("Mystery Tool")).toBe("more");
  });
});
