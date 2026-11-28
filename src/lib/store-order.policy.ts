export const FUNDING_SESSION_MS = 30 * 60_000;
export const ORDER_STATUSES: Record<string, string> = {
  awaiting_payment: 'Awaiting payment', payment_submitted: 'Under review',
  under_review: 'Under review', awaiting_email: 'Email needed',
  payment_confirmed: 'Confirmed', awaiting_fulfillment: 'Preparing',
  delivered: 'Delivered', expired: 'Expired', cancelled: 'Cancelled', rejected: 'Rejected', refunded: 'Refunded',
};
export function sessionIsFresh(updatedAt: string, now = Date.now()) {
  const updated = Date.parse(updatedAt);
  return Number.isFinite(updated) && now - updated < FUNDING_SESSION_MS;
}
export function paymentExpired(order: { status: string; expires_at?: string | null }, now = Date.now()) {
  return order.status === 'awaiting_payment' && !!order.expires_at && Date.parse(order.expires_at) <= now;
}
export function orderStatus(order: { status: string; expires_at?: string | null }, now = Date.now()) {
  return paymentExpired(order, now) ? 'Expired' : ORDER_STATUSES[order.status] ?? 'Processing';
}
export function validDeliveryEmails(raw: string, quantity: number) {
  const emails = raw.split(',').map(s => s.trim()).filter(Boolean);
  return (emails.length === 1 || emails.length === quantity) && emails.every(s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s));
}
export function matchesMemberSearch(member: { member_number: number | null; first_name: string | null; last_name?: string | null; telegram_username: string | null; telegram_user_id: number; referral_code?: string }, term: string, emails: string[] = []) {
  const q = term.trim().replace(/^@/, '').toLowerCase();
  if (!q) return true;
  const number = member.member_number;
  return [member.first_name, member.last_name, member.telegram_username, member.telegram_user_id,
    member.referral_code, number, number === null ? null : `M-${String(number).padStart(6, '0')}`, ...emails]
    .some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
}
export function customerErrorMessage(error: unknown) {
  const message=error instanceof Error?error.message.toLowerCase():'';
  if(/insufficient|balance/.test(message))return 'Your wallet balance is too low. Add funds or choose another payment method.';
  if(/quantity|stock|product unavailable/.test(message))return 'This quantity is no longer available. Refresh the product and choose another quantity.';
  if(/payment method|price or wallet|provider|reseller/.test(message))return 'Payment is temporarily unavailable. Please try again in a few minutes.';
  if(/verify your email/.test(message))return 'Verify your email before ordering. Check your inbox or sign in again.';
  if(/email/.test(message))return 'Enter a valid delivery email, or one email per unit.';
  if(/transaction|reference/.test(message))return 'Check your transaction reference and try again. Contact Support if it was already submitted.';
  if(/screenshot|upload|proof/.test(message))return 'The payment screenshot could not be saved. Choose a JPEG, PNG or WebP under 5 MB and retry.';
  if(/auth|sign-in|session/.test(message))return 'Please sign in again, then retry your action.';
  if(/no longer waiting|expired|cannot be cancelled/.test(message))return 'This order has changed. Open My orders to check its latest status.';
  return 'This action could not be completed. Please retry or contact Support with your order number.';
}