/**
 * Official brand logos for store products, looked up from the product name. Lets every product
 * show its real brand mark even when no logo was set in Admin, and keeps new supplier products
 * covered automatically. Sources: the brand's own site icon (via Google's favicon service) or the
 * Simple Icons brand mark where the site icon is too small to look sharp.
 */
const favicon = (domain: string) => `https://www.google.com/s2/favicons?sz=256&domain=${domain}`;
const simpleIcon = (slug: string) => `https://cdn.simpleicons.org/${slug}`;

/** Keyword (lowercase, matched as a whole word or phrase) → official logo URL. */
const BRANDS: Array<[keywords: string[], url: string]> = [
  [["chatgpt"], favicon("www.chatgpt.com")],
  [["codex", "openai"], favicon("openai.com")],
  [["claude", "anthropic"], favicon("claude.ai")],
  [["gemini"], favicon("gemini.google.com")],
  [["grok", "gro.k"], favicon("grok.com")],
  [["lovable"], favicon("lovable.dev")],
  [["google ai", "google one", "google"], favicon("google.com")],
  [["gmail", "gmails"], simpleIcon("gmail")],
  [["outlook", "hotmail"], favicon("outlook.com")],
  [["microsoft", "office 365", "windows"], favicon("microsoft.com")],
  [["adobe"], favicon("adobe.com")],
  [["autodesk", "fusion 360"], simpleIcon("autodesk")],
  [["canva"], favicon("canva.com")],
  [["capcut"], favicon("capcut.com")],
  [["coursera"], favicon("coursera.org")],
  [["duolingo"], favicon("duolingo.com")],
  [["netflix"], simpleIcon("netflix")],
  [["spotify"], simpleIcon("spotify")],
  [["youtube"], favicon("youtube.com")],
  [["nord vpn", "nordvpn"], favicon("nordvpn.com")],
  [["surfshark"], favicon("surfshark.com")],
  [["notion"], favicon("notion.so")],
  [["ilovepdf"], simpleIcon("ilovepdf")],
  [["airtable"], simpleIcon("airtable")],
  [["intercom"], simpleIcon("intercom")],
  [["bolt.new", "bolt"], favicon("bolt.new")],
  [["replit"], favicon("replit.com")],
  [["manus"], favicon("manus.im")],
  [["mobbin"], favicon("mobbin.com")],
  [["framer"], favicon("framer.com")],
  [["gamma"], favicon("gamma.app")],
  [["descript"], favicon("descript.com")],
  [["granola"], favicon("granola.ai")],
  [["linear"], favicon("linear.app")],
  [["magic patterns"], favicon("magicpatterns.com")],
  [["pangram"], favicon("pangram.com")],
  [["posthog"], favicon("posthog.com")],
  [["railway"], favicon("railway.com")],
  [["resend"], favicon("resend.com")],
  [["wispr"], favicon("wisprflow.ai")],
  [["arize"], favicon("arize.com")],
  [["chatprd"], favicon("chatprd.ai")],
  [["gumloop"], favicon("gumloop.com")],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BRANDS.flatMap(([keys, url]) =>
  keys.map((k) => ({ re: new RegExp(`(^|[^a-z0-9])${escape(k)}(?=$|[^a-z0-9])`, "i"), url })),
);

/** Official logo for the brand named earliest in the product name, or null when unknown. */
export function brandLogoFor(name: string): string | null {
  let best: { at: number; url: string } | null = null;
  for (const m of MATCHERS) {
    const hit = m.re.exec(name);
    if (!hit) continue;
    const at = hit.index + hit[1]!.length;
    if (!best || at < best.at) best = { at, url: m.url };
  }
  return best?.url ?? null;
}

const GOOGLE_FAVICON = /^https:\/\/www\.google\.com\/s2\/favicons\?/;

/**
 * Logo to show for a product. A custom logo set in Admin always wins; a generic site icon link
 * (or no logo) is replaced by the official brand logo when the brand is known, and old small
 * site icon links are upgraded to the sharp 256px size.
 */
export function resolveProductLogo(name: string, logoUrl: string | null | undefined): string | null {
  const custom = logoUrl?.trim() || null;
  if (custom && !GOOGLE_FAVICON.test(custom)) return custom;
  return brandLogoFor(name) ?? (custom ? custom.replace(/sz=\d+/, "sz=256") : null);
}
