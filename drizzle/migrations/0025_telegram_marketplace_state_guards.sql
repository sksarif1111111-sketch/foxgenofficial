ALTER TABLE public.shop_webhook_work ADD COLUMN claim_token uuid;
CREATE OR REPLACE FUNCTION public.shop_claim_webhook(_id bigint,_token uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.shop_webhook_work%ROWTYPE; BEGIN
 INSERT INTO public.shop_webhook_work(update_id,claim_token) VALUES(_id,_token) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.shop_webhook_work WHERE update_id=_id FOR UPDATE;
 IF r.claim_token=_token THEN RETURN 'claimed'; END IF;
 IF r.status='completed' THEN RETURN 'completed'; END IF;
 IF r.locked_until>now() THEN RETURN 'busy'; END IF;
 UPDATE public.shop_webhook_work SET claim_token=_token,status='processing',locked_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() WHERE update_id=_id; RETURN 'claimed'; END $$;
REVOKE ALL ON FUNCTION public.shop_claim_webhook(bigint,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_claim_webhook(bigint,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.shop_cancel_atomic(_id uuid,_status text,_reason text,_actor text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.shop_orders%ROWTYPE; BEGIN
 IF _status NOT IN ('cancelled','rejected','expired') THEN RAISE EXCEPTION 'Invalid cancellation'; END IF;
 SELECT * INTO o FROM public.shop_orders WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.stock_consumed OR o.confirmed_at IS NOT NULL OR o.status NOT IN ('awaiting_payment','payment_submitted','under_review','awaiting_email') THEN RAISE EXCEPTION 'Order cannot be cancelled'; END IF;
 PERFORM public.shop_release_stock(_id);
 UPDATE public.shop_orders SET status=_status,reject_reason=CASE WHEN _status='rejected' THEN _reason ELSE reject_reason END,rejected_at=CASE WHEN _status='rejected' THEN now() ELSE rejected_at END,updated_at=now() WHERE id=_id;
 PERFORM public.shop_refund_wallet_atomic(_id,_reason);
 INSERT INTO public.shop_order_events(order_id,event,actor,details) VALUES(_id,_status,_actor,_reason); RETURN true; END $$;
REVOKE ALL ON FUNCTION public.shop_cancel_atomic(uuid,text,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_cancel_atomic(uuid,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.shop_mark_delayed() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.shop_orders%ROWTYPE; n integer:=0; sla integer:=30; BEGIN
 SELECT CASE WHEN value ~ '^[0-9]+$' THEN greatest(1,least(value::integer,1440)) ELSE 30 END INTO sla FROM public.app_settings WHERE key='shop_delivery_sla_minutes'; sla:=coalesce(sla,30);
 FOR o IN SELECT * FROM public.shop_orders WHERE confirmed_at IS NOT NULL AND status IN ('payment_confirmed','awaiting_fulfillment','awaiting_email') AND delayed_at IS NULL AND confirmed_at+make_interval(mins=>sla)<=now() FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.shop_orders SET delayed_at=now(),updated_at=now() WHERE id=o.id;
 INSERT INTO public.shop_order_events(order_id,event,actor,details) VALUES(o.id,'delayed','system','Delivery target exceeded');
 IF o.telegram_user_id IS NOT NULL THEN INSERT INTO public.shop_delivery_jobs(order_id,channel,target,payload) VALUES(o.id,'telegram',o.telegram_user_id::text,jsonb_build_object('text','Your order '||o.order_number||' is taking longer than expected. Our team is following up. Please contact Support for an update.')); END IF;
 n:=n+1; END LOOP; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.shop_mark_delayed() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_mark_delayed() TO service_role;
CREATE TABLE public.shop_inventory_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.products(id), content text NOT NULL, status text NOT NULL DEFAULT 'available', order_id uuid REFERENCES public.shop_orders(id), created_at timestamptz NOT NULL DEFAULT now(), assigned_at timestamptz);
GRANT ALL ON public.shop_inventory_items TO service_role;
ALTER TABLE public.shop_inventory_items ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX shop_inventory_product_content ON public.shop_inventory_items(product_id,md5(content));
CREATE OR REPLACE FUNCTION public.shop_assign_inventory(_order uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.shop_orders%ROWTYPE; i record; ids uuid[]; n integer:=0; BEGIN
 SELECT * INTO o FROM public.shop_orders WHERE id=_order FOR UPDATE;
 IF NOT FOUND OR o.status NOT IN ('payment_confirmed','awaiting_fulfillment') THEN RAISE EXCEPTION 'Payment must be confirmed'; END IF;
 IF EXISTS(SELECT 1 FROM public.shop_inventory_items WHERE order_id=_order) THEN RETURN 0; END IF;
 FOR i IN SELECT * FROM public.shop_order_items WHERE order_id=_order LOOP
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.shop_inventory_items WHERE product_id=i.product_id AND status='available' ORDER BY created_at,id LIMIT i.quantity FOR UPDATE SKIP LOCKED) q;
 IF coalesce(array_length(ids,1),0)<>i.quantity THEN RAISE EXCEPTION 'Not enough private inventory'; END IF;
 INSERT INTO public.shop_fulfillments(order_id,kind,content) SELECT _order,'code',content FROM public.shop_inventory_items WHERE id=ANY(ids);
 UPDATE public.shop_inventory_items SET status='assigned',order_id=_order,assigned_at=now() WHERE id=ANY(ids); n:=n+i.quantity;
 END LOOP;
 INSERT INTO public.shop_order_events(order_id,event,actor,details) VALUES(_order,'inventory_assigned','admin',n::text||' items'); RETURN n; END $$;
REVOKE ALL ON FUNCTION public.shop_assign_inventory(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_assign_inventory(uuid) TO service_role;