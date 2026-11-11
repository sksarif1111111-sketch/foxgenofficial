# Roadmap

## Telegram payment summary and premium menus (Nov 12 2026)
- [x] Fixed >64-byte payment callbacks; UPI/Binance/wallet summary, card/bank Coming Soon, screenshot-first order proof and required funding photo, QR/copy controls.
- [x] Native green/blue/red Telegram button styles and exact member count added. Isolated database flow verified UPI proof under review, ₹100 approval → $1, automatic wallet debit → $0 with 7 referral credits unchanged; checkout channel-variable ambiguity fixed. 25 focused tests passed; no real transfers or Telegram client navigation performed.
- [ ] Publish and verify updated buttons in Telegram — hosted code/client appearance not yet checked; Telegram controls message/background colours.

## Live Telegram navigation failure (Nov 12 2026)
- [x] Confirmed historical hosted 500 at 21:33 UTC and a failed webhook work row; current signed harmless hosted requests return 200 with zero pending Telegram updates. Read-only navigation failures now acknowledge successfully delivered error screens; funding/payment/redemption work retains failure fencing. Original exception is absent from logs, so its exact trigger remains unproven.
- [x] Real database + isolated profile + mocked Telegram transport verified full webhook Shop → Wallet → Free Rewards → injected DIGIHUP error screen → Wallet recovery, all 200 with completed work. 25 regression tests passed; live DIGIHUP returns 401 with a clear credential message. Temporary profile removed.
- [ ] Publish reviewed changes and click Shop, Wallet and Free Rewards in the real Telegram client; no accessible Telegram user session/test chat was available, so hosted customer navigation and original 500 trigger remain unverified. DIGIHUP imports require the owner to replace its rejected key.

## Supplier removal and simple Telegram marketplace (Nov 12 2026)
- [x] Supplier identity/status and atomic removal controls added; removed product tombstones prevent republishing. Authenticated Admin controls checked at 1280/390px; isolated product removed from real catalogue and mocked bot. No live supplier catalogue was removed during tests.
- [x] Simple Shop/Wallet/Free Rewards/Profile navigation; extension/tasks/credits live under rewards and invite/earn under Profile. Referral credits remain separate from wallet funds.
- [x] Fixed ₹100 = $1 review verified with an isolated real wallet; caller override ignored, duplicate review rejected and referral credits unchanged. Missing INR prices filled from existing USD price; existing prices preserved.
- [x] Concurrent referral-notification burst guarded; throttled edits no longer cause additional sends. HTTP webhook safe update/duplicate checks and 31 focused tests passed; error context logging added.
- [ ] Live webhook 500 root cause and paid bot flow: published bot still reports its historical 500; latest fixes require publishing and a real customer action to capture any continuing failure. No complete production-readiness claim.

## Mobile layout and duplicate Telegram screens (Nov 11 2026)
- [x] Compact mobile login, Admin/AI pop-ups and storefront spacing; two-column catalogue from 360px, compact navigation and desktop layout preserved. No account/payment logic changed.
- [x] One Shop/profile menu, distinct credits/rewards entry and shared edit-first text/photo navigation for marketplace, wallet and legacy handlers. Seven mock transport regression tests passed; live Telegram checks remain deployment-dependent.
- [x] Login/signup/recovery and password visibility, Admin/AI pop-up open/close and real 81-product catalogue checked at 320/390/1280px without overflow/runtime errors. Wallet and marketplace rule tests passed; build healthy.

