<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep each downloadable reseller extension in its own source directory so branding changes never overwrite another edition.

- Admin sales CRM tables use the `crm_` prefix and are admin-only via `is_admin(auth.uid())` RLS, with an audit trigger on every table; keeps CRM bookkeeping separate from the live store `products`/`shop_orders` tables.
- CRM pages are removed from this storefront after a pre-removal source export; retain CRM tables, admin-only RLS, `crm_record_sale`, and paid-order bookkeeping for external CRM integrations without restoring storefront CRM navigation.
- Reseller API calls go through admin-checked server functions in `src/lib/reseller.functions.ts` (token in the `RESELLER_API_KEY` secret); syncing refreshes wholesale cost/stock on `crm_products` and publishes/updates live store `products` by `reseller_product_id` (store USDT price follows the CRM selling price; Stars price and store-only edits are never overwritten).
- Paid store/bot orders are copied into the CRM by the `shop_orders_log_crm_sale` database trigger (once per order via `crm_orders.external_order_id = 'shop:<id>'`), so every payment path is logged without app code changes.
- External CRM exports use a read-only bearer-protected `/api/public/shop/v1/$resource` route, narrow non-contact projections, and timestamp/UUID pagination; receiving CRMs upsert `shop:<id>` to avoid duplicate sales without granting payment or bot control.
