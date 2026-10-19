-- Admin-only sales CRM (crm_ prefix keeps it separate from the live store tables)

CREATE OR REPLACE FUNCTION public.crm_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TABLE public.crm_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  telegram_username text,
  country text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  description text,
  default_sale_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (default_sale_price >= 0),
  default_cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (default_cost_price >= 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.crm_products(id) ON DELETE RESTRICT,
  batch_code text,
  supplier text,
  quantity_total integer NOT NULL CHECK (quantity_total >= 0),
  quantity_remaining integer NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_remaining <= quantity_total)
);

CREATE TABLE public.crm_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('CRM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','confirmed','fulfilled','cancelled','refunded')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','partially_paid','paid','partially_refunded','refunded')),
  currency char(3) NOT NULL DEFAULT 'USD',
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  source text,
  notes text,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.crm_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.crm_products(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.crm_inventory_batches(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_sale_price numeric(12,2) NOT NULL CHECK (unit_sale_price >= 0),
  unit_cost_price numeric(12,2) NOT NULL CHECK (unit_cost_price >= 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  line_total numeric(14,2) GENERATED ALWAYS AS (quantity * unit_sale_price) STORED,
  line_cost numeric(14,2) GENERATED ALWAYS AS (quantity * unit_cost_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.crm_order_items.unit_sale_price IS 'Snapshot of the sale price at the time of the order';
COMMENT ON COLUMN public.crm_order_items.unit_cost_price IS 'Snapshot of the cost price at the time of the order';

CREATE TABLE public.crm_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.crm_orders(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  method text NOT NULL,
  reference text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed','cancelled')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text,
  vendor text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  expense_date date NOT NULL DEFAULT current_date,
  order_id uuid REFERENCES public.crm_orders(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.crm_inventory_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.crm_orders(id) ON DELETE RESTRICT,
  payment_id uuid REFERENCES public.crm_payments(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  reason text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','completed','rejected')),
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.crm_orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.crm_order_items(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'manual'
    CHECK (method IN ('email','telegram','download','manual')),
  recipient text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','failed')),
  details text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_inventory_batches_product_idx ON public.crm_inventory_batches(product_id);
CREATE INDEX crm_orders_customer_idx ON public.crm_orders(customer_id);
CREATE INDEX crm_orders_status_idx ON public.crm_orders(status, payment_status);
CREATE INDEX crm_order_items_order_idx ON public.crm_order_items(order_id);
CREATE INDEX crm_payments_order_idx ON public.crm_payments(order_id);
CREATE INDEX crm_refunds_order_idx ON public.crm_refunds(order_id);
CREATE INDEX crm_deliveries_order_idx ON public.crm_deliveries(order_id);
CREATE INDEX crm_audit_log_record_idx ON public.crm_audit_log(table_name, record_id);

-- Audit trigger
CREATE OR REPLACE FUNCTION public.crm_write_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_audit_log(table_name, record_id, action, actor_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.crm_write_audit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_customers','crm_products','crm_inventory_batches','crm_orders','crm_order_items','crm_payments','crm_expenses','crm_refunds','crm_deliveries']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Admins manage %s" ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', t, t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at()', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.crm_write_audit()', t || '_audit', t);
  END LOOP;
END $$;

GRANT SELECT ON public.crm_audit_log TO authenticated;
GRANT ALL ON public.crm_audit_log TO service_role;
ALTER TABLE public.crm_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read crm audit log" ON public.crm_audit_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
