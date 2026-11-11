import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/api/admin/payment-proof/$id')({server:{handlers:{GET:async({params})=>{
  try {const {requireAdminAccess}=await import('@/lib/admin-access.server');await requireAdminAccess();}catch{return new Response('Unauthorized',{status:401});}
  if(!z.string().uuid().safeParse(params.id).success)return new Response('Invalid order',{status:400});
  const {db,tg,botToken}=await import('@/lib/hub.server');
  const order=await db.from('shop_orders').select('payment_evidence_url').eq('id',params.id).maybeSingle();
  const deposit=order.data ? null : await db.from('wallet_topup_requests').select('evidence_url').eq('id',params.id).maybeSingle();
  const evidence=order.data?.payment_evidence_url ?? deposit?.data?.evidence_url;
  if(!evidence?.startsWith('telegram-file:'))return new Response('Not found',{status:404});
  const file=await tg<{file_path?:string}>('getFile',{file_id:evidence.slice(14)});
  if(!file.ok||!file.result?.file_path)return new Response('Evidence unavailable',{status:502});
  const response=await fetch(`https://api.telegram.org/file/bot${botToken()}/${file.result.file_path}`);
  if(!response.ok)return new Response('Evidence unavailable',{status:502});
  return new Response(response.body,{headers:{'Content-Type':response.headers.get('Content-Type')||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}}}});