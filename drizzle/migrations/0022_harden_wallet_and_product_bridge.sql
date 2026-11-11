CREATE OR REPLACE FUNCTION public.shop_crm_upsert_product(_input jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p uuid; BEGIN
 IF nullif(trim(_input->>'reseller_product_id'),'') IS NULL OR nullif(trim(_input->>'name'),'') IS NULL OR (_input->>'stock_quantity')::integer<0 OR (_input->>'price_usdt')::numeric<0 OR (_input->>'price_inr')::numeric<0 OR (_input->>'price_stars')::integer<0 THEN RAISE EXCEPTION 'Invalid product'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_input->>'reseller_product_id',0));
 SELECT id INTO p FROM public.products WHERE reseller_product_id=_input->>'reseller_product_id';
 IF p IS NULL THEN INSERT INTO public.products(name,reseller_product_id,short_description,price_usdt,price_inr,price_stars,stock_quantity,stock_mode,image_url,shop_published,status,price,currency,is_free) VALUES(_input->>'name',_input->>'reseller_product_id',_input->>'short_description',(_input->>'price_usdt')::numeric,(_input->>'price_inr')::numeric,(_input->>'price_stars')::integer,(_input->>'stock_quantity')::integer,'tracked',_input->>'image_url',false,'draft',coalesce((_input->>'price_usdt')::numeric,0),'USDT',false) RETURNING id INTO p;
 ELSE UPDATE public.products SET name=_input->>'name',short_description=coalesce(_input->>'short_description',short_description),price_usdt=(_input->>'price_usdt')::numeric,price_inr=(_input->>'price_inr')::numeric,price_stars=(_input->>'price_stars')::integer,stock_quantity=(_input->>'stock_quantity')::integer,image_url=coalesce(_input->>'image_url',image_url),updated_at=clock_timestamp() WHERE id=p; END IF;
 RETURN p;
END $$;
CREATE OR REPLACE FUNCTION public.shop_admin_wallet_deduct(_profile uuid,_amount numeric,_note text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE tx uuid; BEGIN
 IF _note IS NULL OR length(trim(_note))<3 OR _amount IS NULL OR _amount<=0 OR _amount>100000 THEN RAISE EXCEPTION 'Amount and note required'; END IF;
 IF NOT public.wallet_debit(_profile,_amount,NULL,_note) THEN RETURN false; END IF;
 SELECT id INTO tx FROM public.wallet_transactions WHERE profile_id=_profile ORDER BY created_at DESC LIMIT 1;
 UPDATE public.wallet_transactions SET kind='adjustment',actor='admin' WHERE id=tx;
 RETURN true;
END $$;