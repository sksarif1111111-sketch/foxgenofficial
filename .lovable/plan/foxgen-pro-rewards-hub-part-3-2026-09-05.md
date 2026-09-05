# FoxGEN PRO Rewards Hub – Part 3

## Goal
Improve the existing referral and credit system without rebuilding or changing the task, license, or bot foundations.

## What will change
- Generate new personal codes in the `FOXGEN-A7X92` style while preserving already-issued codes and links.
- Keep referral ownership immutable: only a brand-new Telegram user arriving through a valid link can create one pending referral, never self-refer, switch referrers, or earn twice.
- Make verification and manual approval use one atomic database operation so `1 verified referral = 1 credit` even under retries or simultaneous requests.
- Notify the referrer in Telegram after a successful automatic or manual award, including verified-referral and available-credit totals.
- Expand the member wallet with available, earned, spent, valid referral, and bonus-credit totals plus dated transaction details.
- Expand Invite & Earn with the personal code/link, next enabled reward, progress, and Telegram, WhatsApp, Facebook, and copy-share actions using the configured bot username.
- Expand admin referrals with search, pending/verified/rejected/suspicious filters, participant details, credit status, manual approve, and reject controls.
- Record suspicious/duplicate attempts for review and ensure rejection never awards credit.

## Technical details
- Add a focused database migration for atomic referral approval/rejection and integrity safeguards; all privileged functions remain service-only.
- Reuse the existing profile, referral, transaction, notification, fraud flag, reward, and settings tables.
- Update the server helpers, Telegram webhook, member data function/page, and admin function/page only.
- Keep current task completion and license redemption behavior intact.
- Validate with type checking, the live preview build log, and targeted route/API checks.
