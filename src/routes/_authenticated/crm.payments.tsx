import { createFileRoute } from "@tanstack/react-router";
import { InlineSelect, opts, ResourcePage, useOptions } from "@/components/crm/resource-page";
import { fmtDate, money, PAYMENT_METHODS, PAYMENT_STATUSES, type Row } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/payments")({
  head: () => ({
    meta: [
      { title: "Payments — FoxGEN CRM" },
      { name: "description", content: "Recorded payments with method, fee, status, filters and CSV export." },
      { property: "og:title", content: "Payments — FoxGEN CRM" },
      { property: "og:description", content: "Track received payments and fees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const orders = useOptions("crm_orders", "order_number");
  return (
    <ResourcePage
      title="Payments"
      table="crm_payments"
      select="*, crm_orders(order_number)"
      orderBy="created_at"
      dateField="created_at"
      searchKeys={["method", "reference", "crm_orders.order_number", "notes"]}
      status={{ key: "status", options: PAYMENT_STATUSES }}
      csvName="payments"
      columns={[
        { key: "created_at", label: "Date", render: (r) => fmtDate(r.paid_at ?? r.created_at) },
        { key: "crm_orders.order_number", label: "Order", render: (r) => String((r.crm_orders as Row | null)?.order_number ?? "—") },
        { key: "method", label: "Method" },
        { key: "reference", label: "Reference", render: (r) => String(r.reference ?? "—") },
        { key: "amount", label: "Amount", align: "right", render: (r) => money(r.amount, String(r.currency)) },
        { key: "fee", label: "Fee", align: "right", render: (r) => money(r.fee, String(r.currency)) },
        {
          key: "status",
          label: "Status",
          render: (r, u) => <InlineSelect value={String(r.status)} options={PAYMENT_STATUSES} onChange={(v) => u({ status: v })} />,
        },
      ]}
      fields={[
        { key: "order_id", label: "Order", type: "select", required: true, options: orders.data ?? [] },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "fee", label: "Payment fee", type: "number" },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "method", label: "Method", type: "select", required: true, options: opts(PAYMENT_METHODS) },
        { key: "status", label: "Status", type: "select", required: true, options: opts(PAYMENT_STATUSES), defaultValue: "completed" },
        { key: "reference", label: "Reference" },
        { key: "paid_at", label: "Paid at", type: "datetime" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
    />
  );
}
