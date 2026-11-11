export type TelegramButton = { text: string; url?: string; callback_data?: string; copy_text?: { text: string } };
export type TelegramKeyboard = TelegramButton[][];
type TelegramResult = { ok: boolean; description?: string; error_code?: number; parameters?: { retry_after?: number } };
type TelegramCall = (method: string, body: Record<string, unknown>) => Promise<TelegramResult>;

/** Replace callback screens; new user messages still receive a new reply. */
export function telegramRenderer(call: TelegramCall, chatId: number, messageId?: number, hasPhoto = false) {
  return async (body: string, keyboard: TelegramKeyboard, image?: string | null) => {
    const reply_markup = { inline_keyboard: keyboard };
    if (messageId) {
      const method = image ? 'editMessageMedia' : hasPhoto && body.length <= 1024 ? 'editMessageCaption' : 'editMessageText';
      const content = image ? { media: { type: 'photo', media: image, caption: body, parse_mode: 'HTML' } }
        : method === 'editMessageCaption' ? { caption: body, parse_mode: 'HTML' }
        : { text: body, parse_mode: 'HTML', disable_web_page_preview: true };
      const edited = await call(method, { chat_id: chatId, message_id: messageId, ...content, reply_markup });
      if (edited.ok || edited.description?.includes('message is not modified')) return;
      if (edited.error_code === 429 || edited.parameters?.retry_after || edited.description?.includes('Too Many Requests')) return;
    }
    let sent: TelegramResult;
    if (image && body.length <= 1024) {
      sent = await call('sendPhoto', { chat_id: chatId, photo: image, caption: body, parse_mode: 'HTML', reply_markup });
      if (!sent.ok) sent = await call('sendMessage', { chat_id: chatId, text: body, parse_mode: 'HTML', reply_markup });
    } else sent = await call('sendMessage', { chat_id: chatId, text: body, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup });
    if (!sent.ok) {
      if (sent.error_code === 429 || sent.parameters?.retry_after || sent.description?.includes('Too Many Requests')) return;
      throw new Error(`Telegram screen failed: ${sent.description ?? 'unknown error'}`);
    }
    // A non-editable older message must not retain an active duplicate menu.
    if (messageId) await call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
  };
}

export function telegramHomeKeyboard(active: boolean, icon: (key: string, fallback: string) => string): TelegramKeyboard {
  return [
    [{ text: '🛍️ Shop', callback_data: 'shop' }, { text: '👛 Wallet', callback_data: 'wallet' }],
    [{ text: `${icon('rewards', '🎁')} Free Rewards`, callback_data: 'rewards' }, { text: '👤 Profile', callback_data: 'storeprofile' }],
    [{ text: `${icon('support', '💬')} Support`, callback_data: 'support' }, { text: `${icon('help', 'ℹ️')} Help`, callback_data: 'help' }],
  ];
}