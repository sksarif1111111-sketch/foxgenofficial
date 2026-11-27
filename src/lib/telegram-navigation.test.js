import { describe, it, expect } from 'bun:test';
import { telegramRenderer, telegramHomeKeyboard } from './telegram-navigation';

describe('single Telegram navigation screen', () => {
  const keyboard = [[{ text: 'Shop', callback_data: 'shop' }]];
  it('edits an existing text screen without sending a second message', async () => {
    const calls = [];
    await telegramRenderer(async method => { calls.push(method); return { ok: true }; }, 12, 34)('Products', keyboard);
    expect(calls).toEqual(['editMessageText']);
  });
  it('does not resend an unchanged screen', async () => {
    const calls = [];
    await telegramRenderer(async method => { calls.push(method); return { ok: false, description: 'Bad Request: message is not modified' }; }, 12, 34)('Products', keyboard);
    expect(calls).toEqual(['editMessageText']);
  });
  it('replaces a product photo instead of sending another photo', async () => {
    const calls = [];
    await telegramRenderer(async method => { calls.push(method); return { ok: true }; }, 12, 34, true)('Product', keyboard, 'https://example.com/product.jpg');
    expect(calls).toEqual(['editMessageMedia']);
  });
  it('edits a photo caption when returning to a short menu', async () => {
    const calls = [];
    await telegramRenderer(async method => { calls.push(method); return { ok: true }; }, 12, 34, true)('Home', keyboard);
    expect(calls).toEqual(['editMessageCaption']);
  });
  it('retires the old keyboard when replacing a noneditable screen', async () => {
    const calls = [];
    await telegramRenderer(async method => { calls.push(method); return { ok: method !== 'editMessageText' }; }, 12, 34)('Products', keyboard);
    expect(calls).toEqual(['editMessageText', 'sendMessage', 'editMessageReplyMarkup']);
  });
  it('keeps one Shop and customer Profile while retaining legacy reward actions', () => {
    const actions = telegramHomeKeyboard(true, (_, fallback) => fallback).flat().map(b => b.callback_data);
    expect(actions.filter(a => a === 'shop')).toHaveLength(1);
    expect(actions.filter(a => a === 'storeprofile')).toHaveLength(1);
    expect(new Set(actions).size).toBe(actions.length);
    expect(actions).toEqual(['shop', 'wallet', 'myorders', 'storeprofile', 'invite', 'rewards', 'support', 'help']);
  });
  it('keeps invitations hidden for inactive buyers', () => {
    expect(telegramHomeKeyboard(false, (_, fallback) => fallback).flat().map(b => b.callback_data)).not.toContain('invite');
  });
  it('does not send a duplicate screen when Telegram throttles an edit', async () => {
    const calls = [];
    await telegramRenderer(async method => { calls.push(method); return { ok: false, error_code: 429, parameters: { retry_after: 9 } }; }, 12, 34)('Home', keyboard);
    expect(calls).toEqual(['editMessageText']);
  });
});