## Complete Telegram marketplace upgrade (Nov 11 2026)
- [x] Inspect 11 uploaded bot screenshots, supplied PhonePe QR, current bot checkout, wallet, Admin, payment methods and security architecture.
- [x] Atomic checkout, unpaid cancellation and null-safe row-locked wallet refund added; duplicate checkout, overselling, stock return and webhook lease fencing verified against isolated database records. Broader paid concurrency checks remain below.
- [x] Bot catalogue/search/categories/details, quantity confirmation and individual order/profile/wallet views added; mocked Telegram transport with real isolated database readback verified catalogue → product → quantity → pending INR order → photo proof → tracking.
- [x] Separate Telegram UPI/Binance/wallet methods, private order/deposit screenshot collection and Coming Soon methods; generated QR decoded and matched supplied UPI/account. Original uploaded QR was not decoded. Website recipients and prices preserved.
- [ ] Phase 4: durable delivery reminders/retries, private inventory assignment, file delivery and explicit refund tracking.
- [x] Existing Admin product warranty/minimum/category, inventory, image generation, payment recipient/QR and private evidence controls extended; authenticated editor checked desktop/mobile without page overflow.
- [ ] Coupons, scoped staff accounts, CSV/file delivery, comprehensive job health and explicit external refund recording remain unimplemented; further implementation required, not production-complete.
- [ ] Phase 6: end-to-end and concurrency/security tests, hosted webhook/job verification and owner launch checklist.
- [x] 18 focused rule tests passed; real pending order/payment photo and wallet photo readbacks passed with mocked Telegram transport. Temporary test products/accounts/orders removed. Current build is healthy.
- [ ] Live paid Telegram approval → fulfillment, insufficient-wallet/refund concurrency and hosted scheduler/webhook checks need completion; no real payment or Telegram delivery was performed. Review/publish before hosted checks.
- [ ] Enable USDT BEP-20 — awaiting a verified BNB Smart Chain recipient; never reuse the existing Solana address.
- [ ] Approve any ad-hoc rate-limit approach after explaining platform limitations; current shared Admin access must remain working during staff-auth rollout.

## Compact login and customer account
- [x] Smaller 368px glass login with moving background; sign-in/recovery controls preserved and exercised without sending emails.
- [x] Customer display name, paginated currency-separated paid spending, order totals and My orders interface; website and Telegram records stay separate.
- [x] Student voucher FOXGENSTUDENT10 shown after saved self-declaration, without changing prices.
- [ ] Activate voucher discount/verification/redemption — awaiting owner terms; code alone does not define a discount.
- [x] Authenticated name/student save and reload verified, original preferences restored; real zero-order totals and My orders link checked at 1280/390px, reduced motion stops background. Six rule tests and build passed; no paid website history was available for a nonzero UI check.

## Member feed, bot funding and CRM product bridge
- [x] Number every bot member and website account; durable customer directory/payment exports acknowledged by CRM.
- [x] Bot USDT/UPI request flow tested with real pending readback and mocked Telegram transport; atomic review, duplicate rejection, noted deductions verified; Admin approval and mobile checked.
- [x] Authenticated CRM product upsert with draft-only creation and published update tested; rules and operator documentation updated.
- [ ] Live bot transfer/notification — needs buyer interaction; no real funds transferred. Publish and verify hosted managed retry callback before relying on automatic sync.

## CRM buyer history linking
- [x] Persist stable buyer IDs and first-seen timestamps without merging website and Telegram accounts.
- [x] Send customer upserts alongside linked order snapshots; preserve order numbers, retries and read-only API.
- [x] Identity priority and deduplication tests passed; actual CRM acknowledged five paired transfers; operator documentation updated.

## Website customer login
- [x] Animated glass login/signup, signup-only email OTP form, Google/Microsoft/Apple enabled, recovery and session-aware navigation.
- [x] Website purchases tied to verified auth users; independent Telegram identities, prices and fulfillment preserved. Legacy token checkout cannot create new website orders.
- [ ] Branded OTP and account-created emails — waiting for owner email-domain setup.
- [x] Verified real password sign-in with dedicated confirmed test user, website order create/cancel/readback, logout, 390px layout and 61 tests.
- [ ] Signup OTP inbox and full Google/Microsoft/Apple roundtrips — need recipient inbox/provider interaction; branded code email requires owner domain setup.

