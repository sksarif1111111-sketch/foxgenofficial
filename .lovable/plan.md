# Fix final Telegram verification step

## Changes
- Keep both Telegram channels as separate task records, but always place them together after every other task.
- Check both channel memberships only from the final verification action and accept every Telegram status that represents a current member.
- Show customers only simple follow/retry guidance; keep channel access and bot setup details inside admin diagnostics and error logs.
- Preserve completed tasks and previously verified channel memberships during temporary Telegram failures.
- Verify the task flow, current data ordering, and preview health without changing the rest of the application.

## Technical details
- Centralize task ordering and Telegram membership interpretation in the existing server helper.
- Return safe user-facing verification results while retaining detailed server-side logging.
