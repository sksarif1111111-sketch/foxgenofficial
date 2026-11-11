ALTER TABLE public.products ADD COLUMN IF NOT EXISTS warranty_label text, ADD COLUMN IF NOT EXISTS min_per_order integer NOT NULL DEFAULT 1;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS checkout_key text, ADD COLUMN IF NOT EXISTS delayed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_checkout_key_unique ON public.shop_orders(checkout_key) WHERE checkout_key IS NOT NULL;
CREATE TABLE public.shop_bot_sessions (profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, state text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.shop_bot_sessions TO service_role;
ALTER TABLE public.shop_bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.shop_webhook_work (update_id bigint PRIMARY KEY, status text NOT NULL DEFAULT 'processing', locked_until timestamptz NOT NULL DEFAULT now() + interval '2 minutes', attempts integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.shop_webhook_work TO service_role;
ALTER TABLE public.shop_webhook_work ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.shop_claim_webhook(_id bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 INSERT INTO public.shop_webhook_work(update_id) VALUES(_id) ON CONFLICT(update_id) DO UPDATE SET status='processing',locked_until=now()+interval '2 minutes',attempts=shop_webhook_work.attempts+1,updated_at=now() WHERE shop_webhook_work.status<>'completed' AND shop_webhook_work.locked_until<now(); RETURN FOUND; END $$;
REVOKE ALL ON FUNCTION public.shop_claim_webhook(bigint) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_claim_webhook(bigint) TO service_role;
CREATE OR REPLACE FUNCTION public.shop_create_order_atomic(_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products%ROWTYPE; m public.payment_methods%ROWTYPE; o public.shop_orders%ROWTYPE; qty integer; cur text; unit numeric; stars integer; expiry integer; pid uuid; channel text; ck text; wallet boolean:=false;
BEGIN
 channel:=_input->>'channel'; pid:=nullif(_input->>'profileId','')::uuid; qty:=(_input->>'quantity')::integer; ck:=nullif(_input->>'checkoutKey','');
 IF channel NOT IN ('website','telegram') OR qty IS NULL OR qty<1 THEN RAISE EXCEPTION 'Invalid order'; END IF;
 IF ck IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(ck,0)); SELECT * INTO o FROM public.shop_orders WHERE checkout_key=ck; IF FOUND THEN RETURN to_jsonb(o); END IF; END IF;
 SELECT * INTO p FROM public.products WHERE id=(_input->>'productId')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT p.shop_published OR p.status='archived' OR p.availability<>'in_stock' THEN RAISE EXCEPTION 'Product unavailable'; END IF;
 IF qty< p.min_per_order OR qty>p.max_per_order OR (p.stock_mode='tracked' AND coalesce(p.stock_quantity,0)<qty) THEN RAISE EXCEPTION 'Quantity exceeds available stock or purchase limits'; END IF;
 IF channel='telegram' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=pid AND telegram_user_id=(_input->>'telegramUserId')::bigint) THEN RAISE EXCEPTION 'Buyer mismatch'; END IF;
 IF nullif(_input->>'paymentMethodId','') IS NOT NULL THEN
 SELECT * INTO m FROM public.payment_methods WHERE id=(_input->>'paymentMethodId')::uuid AND enabled;
 IF NOT FOUND OR (channel='website' AND m.channel<>'website') OR m.provider NOT IN ('wallet','upi','binance_id','usdt_solana','usdt_bep20') THEN RAISE EXCEPTION 'Payment method unavailable'; END IF;
 cur:=m.currency; unit:=CASE WHEN cur='INR' THEN p.price_inr ELSE p.price_usdt END; wallet:=m.provider='wallet';
 IF unit IS NULL OR unit<=0 OR (wallet AND pid IS NULL) THEN RAISE EXCEPTION 'Price or wallet unavailable'; END IF;
 ELSE
 IF channel<>'telegram' OR coalesce(p.price_stars,0)<=0 THEN RAISE EXCEPTION 'Choose an available payment method'; END IF;
 cur:='XTR'; stars:=p.price_stars;
 END IF;
 SELECT CASE WHEN value ~ '^[0-9]+$' THEN greatest(1,least(value::integer,1440)) ELSE 20 END INTO expiry FROM public.app_settings WHERE key='shop_unpaid_expiry_minutes'; expiry:=coalesce(expiry,20);
 IF p.stock_mode='tracked' THEN UPDATE public.products SET stock_quantity=stock_quantity-qty,updated_at=now() WHERE id=p.id; END IF;
 INSERT INTO public.shop_orders(profile_id,customer_user_id,telegram_user_id,customer_name,channel,status,currency,total,stars_total,payment_method_id,payment_method_name,payment_network,payment_recipient,stock_reserved,expires_at,checkout_key)
 VALUES(pid,nullif(_input->>'customerUserId','')::uuid,nullif(_input->>'telegramUserId','')::bigint,_input->>'customerName',channel,'awaiting_payment',cur,CASE WHEN unit IS NOT NULL THEN round(unit*qty,2) END,stars*qty,m.id,coalesce(m.name,'Telegram Stars'),m.network,m.recipient,true,now()+make_interval(mins=>expiry),ck) RETURNING * INTO o;
 INSERT INTO public.shop_order_items(order_id,product_id,product_name,quantity,unit_price,line_total,unit_stars,currency,snapshot) VALUES(o.id,p.id,p.name,qty,unit,round(unit*qty,2),stars,cur,jsonb_build_object('name',p.name,'duration_label',p.duration_label,'features',p.features,'terms',p.terms,'delivery_method',p.delivery_method,'requires_buyer_email',CASE WHEN channel='telegram' THEN p.requires_buyer_email ELSE true END,'price_usdt',p.price_usdt,'price_inr',p.price_inr,'price_stars',p.price_stars));
 IF wallet THEN
 IF NOT public.wallet_debit(pid,o.total,o.id,p.name||' x'||qty) THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
 UPDATE public.shop_orders SET payment_reference='WALLET-'||o.order_number,status=CASE WHEN channel='telegram' AND NOT p.requires_buyer_email THEN 'awaiting_fulfillment' ELSE 'awaiting_email' END,submitted_at=now(),confirmed_at=now(),stock_consumed=true,updated_at=now() WHERE id=o.id RETURNING * INTO o;
 END IF;
 INSERT INTO public.shop_order_events(order_id,event,actor,details) VALUES(o.id,'order_created','customer',p.name||' x'||qty);
 RETURN to_jsonb(o);
END $$;
REVOKE ALL ON FUNCTION public.shop_create_order_atomic(jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_create_order_atomic(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.shop_refund_wallet_atomic(_id uuid,_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.shop_orders%ROWTYPE; BEGIN
 SELECT * INTO o FROM public.shop_orders WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR o.payment_reference NOT LIKE 'WALLET-%' OR o.profile_id IS NULL OR o.total<=0 OR o.status NOT IN ('cancelled','rejected','refunded') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.wallet_transactions WHERE order_id=_id AND kind='refund') THEN RETURN false; END IF;
 PERFORM public.wallet_credit(o.profile_id,o.total,'refund',_reason,o.id,'system'); RETURN true; END $$;
REVOKE ALL ON FUNCTION public.shop_refund_wallet_atomic(uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_refund_wallet_atomic(uuid,text) TO service_role;