## Store fulfillment and operator CRM integration (Nov 2026)
- [x] Direct Telegram fulfillment with conditional email capture and shared admin/CRM actions.
- [x] Thirty-minute admin SLA badges and overdue KPI.
- [x] Separate CRM action credential and endpoint; preserve read-only API.
- [x] Durable snapshot CRM order outbox, minute retries armed on enqueue/paused on drain, sync health and documentation; real unpaid order acknowledged by CRM.
- [x] Rule tests and authenticated Buying desktop/mobile checks; unpaid delivery rejection checked.
- [ ] Live paid Telegram fulfillment / email send — no paid order available; email API key and verified sender missing.
- [ ] Owner reviews changes before publishing; CRM must configure the same action key before initiating actions.
- [ ] Hosted CRM retry callback — stable preview host currently returns 404 for new route; publish reviewed changes before activating live delivery retries.

## Homepage rebuild from the user's SKILL.md (Nov 2026)
- [x] Floating nav + full height mobile menu, hero with Buy now, live offers with category filter, why, how it works, tagline reveal, rewards + bot, tutorials, support, FAQ (with FAQ schema), final CTA, footer, Privacy and Terms pages, branded 404. Tested at 1280/1024/768/390.
- [x] Refund/cancellation terms — owner gave the 30 minute delivery promise and refund rule (Home trust band, FAQ, Terms).
- [ ] Tutorial video URL — not configured yet; section links to the YouTube channel instead.
- [ ] Brand name on public pages (Foxgen AI Store vs FOXGEN OFFICIAL) — waiting for owner's confirmation.

## Foxgen AI Store premium redesign (Nov 2026)
- [x] Rename to Foxgen AI Store with the new fox logo; soft white / navy / blue design; whole site in English.
- [x] Header: Home, Shop, Latest Offers, Free Rewards, Tutorials, Support, search, Account; mobile menu.
- [x] Home: admin-managed promotional banner (falls back to real products), brands, featured offers, trending (real sales only), latest, premium, exclusive, free rewards, recently updated.
- [x] Product detail page, Latest Offers, Tutorials, Support and My Account pages.
- [x] Offer manager (title, product, image upload, dates, featured, priority, source, status) with live-window rule tests.
- [x] Control Center: grouped collapsible sidebar, bot dashboard from real data, leaderboard + credit history, task manager showing bot visibility, member credit tools, product table (feature, publish, archive, delete, image/logo upload).
- [x] Integration center: Telegram, Reseller API, DIGIHUP, email, AI health; manual supplier sync with history; sync never overwrites store prices.
- [x] Extension Admin: separate server-checked unlock pop-up; licence center with expired/blocked counts, filters, pages, safe delete, logged actions.
- [ ] DIGIHUP supplier sync — blocked: DIGIHUP rejects the saved API key; owner must provide a new key.
- [ ] Automatic scheduled supplier sync — route ready; needs publishing and a scheduler secret set up.
- [ ] Order email delivery — needs an email API key and verified sender (orders can still be delivered manually).
- [ ] Bot welcome message / commands editor and per-task reward credits — not in the current bot; adding them changes bot behaviour, so waiting for owner's go-ahead.

- [x] Complete FOXGEN OFFICIAL visual redesign: new Home, Store, product details, Extension downloads, Rewards hub, Admin password pop-up and dark-sidebar control center (Store, Bot, Extension); desktop/mobile browser-checked with real catalogue and Admin login.

- [x] Expand Shop Admin with top-level Shop, Bot Management and Extension tabs, live daily/monthly financial summaries and CRM reconciliation; password login, real member/order counts, month selection and Extension controls verified on desktop/mobile. No live paid orders exist to exercise financial records end-to-end; formula tests passed.

- [x] Configure Admin password, protect Admin pages and all their server actions, and verify login/logout (wrong password, correct password, refresh and both protected pages checked).

- [x] Deliver a clean complete source ZIP containing the CRM before removing its pages.
- [x] Remove only CRM pages and entry links; preserve stored data, Store, Bot and export API, then verify.

