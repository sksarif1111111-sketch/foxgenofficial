CREATE TABLE public.store_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  headline text,
  description text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  image_url text,
  badge text,
  cta_text text NOT NULL DEFAULT 'View offer',
  cta_url text,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  featured boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_offers_status_check CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT store_offers_source_check CHECK (source IN ('manual', 'reseller', 'digihup'))
);
CREATE INDEX store_offers_live_idx ON public.store_offers (status, priority DESC);
CREATE INDEX store_offers_product_idx ON public.store_offers (product_id);
GRANT ALL ON public.store_offers TO service_role;
ALTER TABLE public.store_offers ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.store_offers IS 'Promotional offers shown on the storefront; read and written only through password-guarded server functions.';
CREATE TRIGGER store_offers_touch BEFORE UPDATE ON public.store_offers FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

CREATE TABLE public.integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  added integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT integration_sync_runs_status_check CHECK (status IN ('success', 'partial', 'failed')),
  CONSTRAINT integration_sync_runs_trigger_check CHECK (trigger IN ('manual', 'auto'))
);
CREATE INDEX integration_sync_runs_provider_idx ON public.integration_sync_runs (provider, started_at DESC);
GRANT ALL ON public.integration_sync_runs TO service_role;
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.integration_sync_runs IS 'History of supplier API synchronisations; server-side only.';