ALTER TABLE public.shop_orders ADD COLUMN customer_user_id uuid;
CREATE INDEX shop_orders_customer_user_idx ON public.shop_orders(customer_user_id,created_at DESC);
COMMENT ON COLUMN public.shop_orders.customer_user_id IS 'Verified website auth user, separate from legacy Telegram profile_id; never inferred from email.';
GRANT SELECT ON public.shop_orders TO authenticated;
CREATE POLICY shop_orders_customer_read ON public.shop_orders FOR SELECT TO authenticated USING(customer_user_id = auth.uid());