- [x] Build and verify authenticated Store/Bot export API for external CRM sync (live catalogue/order reads, pagination, auth and rule tests passed; no paid sale available to verify).
- [x] Configure shared SHOP_CRM_API_KEY securely.
- [ ] Publish the API and connect the external CRM (requires its project link/access and the same shared key there).

- [x] Verify and resolve the reported `use-mobile.tsx` TypeScript error.
- [x] Rebrand the latest uploaded extension’s visible design to FoxGEN Pro while preserving licensing and functionality.
- [x] Repackage the extension and update the existing download section.
- [x] Verify the website and downloadable ZIP.
- [x] Add the supplied social/community links and updated global pricing content.
- [x] Keep an Admin “Add Task” option for adding future tasks without code changes.
- [x] Keep both Telegram channels as separate final tasks, verify both together, and preserve verified progress during temporary errors.
- [x] Recheck the stale `use-mobile.tsx` diagnostic and current preview health.
- [x] Referral license redemption: permanent license record, 50-day plan support, editable Extension Instructions guide in bot + admin.
- [x] Direct reward redemption: generate a valid license immediately from credits without bulk inventory.
- [x] Remove obsolete bulk-license controls and make generated-license history the only Rewards admin workflow.
- [x] FOXGEN STORE shop catalogue, website checkout, Telegram Stars checkout, Buying dashboard and email delivery.
- [x] Make referral credit atomic and hide invite links until all required tasks are verified.
- [x] Three payment options at checkout, Gemini ₹150 UPI price, and an admin-funded customer dollar wallet.

- [x] Award exactly 1 referral credit when a referred Telegram user first starts the bot; keep invite links hidden until referrer verification.
- [x] Rebrand the newly uploaded extension, replace its legacy license validation with FoxGEN verification, remove notice UI, package it, and add a second download panel.
- [x] Release FoxGEN Pro 6.3 with reliable activation retries, consistent device errors, stale status cleanup, and direct Approve support.
- [x] Remove one-device binding from every current and future license and enable unlimited multiple-device activation.
- [x] Build DigiExtension Reseller 3 from the 5.1.5 feature set with Krishna Gupta branding, light-pink styling, supplied logo, two requested channels, and separate downloads.
- [x] Rename every visible Reseller 3 label to DG Extension, replace legacy startup artwork, and keep Made by Krishna Gupta attribution.
- [x] Build FoxGEN Pro 6.10 from the uploaded extension with FoxGEN licensing, branding and premium styling; add a separate download.

## Festive offer on the landing page (Nov 2026)
- [x] Config driven offer: top bar with live countdown, hero offer card with animated badge and prices, offer section after benefits; hides itself outside its dates. Tested at 1280 and 390 with temporary values.
- [ ] Real offer values (name, discount, prices, dates, product, button text and link) — waiting for the owner; the offer stays hidden until they are filled in.

## Reference design pass (Nov 2026)
- [x] Home like reference 1: floating white nav, blue hero light, big navy heading, live stats, moving rows of real product tiles, livelier product cards.
- [x] Bot management like reference 2: white sidebar, bot Online pill, quick actions, member tiles, rewards/licences/bot cards.
- [x] Extension licence center like reference 3: dark violet stage, glowing status tiles, filters, card/table view, sort.

## White studio 3D hero motion (Nov 2026)
- [x] Bright white studio hero with glass platform, floating real product tiles and in-stock category cards; entrance, slow idle drift, mouse tilt on desktop, pause off screen, static under reduced motion. Checked at 1280, 820 and 390 with no overflow or console errors; hero buttons stay clickable.
- [x] Sliding product rows show only logo/emoji and the clean product name (no price, plan length or badges), follow the live catalogue and refresh every minute.
- [x] Hero product tiles circle the platform on a slow 3D orbit (always facing the viewer, dimmer behind); category cards moved above the orbit.
- [x] Full width member counter + 30 minute delivery guarantee band under the Home hero.
