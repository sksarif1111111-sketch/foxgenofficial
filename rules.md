# Technical Rules

- Stack: TanStack Start (React 19, TypeScript), Tailwind CSS v4, Lovable Cloud (Supabase).
- Strict TypeScript; no `any` except the documented untyped CRM client helper.
- Modular components: shared CRM pieces in `src/components/crm/`, helpers in `src/lib/crm.ts`.
- Server logic uses `createServerFn`; external callers (Telegram bot) use routes under `src/routes/api/public/*` that verify a shared secret header before writing.
- Reseller API token and bot secrets are server-side secrets only; never sent to the browser, never stored in tables, never logged.
- All CRM tables use the `crm_` prefix, RLS with `is_admin(auth.uid())`, explicit GRANTs, audit trigger.
- Money: numeric columns + 3-letter currency; snapshot prices on each sale.
- Profit = (selling price − wholesale cost) × quantity, computed server/database side.
- Bot sale logging must be idempotent (unique external order id).
- All UI strings come from `text.md` conventions.
- Schema changes only through migrations; no breaking changes.
