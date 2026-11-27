CREATE OR REPLACE FUNCTION public.shop_expire_unpaid(_profile uuid DEFAULT NULL, _customer uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE o record; n integer := 0;
BEGIN
  IF _profile IS NULL AND _customer IS NULL THEN RETURN 0; END IF;
  FOR o IN SELECT id FROM public.shop_orders
    WHERE status = 'awaiting_payment' AND expires_at <= now()
      AND ((_profile IS NOT NULL AND profile_id = _profile) OR (_customer IS NOT NULL AND customer_user_id = _customer AND channel = 'website'))
    ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.shop_cancel_atomic(o.id, 'expired', 'Unpaid order expired', 'system');
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.shop_expire_unpaid(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_expire_unpaid(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.bot_buyer_stats(_profile_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $function$
  WITH o AS (SELECT id::text AS k, status, currency, CASE WHEN currency='XTR' THEN coalesce(stars_total,0) ELSE coalesce(total,0) END::numeric AS amt FROM public.shop_orders WHERE profile_id=_profile_id),
  t AS (SELECT currency, sum(amt) AS total, min(k) AS first FROM o WHERE status IN ('delivered','payment_confirmed','awaiting_email','awaiting_fulfillment') GROUP BY currency)
  SELECT jsonb_build_object('placed', (SELECT count(*) FROM o), 'completed', (SELECT count(*) FROM o WHERE status='delivered'), 'pending', (SELECT count(*) FROM o WHERE status NOT IN ('delivered','cancelled','rejected','expired','refunded')), 'totals', coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'total',total) ORDER BY first) FROM t),'[]'::jsonb));
$function$;
REVOKE ALL ON FUNCTION public.bot_buyer_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_buyer_stats(uuid) TO service_role;