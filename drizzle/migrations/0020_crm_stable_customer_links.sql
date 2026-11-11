ALTER TABLE public.shop_orders ADD COLUMN customer_external_id uuid;
ALTER TABLE public.shop_orders ADD COLUMN customer_first_seen_at timestamptz;
CREATE INDEX shop_orders_customer_external_idx ON public.shop_orders(customer_external_id, created_at);
CREATE OR REPLACE FUNCTION public.shop_crm_customer_id(_profile uuid, _customer uuid, _emails text, _telegram bigint) RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT COALESCE(_profile, _customer, CASE WHEN nullif(trim(split_part(_emails, ',', 1)), '') IS NOT NULL THEN md5('email:' || lower(trim(split_part(_emails, ',', 1))))::uuid WHEN _telegram IS NOT NULL THEN md5('telegram:' || _telegram::text)::uuid END);
$$;
REVOKE ALL ON FUNCTION public.shop_crm_customer_id(uuid,uuid,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_crm_customer_id(uuid,uuid,text,bigint) TO service_role;
UPDATE public.shop_orders SET customer_external_id=public.shop_crm_customer_id(profile_id,customer_user_id,delivery_emails,telegram_user_id);
UPDATE public.shop_orders o SET customer_first_seen_at=(SELECT min(h.created_at) FROM public.shop_orders h WHERE h.customer_external_id=o.customer_external_id) WHERE o.customer_external_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.shop_set_crm_customer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.customer_external_id IS NOT NULL THEN
  NEW.customer_external_id:=OLD.customer_external_id;
  NEW.customer_first_seen_at:=OLD.customer_first_seen_at;
 ELSE
  NEW.customer_external_id:=public.shop_crm_customer_id(NEW.profile_id,NEW.customer_user_id,NEW.delivery_emails,NEW.telegram_user_id);
  IF NEW.customer_external_id IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.customer_external_id::text,0));
   SELECT min(created_at) INTO NEW.customer_first_seen_at FROM public.shop_orders WHERE customer_external_id=NEW.customer_external_id;
   NEW.customer_first_seen_at:=LEAST(COALESCE(NEW.customer_first_seen_at,NEW.created_at),NEW.created_at);
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shop_set_crm_customer() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER shop_orders_crm_customer BEFORE INSERT OR UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.shop_set_crm_customer();
CREATE OR REPLACE FUNCTION public.shop_crm_order_snapshot(_order_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object('order', jsonb_build_object('id',o.id,'order_number',o.order_number,'channel',o.channel,'status',o.status,'total',o.total,'currency',o.currency,'stars_total',o.stars_total,'updated_at',o.updated_at,'created_at',o.created_at,'profile_id',o.profile_id,'customer_user_id',o.customer_user_id,'customer_external_id',o.customer_external_id,'customer_first_seen_at',o.customer_first_seen_at,'customer_name',o.customer_name,'delivery_emails',o.delivery_emails,'telegram_user_id',o.telegram_user_id,'telegram_username',p.telegram_username,'payment_method_name',o.payment_method_name,'payment_reference',o.payment_reference,'confirmed_at',o.confirmed_at,'delivered_at',o.delivered_at), 'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('product_name',i.product_name,'quantity',i.quantity,'snapshot',jsonb_build_object('price_usdt',i.snapshot->'price_usdt'))) FROM public.shop_order_items i WHERE i.order_id=o.id), '[]'::jsonb), 'has_fulfillment', EXISTS(SELECT 1 FROM public.shop_fulfillments f WHERE f.order_id=o.id)) FROM public.shop_orders o LEFT JOIN public.profiles p ON p.id=o.profile_id WHERE o.id=_order_id;
$$;
REVOKE ALL ON FUNCTION public.shop_crm_order_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_crm_order_snapshot(uuid) TO service_role;
UPDATE public.shop_crm_outbox q SET payload=jsonb_set(q.payload,'{order}',(q.payload->'order') || jsonb_build_object('customer_external_id',o.customer_external_id,'customer_first_seen_at',o.customer_first_seen_at,'profile_id',o.profile_id,'customer_user_id',o.customer_user_id,'created_at',o.created_at,'telegram_username',p.telegram_username)) FROM public.shop_orders o LEFT JOIN public.profiles p ON p.id=o.profile_id WHERE q.order_id=o.id AND q.sent_at IS NULL;
