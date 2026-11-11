# Roadmap

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
