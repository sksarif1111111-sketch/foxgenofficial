/** Pure offer rules shared by the storefront, the admin and tests. */
export type OfferWindow = { status: string; starts_at: string | null; ends_at: string | null };
export type OfferState = "live" | "scheduled" | "expired" | "draft" | "archived";

export function offerState(offer: OfferWindow, now: Date = new Date()): OfferState {
  if (offer.status === "archived") return "archived";
  if (offer.status !== "active") return "draft";
  if (offer.starts_at && new Date(offer.starts_at).getTime() > now.getTime()) return "scheduled";
  if (offer.ends_at && new Date(offer.ends_at).getTime() <= now.getTime()) return "expired";
  return "live";
}

export function offerIsLive(offer: OfferWindow, now: Date = new Date()): boolean {
  return offerState(offer, now) === "live";
}

/** Featured first, then higher priority, then newest. */
export function sortOffers<T extends { featured: boolean; priority: number; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || b.priority - a.priority || b.created_at.localeCompare(a.created_at),
  );
}

/** Supplier data older than this is shown with a "last verified" notice instead of as fresh. */
export const SUPPLIER_STALE_HOURS = 24;

export function supplierIsStale(lastSync: string | null, now: Date = new Date()): boolean {
  if (!lastSync) return true;
  return now.getTime() - new Date(lastSync).getTime() > SUPPLIER_STALE_HOURS * 3600_000;
}
