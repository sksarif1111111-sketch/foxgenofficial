import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/crm/resource-page";
import { money } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/products")({
  head: () => ({
    meta: [
      { title: "Products — FoxGEN CRM" },
      { name: "description", content: "CRM products with default sale and cost prices." },
      { property: "og:title", content: "Products — FoxGEN CRM" },
      { property: "og:description", content: "Manage CRM products and prices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ResourcePage
      title="Products"
      table="crm_products"
      orderBy="created_at"
      dateField="created_at"
      searchKeys={["name", "sku", "description"]}
      csvName="products"
      columns={[
        { key: "name", label: "Name" },
        { key: "sku", label: "SKU", render: (r) => String(r.sku ?? "—") },
        { key: "default_sale_price", label: "Sale price", align: "right", render: (r) => money(r.default_sale_price, String(r.currency)) },
        { key: "default_cost_price", label: "Cost price", align: "right", render: (r) => money(r.default_cost_price, String(r.currency)) },
        {
          key: "active",
          label: "Active",
          render: (r, u) => <input type="checkbox" checked={Boolean(r.active)} onChange={(e) => u({ active: e.target.checked })} />,
        },
        { key: "description", label: "Description", render: (r) => String(r.description ?? "") },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "sku", label: "SKU" },
        { key: "default_sale_price", label: "Default sale price", type: "number", required: true },
        { key: "default_cost_price", label: "Default cost price", type: "number", required: true },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "active", label: "Active", type: "checkbox", defaultValue: true },
      ]}
    />
  ),
});
