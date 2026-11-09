# FoxGEN Store + Bot CRM API v1

Base URL after publishing: `https://foxgenofficial.lovable.app/api/public/shop/v1`

All requests require `Authorization: Bearer <SHOP_CRM_API_KEY>`.
Keep this shared key in the receiving CRM's server-side secret store, never its frontend.
The owner copies the same value into both projects using their secure secret forms.

## Resources (GET only)

- `/health`: connection check and API version.
- `/products`: published catalogue, stock, prices, product image URLs.
- `/orders`: website and Telegram orders, including unpaid orders and current statuses.
- `/sales`: only confirmed/delivered orders from both channels.
- `/bot`: aggregate client/order/paid-order counts; no individual client records.

This is a read-only export API. It cannot send bot messages, issue licenses, create orders,
change stock, approve payment or expose delivery credentials. Names, emails, Telegram IDs,
payment references, private delivery notes and bot tokens are not exported.
Customer/contact syncing requires a separately authenticated private integration.

## Incremental sync

Query parameters: `limit` (1–100, default 50), `since` and `until` (ISO 8601 timestamps),
`cursor_time` and `cursor_id` (both required together), optional `channel` (`website` or `bot`; `web`/`telegram` also accepted).
Pages contain `data`, `until`, `has_more`, and `next_cursor`.

1. The external CRM polls `/orders` every 30–60 seconds.
2. Begin with the saved `since` watermark, with a small overlap (e.g. 5 minutes) to accommodate concurrent updates/commits.
3. Keep the returned `until` fixed for all remaining pages. Pass both fields from `next_cursor` while `has_more` is true.
4. Upsert each row by `external_order_id` (`shop:<order UUID>`), never insert blindly.
5. Save `until` as the next watermark only after every page was imported successfully.
6. Only `confirmed` / `delivered` count as paid sales; other statuses remain pending/failed.

`/orders` is recommended for ongoing sync because it also carries subsequent rejection/status changes.
`/sales` is useful for an initial paid-sales import. Archived/unpublished products disappear from
`/products`; periodically reconcile its full catalogue, not only incremental pages.
This API does not automatically update another project until that project implements the importer.

## Response details

Orders have stable IDs, order number, source (`Website` / `Bot`), original currency,
original monetary total or Stars total, timestamps, and item snapshots.
`accounting` contains the existing CRM's currency, revenue, and historical cost/selling-price
snapshots when available; it can be null. Do not invent missing wholesale cost or add
INR, USDT, USD and XTR together. Preserve original payment currency separately from accounting currency.

Example request (run only on the receiving CRM server):

```js
const response = await fetch(
  'https://foxgenofficial.lovable.app/api/public/shop/v1/orders?limit=50',
  { headers: { Authorization: `Bearer ${process.env.SHOP_CRM_API_KEY}` } }
);
if (!response.ok) throw new Error(`Store sync failed: ${response.status}`);
const page = await response.json();
// Upsert page.data by external_order_id; advance the watermark only after importing all pages.
```

Errors: 401 invalid/missing credential, 400 invalid query, 404 unknown resource,
503 key not configured or service unavailable. Responses are never cacheable.
No cross-origin browser access is enabled: connect server-to-server.
Rotate the shared key using the secure secret form in both projects.