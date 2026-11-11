CREATE SEQUENCE public.profile_member_number_seq;
ALTER TABLE public.profiles ADD COLUMN member_number bigint DEFAULT nextval('public.profile_member_number_seq') UNIQUE;
CREATE TABLE public.shop_customer_accounts (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, member_number bigint NOT NULL DEFAULT nextval('public.profile_member_number_seq') UNIQUE, email text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.shop_customer_accounts TO service_role;
ALTER TABLE public.shop_customer_accounts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.shop_crm_entity_outbox (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity text NOT NULL, external_id uuid NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, attempts integer NOT NULL DEFAULT 0, last_error text, locked_until timestamptz, claim_token uuid);
GRANT ALL ON public.shop_crm_entity_outbox TO service_role;
ALTER TABLE public.shop_crm_entity_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX shop_crm_entity_pending ON public.shop_crm_entity_outbox(created_at) WHERE sent_at IS NULL;
CREATE TABLE public.wallet_topup_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES public.profiles(id), amount numeric(12,2) NOT NULL CHECK(amount>0), currency text NOT NULL CHECK(currency IN ('USDT','INR')), method text NOT NULL, network text, recipient_used text NOT NULL, reference text, evidence_url text, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), admin_note text, credit_usd numeric(12,2), created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz);
GRANT ALL ON public.wallet_topup_requests TO service_role;
ALTER TABLE public.wallet_topup_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX wallet_topup_reference_unique ON public.wallet_topup_requests(method,lower(reference)) WHERE reference IS NOT NULL;
CREATE TABLE public.wallet_topup_sessions (profile_id uuid PRIMARY KEY REFERENCES public.profiles(id), method_id uuid NOT NULL REFERENCES public.payment_methods(id), amount numeric(12,2), reference text, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wallet_topup_sessions TO service_role;
ALTER TABLE public.wallet_topup_sessions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.shop_enqueue_customer(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 SELECT jsonb_build_object('entity','customers','external_id',p.id,'name',trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),'status','','amount',null,'currency',null,'updated_at',clock_timestamp(),'data',jsonb_build_object('customer_external_id',p.id,'member_number','M-'||lpad(p.member_number::text,greatest(6,length(p.member_number::text)), '0'),'telegram_user_id',p.telegram_user_id,'telegram_username',p.telegram_username,'email',null,'joined_at',p.created_at,'first_seen_at',p.created_at,'wallet_balance',coalesce(w.balance_usd,0),'wallet_currency','USD')) INTO r FROM public.profiles p LEFT JOIN public.wallets w ON w.profile_id=p.id WHERE p.id=_id;
 IF r IS NULL THEN
 SELECT jsonb_build_object('entity','customers','external_id',a.user_id,'name',coalesce(a.email,''),'status','','amount',null,'currency',null,'updated_at',clock_timestamp(),'data',jsonb_build_object('customer_external_id',a.user_id,'member_number','M-'||lpad(a.member_number::text,greatest(6,length(a.member_number::text)),'0'),'email',a.email,'telegram_user_id',null,'telegram_username',null,'joined_at',a.created_at,'first_seen_at',a.created_at,'wallet_balance',0,'wallet_currency','USD')) INTO r FROM public.shop_customer_accounts a WHERE a.user_id=_id;
 END IF;
 IF r IS NOT NULL THEN INSERT INTO public.shop_crm_entity_outbox(entity,external_id,payload) VALUES('customers',_id,r); PERFORM cron.alter_job(1,active:=true); END IF;
END $$;
REVOKE ALL ON FUNCTION public.shop_enqueue_customer(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_enqueue_customer(uuid) TO service_role;
CREATE FUNCTION public.shop_member_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.shop_enqueue_customer(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER profiles_crm_directory AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.shop_member_changed();
CREATE FUNCTION public.shop_wallet_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.shop_enqueue_customer(NEW.profile_id); RETURN NEW; END $$;
CREATE TRIGGER wallets_crm_directory AFTER INSERT OR UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.shop_wallet_changed();
CREATE FUNCTION public.shop_auth_customer_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.shop_customer_accounts(user_id,email,created_at,updated_at) VALUES(NEW.id,NEW.email,NEW.created_at,now()) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,updated_at=now(); PERFORM public.shop_enqueue_customer(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER shop_auth_directory AFTER INSERT OR UPDATE OF email,email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.shop_auth_customer_changed();
INSERT INTO public.shop_customer_accounts(user_id,email,created_at) SELECT id,email,created_at FROM auth.users ON CONFLICT DO NOTHING;
DO $$ DECLARE i uuid; BEGIN FOR i IN SELECT id FROM public.profiles UNION ALL SELECT user_id FROM public.shop_customer_accounts LOOP PERFORM public.shop_enqueue_customer(i); END LOOP; END $$;
CREATE FUNCTION public.shop_review_wallet_topup(_id uuid,_approve boolean,_note text,_credit_usd numeric DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.wallet_topup_requests; credit numeric; balance numeric;
BEGIN
 SELECT * INTO r FROM public.wallet_topup_requests WHERE id=_id FOR UPDATE;
 IF r.id IS NULL OR r.status<>'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
 IF length(trim(_note))<3 THEN RAISE EXCEPTION 'Note required'; END IF;
 credit:=CASE WHEN r.currency='USDT' THEN r.amount ELSE _credit_usd END;
 IF _approve THEN
 IF credit IS NULL OR credit<=0 OR credit>100000 THEN RAISE EXCEPTION 'Verified USD credit required for INR'; END IF;
 balance:=public.wallet_credit(r.profile_id,credit,'topup','Request '||r.id||': '||_note,NULL,'admin');
 END IF;
 UPDATE public.wallet_topup_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,admin_note=_note,credit_usd=CASE WHEN _approve THEN credit ELSE NULL END,reviewed_at=clock_timestamp() WHERE id=_id RETURNING * INTO r;
 INSERT INTO public.shop_crm_entity_outbox(entity,external_id,payload) VALUES('payments',r.id,jsonb_build_object('entity','payments','external_id',r.id,'name','Wallet top up','status',r.status,'amount',r.amount,'currency',r.currency,'updated_at',r.reviewed_at,'data',jsonb_build_object('customer_external_id',r.profile_id,'method',r.method,'network',r.network,'reference',r.reference,'credit_usd',r.credit_usd,'admin_note',r.admin_note,'created_at',r.created_at)));
 PERFORM cron.alter_job(1,active:=true);
 RETURN jsonb_build_object('profile_id',r.profile_id,'amount',r.amount,'currency',r.currency,'balance',balance);
END $$;
REVOKE ALL ON FUNCTION public.shop_review_wallet_topup(uuid,boolean,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_review_wallet_topup(uuid,boolean,text,numeric) TO service_role;
CREATE FUNCTION public.shop_admin_wallet_deduct(_profile uuid,_amount numeric,_note text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE tx uuid; BEGIN
 IF length(trim(_note))<3 THEN RAISE EXCEPTION 'Note required'; END IF;
 IF NOT public.wallet_debit(_profile,_amount,NULL,_note) THEN RETURN false; END IF;
 SELECT id INTO tx FROM public.wallet_transactions WHERE profile_id=_profile ORDER BY created_at DESC LIMIT 1;
 UPDATE public.wallet_transactions SET kind='adjustment',actor='admin' WHERE id=tx;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.shop_admin_wallet_deduct(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_admin_wallet_deduct(uuid,numeric,text) TO service_role;
CREATE FUNCTION public.shop_claim_crm_entities(_token uuid) RETURNS SETOF public.shop_crm_entity_outbox LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ WITH picked AS (SELECT id FROM public.shop_crm_entity_outbox WHERE sent_at IS NULL AND (locked_until IS NULL OR locked_until<now()) ORDER BY created_at,id LIMIT 50 FOR UPDATE SKIP LOCKED) UPDATE public.shop_crm_entity_outbox q SET locked_until=now()+interval '3 minutes',claim_token=_token,attempts=attempts+1 FROM picked WHERE q.id=picked.id RETURNING q.* $$;
REVOKE ALL ON FUNCTION public.shop_claim_crm_entities(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_claim_crm_entities(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.shop_pause_crm_when_drained() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN LOCK TABLE public.shop_crm_outbox,public.shop_crm_entity_outbox IN SHARE ROW EXCLUSIVE MODE; IF NOT EXISTS(SELECT 1 FROM public.shop_crm_outbox WHERE sent_at IS NULL) AND NOT EXISTS(SELECT 1 FROM public.shop_crm_entity_outbox WHERE sent_at IS NULL) THEN PERFORM cron.alter_job(1,active:=false); END IF; END $$;
CREATE FUNCTION public.shop_crm_upsert_product(_input jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p uuid; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_input->>'reseller_product_id',0));
 SELECT id INTO p FROM public.products WHERE reseller_product_id=_input->>'reseller_product_id';
 IF p IS NULL THEN INSERT INTO public.products(name,reseller_product_id,short_description,price_usdt,price_inr,price_stars,stock_quantity,stock_mode,image_url,shop_published,status,price,currency) VALUES(_input->>'name',_input->>'reseller_product_id',_input->>'short_description',(_input->>'price_usdt')::numeric,(_input->>'price_inr')::numeric,(_input->>'price_stars')::integer,(_input->>'stock_quantity')::integer,'limited',_input->>'image_url',false,'draft',coalesce((_input->>'price_usdt')::numeric,0),'USDT') RETURNING id INTO p;
 ELSE UPDATE public.products SET name=_input->>'name',short_description=coalesce(_input->>'short_description',short_description),price_usdt=(_input->>'price_usdt')::numeric,price_inr=(_input->>'price_inr')::numeric,price_stars=(_input->>'price_stars')::integer,stock_quantity=(_input->>'stock_quantity')::integer,image_url=coalesce(_input->>'image_url',image_url),updated_at=clock_timestamp() WHERE id=p; END IF;
 RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.shop_crm_upsert_product(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_crm_upsert_product(jsonb) TO service_role;