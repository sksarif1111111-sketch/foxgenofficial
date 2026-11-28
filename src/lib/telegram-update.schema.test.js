import {test,expect} from 'bun:test';
import {telegramUpdateSchema} from './telegram-update.schema';
test('webhook update requires a valid retry identity',()=>{
  expect(telegramUpdateSchema.safeParse({update_id:1,message:{chat:{id:123},from:{id:123},text:'/start'}}).success).toBe(true);
  expect(telegramUpdateSchema.safeParse({message:{chat:{id:123}}}).success).toBe(false);
});
test('malformed Telegram callback and oversized payload are rejected',()=>{
  expect(telegramUpdateSchema.safeParse({update_id:1,callback_query:{id:'a',from:{id:123},data:'x'.repeat(65)}}).success).toBe(false);
  expect(telegramUpdateSchema.safeParse({update_id:1,message:{chat:{id:'not-a-number'}}}).success).toBe(false);
});