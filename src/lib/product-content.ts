/** Display-only formatting. Never writes cleaned text back into the catalogue. */
export function cleanProductText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/([0-9])\uFE0F?\u20E3/gu, "$1.")
    .replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0E\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\r\n?/g, "\n")
    .split("\n").map((line) => line.replace(/[\t ]+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export type SectionId = "overview" | "how" | "activation" | "delivery" | "warranty" | "terms";
export type ProductSection = { id: SectionId; title: string; text: string };
const TITLES: Record<SectionId, string> = {
  overview: "Product overview", how: "How it works", activation: "Activation guide",
  delivery: "Delivery information", warranty: "Warranty & support", terms: "Important terms",
};
const HEADINGS: Array<[SectionId, RegExp]> = [
  ["overview", /^(?:product overview|overview|description|features|included benefits|benefits|available plan|subscription details)$/i],
  ["how", /^(?:how it works|what you receive|usage information|usage guide)$/i],
  ["activation", /^(?:activation(?: guide| instructions| requirements| steps)?|installation(?: guide| instructions)?|setup(?: guide| instructions| requirements)?|getting started|important notes|account requirements)$/i],
  ["delivery", /^(?:delivery(?: information| details| method| time)?|how delivery works)$/i],
  ["warranty", /^(?:warranty(?: & support| and support| information| details| terms| duration)?|support(?: information)?|coverage|what is covered|what is not covered)$/i],
  ["terms", /^(?:important terms|terms(?: & conditions| and conditions)?|conditions)$/i],
];

/** Only explicit heading lines change sections; prose is never guessed or discarded. */
export function productSections(input: {
  description?: string | null; features?: string[]; duration_label?: string | null;
  installation_instructions?: string | null; terms?: string | null;
  warranty_label?: string | null;
  credits_per_interval?: number | null; renewal_interval?: string | null;
}): ProductSection[] {
  const buckets = new Map<SectionId, string[]>();
  const append = (id: SectionId, text: string) => { if (text.trim()) buckets.set(id, [...(buckets.get(id) ?? []), text]); };
  const ingest = (value: string | null | undefined, fallback: SectionId) => {
    let active = fallback;
    for (const line of cleanProductText(value).split("\n")) {
      const candidate = line.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").replace(/:$/, "").trim();
      const heading = HEADINGS.find(([, pattern]) => pattern.test(candidate));
      if (heading) { active = heading[0]; append(active, `## ${candidate}`); }
      else append(active, line);
    }
  };
  ingest(input.description, "overview");
  const features = (input.features ?? []).map(cleanProductText).filter(Boolean);
  if (features.length) append("overview", `## Features\n${features.map((f) => `- ${f}`).join("\n")}`);
  if (cleanProductText(input.duration_label)) append("overview", `## Plan duration\n${cleanProductText(input.duration_label)}`);
  if (input.credits_per_interval != null) append("overview", `## Included credits\n${input.credits_per_interval}${input.renewal_interval ? ` every ${cleanProductText(input.renewal_interval)}` : ""}`);
  ingest(input.installation_instructions, "activation");
  ingest(input.terms, "terms");
  if (cleanProductText(input.warranty_label)) append("warranty", `## Warranty duration\n${cleanProductText(input.warranty_label)}`);
  return (Object.keys(TITLES) as SectionId[]).flatMap((id) => {
    const lines = buckets.get(id) ?? [];
    // An isolated heading is not relevant content.
    if (!lines.join("\n").split("\n").some((line) => line.trim() && !line.startsWith("## "))) return [];
    return [{ id, title: TITLES[id], text: lines.join("\n") }];
  });
}

export const deliveryMethodLabel = (method: string): string | null => ({
  email_manual: "Email delivery", email: "Email delivery", telegram: "Telegram delivery",
  license: "Licence key", license_key: "Licence key", download: "Digital download", file: "Digital file",
  manual: "Manual delivery",
} as Record<string, string>)[method] ?? null;