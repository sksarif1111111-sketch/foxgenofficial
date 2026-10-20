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
  size?: "md" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  const box = size === "lg" ? "h-16 w-16 rounded-2xl" : "h-12 w-12 rounded-xl";
  const img = size === "lg" ? "h-10 w-10" : "h-7 w-7";
  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center border border-border bg-card shadow-soft`}
      aria-hidden="true"
    >
      {logoUrl && !broken ? (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          className={`${img} rounded-md object-contain`}
          onError={() => setBroken(true)}
        />
      ) : emoji ? (
        <span className={size === "lg" ? "text-3xl" : "text-2xl"}>{emoji}</span>
      ) : (
        <span className="text-lg font-black text-primary">{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
