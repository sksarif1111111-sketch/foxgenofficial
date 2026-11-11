/** Owner-defined accounting rate; not a live exchange-rate quote. */
export const INR_PER_WALLET_USD = 100;
export function walletUsd(amount: number, currency: string) { return currency === 'INR' ? amount / INR_PER_WALLET_USD : amount; }
export function dualPrice(p: { price_usdt: number | null; price_inr: number | null }) {
  return [p.price_usdt === null ? null : `$${p.price_usdt.toFixed(2)} USDT`, p.price_inr === null ? null : `₹${p.price_inr.toFixed(2)}`].filter(Boolean).join(' · ') || 'Price not configured';
}