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
  [["perplexity"], favicon("perplexity.ai")],
  [["deepseek"], favicon("deepseek.com")],
  [["copilot"], favicon("copilot.microsoft.com")],
  [["amazon prime", "prime video"], favicon("primevideo.com")],
  [["disney+", "disney plus", "disney"], favicon("disneyplus.com")],
  [["apple music"], favicon("music.apple.com")],
  [["elevenlabs"], favicon("elevenlabs.io")],
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
  [["cursor"], favicon("cursor.com")],
  [["warp.dev", "warp"], favicon("warp.dev")],
  [["n8n"], favicon("n8n.io")],
  [["jam.dev"], favicon("jam.dev")],
  [["magicpatterns"], favicon("magicpatterns.com")],
  [["chatbase"], favicon("chatbase.co")],
  [["roboflow"], favicon("roboflow.com")],
  [["apify"], favicon("apify.com")],
  [["jetbrains"], favicon("jetbrains.com")],
  [["factory"], favicon("factory.ai")],
  [["figma"], favicon("figma.com")],
  [["supercut"], favicon("supercut.ai")],
  [["kling"], favicon("klingai.com")],
  [["runway", "runwayml"], favicon("runwayml.com")],
  [["ideogram"], favicon("ideogram.ai")],
  [["freepik"], favicon("freepik.com")],
  [["suno"], favicon("suno.com")],
  [["synthesia"], favicon("synthesia.io")],
  [["riverside"], favicon("riverside.fm")],
  [["vidiq"], favicon("vidiq.com")],
  [["miro"], favicon("miro.com")],
  [["whimsical"], favicon("whimsical.com")],
  [["readwise"], favicon("readwise.io")],
  [["reclaim"], favicon("reclaim.ai")],
  [["superhuman"], favicon("superhuman.com")],
  [["speechify"], favicon("speechify.com")],
  [["dovetail"], favicon("dovetail.com")],
  [["customer.io"], favicon("customer.io")],
  [["clay"], favicon("clay.com")],
  [["zoom"], favicon("zoom.us")],
  [["linkedin"], favicon("linkedin.com")],
  [["crunchyroll"], favicon("crunchyroll.com")],
  [["brain.fm"], favicon("brain.fm")],
  [["waking up"], favicon("wakingup.com")],
  [["udemy"], favicon("udemy.com")],
  [["edx"], favicon("edx.org")],
  [["proton vpn"], favicon("protonvpn.com")],
  [["hma"], favicon("hidemyass.com")],
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
    const at = hit.index + (hit[1]?.length ?? 0);
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
