# Direct Bot License Generation Cleanup

## Goal
Make the Rewards dashboard the only customer redemption path: a customer spends the configured credits, a new FOXGEN license is created instantly in the main license system, and the bot immediately returns that key with usage instructions.

## Changes
- Keep the existing atomic direct-generation database flow and verify its live database definition.
- Remove the obsolete bulk license upload/inventory controls from the Rewards admin interface so manual key pasting is no longer part of the workflow.
- Replace inventory-oriented admin summaries with generated-license history sourced from the main FOXGEN license records/redemptions.
- Make the bot reward button and confirmation clearly state that the license is generated instantly; retain double-tap protection, My Licenses, download, and instructions.
- Remove obsolete `inventory_empty` handling from the customer redemption path.
- Preserve historical inventory and redemption records in the database; no existing data will be deleted.
- Verify the 5-credit / 15-day reward, one-credit-per-verified-referral rule, TypeScript, build status, and the visible bot/dashboard flow without spending a real customer’s credits.

## Technical details
- Redemption remains one database transaction: validate active account/reward/balance, create the canonical `licenses` row, create redemption and transaction history, deduct credits, and add a notification.
- The canonical license verification endpoint will continue recognizing every generated key because redemption writes directly to `licenses`.
- Existing row locks and Telegram action locks prevent concurrent or repeated redemption taps from double-charging.
