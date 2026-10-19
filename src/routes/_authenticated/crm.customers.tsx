import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/crm/resource-page";
import { fmtDate } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/customers")({
  head: () => ({
    meta: [
      { title: "Customers — FoxGEN CRM" },
      { name: "description", content: "CRM customer list with contact details, filters and CSV export." },
      { property: "og:title", content: "Customers — FoxGEN CRM" },
      { property: "og:description", content: "Manage CRM customers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ResourcePage
      title="Customers"
      table="crm_customers"
      orderBy="created_at"
      dateField="created_at"
      searchKeys={["name", "email", "phone", "telegram_username", "country"]}
      csvName="customers"
      columns={[
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "telegram_username", label: "Telegram" },
        { key: "country", label: "Country" },
        { key: "created_at", label: "Added", render: (r) => fmtDate(r.created_at) },
        { key: "notes", label: "Notes", render: (r) => String(r.notes ?? "") },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "telegram_username", label: "Telegram username" },
        { key: "country", label: "Country" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
    />
  ),
});
