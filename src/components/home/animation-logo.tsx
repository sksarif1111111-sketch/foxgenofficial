import { useState } from "react";
import { Code, MusicNotes, SquaresFour, Sparkle, MonitorPlay, Briefcase } from "@phosphor-icons/react/dist/ssr";
import { resolveProductLogo } from "@/lib/brand-logos";
import { heroGroupOf, type HeroSceneProduct } from "@/lib/hero-scene";

export function AnimationLogo({ product, className }: { product: HeroSceneProduct; className: string }) {
  const src = resolveProductLogo(product.name, product.logo_url);
  const [failed, setFailed] = useState<string | null>(null);
  const group = heroGroupOf(product.name);
  const Icon = group === "ai" ? Sparkle : group === "dev" ? Code : group === "ott" ? MonitorPlay : group === "productivity" ? Briefcase : /music|audio|voice/i.test(product.name) ? MusicNotes : SquaresFour;
  return src && failed !== src ? <img src={src} alt="" loading="lazy" decoding="async" className={`${className} object-contain`} onError={() => setFailed(src)} /> : <Icon className={`${className} text-primary`} weight="regular" aria-hidden="true" />;
}