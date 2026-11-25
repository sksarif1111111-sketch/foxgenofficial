import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/api/admin/payment-proof/$id')({server:{handlers:{GET:async({params})=>{
  try {const {requireAdminAccess}=await import('@/lib/admin-access.server');await requireAdminAccess();}catch{return new Response('Unauthorized',{status:401});}
  if(!z.string().uuid().safeParse(params.id).success)return new Response('Invalid order',{status:400});
  const {db}=await import('@/lib/hub.server');
  const {loadProof,proofHeaders}=await import('@/lib/payment-proof.server');
  const order=await db.from('shop_orders').select('payment_evidence_url').eq('id',params.id).maybeSingle();
  const deposit=order.data ? null : await db.from('wallet_topup_requests').select('evidence_url').eq('id',params.id).maybeSingle();
  const proof=await loadProof(order.data?.payment_evidence_url ?? deposit?.data?.evidence_url);
  if(!proof.ok)return new Response(proof.status===404?'Not found':'Evidence unavailable',{status:proof.status});
  return new Response(proof.bytes as Uint8Array<ArrayBuffer>,{headers:proofHeaders(proof.type)});
}}}});
