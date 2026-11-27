/** Credit plans sold from the Licence Center. Custom amounts are allowed up to MAX_CREDITS. */
export const CREDIT_PLANS = [100, 200, 300, 400, 500] as const;
export const MAX_CREDITS = 100000;
export const MAX_DEDUCT_PER_CALL = 100;

export type CreditFields = {
  credit_total: number | null;
  credit_balance: number | null;
};

/**
 * Credit numbers sent to the extension. A licence without a credit plan has 0 credits
 * (the admin adds credits from the Licence Center); the extension shows these values as-is.
 */
export function creditPayload(row: CreditFields) {
  const credits = Math.max(0, row.credit_balance ?? 0);
  const max = Math.max(credits, row.credit_total ?? 0);
  return {
    credits,
    credits_remaining: credits,
    balance: credits,
    max_credits: max,
    total_credits: max,
    credit_quota: max,
    quota: max,
  };
}

export function creditLabel(row: CreditFields) {
  if (row.credit_total === null || row.credit_balance === null) return null;
  return `${row.credit_balance} / ${row.credit_total}`;
}
