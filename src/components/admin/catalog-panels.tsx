import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  catalogActivity,
  catalogCategories,
  catalogClearActivity,
  catalogCommunities,
  catalogDeleteCategory,
  catalogDeleteCommunity,
  catalogDeletePaymentMethod,
  catalogDeleteProduct,
  catalogDeleteProductFile,
  catalogPaymentMethods,
  catalogProducts,
  catalogProductFiles,
  catalogSaveCategory,
  catalogSaveCommunity,
  catalogSavePaymentMethod,
  catalogSaveProduct,
  catalogSaveProductFile,
  type ProductInput,
} from "@/lib/hubcatalog.functions";

type Notify = (message: string) => void;

const card = "rounded-2xl border border-border bg-card/60 p-5 backdrop-blur";
const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const primaryBtn = "rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground";
const ghostBtn = "rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground";

const PRODUCT_TYPES = [
  "digital_product",
  "browser_extension",
  "license_product",
  "subscription",
  "free_giveaway",
  "paid_product",
  "downloadable_file",
  "tutorial_resource",
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const emptyProduct: ProductInput = {
  name: "",
  short_name: "",
  description: "",
  icon_url: "",
  logo_url: "",
  banner_url: "",
  category_id: null,
  product_type: "browser_extension",
  price: 0,
  currency: "USD",
  is_free: true,
  giveaway_enabled: true,
  referral_required: true,
  credit_cost: 0,
  license_required: true,
  download_url: "",
  download_file_path: "",
  tutorial_url: "",
  installation_guide_url: "",
  status: "active",
  featured: false,
  display_order: 0,
};

export function ProductsPanel({ notify }: { notify: Notify }) {
  const list = useServerFn(catalogProducts);
  const cats = useServerFn(catalogCategories);
  const save = useServerFn(catalogSaveProduct);
  const remove = useServerFn(catalogDeleteProduct);

  const [rows, setRows] = useState<Awaited<ReturnType<typeof catalogProducts>>>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof catalogCategories>>>([]);
  const [draft, setDraft] = useState<ProductInput | null>(null);

  const reload = useCallback(async () => {
    const [p, c] = await Promise.all([list({ data: undefined }), cats({ data: undefined })]);
    setRows(p);
    setCategories(c);
  }, [list, cats]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} product(s) in the catalogue.</p>
        <button className={primaryBtn} onClick={() => setDraft({ ...emptyProduct })}>
          + Add Product
        </button>
      </div>

      {draft && (
        <div className={`${card} space-y-3`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product name">
              <input className={input} value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Short name">
              <input className={input} value={draft.short_name ?? ""} onChange={(e) => set("short_name", e.target.value)} />
            </Field>
            <Field label="Category">
              <select
                className={input}
                value={draft.category_id ?? ""}
                onChange={(e) => set("category_id", e.target.value || null)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product type">
              <select className={input} value={draft.product_type} onChange={(e) => set("product_type", e.target.value)}>
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price">
              <input
                type="number"
                className={input}
                value={draft.price}
                onChange={(e) => set("price", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Currency">
              <input className={input} value={draft.currency} onChange={(e) => set("currency", e.target.value)} />
            </Field>
            <Field label="Credit cost">
              <input
                type="number"
                className={input}
                value={draft.credit_cost}
                onChange={(e) => set("credit_cost", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Display order">
              <input
                type="number"
                className={input}
                value={draft.display_order}
                onChange={(e) => set("display_order", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Download URL">
              <input className={input} value={draft.download_url ?? ""} onChange={(e) => set("download_url", e.target.value)} />
            </Field>
            <Field label="Download file / Telegram file ID">
              <input
                className={input}
                value={draft.download_file_path ?? ""}
                onChange={(e) => set("download_file_path", e.target.value)}
              />
            </Field>
            <Field label="Tutorial URL">
              <input className={input} value={draft.tutorial_url ?? ""} onChange={(e) => set("tutorial_url", e.target.value)} />
            </Field>
            <Field label="Installation guide URL">
              <input
                className={input}
                value={draft.installation_guide_url ?? ""}
                onChange={(e) => set("installation_guide_url", e.target.value)}
              />
            </Field>
            <Field label="Icon URL">
              <input className={input} value={draft.icon_url ?? ""} onChange={(e) => set("icon_url", e.target.value)} />
            </Field>
            <Field label="Logo URL">
              <input className={input} value={draft.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} />
            </Field>
            <Field label="Banner URL">
              <input className={input} value={draft.banner_url ?? ""} onChange={(e) => set("banner_url", e.target.value)} />
            </Field>
            <Field label="Status">
              <select
                className={input}
                value={draft.status}
                onChange={(e) => set("status", e.target.value as ProductInput["status"])}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className={`${input} min-h-20`}
              value={draft.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-4 text-xs">
            {(
              [
                ["is_free", "Free"],
                ["giveaway_enabled", "Giveaway"],
                ["referral_required", "Referral required"],
                ["license_required", "License required"],
                ["featured", "Featured"],
              ] as Array<[keyof ProductInput, string]>
            ).map(([key, label]) => (
              <label key={String(key)} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(draft[key])}
                  onChange={(e) => set(key, e.target.checked as never)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className={primaryBtn}
              onClick={async () => {
                try {
                  await save({ data: draft });
                  notify("Product saved");
                  setDraft(null);
                  await reload();
                } catch (err) {
                  notify(err instanceof Error ? err.message : "Could not save product");
                }
              }}
            >
              Save product
            </button>
            <button className={ghostBtn} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((p) => (
          <div key={p.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <p className="font-bold">
                {p.name} <span className="text-xs text-muted-foreground">· {p.product_type.replace(/_/g, " ")}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {p.status} · {p.is_free ? "Free" : `${p.price} ${p.currency}`}
                {p.credit_cost ? ` · ${p.credit_cost} credits` : ""}
                {p.featured ? " · Featured" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={ghostBtn}
                onClick={() =>
                  setDraft({
                    ...emptyProduct,
                    ...p,
                    price: Number(p.price),
                    short_name: p.short_name ?? "",
                    description: p.description ?? "",
                    icon_url: p.icon_url ?? "",
                    logo_url: p.logo_url ?? "",
                    banner_url: p.banner_url ?? "",
                    download_url: p.download_url ?? "",
                    download_file_path: p.download_file_path ?? "",
                    tutorial_url: p.tutorial_url ?? "",
                    installation_guide_url: p.installation_guide_url ?? "",
                    status: (p.status as ProductInput["status"]) ?? "active",
                  })
                }
              >
                Edit
              </button>
              <button
                className="rounded-xl border border-destructive px-4 py-2 text-xs font-bold text-destructive"
                onClick={async () => {
                  await remove({ data: { id: p.id } });
                  notify("Product deleted");
                  await reload();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">No products yet. Use + Add Product to create one.</p>}
      </div>
    </section>
  );
}

export function CatalogPanel({ notify }: { notify: Notify }) {
  const cats = useServerFn(catalogCategories);
  const saveCat = useServerFn(catalogSaveCategory);
  const delCat = useServerFn(catalogDeleteCategory);
  const comms = useServerFn(catalogCommunities);
  const saveComm = useServerFn(catalogSaveCommunity);
  const delComm = useServerFn(catalogDeleteCommunity);
  const pays = useServerFn(catalogPaymentMethods);
  const savePay = useServerFn(catalogSavePaymentMethod);
  const delPay = useServerFn(catalogDeletePaymentMethod);

  const [categories, setCategories] = useState<Awaited<ReturnType<typeof catalogCategories>>>([]);
  const [communities, setCommunities] = useState<Awaited<ReturnType<typeof catalogCommunities>>>([]);
  const [methods, setMethods] = useState<Awaited<ReturnType<typeof catalogPaymentMethods>>>([]);
  const [cat, setCat] = useState({ name: "", slug: "" });
  const [comm, setComm] = useState({ name: "", platform: "telegram", url: "", telegram_chat_id: "" });
  const [pay, setPay] = useState({ name: "", provider: "manual", currency: "USD", instructions: "" });

  const reload = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      cats({ data: undefined }),
      comms({ data: undefined }),
      pays({ data: undefined }),
    ]);
    setCategories(a);
    setCommunities(b);
    setMethods(c);
  }, [cats, comms, pays]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      notify(message);
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className={`${card} space-y-3`}>
        <h2 className="text-sm font-black uppercase tracking-widest">Categories</h2>
        <input className={input} placeholder="Name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
        <input
          className={input}
          placeholder="short-name"
          value={cat.slug}
          onChange={(e) => setCat({ ...cat, slug: e.target.value.toLowerCase() })}
        />
        <button
          className={primaryBtn}
          onClick={() =>
            run(async () => {
              await saveCat({ data: { ...cat, display_order: categories.length, enabled: true } });
              setCat({ name: "", slug: "" });
            }, "Category added")
          }
        >
          + Add Category
        </button>
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm">
            <span>{c.name}</span>
            <button className="text-xs text-destructive" onClick={() => run(() => delCat({ data: { id: c.id } }), "Deleted")}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className={`${card} space-y-3`}>
        <h2 className="text-sm font-black uppercase tracking-widest">Communities</h2>
        <input className={input} placeholder="Name" value={comm.name} onChange={(e) => setComm({ ...comm, name: e.target.value })} />
        <input
          className={input}
          placeholder="Platform (telegram, youtube…)"
          value={comm.platform}
          onChange={(e) => setComm({ ...comm, platform: e.target.value })}
        />
        <input className={input} placeholder="URL" value={comm.url} onChange={(e) => setComm({ ...comm, url: e.target.value })} />
        <input
          className={input}
          placeholder="Telegram chat ID (optional)"
          value={comm.telegram_chat_id}
          onChange={(e) => setComm({ ...comm, telegram_chat_id: e.target.value })}
        />
        <button
          className={primaryBtn}
          onClick={() =>
            run(async () => {
              await saveComm({ data: { ...comm, display_order: communities.length, enabled: true } });
              setComm({ name: "", platform: "telegram", url: "", telegram_chat_id: "" });
            }, "Community added")
          }
        >
          + Add Community
        </button>
        {communities.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm">
            <span>
              {c.name} <span className="text-xs text-muted-foreground">({c.platform})</span>
            </span>
            <button className="text-xs text-destructive" onClick={() => run(() => delComm({ data: { id: c.id } }), "Deleted")}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className={`${card} space-y-3`}>
        <h2 className="text-sm font-black uppercase tracking-widest">Payment methods</h2>
        <input className={input} placeholder="Name" value={pay.name} onChange={(e) => setPay({ ...pay, name: e.target.value })} />
        <input
          className={input}
          placeholder="Provider (manual, upi, stripe…)"
          value={pay.provider}
          onChange={(e) => setPay({ ...pay, provider: e.target.value })}
        />
        <input
          className={input}
          placeholder="Currency"
          value={pay.currency}
          onChange={(e) => setPay({ ...pay, currency: e.target.value })}
        />
        <textarea
          className={`${input} min-h-16`}
          placeholder="Payment instructions"
          value={pay.instructions}
          onChange={(e) => setPay({ ...pay, instructions: e.target.value })}
        />
        <button
          className={primaryBtn}
          onClick={() =>
            run(async () => {
              await savePay({ data: { ...pay, display_order: methods.length, enabled: true } });
              setPay({ name: "", provider: "manual", currency: "USD", instructions: "" });
            }, "Payment method added")
          }
        >
          + Add Payment Method
        </button>
        {methods.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-sm">
            <span>
              {m.name} <span className="text-xs text-muted-foreground">({m.provider})</span>
            </span>
            <button className="text-xs text-destructive" onClick={() => run(() => delPay({ data: { id: m.id } }), "Deleted")}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

const MODULES = ["all", "users", "referrals", "credits", "licenses", "products", "payments", "communities", "bot", "admin"];
const STATUS_STYLES: Record<string, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-border bg-muted/30 text-muted-foreground",
};

export function ActivityPanel({ notify }: { notify: Notify }) {
  const load = useServerFn(catalogActivity);
  const clear = useServerFn(catalogClearActivity);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof catalogActivity>>>([]);
  const [module, setModule] = useState("all");
  const [status, setStatus] = useState<"all" | "success" | "warning" | "error" | "info">("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const refresh = useCallback(async () => {
    setRows(await load({ data: { module, status, search, from, to } }));
  }, [load, module, status, search, from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select className={`${input} w-auto`} value={module} onChange={(e) => setModule(e.target.value)}>
          {MODULES.map((m) => (
            <option key={m} value={m}>
              {m === "all" ? "All activity" : m}
            </option>
          ))}
        </select>
        <select
          className={`${input} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="info">Info</option>
        </select>
        <input type="date" className={`${input} w-auto`} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={`${input} w-auto`} value={to} onChange={(e) => setTo(e.target.value)} />
        <input
          className={`${input} w-auto flex-1`}
          placeholder="Search activity"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={ghostBtn} onClick={() => void refresh()}>
          Refresh
        </button>
        <button
          className="rounded-xl border border-destructive px-4 py-2 text-xs font-bold text-destructive"
          onClick={async () => {
            await clear({ data: undefined });
            notify("Activity cleared");
            await refresh();
          }}
        >
          Clear
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <p className="text-sm font-bold">{r.action}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()} · {r.module}
                {r.actor ? ` · ${r.actor}` : ""}
              </p>
              {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${
                STATUS_STYLES[r.status] ?? STATUS_STYLES["info"]
              }`}
            >
              {r.status}
            </span>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">No activity recorded for these filters.</p>}
      </div>
    </section>
  );
}

/* ------------------------------ Product files ------------------------------ */

type FileRow = {
  id: string;
  product_id: string;
  label: string;
  file_url: string | null;
  telegram_file_id: string | null;
  version: string | null;
  enabled: boolean;
  display_order: number;
};

const emptyFile = {
  product_id: "",
  label: "",
  file_url: "",
  telegram_file_id: "",
  version: "",
  enabled: true,
  display_order: 0,
};

export function ProductFilesPanel({ notify }: { notify: Notify }) {
  const listFiles = useServerFn(catalogProductFiles);
  const saveFile = useServerFn(catalogSaveProductFile);
  const removeFile = useServerFn(catalogDeleteProductFile);
  const listProducts = useServerFn(catalogProducts);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [draft, setDraft] = useState({ ...emptyFile });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [f, p] = await Promise.all([listFiles({ data: undefined }), listProducts({ data: undefined })]);
    setFiles(f as FileRow[]);
    setProducts((p as Array<{ id: string; name: string }>).map((x) => ({ id: x.id, name: x.name })));
  }, [listFiles, listProducts]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    try {
      await saveFile({ data: { ...draft, ...(editingId ? { id: editingId } : {}) } });
      notify(editingId ? "File updated" : "File added");
      setDraft({ ...emptyFile });
      setEditingId(null);
      setOpen(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save the file.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">Product files</h2>
        <button
          onClick={() => {
            setDraft({ ...emptyFile, product_id: products[0]?.id ?? "" });
            setEditingId(null);
            setOpen(true);
          }}
          className={primaryBtn}
        >
          + Upload / Add File
        </button>
      </div>

      {open && (
        <div className={`${card} grid gap-3 sm:grid-cols-2`}>
          <Field label="Product">
            <select className={input} value={draft.product_id} onChange={(e) => setDraft({ ...draft, product_id: e.target.value })}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Label / description">
            <input className={input} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Version">
            <input className={input} value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} />
          </Field>
          <Field label="Display order">
            <input type="number" className={input} value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })} />
          </Field>
          <Field label="Download URL">
            <input className={input} value={draft.file_url} onChange={(e) => setDraft({ ...draft, file_url: e.target.value })} placeholder="https://..." />
          </Field>
          <Field label="Telegram file ID (optional)">
            <input className={input} value={draft.telegram_file_id} onChange={(e) => setDraft({ ...draft, telegram_file_id: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            Visible / enabled
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={submit} className={primaryBtn} disabled={!draft.product_id || !draft.label}>
              Save file
            </button>
            <button onClick={() => { setOpen(false); setEditingId(null); }} className={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {files.length === 0 && <p className="text-sm text-muted-foreground">No files yet. Add one to enable downloads.</p>}
        {files.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-3 text-sm">
            <div>
              <p className="font-bold">{f.label} {f.version ? `· v${f.version}` : ""}</p>
              <p className="text-xs text-muted-foreground">
                {products.find((p) => p.id === f.product_id)?.name ?? "Unlinked product"} · {f.enabled ? "Enabled" : "Disabled"} ·{" "}
                {f.file_url ? "URL" : "Telegram file"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDraft({
                    product_id: f.product_id,
                    label: f.label,
                    file_url: f.file_url ?? "",
                    telegram_file_id: f.telegram_file_id ?? "",
                    version: f.version ?? "",
                    enabled: f.enabled,
                    display_order: f.display_order,
                  });
                  setEditingId(f.id);
                  setOpen(true);
                }}
                className={ghostBtn}
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  await removeFile({ data: { id: f.id } });
                  notify("File removed");
                  await load();
                }}
                className="rounded-xl border border-destructive px-4 py-2 text-xs font-bold text-destructive"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
