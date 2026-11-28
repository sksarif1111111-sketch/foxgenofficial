import { z } from 'zod';
const user=z.object({id:z.number().int().safe(),username:z.string().max(64).optional(),first_name:z.string().max(256).optional(),last_name:z.string().max(256).optional()});
const chat=z.object({id:z.number().int().safe()});
const photos=z.array(z.object({file_id:z.string().min(1).max(256)})).max(10);
export const telegramUpdateSchema=z.object({
  update_id:z.number().int().nonnegative().safe(),
  message:z.object({chat,from:user.optional(),text:z.string().max(16384).optional(),photo:photos.optional(),successful_payment:z.object({currency:z.string().max(10),total_amount:z.number().int().nonnegative(),invoice_payload:z.string().max(128),telegram_payment_charge_id:z.string().max(256)}).optional()}).optional(),
  callback_query:z.object({id:z.string().min(1).max(256),from:user,data:z.string().max(64).optional(),message:z.object({chat,message_id:z.number().int().positive(),photo:photos.optional()}).optional()}).optional(),
  pre_checkout_query:z.object({id:z.string().max(256),from:user,total_amount:z.number().int().nonnegative(),invoice_payload:z.string().max(128)}).optional(),
});