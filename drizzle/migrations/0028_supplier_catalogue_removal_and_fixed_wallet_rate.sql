ALTER TABLE public.products ADD COLUMN supplier_removed boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.shop_guard_supplier_product() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE provider text; disabled boolean;
BEGIN
 IF NEW.reseller_product_id IS NOT NULL THEN
 provider:=CASE WHEN NEW.reseller_product_id LIKE 'digihup:%' THEN 'digihup' ELSE 'reseller' END;
 SELECT value='true' INTO disabled FROM public.app_settings WHERE key='supplier_disabled_'||provider;
 IF COALESCE(disabled,false) OR NEW.supplier_removed THEN NEW.supplier_removed:=true; NEW.shop_published:=false; NEW.status:='archived'; NEW.availability:='out_of_stock'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shop_guard_supplier_product BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.shop_guard_supplier_product();
CREATE OR REPLACE FUNCTION public.shop_remove_supplier(_provider text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 IF _provider NOT IN ('reseller','digihup') THEN RAISE EXCEPTION 'Unknown supplier'; END IF;
 INSERT INTO public.app_settings(key,value,updated_at) VALUES('supplier_disabled_'||_provider,'true',now()) ON CONFLICT(key) DO UPDATE SET value='true',updated_at=now();
 UPDATE public.products SET supplier_removed=true,shop_published=false,status='archived',availability='out_of_stock',updated_at=now() WHERE reseller_product_id IS NOT NULL AND (CASE WHEN reseller_product_id LIKE 'digihup:%' THEN 'digihup' ELSE 'reseller' END)=_provider;
 GET DIAGNOSTICS affected=ROW_COUNT;
 UPDATE public.crm_products SET active=false,updated_at=now() WHERE reseller_product_id IS NOT NULL AND (CASE WHEN reseller_product_id LIKE 'digihup:%' THEN 'digihup' ELSE 'reseller' END)=_provider;
 UPDATE public.store_offers SET status='archived',updated_at=now() WHERE source=_provider OR product_id IN (SELECT id FROM public.products WHERE supplier_removed AND reseller_product_id IS NOT NULL AND (CASE WHEN reseller_product_id LIKE 'digihup:%' THEN 'digihup' ELSE 'reseller' END)=_provider);
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.shop_remove_supplier(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_remove_supplier(text) TO service_role;
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
 INSERT INTO public.shop_crm_entity_outbox(entity,external_id,payload) VALUES('payments',r.id,jsonb_build_object('entity','payments','external_id',r.id,'name','Wallet top up','status',r.status,'amount',r.amount,'currency',r.currency,'updated_at',r.reviewed_at,'data',jsonb_build_object('customer_external_id',r.profile_id,'method',r.method,'network',r.network,'reference',r.reference,'credit_usd',r.credit_usd,'admin_note',r.admin_note,'created_at',r.created_at)));
 PERFORM cron.alter_job(1,active:=true);
 RETURN jsonb_build_object('profile_id',r.profile_id,'amount',r.amount,'currency',r.currency,'credit_usd',r.credit_usd,'balance',balance);
END $$;
REVOKE ALL ON FUNCTION public.shop_review_wallet_topup(uuid,boolean,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_review_wallet_topup(uuid,boolean,text,numeric) TO service_role;