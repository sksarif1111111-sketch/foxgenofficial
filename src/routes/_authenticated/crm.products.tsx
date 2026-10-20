import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResourcePage } from "@/components/crm/resource-page";
import { money } from "@/lib/crm";
import { resellerBalance, resellerSyncProducts } from "@/lib/reseller.functions";

export const Route = createFileRoute("/_authenticated/crm/products")({
  head: () => ({
    meta: [
      { title: "Products — FoxGEN CRM" },
      { name: "description", content: "CRM products with wholesale cost from the reseller API and your selling price." },
      { property: "og:title", content: "Products — FoxGEN CRM" },
      { property: "og:description", content: "Manage CRM products and prices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

function ResellerActions() {
  const qc = useQueryClient();
  const sync = useServerFn(resellerSyncProducts);
  const getBalance = useServerFn(resellerBalance);
  const balance = useQuery({ queryKey: ["crm", "reseller-balance"], queryFn: () => getBalance(), retry: false });
  const run = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success(`Products synced — ${r.added} new, ${r.updated} updated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <span className="self-center rounded-md border border-border px-3 py-1.5 text-sm">
        Wallet: <b className="tabular-nums">{balance.isPending ? "…" : balance.error ? "—" : `${balance.data?.balance ?? 0} USDT`}</b>
      </span>
      <Button onClick={() => run.mutate()} disabled={run.isPending}>
        {run.isPending ? "Syncing…" : "Sync products"}
      </Button>
    </>
  );
}

function ProductsPage() {
  return (
    <ResourcePage
      title="Products"
      table="crm_products"
      orderBy="created_at"
      dateField="created_at"
      searchKeys={["name", "sku", "description"]}
      csvName="products"
      actions={<ResellerActions />}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "default_sale_price",
          label: "Selling price",
          align: "right",
          render: (r, u) => (
            <input
              type="number"
              min={0}
              step="any"
              defaultValue={String(r.default_sale_price ?? 0)}
              className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums"
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0 && v !== Number(r.default_sale_price)) u({ default_sale_price: v });
              }}
            />
          ),
        },
        { key: "default_cost_price", label: "Wholesale cost", align: "right", render: (r) => money(r.default_cost_price, String(r.currency)) },
        {
          key: "profit",
          label: "Profit / unit",
          align: "right",
          render: (r) => {
            const p = Number(r.default_sale_price ?? 0) - Number(r.default_cost_price ?? 0);
            return <span className={p < 0 ? "text-destructive" : ""}>{money(p, String(r.currency))}</span>;
          },
        },
        { key: "reseller_stock", label: "Reseller stock", align: "right", render: (r) => (r.reseller_stock == null ? "—" : String(r.reseller_stock)) },
        {
          key: "active",
          label: "Active",
          render: (r, u) => <input type="checkbox" checked={Boolean(r.active)} onChange={(e) => u({ active: e.target.checked })} />,
        },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "sku", label: "SKU" },
        { key: "default_sale_price", label: "Selling price", type: "number", required: true },
        { key: "default_cost_price", label: "Wholesale cost", type: "number", required: true },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "active", label: "Active", type: "checkbox", defaultValue: true },
      ]}
    />
  );
}
