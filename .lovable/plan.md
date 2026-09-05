# Fix Telegram verification, duplicate messages, profiles, and downloads

## Changes
- Make Telegram channel verification report the real per-channel failure instead of silently showing “not joined”; preserve previously verified memberships during temporary Telegram errors.
- Prevent Telegram webhook retries from processing the same update more than once, so community and task messages are not duplicated.
- Refresh each returning Telegram user's name and username from their latest Telegram profile, and display their available profile details clearly in the bot and Rewards Hub.
- Deduplicate enabled social tasks defensively so YouTube, WhatsApp, Facebook, and Telegram entries appear once even if duplicate rows are added later.
- Make the Rewards Hub extension button download the current ZIP directly from the website and verify that the file is present and downloadable.
- Keep all referral, credit, reward, license, admin, and extension systems unchanged.

## Technical details
- Add a small server-only table for processed Telegram update IDs with explicit grants, RLS, and deny-direct-access policy.
- Update the Telegram webhook and shared verification/profile helpers; do not expose bot credentials or private profile data.
- Validate with TypeScript, build diagnostics, database checks, and live route/download smoke tests.

## Required Telegram setup
- The Oxygen/FoxGEN bot must be added as an administrator in both Telegram channels. Telegram only guarantees `getChatMember` checks for other users when the bot is an administrator; the improved diagnostics will identify this configuration issue directly.
