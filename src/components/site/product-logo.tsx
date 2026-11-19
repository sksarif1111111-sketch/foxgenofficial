import { useState } from "react";
import { resolveProductLogo } from "@/lib/brand-logos";

/** Official brand logo tile for a product; falls back to emoji, then the first letter. */
export function ProductLogo({
  name,
  logoUrl,
  emoji,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  emoji: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "showcase";
}) {
  const [broken, setBroken] = useState(false);
  const box = {
    sm: "size-9 rounded-lg",
    md: "size-12 rounded-xl",
    lg: "size-12 rounded-xl sm:size-16 sm:rounded-2xl",
    xl: "size-16 rounded-2xl sm:size-24 sm:rounded-3xl",
    showcase: "size-20 rounded-2xl sm:size-24 sm:rounded-3xl",
  }[size];
  const img = { sm: "size-5", md: "size-7", lg: "size-8 sm:size-10", xl: "size-10 sm:size-14", showcase: "size-14 sm:size-16" }[size];
  const text = { sm: "text-base", md: "text-xl", lg: "text-2xl sm:text-3xl", xl: "text-4xl sm:text-5xl", showcase: "text-5xl" }[size];
  const src = resolveProductLogo(name, logoUrl);
  return (
    <span className={`${box} flex shrink-0 items-center justify-center border border-border bg-card shadow-soft`} aria-hidden="true">
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" className={`${img} rounded-md object-contain`} onError={() => setBroken(true)} />
      ) : emoji ? (
        <span className={text}>{emoji}</span>
      ) : (
        <span className={`${text} font-display font-bold text-primary`}>{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
