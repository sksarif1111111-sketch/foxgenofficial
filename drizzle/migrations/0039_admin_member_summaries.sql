CREATE OR REPLACE FUNCTION public.shop_member_summaries(_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
WITH members AS (SELECT id FROM public.profiles WHERE id = ANY(_ids)),
spending AS (SELECT profile_id,currency,sum(CASE WHEN currency='XTR' THEN coalesce(stars_total,0) ELSE coalesce(total,0) END) AS total FROM public.shop_orders WHERE profile_id=ANY(_ids) AND status IN ('payment_confirmed','awaiting_email','awaiting_fulfillment','delivered') GROUP BY profile_id,currency)
SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'balance',coalesce(w.balance_usd,0),'orders',(SELECT count(*) FROM public.shop_orders o WHERE o.profile_id=m.id),'spent',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',s.currency,'total',s.total) ORDER BY s.currency) FROM spending s WHERE s.profile_id=m.id),'[]'::jsonb))),'[]'::jsonb) FROM members m LEFT JOIN public.wallets w ON w.profile_id=m.id;
$function$;
REVOKE ALL ON FUNCTION public.shop_member_summaries(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_member_summaries(uuid[]) TO service_role;