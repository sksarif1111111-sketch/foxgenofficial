# Foxgen Store — চূড়ান্ত পরীক্ষা ও পরিবর্তনের তালিকা

## ফলাফল ও সীমা
- বট, Store এবং Admin-এর উল্লেখিত প্রধান অংশগুলো উন্নত ও পরীক্ষা করা হয়েছে; পুরো সিস্টেমকে উৎপাদনে সম্পূর্ণ ত্রুটিমুক্ত বলা হচ্ছে না।
- এই অ্যাপে `src/main.tsx` নেই; সেই পাঠানো পুরোনো ত্রুটির জন্য কোনো নতুন main ফাইল বানানো হয়নি। ছবি আপলোডে একটি বাস্তব nullable canvas context নিরাপদ করা হয়েছে।
- **শুধু email মিলে website ও Telegram-এর ব্যক্তিগত অর্ডার এক করা হয়নি।** Email যোগাযোগের তথ্য, পরিচয়ের প্রমাণ নয়। ইতিমধ্যে profile_id-এর অধীনে থাকা অর্ডার বটে থাকে; website ইতিহাস verified customer_user_id দিয়ে আলাদা থাকে। নতুন verified account-linking ব্যবস্থা এই কাজে যোগ করা হয়নি।
- বিদ্যমান দাম, margin, branding, theme switch, licence ব্যবস্থা ও supplier integration পুনর্লিখন করা হয়নি।

