import type { TelegramKeyboard } from './telegram-navigation';

type Method = { id: string; name: string; provider: string; currency: string; recipient: string | null };
export function paymentMenu(productId: string, quantity: number, methods: Method[], prices: { price_inr: number | null; price_usdt: number | null }, balance: number): TelegramKeyboard {
  return methods.filter(m => ['wallet', 'upi', 'binance_id', 'usdt_bep20'].includes(m.provider)
    && (m.provider === 'wallet' || Boolean(m.recipient))
    && (m.currency === 'INR' ? prices.price_inr !== null : prices.price_usdt !== null))
    .map(m => [{ text: m.provider === 'wallet' ? `👛 Wallet ($${balance.toFixed(2)})` : `${m.provider === 'upi' ? '🔵' : '🟢'} ${m.name}`,
      // UUID + UUID exceeds Telegram's 64-byte callback limit. Resolve provider server-side.
      callback_data: `pay:${productId}:${quantity}:${m.provider}`, style: m.provider === 'upi' ? 'primary' : 'success' }]);
}