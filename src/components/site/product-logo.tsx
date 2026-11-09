import { useState } from "react";

/** Brand logo tile for a product; falls back to emoji, then the first letter. */
export function ProductLogo({
  name,
  logoUrl,
  emoji,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  emoji: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [broken, setBroken] = useState(false);
  const box = {
    sm: "size-9 rounded-lg",
    md: "size-12 rounded-xl",
    lg: "size-16 rounded-2xl",
    xl: "size-24 rounded-3xl",
  }[size];
  const img = { sm: "size-5", md: "size-7", lg: "size-10", xl: "size-14" }[size];
  const text = { sm: "text-base", md: "text-xl", lg: "text-3xl", xl: "text-5xl" }[size];
  return (
    <span className={`${box} flex shrink-0 items-center justify-center border border-border bg-card shadow-soft`} aria-hidden="true">
      {logoUrl && !broken ? (
        <img src={logoUrl} alt="" loading="lazy" className={`${img} rounded-md object-contain`} onError={() => setBroken(true)} />
      ) : emoji ? (
        <span className={text}>{emoji}</span>
      ) : (
        <span className={`${text} font-display font-bold text-primary`}>{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
