# Design — CRM UI/UX

## Theme
- Dark professional dashboard; all colors from semantic tokens in `src/styles.css` (no hardcoded colors).
- Accent: FoxGEN cyan/blue for primary actions and profit highlights; destructive token for losses.

## Layout
- Sticky top bar: brand, signed-in email, sign out.
- Horizontal scrollable nav on mobile; same nav on desktop.
- Content max width ~1280px, generous spacing.

## Dashboard
- KPI cards: Income, Investment, Net Profit, Reseller wallet balance.
- Today + This month blocks.
- Charts: daily profit/loss line or bar for the current month; revenue vs investment comparison.
- Recent sales list.

## Tables (products, sales, customers)
- Clean tabular layout, right-aligned tabular numbers, status badges.
- Filters above table (date range, source, product, search), CSV export button.
- Mobile: tables scroll horizontally; key columns first.

## Forms
- Manual sale: single card, two/three-column grid on desktop, one column on mobile; live total and profit preview.
- Clear validation messages from `text.md`.

## Responsiveness
- Must work from 360px width upward.
