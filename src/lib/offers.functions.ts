import { requireAdminPassword } from "@/lib/admin-access.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicOffer = {
  id: string;
  title: string;
  headline: string | null;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  cta_text: string;
  cta_url: string | null;
  ends_at: string | null;
  featured: boolean;
  source: string;
  product: {
    id: string;
    name: string;
    logo_url: string | null;
    emoji: string | null;
    image_url: string | null;
    price_usdt: number | null;
    price_inr: number | null;
    purchasable: boolean;
    availability: string;
    duration_label: string | null;
  } | null;
};

/** Live promotional offers for the storefront (status active and inside the date window). */
export const publicOffers = createServerFn({ method: "GET" }).handler(async (): Promise<{ offers: PublicOffer[] }> => {
  const { db } = await import("@/lib/hub.server");
  const { shopProductRows } = await import("@/lib/shop.server");
  const { offerIsLive, sortOffers } = await import("@/lib/offers");
  const { data, error } = await db.from("store_offers").select("*").eq("status", "active").limit(100);
  if (error) throw new Error("Offers are temporarily unavailable.");
  const live = sortOffers((data ?? []).filter((o) => offerIsLive(o)));
  if (!live.length) return { offers: [] };
  const products = new Map((await shopProductRows("website")).map((p) => [p.id, p]));
  const offers: PublicOffer[] = [];
  for (const o of live) {
    const p = o.product_id ? products.get(o.product_id) : undefined;
    if (o.product_id && !p) continue; // linked product is unpublished or archived
    offers.push({
      id: o.id,
      title: o.title,
      headline: o.headline,
      description: o.description,
      image_url: o.image_url,
      badge: o.badge,
      cta_text: o.cta_text,
      cta_url: o.cta_url,
      ends_at: o.ends_at,
      featured: o.featured,
      source: o.source,
      product: p
        ? {
            id: p.id,
            name: p.name,
            logo_url: p.logo_url,
            emoji: p.emoji,
            image_url: p.image_url,
            price_usdt: p.price_usdt,
            price_inr: p.price_inr,
            purchasable: p.purchasable,
            availability: p.availability,
            duration_label: p.duration_label,
          }
        : null,
    });
  }
  return { offers };
});

/* --------------------------------- Admin ---------------------------------- */

const offerSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Add an offer title.").max(120),
  headline: z.string().trim().max(80).optional(),
  description: z.string().trim().max(600).optional(),
  product_id: z.string().uuid().nullable().optional(),
  image_url: z
    .string()
    .trim()
    .max(700)
    .refine((v) => !v || v.startsWith("/api/public/media/") || /^https:\/\//.test(v), "Use an uploaded image or an https:// link.")
    .optional(),
  badge: z.string().trim().max(40).optional(),
  cta_text: z.string().trim().min(1).max(40),
  cta_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), "Use a page path like /shop or an https:// link.")
    .optional(),
  status: z.enum(["draft", "active", "archived"]),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  featured: z.boolean(),
  priority: z.number().int().min(0).max(1000),
  source: z.enum(["manual", "reseller", "digihup"]),
});
export type OfferInput = z.infer<typeof offerSchema>;

const blank = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);

export const adminOffers = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data, error } = await db
    .from("store_offers")
    .select("*, product:products(id, name, price_usdt, price_inr, availability, shop_published, reseller_product_id)")
    .order("featured", { ascending: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load offers.");
  return data ?? [];
});

export const adminSaveOffer = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((input: unknown) => offerSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    if (data.starts_at && data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
      throw new Error("The expiry date must be after the start date.");
    }
    const { id, ...rest } = data;
    const row = {
      ...rest,
      headline: blank(rest.headline),
      description: blank(rest.description),
      image_url: blank(rest.image_url),
      badge: blank(rest.badge),
      cta_url: blank(rest.cta_url),
      product_id: rest.product_id ?? null,
      starts_at: rest.starts_at ?? null,
      ends_at: rest.ends_at ?? null,
    };
    const result = id
      ? await db.from("store_offers").update(row).eq("id", id).select("id").single()
      : await db.from("store_offers").insert(row).select("id").single();
    if (result.error) throw new Error("Could not save this offer.");
    await logActivity("offers", id ? "Offer updated" : "Offer created", "success", row.title);
    return { ok: true, id: result.data.id };
  });

export const adminDeleteOffer = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { error } = await db.from("store_offers").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this offer.");
    await logActivity("offers", "Offer deleted", "success", data.id);
    return { ok: true };
  });

const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as const;

/** Uploads an image to the private media bucket; returns the public read path served by /api/public/media. */
export const adminUploadMedia = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        folder: z.enum(["offers", "products"]),
        contentType: z.enum(Object.keys(IMAGE_TYPES) as [keyof typeof IMAGE_TYPES, ...Array<keyof typeof IMAGE_TYPES>]),
        dataBase64: z.string().min(10).max(7_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
    const key = `${data.folder}/${crypto.randomUUID()}.${IMAGE_TYPES[data.contentType]}`;
    const { error } = await supabaseAdmin.storage.from("store-media").upload(key, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error("Upload failed. Please try again.");
    return { url: `/api/public/media/${key}` };
  });
