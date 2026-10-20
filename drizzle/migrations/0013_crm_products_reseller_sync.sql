ALTER TABLE public.crm_products
  ADD COLUMN IF NOT EXISTS reseller_product_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS wholesale_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS reseller_currency text,
  ADD COLUMN IF NOT EXISTS reseller_stock integer,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;