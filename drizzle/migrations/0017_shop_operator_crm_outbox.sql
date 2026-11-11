CREATE TABLE public.shop_crm_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 locked_until timestamptz,
 claim_token uuid
);
GRANT ALL ON public.shop_crm_outbox TO service_role;
ALTER TABLE public.shop_crm_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX shop_crm_outbox_pending ON public.shop_crm_outbox(created_at) WHERE sent_at IS NULL;
CREATE FUNCTION public.shop_enqueue_crm_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.shop_crm_outbox(order_id) VALUES (NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER shop_orders_enqueue_crm AFTER INSERT OR UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.shop_enqueue_crm_order();
CREATE FUNCTION public.shop_enqueue_crm_material() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.shop_orders SET updated_at = clock_timestamp() WHERE id = NEW.order_id;
 RETURN NEW;
END $$;
CREATE TRIGGER shop_fulfillment_enqueue_crm AFTER INSERT OR UPDATE ON public.shop_fulfillments FOR EACH ROW EXECUTE FUNCTION public.shop_enqueue_crm_material();
CREATE TRIGGER shop_items_enqueue_crm AFTER INSERT OR UPDATE ON public.shop_order_items FOR EACH ROW EXECUTE FUNCTION public.shop_enqueue_crm_material();
CREATE FUNCTION public.shop_claim_crm_outbox(_token uuid) RETURNS SETOF public.shop_crm_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 WITH picked AS (
 SELECT id FROM public.shop_crm_outbox WHERE sent_at IS NULL AND (locked_until IS NULL OR locked_until < now()) ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED
 ) UPDATE public.shop_crm_outbox o SET locked_until = now() + interval '2 minutes', claim_token = _token, attempts = attempts + 1 FROM picked WHERE o.id = picked.id RETURNING o.*;
$$;
REVOKE ALL ON FUNCTION public.shop_claim_crm_outbox(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_claim_crm_outbox(uuid) TO service_role;
INSERT INTO public.shop_crm_outbox(order_id) SELECT id FROM public.shop_orders;