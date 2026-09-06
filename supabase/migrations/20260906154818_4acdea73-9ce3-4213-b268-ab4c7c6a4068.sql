CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon_url text,
  display_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct browser access" ON public.product_categories FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  description text,
  icon_url text,
  logo_url text,
  banner_url text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  product_type text NOT NULL DEFAULT 'digital_product',
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_free boolean NOT NULL DEFAULT true,
  giveaway_enabled boolean NOT NULL DEFAULT false,
  referral_required boolean NOT NULL DEFAULT false,
  credit_cost integer NOT NULL DEFAULT 0,
  license_required boolean NOT NULL DEFAULT false,
  download_url text,
  download_file_path text,
  tutorial_url text,
  installation_guide_url text,
  status text NOT NULL DEFAULT 'active',
  featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct browser access" ON public.products FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  duration_days integer,
  credit_cost integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_prices TO service_role;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct browser access" ON public.product_prices FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.product_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  file_url text,
  telegram_file_id text,
  version text,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_files TO service_role;
ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct browser access" ON public.product_files FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'telegram',
  url text NOT NULL,
  telegram_chat_id text,
  icon text,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct browser access" ON public.communities FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  currency text NOT NULL DEFAULT 'USD',
  instructions text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct browser access" ON public.payment_methods FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'info',
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct browser access" ON public.activity_logs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_module ON public.activity_logs (module);
CREATE INDEX idx_products_status ON public.products (status, display_order);