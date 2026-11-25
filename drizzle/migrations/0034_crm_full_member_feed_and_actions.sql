CREATE TABLE public.customer_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Message from FOXGEN STORE',
  body text NOT NULL,
  order_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_notices_user_idx ON public.customer_notices(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.customer_notices TO authenticated;
GRANT ALL ON public.customer_notices TO service_role;
ALTER TABLE public.customer_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers read own notices" ON public.customer_notices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Customers mark own notices read" ON public.customer_notices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.shop_crm_action_requests (
  request_key text PRIMARY KEY,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  http_status integer,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shop_crm_action_requests TO service_role;
ALTER TABLE public.shop_crm_action_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.shop_customer_stats(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'total_orders', count(*) FILTER (WHERE status IN ('payment_confirmed','awaiting_fulfillment','delivered')),
    'total_spent', coalesce((SELECT jsonb_object_agg(currency, amt) FROM (SELECT currency, round(sum(total),2) amt FROM public.shop_orders WHERE customer_external_id=_id AND status IN ('payment_confirmed','awaiting_fulfillment','delivered') AND total IS NOT NULL GROUP BY currency) s), '{}'::jsonb),
    'last_order_at', max(created_at),
    'last_email', (SELECT lower(trim(split_part(delivery_emails,',',1))) FROM public.shop_orders WHERE customer_external_id=_id AND nullif(trim(delivery_emails),'') IS NOT NULL ORDER BY created_at DESC LIMIT 1))
  FROM public.shop_orders WHERE customer_external_id=_id
$$;
REVOKE ALL ON FUNCTION public.shop_customer_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_customer_stats(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.shop_enqueue_customer(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; s jsonb;
BEGIN
 IF _id IS NULL THEN RETURN; END IF;
 s := public.shop_customer_stats(_id);
 SELECT jsonb_build_object('entity','customers','external_id',p.id,'name',trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),'status',p.status,'amount',null,'currency',null,'updated_at',clock_timestamp(),
  'data',jsonb_build_object('customer_external_id',p.id,'channel','telegram',
   'member_number','M-'||lpad(p.member_number::text,greatest(6,length(p.member_number::text)),'0'),
   'name',trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),
   'email',s->>'last_email','telegram_user_id',p.telegram_user_id,'telegram_username',p.telegram_username,
   'joined_at',p.created_at,'first_seen_at',p.created_at,
   'wallet_balance',coalesce(w.balance_usd,0),'wallet_currency','USD',
   'credit_balance',p.credits_available,'credits_earned',p.credits_earned,'credits_spent',p.credits_spent,
   'total_orders',(s->>'total_orders')::int,'total_spent',s->'total_spent','last_order_at',s->'last_order_at'))
 INTO r FROM public.profiles p LEFT JOIN public.wallets w ON w.profile_id=p.id WHERE p.id=_id;
 IF r IS NULL THEN
  SELECT jsonb_build_object('entity','customers','external_id',a.user_id,'name',coalesce(a.email,''),'status','active','amount',null,'currency',null,'updated_at',clock_timestamp(),
   'data',jsonb_build_object('customer_external_id',a.user_id,'channel','website',
    'member_number','M-'||lpad(a.member_number::text,greatest(6,length(a.member_number::text)),'0'),
    'name',coalesce(u.raw_user_meta_data->>'display_name',a.email,''),
    'email',a.email,'telegram_user_id',null,'telegram_username',null,
    'joined_at',a.created_at,'first_seen_at',a.created_at,
    'wallet_balance',0,'wallet_currency','USD','credit_balance',0,'credits_earned',0,'credits_spent',0,
    'total_orders',(s->>'total_orders')::int,'total_spent',s->'total_spent','last_order_at',s->'last_order_at'))
  INTO r FROM public.shop_customer_accounts a LEFT JOIN auth.users u ON u.id=a.user_id WHERE a.user_id=_id;
 END IF;
 IF r IS NOT NULL THEN INSERT INTO public.shop_crm_entity_outbox(entity,external_id,payload) VALUES('customers',_id,r); PERFORM cron.alter_job(1,active:=true); END IF;
END $$;
REVOKE ALL ON FUNCTION public.shop_enqueue_customer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_enqueue_customer(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.shop_enqueue_topup(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.wallet_topup_requests;
BEGIN
 SELECT * INTO r FROM public.wallet_topup_requests WHERE id=_id;
 IF r.id IS NULL THEN RETURN; END IF;
 INSERT INTO public.shop_crm_entity_outbox(entity,external_id,payload) VALUES('payments',r.id,jsonb_build_object('entity','payments','external_id',r.id,'name','Wallet top up','status',r.status,'amount',r.amount,'currency',r.currency,'updated_at',coalesce(r.reviewed_at,r.created_at,clock_timestamp()),
  'data',jsonb_build_object('customer_external_id',r.profile_id,'method',r.method,'network',r.network,'reference',r.reference,'has_payment_proof',r.evidence_url IS NOT NULL,'credit_usd',r.credit_usd,'admin_note',r.admin_note,'created_at',r.created_at,'reviewed_at',r.reviewed_at)));
 PERFORM cron.alter_job(1,active:=true);
END $$;
REVOKE ALL ON FUNCTION public.shop_enqueue_topup(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_enqueue_topup(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.shop_topup_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.shop_enqueue_topup(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER wallet_topups_crm_feed AFTER INSERT OR UPDATE ON public.wallet_topup_requests FOR EACH ROW EXECUTE FUNCTION public.shop_topup_changed();

CREATE OR REPLACE FUNCTION public.shop_order_customer_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN PERFORM public.shop_enqueue_customer(NEW.customer_external_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shop_orders_customer_feed AFTER INSERT OR UPDATE OF status ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.shop_order_customer_changed();

-- Review function: the topup trigger now emits the payment record (with proof flag).
CREATE OR REPLACE FUNCTION public.shop_review_wallet_topup(_id uuid, _approve boolean, _note text, _credit_usd numeric DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.wallet_topup_requests; credit numeric; balance numeric;
BEGIN
 SELECT * INTO r FROM public.wallet_topup_requests WHERE id=_id FOR UPDATE;
 IF r.id IS NULL OR r.status<>'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
 IF length(trim(_note))<3 THEN RAISE EXCEPTION 'Note required'; END IF;
 IF r.currency NOT IN ('USDT','INR') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;
 credit:=CASE WHEN r.currency='USDT' THEN r.amount ELSE r.amount/100 END;
 IF _approve THEN
 IF credit IS NULL OR credit<=0 OR credit>100000 THEN RAISE EXCEPTION 'Invalid wallet amount'; END IF;
 balance:=public.wallet_credit(r.profile_id,credit,'topup','Request '||r.id||': '||_note,NULL,'admin');
 END IF;
 UPDATE public.wallet_topup_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,admin_note=_note,credit_usd=CASE WHEN _approve THEN credit ELSE NULL END,reviewed_at=clock_timestamp() WHERE id=_id RETURNING * INTO r;
 RETURN jsonb_build_object('profile_id',r.profile_id,'amount',r.amount,'currency',r.currency,'credit_usd',r.credit_usd,'balance',balance);
END $$;
REVOKE ALL ON FUNCTION public.shop_review_wallet_topup(uuid,boolean,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_review_wallet_topup(uuid,boolean,text,numeric) TO service_role;

-- Backfill every member and every top-up request.
DO $$ DECLARE x uuid; BEGIN
 FOR x IN SELECT id FROM public.profiles ORDER BY created_at LOOP PERFORM public.shop_enqueue_customer(x); END LOOP;
 FOR x IN SELECT user_id FROM public.shop_customer_accounts WHERE user_id NOT IN (SELECT id FROM public.profiles) LOOP PERFORM public.shop_enqueue_customer(x); END LOOP;
 FOR x IN SELECT id FROM public.wallet_topup_requests ORDER BY created_at LOOP PERFORM public.shop_enqueue_topup(x); END LOOP;
END $$;