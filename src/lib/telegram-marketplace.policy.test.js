import { describe, it, expect } from 'vitest';
import { quantityChoices, orderTime } from './telegram-marketplace.policy';
describe('Telegram marketplace rules', () => {
  it('offers 1, 2, 3, 5 and all available units without exceeding stock', () => {
    expect(quantityChoices(18)).toEqual([1,2,3,5,18]);
    expect(quantityChoices(2)).toEqual([1,2]);
    expect(quantityChoices(0)).toEqual([]);
  });
  it('uses confirmed server timestamp and a thirty minute delivery window', () => {
    expect(orderTime('2026-11-11T00:00:00Z',null,30,Date.parse('2026-11-11T00:00:01Z'))).toBe('29:59 remaining');
    expect(orderTime('2026-11-11T00:00:00Z',null,30,Date.parse('2026-11-11T00:30:00Z'))).toContain('Delayed');
  });
  it('preserves final elapsed delivery time', () => {
    expect(orderTime('2026-11-11T00:00:00Z','2026-11-11T00:18:00Z',30)).toBe('Delivered in 18 min');
  });
  it('respects the configured minimum quantity', () => {
    expect(quantityChoices(8,3)).toEqual([3,5,8]);
    expect(quantityChoices(2,3)).toEqual([]);
  });
});