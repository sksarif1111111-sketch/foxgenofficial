import { test, expect } from 'bun:test';
import { walletUsd, dualPrice } from './wallet-rate';
test('100 rupees adds exactly one funded wallet dollar', () => { expect(walletUsd(100, 'INR')).toBe(1); expect(walletUsd(250, 'INR')).toBe(2.5); });
test('one USDT remains one wallet dollar', () => { expect(walletUsd(1, 'USDT')).toBe(1); });
test('dual price preserves existing Indian selling prices', () => { expect(dualPrice({ price_usdt: 1, price_inr: 150 })).toBe('$1.00 USDT · ₹150.00'); });