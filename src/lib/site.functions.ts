import { createServerFn } from "@tanstack/react-start";

/** Only links that are already public in the Telegram bot are exposed here. */
const PUBLIC_KEYS = [
  "support_url",
  "whatsapp_support_url",
  "telegram_channel_1",
  "telegram_channel_1_name",
  "telegram_channel_2",
  "telegram_channel_2_name",
  "youtube_url",
  "facebook_url",
  "whatsapp_url",
  "whatsapp_official_url",
  "community_url",
  "bot_username",
  "tutorial_url",
  "installation_guide_url",
  "guide_title",
  "extension_name",
  "extension_version",
] as const;

export type SiteInfo = {
  links: Partial<Record<(typeof PUBLIC_KEYS)[number], string>>;
  guide: Array<{ id: string; heading: string; body: string }>;
  communities: Array<{ id: string; name: string; platform: string; url: string }>;
};

export const publicSiteInfo = createServerFn({ method: "GET" }).handler(async (): Promise<SiteInfo> => {
  const { db, getSettings } = await import("@/lib/hub.server");
  const [settings, guide, communities] = await Promise.all([
    getSettings(),
    db.from("extension_guide_pages").select("id, heading, body").eq("published", true).order("display_order"),
    db.from("communities").select("id, name, platform, url").eq("enabled", true).order("display_order"),
  ]);
  const links: SiteInfo["links"] = {};
  for (const key of PUBLIC_KEYS) {
    const value = (settings[key] ?? "").trim();
    if (value) links[key] = value;
  }
  return { links, guide: guide.data ?? [], communities: communities.data ?? [] };
});
