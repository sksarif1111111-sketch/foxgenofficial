import { test, expect } from 'bun:test';
import { isReadOnlyBotAction } from './telegram-recovery';
import { supplierFailure } from './supplier-errors';

test('Shop, Wallet and Free rewards errors can be handled without webhook replay', () => {
  for (const action of ['shop', 'shop:2', 'wallet', 'walletlog', 'rewards']) expect(isReadOnlyBotAction(action)).toBe(true);
});
test('payment, refund, funding and redemption failures must retain retry fencing', () => {
  for (const action of ['pay:a:1:b', 'buystars:a:1', 'cancelshop:a', 'redeem:a', 'fundsubmit']) expect(isReadOnlyBotAction(action)).toBe(false);
});
test('DIGIHUP rejection is recognized without leaking provider body', () => {
  expect(supplierFailure(401, 'DIGIHUP', null)).toContain('DIGIHUP rejected the API key');
  expect(supplierFailure(200, 'DIGIHUP', { error: 'Invalid API key', debug: 'private-response' })).toContain('DIGIHUP rejected the API key');
  expect(supplierFailure(403, 'DIGIHUP', { message: 'private-response' })).not.toContain('private-response');
});