# Reliable referrals and verified-only invites

## Build
- Make account activation and the one-credit referral reward one atomic operation, safe to retry without duplicate credits.
- Surface verification and referral-credit failures instead of silently continuing.
- Hide referral links and invite actions on both Telegram and the web dashboard until all required tasks are verified.
- Keep pending users directed to Tasks, then unlock Invite immediately after activation.

## Technical details
- Add the missing tracked task-verification columns and an idempotent database function that activates the user and awards any pending referral together.
- Reuse the existing unique referral transaction protection and immutable referrer rules.
- Validate the TypeScript result and current preview build logs.
