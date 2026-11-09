import { expect, test } from "bun:test";
import { offerIsLive, offerState, sortOffers, supplierIsStale } from "./offers";

const now = new Date("2026-11-10T12:00:00Z");

test("Only active offers inside their start and expiry dates are shown", () => {
  expect(offerIsLive({ status: "active", starts_at: null, ends_at: null }, now)).toBe(true);
  expect(offerState({ status: "active", starts_at: "2026-11-11T00:00:00Z", ends_at: null }, now)).toBe("scheduled");
  expect(offerState({ status: "active", starts_at: null, ends_at: "2026-11-10T12:00:00Z" }, now)).toBe("expired");
  expect(offerIsLive({ status: "draft", starts_at: null, ends_at: null }, now)).toBe(false);
  expect(offerIsLive({ status: "archived", starts_at: null, ends_at: null }, now)).toBe(false);
});

test("Featured offers come first, then display priority", () => {
  const rows = [
    { id: "a", featured: false, priority: 50, created_at: "2026-01-01" },
    { id: "b", featured: true, priority: 0, created_at: "2026-01-01" },
    { id: "c", featured: false, priority: 90, created_at: "2026-01-01" },
  ];
  expect(sortOffers(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
});

test("Supplier data older than 24 hours is marked as last verified", () => {
  expect(supplierIsStale("2026-11-10T00:00:00Z", now)).toBe(false);
  expect(supplierIsStale("2026-11-09T11:00:00Z", now)).toBe(true);
  expect(supplierIsStale(null, now)).toBe(true);
});
