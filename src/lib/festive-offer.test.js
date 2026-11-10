import { expect, test } from "bun:test";
import { countdownParts, festiveOfferIsConfigured, festiveOfferStatus, msUntilNextChange } from "./festive-offer";
import { ACTIVE_OFFER } from "../config/offers";

const offer = {
  name: "Diwali offer",
  discountLabel: "20% off",
  originalPrice: "10.00 USDT",
  offerPrice: "8.00 USDT",
  startsAt: "2026-11-10T00:00:00Z",
  endsAt: "2026-11-12T00:00:00Z",
  productName: "Lovable Pro",
  ctaLabel: "Claim the offer",
  ctaHref: "/#offers",
};
const at = (iso) => Date.parse(iso);

test("Offer is hidden before startsAt", () => {
  expect(festiveOfferStatus(offer, at("2026-11-09T23:59:59Z"))).toBe("upcoming");
});

test("Offer is shown from startsAt until just before endsAt", () => {
  expect(festiveOfferStatus(offer, at("2026-11-10T00:00:00Z"))).toBe("live");
  expect(festiveOfferStatus(offer, at("2026-11-11T23:59:59Z"))).toBe("live");
});

test("Offer is hidden once endsAt has passed", () => {
  expect(festiveOfferStatus(offer, at("2026-11-12T00:00:00Z"))).toBe("ended");
});

test("Any field left as a {{placeholder}} keeps the offer hidden", () => {
  expect(festiveOfferIsConfigured({ ...offer, offerPrice: "{{offerPrice}}" })).toBe(false);
  expect(festiveOfferStatus({ ...offer, name: "{{offerName}}" }, at("2026-11-11T00:00:00Z"))).toBe("unconfigured");
});

test("Invalid or reversed dates keep the offer hidden", () => {
  expect(festiveOfferIsConfigured({ ...offer, endsAt: "not a date" })).toBe(false);
  expect(festiveOfferIsConfigured({ ...offer, startsAt: offer.endsAt, endsAt: offer.startsAt })).toBe(false);
});

test("The shipped config has no invented values, so nothing is shown until it is filled in", () => {
  expect(festiveOfferIsConfigured(ACTIVE_OFFER)).toBe(false);
});

test("The status rechecks exactly at the next start or end", () => {
  expect(msUntilNextChange(offer, at("2026-11-09T23:59:00Z"))).toBe(60_000);
  expect(msUntilNextChange(offer, at("2026-11-11T23:00:00Z"))).toBe(3_600_000);
  expect(msUntilNextChange(offer, at("2026-11-13T00:00:00Z"))).toBe(null);
});

test("Countdown splits the remaining time into days, hours, minutes and seconds", () => {
  expect(countdownParts(((2 * 24 + 4) * 3600 + 12 * 60 + 9) * 1000 + 500)).toEqual({ days: 2, hours: 4, minutes: 12, seconds: 9 });
  expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
});
