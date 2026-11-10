import type { FestiveOffer } from "@/lib/festive-offer";

/**
 * The one festive offer shown on the landing page.
 *
 * Replace every {{placeholder}} with the real value. While any field still holds a
 * placeholder, or the current time is outside startsAt and endsAt, the announcement bar,
 * the hero offer and the offer section stay hidden automatically.
 *
 * To switch festivals, change `name` (and the other values). No code change is needed.
 * Dates are ISO 8601 with a timezone, for example "2026-11-12T00:00:00+05:30".
 * Prices are shown exactly as written, for example "12.00 USDT" or "₹999".
 */
export const ACTIVE_OFFER: FestiveOffer = {
  name: "Test festival offer",
  discountLabel: "TEST 20% off",
  originalPrice: "10.00 USDT",
  offerPrice: "8.00 USDT",
  startsAt: "2026-11-09T23:32:09.480091+00:00",
  endsAt: "2026-11-12T03:32:09.480091+00:00",
  productName: "Lovable",
  ctaLabel: "Claim the offer",
  ctaHref: "/#offers",
};
