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
- Supplier APIs use per-provider adapters in `src/lib/reseller.server.ts`, called only from password-guarded functions in `src/lib/control.functions.ts` or the CRON_SECRET-protected `/api/public/cron/supplier-sync`; each run is logged to `integration_sync_runs`. Sync refreshes wholesale cost/stock on `crm_products` and name/stock on store `products` by `reseller_product_id`; existing store prices and store-only edits are never overwritten (new products start at the CRM selling price).
- Paid store/bot orders are copied into the CRM by the `shop_orders_log_crm_sale` database trigger (once per order via `crm_orders.external_order_id = 'shop:<id>'`), so every payment path is logged without app code changes.
- External CRM exports use a read-only bearer-protected `/api/public/shop/v1/$resource` route, narrow non-contact projections, and timestamp/UUID pagination; receiving CRMs upsert `shop:<id>` to avoid duplicate sales without granting payment or bot control.
- Operator CRM actions use a separate credential and shared server-only Admin action helpers; a private durable order outbox exports operator contact metadata (never fulfillment credentials) with UUID identities and persisted timestamps, keeping the older read-only API unchanged.
- CRM buyer UUIDs are assigned and frozen on orders by a database trigger (profile, website auth identity, normalized email, Telegram ID priority); the outbox sends customer upserts and matching order links together so retrying never splits history or changes order numbers.
- Store Admin uses a server-verified shared-password session with encrypted HttpOnly cookies; guard every Admin server function as well as page entry, and derive session encryption from the secrets so password rotation invalidates prior access. Licence functions additionally require the session's separate `extension` unlock (`requireExtensionPassword`; own secret `EXTENSION_ADMIN_PASSWORD` if set, else the admin password).
- Admin management summaries read retained CRM snapshots through password-guarded server functions, paginate financial sources, separate currencies, and use Kolkata day/month boundaries; prevents truncated totals and keeps bookkeeping private without restoring CRM routes.

- Storefront categories are derived from product names in `src/lib/store-categories.ts` (the category table is unused), so new supplier products sort without manual tagging.
- Storefront pages share `SiteNav`/`SiteFooter`; Admin pages share `AdminShell` (sidebar, logout, metric tiles) so navigation and session controls live in one place.
- Storefront promotions live in `store_offers` (server-only RLS, read via `publicOffers`); live = active + inside start/expiry (`src/lib/offers.ts`). With no live offers the Home banner falls back to real catalogue products — never invented offers, discounts or stock.
- Admin-uploaded images go to the private `store-media` bucket (public buckets are blocked) and are served read-only by `/api/public/media/$` for `offers/` and `products/` keys only.
- Brand name and logo come from `src/lib/brand.ts`; never hardcode the store name or logo path in components.
- Public pages use named text-style utilities in `src/styles.css` (`heading-*`, `title-*`, `body-*`, `button-*`, `caption-*`) and Phosphor icons from `@phosphor-icons/react/dist/ssr` (SSR-safe); admin screens keep lucide. Lighting, tiles and motion are CSS utilities in `src/styles.css` (`hero-aura`, `btn-glow`, `tile-*`, `animate-marquee`, `surface-violet`) so components never hardcode colours and reduced motion is handled in one place.
- Every primary "Buy now" on public pages uses `BuyNowLink` (Home `#offers`); product-level Buy now opens the existing checkout via `/shop?product=<id>&buy=true`, so there is one purchase flow.
- The landing-page festive offer is config only (`src/config/offers.ts`, rules in `src/lib/festive-offer.ts`): every offer element hides while any `{{placeholder}}` remains or outside startsAt/endsAt, and the countdown renders after mount; keeps switching festivals a config edit and avoids hydration mismatch.
- The homepage hero 3D scene (orbit ring) lives in `src/components/home/hero-motion/` as pure CSS 3D (no WebGL), decorative only (aria-hidden, no pointer events); which products/categories it and the showcase rows show, and their cleaned names, come from `src/lib/hero-scene.ts` (purchasable only, deduped), so neither can advertise stock the store does not have.
- Product logos resolve through `resolveProductLogo` in `src/lib/brand-logos.ts` (Admin custom logo wins, else official brand logo matched from the product name); new supplier products get real logos without manual setup.
- Foxgen AI chat lives only in the robot's pop-up (`assistant-robot.tsx` lazy-loads `assistant-chat-popup.tsx`, same `/api/chat` backend); other "Ask Foxgen AI" buttons call `openAssistant()` and `/chat` redirects Home, so there is one chat surface and pages stay light.
- The walking robot mascot is SVG + CSS keyframes keyed by `data-act` on `.robot-root`; a JS script only moves it and switches acts, and where it walks / when it may fall come from `src/lib/robot-motion.ts`, so motion rules stay testable and it never leaves the viewport. Elements marked `data-robot-point` (product cards, product page buy box) make it point when they scroll into view.

- Website buyers use verified Cloud Auth identities on customer_user_id with server-side ownership checks; Telegram profile tokens stay separate and cannot create customer website orders, so channels never merge by matching email. No customer profile table is needed.
- Numbered website identities live in a server-only account directory, not Telegram profiles; member/payment CRM snapshots use a separate durable entity outbox sharing the managed retry job. Wallet approvals lock the request and credit atomically; INR requires an operator-verified USD amount because balances are USD. CRM product imports use a locked reseller-ID upsert and leave new products unpublished.
- Customer display names and self-declared student preferences live in Auth user metadata (never authorization); account spending uses paginated owner-RLS website reads and separate currencies to avoid mixing Telegram identities or truncating totals. Student voucher display does not authorize a checkout discount.
- Telegram marketplace callbacks use durable profile sessions and claim-token-fenced webhook work; order creation, cancellation and wallet refunds lock database rows to prevent duplicate stock or money changes.
- All bot callback navigation shares the edit-first renderer in `telegram-navigation.ts`, including marketplace, wallet and legacy pages; one home action per button and retiring noneditable keyboards prevents duplicate active screens.
- Payment methods are channel-specific; Telegram proof photos retain file IDs and are served only behind the Admin session, including wallet top-up evidence, so neither credentials nor screenshots become public.
- Private non-extension inventory is assigned under order locks; licence products keep their existing separate manager, and marketplace jobs use the existing cron-secret boundary for delayed delivery notices.
