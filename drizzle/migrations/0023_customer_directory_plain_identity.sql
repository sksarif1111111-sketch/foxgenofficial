ALTER TABLE public.shop_customer_accounts DROP CONSTRAINT shop_customer_accounts_user_id_fkey;
CREATE FUNCTION public.shop_auth_customer_removed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN DELETE FROM public.shop_customer_accounts WHERE user_id=OLD.id; RETURN OLD; END $$;
REVOKE ALL ON FUNCTION public.shop_auth_customer_removed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shop_auth_directory_remove AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.shop_auth_customer_removed();