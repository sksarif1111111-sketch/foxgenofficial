ALTER TABLE public.products ADD COLUMN IF NOT EXISTS telegram_image_file_id text, ADD COLUMN IF NOT EXISTS telegram_image_source text;
CREATE OR REPLACE FUNCTION public.bot_buyer_stats(_profile_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  WITH o AS (SELECT id::text AS k, status, currency, CASE WHEN currency='XTR' THEN coalesce(stars_total,0) ELSE coalesce(total,0) END::numeric AS amt
             FROM shop_orders WHERE profile_id=_profile_id AND channel='telegram'),
  t AS (SELECT currency, sum(amt) AS total, min(k) AS first FROM o
        WHERE status IN ('delivered','payment_confirmed','awaiting_email','awaiting_fulfillment') GROUP BY currency)
  SELECT jsonb_build_object(
    'completed', (SELECT count(*) FROM o WHERE status='delivered'),
    'pending', (SELECT count(*) FROM o WHERE status NOT IN ('delivered','cancelled','rejected','expired','refunded')),
    'totals', coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'total',total) ORDER BY first) FROM t),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.bot_buyer_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_buyer_stats(uuid) TO service_role;