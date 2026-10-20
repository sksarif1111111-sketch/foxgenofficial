# Project Memory — CRM Progress

## Completed
- Admin-only CRM database (`crm_` tables: customers, products, inventory batches, orders, order items, payments, expenses, refunds, deliveries, audit log) with admin RLS and audit triggers.
- Sale/cost price snapshots on order items.
- CRM pages at `/crm`: dashboard, manual sale, orders, customers, products, inventory, payments, expenses, refunds, reports, filters, CSV export.
- Telegram bot store with server-side pricing, idempotent updates, Telegram Stars payments.

## Completed (reseller)
- Reseller API key saved as a server secret.
- Products page: Sync products (wholesale cost + reseller stock, keeps my selling price), wallet balance, inline selling price, profit per unit.

## Pending
- Selling prices for the 30 synced products (currently equal to wholesale cost).
- Purchase through API (`action=order`) + status (`action=order_status`).
- Bot → CRM sale logging endpoint (source = Bot).
- Profit/loss charts on dashboard.
- Global settings page (non-secret config only).

## Decisions
- Spec's `sales` table maps to existing `crm_orders` + `crm_order_items` (snapshots + source column) instead of a duplicate table.
- API keys live in server secrets, not in a database `settings` table.
