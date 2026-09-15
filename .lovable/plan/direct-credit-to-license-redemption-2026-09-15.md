# Direct Credit-to-License Redemption

## Goal
Replace bulk license inventory redemption with direct, secure license generation from the existing FOXGEN license system.

## What will change
- Keep the existing reward configuration, including 15 days for 5 referral credits.
- Generate a unique FOXGEN license key during redemption instead of requiring an uploaded inventory key.
- Validate account status, reward availability, duration, and credit balance on the server.
- Complete license creation, credit deduction, transaction history, redemption history, and notification atomically.
- Prevent rapid duplicate taps from creating duplicate redemptions.
- Show the generated license immediately with Download Extension, tutorial when configured, How to Use, My Licenses, and Back actions.
- Keep My Licenses and the database-driven instructions available after the user leaves and returns.
- Preserve the existing referral rule: one fully verified referral awards exactly one credit once.
- Remove the obsolete inventory requirement from the redemption flow without deleting historical license or redemption records.

## Technical details
- Update the existing database redemption function to use its server-generated key input and stop reading from `license_inventory`.
- Add a short-lived per-user/per-reward redemption lock around the Telegram action, while database row locking protects balances and writes.
- Keep generated keys in the existing `licenses` and `license_redemptions` tables so the current license verification API recognizes them.
- Verify the TypeScript check, current build status, and focused database behavior without spending a real user's credits.
