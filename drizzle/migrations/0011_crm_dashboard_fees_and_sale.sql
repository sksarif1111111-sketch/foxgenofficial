ALTER TABLE public.crm_payments ADD COLUMN IF NOT EXISTS fee numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.crm_payments ADD CONSTRAINT crm_payments_fee_nonneg CHECK (fee >= 0);

CREATE OR REPLACE FUNCTION public.crm_record_sale(
  _customer_id uuid,
  _new_customer_name text,
  _product_id uuid,
  _quantity integer,
  _unit_price numeric,
  _currency text,
  _payment_method text,
  _payment_fee numeric,
  _paid boolean,
  _source text,
  _notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _cust uuid := _customer_id;
  _prod public.crm_products%ROWTYPE;
  _batch public.crm_inventory_batches%ROWTYPE;
  _cost numeric;
  _total numeric;
  _order uuid;
  _cur char(3) := upper(coalesce(nullif(trim(_currency), ''), 'USD'));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;
  IF _unit_price IS NULL OR _unit_price < 0 THEN RAISE EXCEPTION 'Price must be 0 or more'; END IF;

  SELECT * INTO _prod FROM public.crm_products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  IF _cust IS NULL AND nullif(trim(_new_customer_name), '') IS NOT NULL THEN
    INSERT INTO public.crm_customers (name) VALUES (trim(_new_customer_name)) RETURNING id INTO _cust;
  END IF;

  -- Oldest batch with enough stock (FIFO); otherwise use the product's default cost
  SELECT * INTO _batch FROM public.crm_inventory_batches
   WHERE product_id = _product_id AND quantity_remaining >= _quantity
   ORDER BY purchased_at ASC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    _cost := _batch.unit_cost;
    UPDATE public.crm_inventory_batches SET quantity_remaining = quantity_remaining - _quantity WHERE id = _batch.id;
  ELSE
    _cost := _prod.default_cost_price;
  END IF;

  _total := round(_unit_price * _quantity, 2);

  INSERT INTO public.crm_orders (customer_id, status, payment_status, currency, subtotal, discount, total, source, notes)
  VALUES (_cust, 'confirmed', CASE WHEN _paid THEN 'paid' ELSE 'unpaid' END, _cur, _total, 0, _total,
          nullif(trim(_source), ''), nullif(trim(_notes), ''))
  RETURNING id INTO _order;

  INSERT INTO public.crm_order_items (order_id, product_id, batch_id, product_name, quantity, unit_sale_price, unit_cost_price, currency)
  VALUES (_order, _prod.id, _batch.id, _prod.name, _quantity, _unit_price, _cost, _cur);

  IF _paid AND _total > 0 THEN
    INSERT INTO public.crm_payments (order_id, amount, currency, method, status, paid_at, fee)
    VALUES (_order, _total, _cur, coalesce(nullif(trim(_payment_method), ''), 'other'), 'completed', now(), greatest(coalesce(_payment_fee, 0), 0));
  END IF;

  RETURN _order;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_record_sale(uuid, text, uuid, integer, numeric, text, text, numeric, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_record_sale(uuid, text, uuid, integer, numeric, text, text, numeric, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;