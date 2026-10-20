# PRD — FoxGEN Digital Product CRM

## Goal
An admin-only CRM to track digital product sales, wholesale investment made through a Reseller API, and net profit.

## Users
- Owner/admins only (signed in, `is_admin` check). No public access.

## Core features
1. **Dashboard** — Income (revenue), Investment (wholesale cost), Net Profit; today and this month; profit/loss chart.
2. **Product Management** — product list with wholesale price (synced from Reseller API) and my selling price; manual edit of selling price; active/inactive.
3. **Customer Database** — contact info (name, Telegram, WhatsApp, email) and purchase history.
4. **Manual Sales Entry** — form for WhatsApp/direct sales: customer, product, quantity, selling price, payment method, source, notes.
5. **Telegram Bot API Bridge** — authenticated server endpoint the bot calls to log a sale (source = Bot). Idempotent by external order id.
6. **Reseller API integration** — `products` (sync wholesale prices), `balance` (wallet balance on dashboard), `order` (buy a product), `order_status`.
7. **Reports & CSV export** — filters by date, source, product, customer.

## Business rules
- Investment = wholesale cost charged by the Reseller API.
- Revenue = selling price I set.
- Net Profit per sale = (Selling Price − Wholesale Cost) × Quantity.
- Selling price and wholesale cost are stored as snapshots on each sale; later price changes never alter old sales.
- Dashboard aggregates Bot + Manual sales together.

## Reseller API
- Base URL: `https://eygkdpfjrjwwbiackfpr.supabase.co/functions/v1/reseller-api`
- Auth: Bearer token (stored as a server-side secret, never in the browser or database).
- Actions: `products`, `balance`, `order`, `order_status`.

## Out of scope (for now)
- Customer-facing checkout or payment processing inside the CRM.

## Status
Documentation phase. Waiting for API key and endpoint details before integration.
