/**
 * Storefront categories derived from product names (the catalogue has no category data yet).
 * Order matters: the first matching rule wins.
 */
export const STORE_CATEGORIES = [
  { id: "learning", label: "Learning", blurb: "Duolingo, Coursera & courses", match: /duolingo|coursera|udemy|skillshare|course/i },
  { id: "ai", label: "AI Assistants", blurb: "Gemini, ChatGPT, Claude & more", match: /gemini|chatgpt|gpt|manus|google ai|claude|codex|gro\.?k|perplexity|copilot|chatprd|wispr|granola|pangram|gamma/i },
  { id: "build", label: "Build & Code", blurb: "Lovable, Bolt, Replit & dev tools", match: /lovable|bolt|replit|resend|cursor|github|vercel|foxgen|supabase|framer|posthog|railway|linear|mobbin|magic patterns|gumloop|arize|intercom|airtable|\bv0\b/i },
  { id: "creative", label: "Design & Video", blurb: "Canva, Adobe, CapCut & more", match: /canva|descript|adobe|capcut|figma|creator/i },
  { id: "office", label: "Productivity", blurb: "Windows, Microsoft 365, Notion", match: /windows|microsoft|office|365|autodesk|fusion|notion|pdf|mail|outlook/i },
  { id: "security", label: "VPN & Security", blurb: "NordVPN, Surfshark", match: /vpn|surfshark/i },
  { id: "entertainment", label: "Entertainment", blurb: "Streaming & music", match: /netflix|spotify|youtube|prime|disney|hotstar/i },
] as const;

export type StoreCategoryId = (typeof STORE_CATEGORIES)[number]["id"] | "more";

export const MORE_CATEGORY = { id: "more" as const, label: "More software", blurb: "Everything else" };

export function categoryOf(name: string): StoreCategoryId {
  return STORE_CATEGORIES.find((c) => c.match.test(name))?.id ?? "more";
}

export function categoryLabel(id: StoreCategoryId): string {
  return STORE_CATEGORIES.find((c) => c.id === id)?.label ?? MORE_CATEGORY.label;
}
