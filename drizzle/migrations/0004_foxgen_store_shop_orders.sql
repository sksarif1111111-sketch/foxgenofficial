-- Shop fields on products (additive, nullable / defaulted)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS emoji TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'email_manual',
  ADD COLUMN IF NOT EXISTS requires_buyer_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS installation_instructions TEXT,
  ADD COLUMN IF NOT EXISTS private_delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS duration_label TEXT,
  ADD COLUMN IF NOT EXISTS credits_per_interval INTEGER,
  ADD COLUMN IF NOT EXISTS renewal_interval TEXT,
  ADD COLUMN IF NOT EXISTS price_usdt NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS price_inr NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS price_stars INTEGER,
  ADD COLUMN IF NOT EXISTS stock_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS max_per_order INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS shop_published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_order INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug) WHERE slug IS NOT NULL;

-- Payment method receiving details
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS network TEXT,
  ADD COLUMN IF NOT EXISTS recipient TEXT,
  ADD COLUMN IF NOT EXISTS recipient_label TEXT,
  ADD COLUMN IF NOT EXISTS settlement_asset TEXT,
  ADD COLUMN IF NOT EXISTS reference_label TEXT,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'website';

-- Order numbers
CREATE SEQUENCE IF NOT EXISTS public.shop_order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('FG-' || lpad(nextval('public.shop_order_number_seq')::text, 6, '0')),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  telegram_user_id BIGINT,
  customer_name TEXT,
  channel TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  currency TEXT NOT NULL DEFAULT 'USDT',
  total NUMERIC(14,2),
  stars_total INTEGER,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  payment_method_name TEXT,
  payment_network TEXT,
  payment_recipient TEXT,
  payment_reference TEXT,
  payment_evidence_url TEXT,
  telegram_charge_id TEXT,
  delivery_emails TEXT,
  review_notes TEXT,
  reject_reason TEXT,
  info_request TEXT,
  approved_by UUID,
  stock_consumed BOOLEAN NOT NULL DEFAULT false,
  stock_reserved BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_reference_unique
  ON public.shop_orders (payment_method_id, lower(payment_reference))
  WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON public.shop_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_profile_idx ON public.shop_orders (profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2),
  line_total NUMERIC(14,2),
  unit_stars INTEGER,
  currency TEXT NOT NULL DEFAULT 'USDT',
  delivery_email TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON public.shop_order_items (order_id);

CREATE TABLE IF NOT EXISTS public.shop_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  actor TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_order_events_order_idx ON public.shop_order_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS public.shop_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'instructions',
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_fulfillments_order_idx ON public.shop_fulfillments (order_id, created_at);

CREATE TABLE IF NOT EXISTS public.shop_delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  target TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_delivery_jobs_order_idx ON public.shop_delivery_jobs (order_id, created_at);

GRANT ALL ON public.shop_orders TO service_role;
GRANT ALL ON public.shop_order_items TO service_role;
GRANT ALL ON public.shop_order_events TO service_role;
GRANT ALL ON public.shop_fulfillments TO service_role;
GRANT ALL ON public.shop_delivery_jobs TO service_role;
GRANT USAGE ON SEQUENCE public.shop_order_number_seq TO service_role;

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_delivery_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_orders_service_only" ON public.shop_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "shop_order_items_service_only" ON public.shop_order_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "shop_order_events_service_only" ON public.shop_order_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "shop_fulfillments_service_only" ON public.shop_fulfillments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "shop_delivery_jobs_service_only" ON public.shop_delivery_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atomic stock reservation / release for tracked products
CREATE OR REPLACE FUNCTION public.shop_reserve_stock(_product_id UUID, _qty INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.products%ROWTYPE;
BEGIN
  IF _qty IS NULL OR _qty < 1 THEN RETURN false; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p.stock_mode <> 'tracked' THEN RETURN true; END IF;
  IF COALESCE(p.stock_quantity, 0) < _qty THEN RETURN false; END IF;
  UPDATE public.products SET stock_quantity = stock_quantity - _qty, updated_at = now() WHERE id = _product_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_release_stock(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.shop_orders%ROWTYPE;
  it public.shop_order_items%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.shop_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.stock_consumed OR NOT o.stock_reserved THEN RETURN false; END IF;
  FOR it IN SELECT * FROM public.shop_order_items WHERE order_id = _order_id LOOP
    UPDATE public.products
      SET stock_quantity = COALESCE(stock_quantity, 0) + it.quantity, updated_at = now()
      WHERE id = it.product_id AND stock_mode = 'tracked';
  END LOOP;
  UPDATE public.shop_orders SET stock_reserved = false, updated_at = now() WHERE id = _order_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.shop_reserve_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_release_stock(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_reserve_stock(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_release_stock(UUID) TO service_role;