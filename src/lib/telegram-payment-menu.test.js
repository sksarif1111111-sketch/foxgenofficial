import { describe, it, expect } from 'bun:test';
import { paymentMenu } from './telegram-payment-menu';
describe('Telegram checkout payment rules', () => {
  const methods = [
    { id:'a', name:'Wallet', provider:'wallet', currency:'USDT', recipient:null },
    { id:'b', name:'Binance Pay', provider:'binance_id', currency:'USDT', recipient:'1243916662' },
    { id:'c', name:'UPI', provider:'upi', currency:'INR', recipient:'8016848213-2@ybl' },
  ];
  it('keeps every payment callback within Telegram’s 64 bytes', () => {
    const keys = paymentMenu('12345678-1234-1234-1234-123456789012',100000,methods,{price_inr:100,price_usdt:1},2).flat();
    expect(keys).toHaveLength(3);
    for (const key of keys) expect(new TextEncoder().encode(key.callback_data).length).toBeLessThanOrEqual(64);
  });
  it('offers wallet, Binance and UPI without enabling an unconfigured recipient', () => {
    const keys = paymentMenu('product',1,[...methods,{id:'d',name:'Unconfigured',provider:'usdt_bep20',currency:'USDT',recipient:null}],{price_inr:100,price_usdt:1},2).flat();
    expect(keys.map(k=>k.callback_data.split(':').at(-1))).toEqual(['wallet','binance_id','upi']);
  });
});