## ১. প্রতিটি তৈরি বা পরিবর্তিত ফাইল
- `.lovable/reviews/final-comprehensive-pass.md` — এই পরিবর্তন ও যাচাইয়ের সম্পূর্ণ তালিকা।
- `drizzle/migrations/0038_store_order_expiry_and_stats.sql` — সুরক্ষিত unpaid expiry ও মোট bot order count।
- `drizzle/migrations/0039_admin_member_summaries.sql` — Admin-only সদস্যের wallet/order/currency totals।
- `drizzle/migrations/meta/0038_snapshot.json` — Migration সরঞ্জামের স্বয়ংক্রিয় journal/snapshot; হাতে সম্পাদনা করা হয়নি।
- `drizzle/migrations/meta/0039_snapshot.json` — Migration সরঞ্জামের স্বয়ংক্রিয় journal/snapshot; হাতে সম্পাদনা করা হয়নি।
- `drizzle/migrations/meta/_journal.json` — Migration সরঞ্জামের স্বয়ংক্রিয় journal/snapshot; হাতে সম্পাদনা করা হয়নি।
- `roadmap.md` — সম্পন্ন কাজ, যাচাইয়ের প্রমাণ ও বাহ্যিক কারণে বাকি কাজ নথিভুক্ত।
- `src/components/admin/bot-panels.tsx` — সদস্য অনুসন্ধান, ওয়ালেট/অর্ডার পরিসংখ্যান, প্রোফাইল, Telegram যোগাযোগ ও ইতিহাসের পাতা।
- `src/components/admin/management-dashboard.tsx` — Kolkata দিনের হিসাব এবং পৃথক মুদ্রায় সপ্তাহের তুলনা।
- `src/components/admin/shop-panels.tsx` — Overdue, একসঙ্গে approve/reject, ডেলিভারি ফল, ওয়ালেটের দ্রুত যোগ-বিয়োগ, ছবি preview ও পুনরায় ক্লিক প্রতিরোধ।
- `src/components/site/customer-account-panel.tsx` — অর্ডারের লোডিং কাঠামো ও Stars-এর সঠিক পরিমাণ।
- `src/components/site/product-card.tsx` — প্রকৃত স্টকসহ Buy সরাসরি বর্তমান quantity/checkout-এ; স্টক শেষ হলে বোতাম বন্ধ।
- `src/components/site/proof-upload.tsx` — Canvas অনুপস্থিত হলেও নিরাপদ ছবি আপলোড; পরিচিত বোতাম।
- `src/integrations/supabase/types.ts` — দুটি migration-এর পরে স্বয়ংক্রিয়ভাবে তৈরি তথ্যের ধরন।
- `src/lib/AGENTS.md` — মালিকানা, মেয়াদ, ডেলিভারি ও পরীক্ষার স্থায়ী প্রযুক্তিগত নিয়ম।
- `src/lib/admin-dashboard.metrics.test.js` — দিনের সীমা, ৩০ মিনিট, আলাদা মুদ্রা ও শতাংশের পরীক্ষা।
- `src/lib/admin-dashboard.metrics.ts` — প্রকৃত order/wallet তথ্যের মুদ্রাভিত্তিক দৈনিক/সাপ্তাহিক হিসাব।
- `src/lib/customer-shop.functions.ts` — পরীক্ষিত website মালিকানা, checkout retry key, unpaid expiry এবং ইতিহাসের pagination।
- `src/lib/hubadmin.functions.ts` — সদস্যের সব পাতায় অনুসন্ধান ও সুরক্ষিত সদস্য ইতিহাস।
- `src/lib/shop-actions.server.ts` — Approve and Send-এ প্রতি চ্যানেলের ফল; সব ব্যর্থ হলে সফল দাবি নয়।
- `src/lib/shop-crm-actions.server.ts` — ডেলিভারি বিষয়বস্তুতে অনিরাপদ non-null assertion সরানো।
- `src/lib/shop.functions.ts` — ক্যাটালগের minimum quantity ও অর্ডারের delivery/expiry timestamp।
- `src/lib/shop.server.ts` — ইমেইল order lock, provider retry key, পাঠানো চ্যানেল পুনরায় না পাঠানো ও অনিশ্চিত Telegram replay বন্ধ।
- `src/lib/shopadmin.functions.ts` — সম্পূর্ণ financial reads, overdue/oldest-first তালিকা, wallet pagination ও top-up গ্রাহকের পরিচয়।
- `src/lib/store-order.policy.test.js` — মেয়াদ, পরিচয়ভিত্তিক অনুসন্ধান, email এবং ভুলের বার্তার নির্দিষ্ট পরীক্ষা।
- `src/lib/store-order.policy.ts` — Funding inactivity, email validation, সদস্য অনুসন্ধান ও গ্রাহকের পরিষ্কার ভুলের বার্তা।
- `src/lib/telegram-marketplace.server.ts` — My Orders/detail/Home/Shop flow, expired retry, profile copy, live catalogue ও double-tap checkout guard।
- `src/lib/telegram-navigation.test.js` — Navigation, retry, loading এবং duplicate screen প্রতিরোধের পরীক্ষা।
- `src/lib/telegram-navigation.ts` — Home shortcuts ও ধীর callback-এর editable loading screen; পুরোনো active keyboard অবসর।
- `src/lib/telegram-update.schema.test.js` — ত্রুটিপূর্ণ বা অতিরিক্ত বড় webhook প্রত্যাখ্যানের পরীক্ষা।
- `src/lib/telegram-update.schema.ts` — Webhook-এর পরিচয়, payload ও callback সীমা যাচাই।
- `src/lib/tests/store-final-pass.integration.js` — আসল database-এ opt-in ১২টি scenario; Telegram/email পরিবহন নকল এবং fixtures পরিষ্কার।
- `src/lib/wallet-topup.server.ts` — ৩০ মিনিট নিষ্ক্রিয় funding entry মুছে নতুন entry-র পথ দেখানো।
- `src/routes/api/public/telegram/webhook.ts` — ইনপুট যাচাই, তাৎক্ষণিক callback feedback, loading fallback ও প্রকৃত মোট অর্ডার।
- `src/routes/shop.tsx` — minimum quantity, retry key, email validation, owner-only history pagination, লোডিং/ভুল এবং readable buttons।

## ২. নতুন database migration
1. `0038_store_order_expiry_and_stats.sql`: শুধু নির্দিষ্ট buyer-এর মেয়াদ ফুরানো awaiting_payment অর্ডার row lock নিয়ে Expired করে; paid/reviewed অর্ডার বদলায় না। Stock ছাড়ার বিদ্যমান atomic action ব্যবহার করে। `bot_buyer_stats`-এ placed count যোগ করে। দুটি function service-only।
2. `0039_admin_member_summaries.sql`: সদস্যদের প্রকৃত wallet balance, সমস্ত order count এবং paid spending পৃথক currency-তে একত্রে পড়ে; service-only। কোনো প্রকাশ্য data access বা নতুন customer profile table নয়।

