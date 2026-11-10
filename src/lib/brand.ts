import markAsset from "@/assets/foxgen-store-mark-hd.webp.asset.json";
import logoAsset from "@/assets/foxgen-store-logo.webp.asset.json";

export const BRAND = {
  name: "Foxgen AI Store",
  short: "Foxgen",
  suffix: "AI Store",
  tagline: "Premium AI tools & software, verified by a real owner.",
  mark: markAsset.url,
  logo: logoAsset.url,
} as const;
