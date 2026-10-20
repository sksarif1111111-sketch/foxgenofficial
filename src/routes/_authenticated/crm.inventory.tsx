import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage, useOptions } from "@/components/crm/resource-page";
import { fmtDate, money, type Row } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory Purchases — FoxGEN CRM" },
      { name: "description", content: "Inventory purchase batches with supplier, quantity and unit cost." },
      { property: "og:title", content: "Inventory Purchases — FoxGEN CRM" },
      { property: "og:description", content: "Track stock purchased for resale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const products = useOptions("crm_products");
  return (
    <ResourcePage
      title="Inventory purchases"
      table="crm_inventory_batches"
      select="*, crm_products(name)"
      orderBy="purchased_at"
      dateField="purchased_at"
      searchKeys={["batch_code", "supplier", "crm_products.name", "notes"]}
      csvName="inventory-purchases"
      beforeInsert={(p) => ({ ...p, quantity_remaining: p.quantity_total })}
      columns={[
        { key: "purchased_at", label: "Purchased", render: (r) => fmtDate(r.purchased_at) },
        { key: "crm_products.name", label: "Product", render: (r) => String((r.crm_products as Row | null)?.name ?? "—") },
        { key: "batch_code", label: "Batch", render: (r) => String(r.batch_code ?? "—") },
        { key: "supplier", label: "Supplier", render: (r) => String(r.supplier ?? "—") },
        { key: "quantity_total", label: "Bought", align: "right" },
        { key: "quantity_remaining", label: "Remaining", align: "right" },
        { key: "unit_cost", label: "Unit cost", align: "right", render: (r) => money(r.unit_cost, String(r.currency)) },
        {
          key: "total_cost",
          label: "Total cost",
          align: "right",
          render: (r) => money(Number(r.unit_cost) * Number(r.quantity_total), String(r.currency)),
          csv: (r) => (Number(r.unit_cost) * Number(r.quantity_total)).toFixed(2),
        },
        { key: "expires_at", label: "Expires", render: (r) => fmtDate(r.expires_at) },
      ]}
      fields={[
        { key: "product_id", label: "Product", type: "select", required: true, options: products.data ?? [] },
        { key: "quantity_total", label: "Quantity bought", type: "number", required: true },
        { key: "unit_cost", label: "Unit cost", type: "number", required: true },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "supplier", label: "Supplier" },
        { key: "batch_code", label: "Batch code" },
        { key: "purchased_at", label: "Purchased at", type: "datetime" },
        { key: "expires_at", label: "Expires at", type: "datetime" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
    />
  );
}
