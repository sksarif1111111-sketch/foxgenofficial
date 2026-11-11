ALTER TABLE public.shop_crm_outbox ADD COLUMN payload jsonb;
CREATE FUNCTION public.shop_crm_order_snapshot(_order_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object('order', jsonb_build_object('id', o.id, 'order_number',o.order_number,'channel',o.channel,'status',o.status,'total',o.total,'currency',o.currency,'stars_total',o.stars_total,'updated_at',o.updated_at,'customer_name',o.customer_name,'delivery_emails',o.delivery_emails,'telegram_user_id',o.telegram_user_id,'payment_method_name',o.payment_method_name,'payment_reference',o.payment_reference,'confirmed_at',o.confirmed_at,'delivered_at',o.delivered_at), 'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('product_name',i.product_name,'quantity',i.quantity,'snapshot',jsonb_build_object('price_usdt',i.snapshot->'price_usdt'))) FROM public.shop_order_items i WHERE i.order_id=o.id), '[]'::jsonb), 'has_fulfillment', EXISTS(SELECT 1 FROM public.shop_fulfillments f WHERE f.order_id=o.id)) FROM public.shop_orders o WHERE o.id=_order_id;
$$;
REVOKE ALL ON FUNCTION public.shop_crm_order_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_crm_order_snapshot(uuid) TO service_role;
UPDATE public.shop_crm_outbox SET payload=public.shop_crm_order_snapshot(order_id) WHERE payload IS NULL;
CREATE OR REPLACE FUNCTION public.shop_enqueue_crm_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.shop_crm_outbox(order_id,payload) VALUES (NEW.id,public.shop_crm_order_snapshot(NEW.id));
 PERFORM cron.alter_job(1, active := true);
 RETURN NEW;
END $$;
CREATE FUNCTION public.shop_pause_crm_when_drained() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 LOCK TABLE public.shop_crm_outbox IN SHARE ROW EXCLUSIVE MODE;
 IF NOT EXISTS(SELECT 1 FROM public.shop_crm_outbox WHERE sent_at IS NULL) THEN
   PERFORM cron.alter_job(1, active := false);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.shop_pause_crm_when_drained() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_pause_crm_when_drained() TO service_role;
CREATE OR REPLACE FUNCTION public.shop_claim_crm_outbox(_token uuid) RETURNS SETOF public.shop_crm_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 WITH picked AS (
 SELECT id FROM public.shop_crm_outbox WHERE sent_at IS NULL AND (locked_until IS NULL OR locked_until < now()) ORDER BY created_at,id LIMIT 5 FOR UPDATE SKIP LOCKED
 ) UPDATE public.shop_crm_outbox o SET locked_until = now() + interval '3 minutes', claim_token = _token, attempts = attempts + 1 FROM picked WHERE o.id = picked.id RETURNING o.*;
$$;
REVOKE ALL ON FUNCTION public.shop_claim_crm_outbox(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_claim_crm_outbox(uuid) TO service_role;