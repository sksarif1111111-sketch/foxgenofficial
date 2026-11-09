# Roadmap

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
