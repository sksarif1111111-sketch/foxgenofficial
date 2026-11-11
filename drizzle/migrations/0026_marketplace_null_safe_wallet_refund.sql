CREATE OR REPLACE FUNCTION public.shop_refund_wallet_atomic(_id uuid,_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.shop_orders%ROWTYPE; BEGIN
 SELECT * INTO o FROM public.shop_orders WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR coalesce(o.payment_reference,'') NOT LIKE 'WALLET-%' OR o.profile_id IS NULL OR coalesce(o.total,0)<=0 OR o.status NOT IN ('cancelled','rejected','refunded') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.wallet_transactions WHERE order_id=_id AND kind='refund') THEN RETURN false; END IF;
 PERFORM public.wallet_credit(o.profile_id,o.total,'refund',_reason,o.id,'system'); RETURN true; END $$;
REVOKE ALL ON FUNCTION public.shop_refund_wallet_atomic(uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.shop_refund_wallet_atomic(uuid,text) TO service_role;