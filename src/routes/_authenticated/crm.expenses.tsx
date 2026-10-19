import { createFileRoute } from "@tanstack/react-router";
import { opts, ResourcePage } from "@/components/crm/resource-page";
import { EXPENSE_CATEGORIES, fmtDate, money } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — FoxGEN CRM" },
      { name: "description", content: "Business expenses by category and vendor with filters and CSV export." },
      { property: "og:title", content: "Expenses — FoxGEN CRM" },
      { property: "og:description", content: "Track business expenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ResourcePage
      title="Expenses"
      table="crm_expenses"
      orderBy="expense_date"
      dateField="expense_date"
      searchKeys={["category", "vendor", "description"]}
      status={{ key: "category", options: EXPENSE_CATEGORIES }}
      csvName="expenses"
      columns={[
        { key: "expense_date", label: "Date", render: (r) => fmtDate(r.expense_date) },
        { key: "category", label: "Category" },
        { key: "vendor", label: "Vendor", render: (r) => String(r.vendor ?? "—") },
        { key: "description", label: "Description", render: (r) => String(r.description ?? "") },
        { key: "amount", label: "Amount", align: "right", render: (r) => money(r.amount, String(r.currency)) },
      ]}
      fields={[
        { key: "expense_date", label: "Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: "category", label: "Category", type: "select", required: true, options: opts(EXPENSE_CATEGORIES) },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "vendor", label: "Vendor" },
        { key: "description", label: "Description", type: "textarea" },
      ]}
    />
  ),
});
