import { test, expect } from 'bun:test';
import { supplierOf, supplierEnabled } from './supplier-policy';
test('supplier identity excludes manually managed products', () => { expect(supplierOf(null)).toBeNull(); expect(supplierOf('digihup:123')).toBe('digihup'); expect(supplierOf('123')).toBe('reseller'); });
test('removed supplier cannot sync while other suppliers remain enabled', () => { const settings = { supplier_disabled_reseller: 'true' }; expect(supplierEnabled('reseller', settings)).toBe(false); expect(supplierEnabled('digihup', settings)).toBe(true); });