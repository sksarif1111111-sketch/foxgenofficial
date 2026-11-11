# FOXGEN AI STORE: সম্পূর্ণ Telegram marketplace উন্নতি

## বর্তমান অবস্থার যাচাই
- ZIP-এর ১১টি screenshot দেখা হয়েছে: ছোট welcome message, পাতাভিত্তিক catalog, ছবিসহ product details, quantity, confirmation, UPI ও Binance payment instructions অনুসরণ করব। অন্য দোকানের পণ্য, দাম বা দাবি কপি করব না।
- বর্তমানে product management, Telegram Stars, website checkout, wallet deposits/review, সরাসরি Telegram delivery, Admin countdown ও CRM sync আছে—সেগুলো প্রসারিত করব, নতুন করে প্রতিস্থাপন নয়।
- Binance ID ও UPI ID আগে থেকেই payment settings-এ আছে, তবে এখন website checkout-এর জন্য; Telegram-এ manual payment selection এখনও নেই।
- wallet balance বর্তমানে USD-তে রাখা হয়। ₹ balance বা বানানো conversion দেখাব না; INR deposit-এ owner যাচাইকৃত USD credit দেবেন।
- নিরাপত্তার গুরুত্বপূর্ণ ঘাটতি: stock reservation ও order/item creation আলাদা ধাপে হয়; ব্যর্থ order creation পুরোনো stock ফিরিয়ে দেয়, যা একসঙ্গে কেনাকাটার সময় ভুল হতে পারে। Webhook processing শুরুতেই completed হিসেবে deduplicate হয়, তাই পরে ব্যর্থ হলে retry হারাতে পারে। এগুলো আগে ঠিক করব।

## ধাপ ১ — লেনদেন ও retry নিরাপদ করা
- Order, item, stock reservation ও wallet payment একত্রে নিরাপদভাবে সম্পন্ন করা; ব্যর্থ হলে পুরো পরিবর্তন ফেরত যাবে।
- একই click, webhook, transaction reference বা approval থেকে duplicate order/credit/refund আটকানো।
- অনুমোদিত status transitions, owner checks, private payment proof ও delivery material-এর access যাচাই।
- ব্যর্থ webhook এবং Telegram delivery-এর durable retry ও পর্যবেক্ষণ রাখা।

## ধাপ ২ — Screenshot অনুসারে customer bot
- Welcome: নাম, username, member/customer ID, প্রকৃত completed orders, USD wallet ও currency অনুযায়ী spending।
- SHOP, Virtual Numbers, My Orders, Profile, Wallet, Refer & Earn, Search, Support, Reseller API; configuration না থাকলে পরিষ্কার unavailable message। Rewards/tasks/extension-এর বর্তমান সুবিধা অক্ষত থাকবে।
- Admin-managed bot categories; paginated catalog, search, refresh, ছবি, stock ও price। Website-এর বর্তমান স্বয়ংক্রিয় category grouping বদলাব না।
- Database থেকে warranty, product/delivery type, instructions, notes ও প্রকৃত sold count। তথ্য না থাকলে বানিয়ে দেখাব না।
- 1/2/3/5, available stock ও custom quantity; minimum/maximum এবং server-side stock check। আগে confirmation, তারপর payment নির্বাচন।
- নিজের order খুলে details, status, delivery countdown, support ও wallet ledger/deposit history।

## ধাপ ৩ — Payment ও screenshot
- Telegram checkout-এ configured Wallet, UPI ও Binance Pay; Stars-এর বর্তমান flow থাকবে।
- Binance Pay: `1243916662`, recipient `FOXGEN AI STORE`।
- UPI: `8016848213-2@ybl`, account `Mirza Muzaffar Hosen`। আপলোড করা PhonePe QR-এর recipient মিলিয়ে তারপর সংরক্ষণ ও ব্যবহার; না মিললে configured details থেকে QR তৈরি।
- Copy recipient/amount, payment instructions, transaction reference ও সরাসরি screenshot upload; evidence ব্যক্তিগতভাবে সংরক্ষণ।
- Proof শুধু review queue-এ যাবে; approve/reject/request proof/internal note Admin-এ। কখনো screenshot পেলেই paid নয়।
- Add Funds-এ amount → method → proof → review; approval-এর পর ledger credit।
- Razer Pay ও Visa/Mastercard স্পষ্ট Coming Soon। BEP-20 সঠিক recipient না পাওয়া পর্যন্ত চালু নয়; Solana address ব্যবহার নয়।

