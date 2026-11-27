import { expect, test } from 'bun:test';
import { sessionIsFresh, paymentExpired, validDeliveryEmails, matchesMemberSearch } from './store-order.policy';
const time = Date.parse('2026-11-28T00:00:00Z');
test('funding expires after exactly thirty minutes of inactivity', () => {
  expect(sessionIsFresh('2026-11-28T00:00:00Z', time + 29 * 60000)).toBe(true);
  expect(sessionIsFresh('2026-11-28T00:00:00Z', time + 30 * 60000)).toBe(false);
});
test('unpaid expiry cannot expire a paid or reviewed order', () => {
  expect(paymentExpired({status:'awaiting_payment',expires_at:'2026-11-28T00:00:00Z'}, time)).toBe(true);
  expect(paymentExpired({status:'under_review',expires_at:'2026-11-28T00:00:00Z'}, time)).toBe(false);
});
test('checkout validates email format and one address or one per unit', () => {
  expect(validDeliveryEmails('bad',1)).toBe(false);
  expect(validDeliveryEmails('buyer@example.com',3)).toBe(true);
  expect(validDeliveryEmails('a@example.com,b@example.com',3)).toBe(false);
});
const member = {member_number:123,first_name:'Mirza',telegram_username:'foxbuyer',telegram_user_id:987654321};
test('member number search', () => expect(matchesMemberSearch(member,'M-000123')).toBe(true));
test('member name search', () => expect(matchesMemberSearch(member,'mirza')).toBe(true));
test('Telegram username search accepts @', () => expect(matchesMemberSearch(member,'@foxbuyer')).toBe(true));
test('Telegram ID search', () => expect(matchesMemberSearch(member,'987654321')).toBe(true));
test('member email search uses order contact without merging identities', () => expect(matchesMemberSearch(member,'buyer@example.com',['buyer@example.com'])).toBe(true));
test('unrelated search is not a match', () => expect(matchesMemberSearch(member,'unknown')).toBe(false));