/**
 * Storefront categories derived from product names (the catalogue has no category data yet).
 * Order matters: the first matching rule wins.
 */
export const STORE_CATEGORIES = [
  { id: "ai", label: "AI Assistants", blurb: "Gemini, ChatGPT, Manus & more", match: /gemini|chatgpt|gpt|manus|google ai|claude|perplexity|grok|copilot/i },
  { id: "build", label: "Build & Code", blurb: "Lovable, Bolt, Replit & dev tools", match: /lovable|bolt|replit|resend|cursor|github|vercel|foxgen|supabase|windsurf|v0/i },
  { id: "office", label: "Office & OS", blurb: "Windows, Microsoft 365, Autodesk", match: /windows|microsoft|office|365|autodesk|fusion/i },
  { id: "creative", label: "Design & Video", blurb: "Canva, Descript & creator tools", match: /canva|descript|adobe|capcut|figma|creator|video/i },
  { id: "learning", label: "Learning", blurb: "Duolingo, Coursera & courses", match: /duolingo|coursera|udemy|skillshare|edu|course/i },
  { id: "entertainment", label: "Entertainment", blurb: "Streaming & music", match: /netflix|spotify|youtube|prime|disney|hotstar|music/i },
] as const;

export type StoreCategoryId = (typeof STORE_CATEGORIES)[number]["id"] | "more";

export const MORE_CATEGORY = { id: "more" as const, label: "More software", blurb: "Everything else" };

export function categoryOf(name: string): StoreCategoryId {
  return STORE_CATEGORIES.find((c) => c.match.test(name))?.id ?? "more";
}

export function categoryLabel(id: StoreCategoryId): string {
  return STORE_CATEGORIES.find((c) => c.id === id)?.label ?? MORE_CATEGORY.label;
}
