import { createFileRoute } from "@tanstack/react-router";
import { InlineSelect, opts, ResourcePage, useOptions } from "@/components/crm/resource-page";
import { fmtDate, money, REFUND_STATUSES, type Row } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/refunds")({
  head: () => ({
    meta: [
      { title: "Refunds — FoxGEN CRM" },
      { name: "description", content: "Refunds by order with status, reason, filters and CSV export." },
      { property: "og:title", content: "Refunds — FoxGEN CRM" },
      { property: "og:description", content: "Track customer refunds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  const orders = useOptions("crm_orders", "order_number");
  return (
    <ResourcePage
      title="Refunds"
      table="crm_refunds"
      select="*, crm_orders(order_number)"
      orderBy="created_at"
      dateField="created_at"
      searchKeys={["reason", "crm_orders.order_number"]}
      status={{ key: "status", options: REFUND_STATUSES }}
      csvName="refunds"
      columns={[
        { key: "created_at", label: "Date", render: (r) => fmtDate(r.refunded_at ?? r.created_at) },
        { key: "crm_orders.order_number", label: "Order", render: (r) => String((r.crm_orders as Row | null)?.order_number ?? "—") },
        { key: "reason", label: "Reason", render: (r) => String(r.reason ?? "—") },
        { key: "amount", label: "Amount", align: "right", render: (r) => money(r.amount, String(r.currency)) },
        {
          key: "status",
          label: "Status",
          render: (r, u) => <InlineSelect value={String(r.status)} options={REFUND_STATUSES} onChange={(v) => u({ status: v })} />,
        },
      ]}
      fields={[
        { key: "order_id", label: "Order", type: "select", required: true, options: orders.data ?? [] },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "status", label: "Status", type: "select", required: true, options: opts(REFUND_STATUSES), defaultValue: "completed" },
        { key: "refunded_at", label: "Refunded at", type: "datetime" },
        { key: "reason", label: "Reason", type: "textarea" },
      ]}
    />
  );
}
