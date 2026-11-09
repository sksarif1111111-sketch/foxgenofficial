import { requireAdminPassword } from "@/lib/admin-access.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ----------------------------- Product catalogue ---------------------------- */

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  short_name: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  icon_url: z.string().trim().max(500).optional(),
  logo_url: z.string().trim().max(500).optional(),
  banner_url: z.string().trim().max(500).optional(),
  category_id: z.string().uuid().nullable().optional(),
  product_type: z.string().trim().min(1).max(50),
  price: z.number().min(0).max(1000000),
  currency: z.string().trim().min(1).max(10),
  is_free: z.boolean(),
  giveaway_enabled: z.boolean(),
  referral_required: z.boolean(),
  credit_cost: z.number().int().min(0).max(100000),
  license_required: z.boolean(),
  download_url: z.string().trim().max(700).optional(),
  download_file_path: z.string().trim().max(700).optional(),
  tutorial_url: z.string().trim().max(700).optional(),
  installation_guide_url: z.string().trim().max(700).optional(),
  status: z.enum(["active", "draft", "archived"]),
  featured: z.boolean(),
  display_order: z.number().int().min(0).max(9999),
});

export type ProductInput = z.infer<typeof productSchema>;

const emptyToNull = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

export const catalogProducts = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("products").select("*").order("display_order").order("created_at");
  return data ?? [];
});

export const catalogSaveProduct = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => productSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const row = {
      ...rest,
      short_name: emptyToNull(rest.short_name),
      description: emptyToNull(rest.description),
      icon_url: emptyToNull(rest.icon_url),
      logo_url: emptyToNull(rest.logo_url),
      banner_url: emptyToNull(rest.banner_url),
      category_id: rest.category_id || null,
      download_url: emptyToNull(rest.download_url),
      download_file_path: emptyToNull(rest.download_file_path),
      tutorial_url: emptyToNull(rest.tutorial_url),
      installation_guide_url: emptyToNull(rest.installation_guide_url),
      updated_at: new Date().toISOString(),
    };
    if (id) {
      const { error } = await db.from("products").update(row).eq("id", id);
      if (error) throw new Error("Could not update this product.");
      await logActivity("products", "Product updated", "success", row.name);
    } else {
      const { error } = await db.from("products").insert(row);
      if (error) throw new Error("Could not create this product.");
      await logActivity("products", "Product added", "success", row.name);
    }
    return { ok: true };
  });

export const catalogDeleteProduct = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    await db.from("products").delete().eq("id", data.id);
    await logActivity("products", "Product deleted", "warning", data.id);
    return { ok: true };
  });

/* ------------------------------- Categories -------------------------------- */

export const catalogCategories = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("product_categories").select("*").order("display_order");
  return data ?? [];
});

export const catalogSaveCategory = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes."),
        description: z.string().trim().max(500).optional(),
        display_order: z.number().int().min(0).max(999),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const row = { ...rest, description: emptyToNull(rest.description), updated_at: new Date().toISOString() };
    const { error } = id
      ? await db.from("product_categories").update(row).eq("id", id)
      : await db.from("product_categories").insert(row);
    if (error) throw new Error("Could not save this category. The short name must be unique.");
    await logActivity("products", id ? "Category updated" : "Category added", "success", row.name);
    return { ok: true };
  });

export const catalogDeleteCategory = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("product_categories").delete().eq("id", data.id);
    return { ok: true };
  });

/* ------------------------------- Communities -------------------------------- */

export const catalogCommunities = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("communities").select("*").order("display_order");
  return data ?? [];
});

export const catalogSaveCommunity = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        platform: z.string().trim().min(1).max(40),
        url: z.string().trim().min(1).max(500),
        telegram_chat_id: z.string().trim().max(80).optional(),
        icon: z.string().trim().max(20).optional(),
        display_order: z.number().int().min(0).max(999),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const row = {
      ...rest,
      telegram_chat_id: emptyToNull(rest.telegram_chat_id),
      icon: emptyToNull(rest.icon),
      updated_at: new Date().toISOString(),
    };
    const { error } = id
      ? await db.from("communities").update(row).eq("id", id)
      : await db.from("communities").insert(row);
    if (error) throw new Error("Could not save this community.");
    await logActivity("communities", id ? "Community updated" : "Community added", "success", row.name);
    return { ok: true };
  });

export const catalogDeleteCommunity = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("communities").delete().eq("id", data.id);
    return { ok: true };
  });

/* ----------------------------- Payment methods ------------------------------ */

export const catalogPaymentMethods = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("payment_methods").select("*").order("display_order");
  return data ?? [];
});

export const catalogSavePaymentMethod = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        provider: z.string().trim().min(1).max(40),
        currency: z.string().trim().min(1).max(10),
        instructions: z.string().trim().max(1000).optional(),
        display_order: z.number().int().min(0).max(999),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const row = { ...rest, instructions: emptyToNull(rest.instructions), updated_at: new Date().toISOString() };
    const { error } = id
      ? await db.from("payment_methods").update(row).eq("id", id)
      : await db.from("payment_methods").insert(row);
    if (error) throw new Error("Could not save this payment method.");
    await logActivity("payments", id ? "Payment method updated" : "Payment method added", "success", row.name);
    return { ok: true };
  });

export const catalogDeletePaymentMethod = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("payment_methods").delete().eq("id", data.id);
    return { ok: true };
  });

/* ------------------------------ Activity logs ------------------------------- */

export const catalogActivity = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        module: z.string().max(40).optional(),
        status: z.enum(["all", "success", "warning", "error", "info"]).optional(),
        search: z.string().max(120).optional(),
        from: z.string().max(30).optional(),
        to: z.string().max(30).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    let query = db
      .from("activity_logs")
      .select("id, module, action, status, actor, details, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.module && data.module !== "all") query = query.eq("module", data.module);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59Z`);
    const { data: rows } = await query;
    const search = (data.search ?? "").trim().toLowerCase();
    if (!search) return rows ?? [];
    return (rows ?? []).filter((row) => JSON.stringify(row).toLowerCase().includes(search));
  });

export const catalogClearActivity = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  await db.from("activity_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return { ok: true };
});

/* ------------------------------ Product files ------------------------------ */

const productFileSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  file_url: z.string().trim().max(700).optional(),
  telegram_file_id: z.string().trim().max(300).optional(),
  version: z.string().trim().max(50).optional(),
  enabled: z.boolean(),
  display_order: z.number().int().min(0).max(9999),
});

export const catalogProductFiles = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("product_files").select("*").order("display_order").order("created_at");
  return data ?? [];
});

export const catalogSaveProductFile = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => productFileSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const row = {
      ...rest,
      file_url: emptyToNull(rest.file_url),
      telegram_file_id: emptyToNull(rest.telegram_file_id),
      version: emptyToNull(rest.version),
    };
    if (!row.file_url && !row.telegram_file_id) throw new Error("Add a download URL or a Telegram file ID.");
    if (id) await db.from("product_files").update(row).eq("id", id);
    else await db.from("product_files").insert(row);
    await logActivity("products", id ? "Product file updated" : "Product file added", "success", rest.label);
    return { ok: true };
  });

export const catalogDeleteProductFile = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    await db.from("product_files").delete().eq("id", data.id);
    await logActivity("products", "Product file deleted", "warning", data.id);
    return { ok: true };
  });
