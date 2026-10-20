import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { label, useOptions } from "@/components/crm/resource-page";
import { db, money, PAYMENT_METHODS, SOURCES, type Row } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/sale")({
  head: () => ({
    meta: [
      { title: "Record a Sale — FoxGEN CRM" },
      { name: "description", content: "Manually record a sale with customer, product, quantity, price, payment and source." },
      { property: "og:title", content: "Record a Sale — FoxGEN CRM" },
      { property: "og:description", content: "Manual sale entry for the FoxGEN sales CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalePage,
});

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function SalePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const customers = useOptions("crm_customers");
  const products = useQuery({
    queryKey: ["crm", "sale-products"],
    queryFn: async () => {
      const { data, error } = await db
        .from("crm_products")
        .select("id, name, default_sale_price, currency, active")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [method, setMethod] = useState("cash");
  const [fee, setFee] = useState("0");
  const [paid, setPaid] = useState(true);
  const [source, setSource] = useState("direct");
  const [notes, setNotes] = useState("");

  const total = (Number(price) || 0) * (Number(quantity) || 0);

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.data?.find((x) => x.id === id);
    if (p) {
      setPrice(String(p.default_sale_price ?? ""));
      setCurrency(String(p.currency ?? "USD").trim());
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("crm_record_sale", {
        _customer_id: (customerId || null) as string,
        _new_customer_name: newCustomer,
        _product_id: productId,
        _quantity: Number(quantity),
        _unit_price: Number(price),
        _currency: currency,
        _payment_method: method,
        _payment_fee: Number(fee) || 0,
        _paid: paid,
        _source: source,
        _notes: notes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Sale recorded");
      navigate({ to: "/crm/orders" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Record a sale</h1>
        <p className="text-sm text-muted-foreground">
          Cost is taken from the oldest inventory batch with enough stock, otherwise from the product's default cost.
        </p>
      </div>
      <form
        className="space-y-5 rounded-xl border border-border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="cust">Customer</Label>
            <select id="cust" className={sel} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— New / walk-in —</option>
              {customers.data?.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {!customerId && (
            <div className="space-y-1">
              <Label htmlFor="newc">New customer name (optional)</Label>
              <Input id="newc" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="prod">
            Product <span className="text-destructive">*</span>
          </Label>
          <select id="prod" required className={sel} value={productId} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">— Select product —</option>
            {products.data?.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name)}
              </option>
            ))}
          </select>
          {products.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">Add a product on the Products page first.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="qty">Quantity *</Label>
            <Input id="qty" type="number" min={1} step={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="price">Unit price *</Label>
            <Input id="price" type="number" min={0} step="any" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cur">Currency</Label>
            <Input id="cur" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="method">Payment method</Label>
            <select id="method" className={sel} value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {label(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fee">Payment fee</Label>
            <Input id="fee" type="number" min={0} step="any" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="src">Source</Label>
            <select id="src" className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Payment received (records a completed payment)
        </label>

        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Total <span className="ml-2 text-xl font-bold text-foreground tabular-nums">{money(total, currency || "USD")}</span>
          </p>
          <Button type="submit" disabled={save.isPending || !productId}>
            {save.isPending ? "Saving…" : "Save sale"}
          </Button>
        </div>
      </form>
    </section>
  );
}