## ধাপ ৪ — Delivery, inventory ও refund
- Confirmation timestamp থেকে ৩০ মিনিটের target; Telegram-এ reopen/refresh করলে server-calculated remaining time। প্রতি সেকেন্ডে Telegram message edit নয়।
- Durable delayed flag, একবার customer update, Admin notification ও priority queue; অতিরিক্ত reminder configurable।
- Private ready-account inventory: individual items, validated CSV, reservation ও একবার assignment। বর্তমান Extension licence bulk-import নিষেধ বজায় থাকবে।
- Credentials, keys, links, instructions ও অনুমোদিত file attachments শুধু সংশ্লিষ্ট buyer-কে; successful send-এর পর delivered record।
- Processing/contact/cancel/refund actions ও audit history। External manual refund কেবল সত্যিই ফেরত দেওয়ার record; configured provider ছাড়া টাকা ফেরতের দাবি নয়।
- বিদ্যমান refund policy: সরবরাহ অসম্ভব হলে full refund; শুধু দেরি হলে স্বয়ংক্রিয় refund নয়।

## ধাপ ৫ — এক কেন্দ্রীয় Admin পরিচালনা
- বর্তমান Admin-এ real overview, date/currency-separated analytics, low stock, pending proof, delayed orders, customer history ও job health।
- Product/category/quantity/warranty/inventory/payment/QR/settings/announcements/maintenance controls; routine changes সঙ্গে সঙ্গে bot-এ দৃশ্যমান।
- Saved product thumbnail generation: configured image service থাকলে একবার generate ও persistent save, upload/replace; না থাকলে branded category fallback। Fake official logo নয়; image generation-এর service cost স্পষ্ট দেখানো হবে।
- Owner/Admin/Support Agent-এর আলাদা verified accounts ও module permissions, প্রতিটি action server-side guarded; বর্তমান owner password access ভেঙে নয়।
- Coupon manager ও validated redemption, কিন্তু student code থেকে discount অনুমান নয়; নতুন coupon শুধু owner-entered terms অনুযায়ী।

## ধাপ ৬ — পরীক্ষা ও launch checklist
- বাস্তব bot account দিয়ে start → search → quantity → payment proof → Admin approval → timer → Telegram delivery → order/ledger readback পরীক্ষা। পরীক্ষায় প্রকৃত টাকা খরচ করার আগে owner-এর সম্মতি।
- Insufficient/concurrent stock, invalid/duplicate proofs, insufficient wallet, duplicate approvals/refunds, rejection, expiry/delay, API failure, retries ও unauthorized staff access পরীক্ষা।
- Hosted webhook/job callbacks, CRM sync এবং storage permissions যাচাই; backup/restore সুবিধার verified setup checklist।
- সব critical/high failure সমাধান না হলে production-ready বলব না; owner review-এর আগে publish নয়।

## জানা সীমাবদ্ধতা ও প্রয়োজনীয় setup
- Telegram-এর background/theme গ্রাহকের Telegram settings নিয়ন্ত্রণ করে; dark theme জোর করে বসানো যাবে না। Compact formatting ও client-supported button appearance ব্যবহার করব।
- USDT BEP-20 recipient এখনও দেওয়া হয়নি; এই option unavailable থাকবে।
- Virtual Numbers ও customer reseller service configuration না থাকলে unavailable থাকবে।
- Managed backend rate limiting-এর standard primitive নেই; custom সীমা দরকার হলে trade-off ব্যাখ্যা করে অনুমতি নিয়ে যোগ করব।
- Hosted retry callback-এর আগের verification অসম্পূর্ণ; launch-এর আগে deployment-এ যাচাই বাধ্যতামূলক।
- Branded email/domain-এর আগের অসম্পূর্ণ setup এই Telegram কাজ থেকে আলাদা থাকবে।

## Technical implementation
- Existing TanStack server functions, Telegram helper, PostgreSQL, private storage ও managed cron reuse; no framework/backend replacement।
- Additive migrations only; grants/RLS, atomic SQL functions, private inventory/proof tables ও durable job state; existing IDs/statuses/CRM contracts preserved।
- Bot-specific handlers ছোট server-only modules-এ; screenshots presentation reference, not app content।
- Existing Admin design tokens/components, responsive tables ও reduced-motion controls reuse; rule tests alongside existing tests।