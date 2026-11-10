/** Pure rules for the config driven festive offer (src/config/offers.ts). */
export type FestiveOffer = {
  name: string;
  discountLabel: string;
  originalPrice: string;
  offerPrice: string;
  startsAt: string;
  endsAt: string;
  productName: string;
  ctaLabel: string;
  ctaHref: string;
};

export type FestiveOfferStatus = "unconfigured" | "upcoming" | "live" | "ended";

const PLACEHOLDER = /\{\{[^}]*\}\}/;

/** True when every field is filled in (no {{placeholder}} left) and the dates form a valid window. */
export function festiveOfferIsConfigured(offer: FestiveOffer): boolean {
  const values = Object.values(offer);
  if (values.some((v) => typeof v !== "string" || v.trim() === "" || PLACEHOLDER.test(v))) return false;
  const start = Date.parse(offer.startsAt);
  const end = Date.parse(offer.endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

/** Live means configured and startsAt <= now < endsAt. */
export function festiveOfferStatus(offer: FestiveOffer, now: number): FestiveOfferStatus {
  if (!festiveOfferIsConfigured(offer)) return "unconfigured";
  if (now < Date.parse(offer.startsAt)) return "upcoming";
  if (now >= Date.parse(offer.endsAt)) return "ended";
  return "live";
}

/** Milliseconds until the status next changes (start or end), or null when it never will. */
export function msUntilNextChange(offer: FestiveOffer, now: number): number | null {
  const status = festiveOfferStatus(offer, now);
  if (status === "upcoming") return Date.parse(offer.startsAt) - now;
  if (status === "live") return Date.parse(offer.endsAt) - now;
  return null;
}

/** Splits a remaining duration into whole days, hours, minutes and seconds (never negative). */
export function countdownParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
