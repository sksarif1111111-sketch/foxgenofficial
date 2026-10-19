import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { InlineSelect, ResourcePage } from "@/components/crm/resource-page";
import { fmtDate, money, ORDER_PAYMENT_STATUSES, ORDER_STATUSES, type Row } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/orders")({
  head: () => ({
    meta: [
      { title: "Orders — FoxGEN CRM" },
      { name: "description", content: "All CRM orders with status, payment status, filters and CSV export." },
      { property: "og:title", content: "Orders — FoxGEN CRM" },
      { property: "og:description", content: "Manage and export CRM orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ResourcePage
      title="Orders"
      table="crm_orders"
      select="*, crm_customers(name), crm_order_items(product_name, quantity, line_cost)"
      orderBy="ordered_at"
      dateField="ordered_at"
      searchKeys={["order_number", "crm_customers.name", "source", "notes"]}
      status={{ key: "status", options: ORDER_STATUSES }}
      csvName="orders"
      actions={
        <Button asChild variant="secondary">
          <Link to="/crm/sale">+ New sale</Link>
        </Button>
      }
      columns={[
        { key: "order_number", label: "Order" },
        { key: "ordered_at", label: "Date", render: (r) => fmtDate(r.ordered_at) },
        { key: "crm_customers.name", label: "Customer", render: (r) => String((r.crm_customers as Row | null)?.name ?? "—") },
        {
          key: "items",
          label: "Items",
          render: (r) => items(r),
          csv: (r) => items(r),
        },
        { key: "source", label: "Source", render: (r) => String(r.source ?? "—") },
        { key: "total", label: "Total", align: "right", render: (r) => money(r.total, String(r.currency)) },
        {
          key: "status",
          label: "Status",
          render: (r, u) => <InlineSelect value={String(r.status)} options={ORDER_STATUSES} onChange={(v) => u({ status: v })} />,
        },
        {
          key: "payment_status",
          label: "Payment",
          render: (r, u) => (
            <InlineSelect value={String(r.payment_status)} options={ORDER_PAYMENT_STATUSES} onChange={(v) => u({ payment_status: v })} />
          ),
        },
        { key: "notes", label: "Notes", render: (r) => String(r.notes ?? "") },
      ]}
    />
  ),
});

function items(r: Row) {
  return ((r.crm_order_items as Row[] | null) ?? []).map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
}