## ৩. নিজে পরীক্ষা করা flow
| Flow | প্রমাণ ও অবস্থা |
|---|---|
| Website Buy | ফোনে সাইন ইন করা পৃথক test account → temporary product → quantity → UPI → screenshot/reference → email → review → My orders। সত্যিকারের storage readback-এ `storage:` evidence ও website owner নিশ্চিত। বাস্তব টাকা পাঠানো হয়নি। |
| Telegram Buy | আসল database + নকল Telegram পরিবহনে product → payment → proof → My Orders/detail এবং wallet checkout সফল। একই সময়ে দুই tap-এ একটিমাত্র order। প্রকৃত Telegram client-এ paid flow এখনও পরীক্ষা নয়। |
| Wallet top-up | আসল database-এ UPI ₹100 → review → $1; caller-এর credit override উপেক্ষিত; আবার approve করলে দ্বিতীয় credit হয় না। Screenshot private storage-এ। |
| Admin approve | ফোনে test website order bulk selection → Approve selected → awaiting_fulfillment readback। Screenshot private Admin endpoint থেকে 200। |
| Admin wallet | ফোনে temporary member-এ Add $5 → required note সহ Deduct $5 → $0 readback। |
| Deliver email | নকল provider-এ failure/retry/concurrent send-once সফল। প্রকৃত Admin Send Email-এ missing provider স্পষ্ট দেখায় এবং order waiting থাকে। **Live successful email delivery বাকি।** |
| Deliver Telegram | নকল transport-এ failure-এর পরে waiting; success-এর পরে delivered; পুনরায় পাঠায় না। Response হারালে blind replay বন্ধ। **প্রকৃত customer chat-এ delivery বাকি।** |
| Member sign-up | একটি confirmed test account দিয়ে account ও checkout যাচাই। **নতুন signup inbox OTP এবং সম্পূর্ণ Google consent roundtrip বাকি**—এই পরীক্ষা তার প্রমাণ নয়। |
| Product publish/unpublish | আসল Admin-এ temporary product Hidden → Published → website checkout → Hidden readback। বটের catalogue visit-এ নতুন publication/stock read হয়, ৬০ সেকেন্ড পুরোনো cache নয়। |
| Member search/profile | ফোনে member number, name, @username, Telegram ID এবং email—পাঁচ ক্ষেত্রেই আসল temporary member পাওয়া গেছে; profile/history/Telegram link দেখা গেছে। |
| Image generation | বিদ্যমান Cloudflare generator-এর প্রতি-product action ও preview রাখা হয়েছে। **প্রকৃত provider দিয়ে নতুন picture generation করা হয়নি।** |
| Expiry/retry | আসল database-এ overdue unpaid order Expired; under_review একই থাকে। ৩০ মিনিটের funding session আর আগের entry ব্যবহার করে না। |
| Responsive/theme | 390px ও 1280px-এ light/dark catalogue → Buy → quantity; stock শেষের বোতাম disabled, horizontal overflow বা page error নেই। Phone Admin analytics, Buying, wallet ও member profile-ও দেখা হয়েছে। |

### পরীক্ষার সংখ্যা
- 156 Bun পরীক্ষা + 11 Vitest পরীক্ষা = **167 pass, 0 fail**।
- **12 real-database scenario pass**, বাহ্যিক email/Telegram পরিবহন নকল।
- স্বয়ংক্রিয় পরীক্ষা provider downtime, বাস্তব transfer বা live Telegram client-এর সম্পূর্ণ প্রমাণ নয়।
- Temporary test products, members, orders, wallets, proof files ও CRM queue copies পরিষ্কার করা হয়েছে।

## ৪. Environment variables / secrets
**নতুন secret লাগছে না।** বিদ্যমান সুবিধাগুলো সরাসরি চালাতে প্রয়োজনীয় নাম:
- `RESEND_API_KEY` — বর্তমানে অনুপস্থিত; সফল live email delivery-র জন্য দরকার। Admin-এ verified sender address-ও সেট করতে হবে।
- `TELEGRAM_BOT_TOKEN` — বিদ্যমান bot transport; এই কাজে নতুন করে token চাওয়া বা পরিবর্তন করা হয়নি।
- `CL_CLOUDFLARE_API_TOKEN` এবং `CLOUDFLARE_ACCOUNT_ID` — সফল live picture generation-এর জন্য বিদ্যমান provider access দরকার।
- `CRON_SECRET` — বিদ্যমান hosted retry/job endpoints-এর সুরক্ষা; নতুন scheduler timing যোগ করা হয়নি।

## প্রকাশের আগে বাকি যাচাই
- পরিবর্তন review ও Publish; তারপর hosted webhook/retry job এবং প্রকৃত Telegram গ্রাহকের flow পরীক্ষা।
- Email key ও verified sender দিয়ে live email delivery।
- Recipient inbox/Google interaction দিয়ে signup এবং OAuth পরীক্ষা।
- Cloudflare provider credentials দিয়ে নতুন product picture-এর বাস্তব পরীক্ষা।
- শুধু email মিলিয়ে ব্যক্তিগত order history merge করা নিরাপত্তার কারণে বাদ; কোনো verified linkage ছাড়া এটিকে চালু করা নিরাপদ নয়।
