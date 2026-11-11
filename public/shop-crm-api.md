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

## Separate operator integration

The GET API above remains read-only and non-contact. The owner's explicit operator-to-operator exception applies only to the following authenticated paths.

### Actions

`POST /api/public/shop/v1/actions` requires **SHOP_CRM_ACTION_KEY**, not the read-only key. Store the same shared action key securely on the CRM server. It grants payment approval/rejection, delivery and buyer messages; do not give it to customers.

Every body has `order_id` (UUID) and `action`:
- `approve`: optional `notes`, `send` (boolean).
- `reject`: required `reason` (3–600 characters).
- `request_info`: required `message` (3–600 characters).
- `add_fulfillment`: `kind` (`link`, `code`, `instructions`) and `content` (3–4000 characters).
- `deliver_email`, `deliver_telegram`: no additional fields.

These call the same server-only helpers as Admin and record actor `crm`. Errors: 400 invalid body/state/material, 401 invalid action key, 404 unknown order, 503 unavailable data service. No stacks or secrets are returned. A successful Telegram job is not resent; email retry behavior remains available. Both channels can deliver the same confirmed order, without resetting its first delivery timestamp.

### Push to FoxgenCRM

### Member directory and wallet activity

Every bot profile and website auth account is exported even without orders. Both draw from one member-number sequence, displayed as `M-000123`. Website accounts remain in a server-only account directory; Telegram UUIDs and website UUIDs never merge by email. Customer `data` includes member number, joined/first-seen time, Telegram details, available email, current `wallet_balance` and `wallet_currency: "USD"`. Changes and initial backfill are durably queued alongside the existing order queue and retried by the same managed job.

Bot `/addfunds` offers configured USDT/UPI payment recipients and collects amount, reference and optional HTTPS evidence. Requests remain pending until Admin review. Reference uniqueness is by payment method and lowercased reference. Approval locks the request and calls wallet credit once; rejection adds no credit. USDT credits the same numeric USD amount; INR requires the operator to enter a verified USD credit (no guessed exchange rate). Reviews export a `payments` record with the request UUID and profile-linked `data.customer_external_id`. Corrections require a note and cannot overdraw the wallet. Telegram notification failure is reported without reversing or duplicating the committed credit.

`upsert_product` on the separate actions endpoint accepts `reseller_product_id`, name, optional short description, nullable USDT/INR/Stars prices, nonnegative stock quantity and optional HTTPS image URL. It requires SHOP_CRM_ACTION_KEY. First creation is draft, tracked stock, paid product and `shop_published=false`; matching updates preserve publication and may update price/stock as explicitly authorized. Existing supplier sync still preserves store prices. The read-only GET API remains unchanged.

Sender: `POST https://foxgencrm.lovable.app/api/public/store/sync`, authenticated with server-only **FOXGEN_CRM_API_KEY** issued in CRM → FoxGen Store. This is independent of both Store API keys.

Records use entity `orders`, plain order UUID `external_id`, original raw status and stable source `updated_at`. Names include product quantities and order number. Stars amounts use stored purchase-time `price_usdt` snapshots for the USDT equivalent; original XTR/Stars remain in `data`. Other currencies remain separate.

Each request also includes one `customers` upsert per distinct identified buyer, before its order record(s). Customer `external_id` equals each linked order's `data.customer_external_id`; the human `FG-...` order number is unchanged. Customer records use the buyer name, empty status, null amount/currency, sending-time `updated_at`, and `data.email`, `telegram_user_id`, `telegram_username` (when known), `first_seen_at` (earliest stored order for that identity).

Buyer IDs are persisted UUIDs: `profile_id` first, otherwise the website account's `customer_user_id` (website accounts deliberately have no profiles table), otherwise MD5 of `email:` plus the trimmed/lowercased first delivery email, otherwise MD5 of `telegram:` plus Telegram ID, rendered as UUIDs. Once assigned to an order, the ID never changes when delivery details change. Identified account IDs outrank email, so website and Telegram accounts are not merged by matching email. An anonymous order without any identifier has a null link until one becomes known; no fake customer is invented. Hashes are internal identity keys, not secrets or credentials. Requests remain bounded to 100 records and 256 KB; the current one-version-per-request sender emits at most two records and acknowledges the outbox entry only when the whole request returns `{ "ok": true }`.

Operator data includes customer name, delivery email, Telegram ID, payment method/reference, confirmation/delivery timestamps, SLA minutes, item names/quantities and fulfillment existence. It **never** includes actual activation codes, credentials, fulfillment content, passwords, tokens or keys. This contact-sharing exception does not widen GET exports.

The server-only outbox retains order-update snapshots and attempts/errors; rows are acknowledged only after CRM returns `{ "ok": true }`. Upserts must use the UUID and source timestamp. Failed transfers remain queued. Buying shows pending/stuck totals and last success. A minute retry is armed while work remains and paused after drain, preventing empty recurring checks (up to 1440 retries/day while blocked; frequent retries can increase Cloud usage). The managed job is `shop-crm-outbox-retry`; do not delete/recreate it without updating the queue functions' job binding. The hosted callback currently returns 404 for the new route; review and publish these changes, then verify the managed callback before relying on automatic retries. Local authenticated flush succeeded and CRM acknowledged the existing unpaid order; no paid delivery has been tested.

Email delivery still requires RESEND_API_KEY and a verified `shop_email_from` setting; neither is configured yet. Telegram verification uses the existing bot-token-derived secret.