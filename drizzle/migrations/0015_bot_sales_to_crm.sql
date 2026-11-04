ALTER TABLE public.crm_orders ADD COLUMN IF NOT EXISTS external_order_id text;
CREATE UNIQUE INDEX IF NOT EXISTS crm_orders_external_order_id_key ON public.crm_orders (external_order_id) WHERE external_order_id IS NOT NULL;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS telegram_user_id bigint;
CREATE UNIQUE INDEX IF NOT EXISTS crm_customers_telegram_user_id_key ON public.crm_customers (telegram_user_id) WHERE telegram_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crm_log_shop_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _paid_states text[] := ARRAY['awaiting_email','awaiting_fulfillment','completed','delivered'];
  _cust uuid;
  _order uuid;
  _cur char(3);
  _total numeric := 0;
  _it record;
  _crm public.crm_products%ROWTYPE;
  _unit numeric;
  _cost numeric;
BEGIN
  IF NOT (NEW.status = ANY(_paid_states)) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = ANY(_paid_states) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.crm_orders WHERE external_order_id = 'shop:' || NEW.id::text) THEN RETURN NEW; END IF;

  -- Stars orders are booked at their USDT price so the dashboard stays in one currency
  _cur := CASE WHEN upper(coalesce(NEW.currency,'USD')) IN ('XTR','USDT') THEN 'USD' ELSE upper(left(coalesce(NEW.currency,'USD'),3)) END;

  IF NEW.telegram_user_id IS NOT NULL THEN
    SELECT id INTO _cust FROM public.crm_customers WHERE telegram_user_id = NEW.telegram_user_id;
    IF _cust IS NULL THEN
      INSERT INTO public.crm_customers (name, telegram_user_id)
      VALUES (coalesce(nullif(trim(NEW.customer_name),''), 'Telegram ' || NEW.telegram_user_id), NEW.telegram_user_id)
      RETURNING id INTO _cust;
    END IF;
  END IF;

  INSERT INTO public.crm_orders (customer_id, status, payment_status, currency, subtotal, discount, total, source, notes, external_order_id, ordered_at)
  VALUES (_cust, 'confirmed', 'paid', _cur, 0, 0, 0,
          CASE WHEN NEW.channel ILIKE '%telegram%' OR NEW.telegram_user_id IS NOT NULL THEN 'Bot' ELSE 'Website' END,
          'Store order ' || coalesce(NEW.order_number, NEW.id::text), 'shop:' || NEW.id::text, coalesce(NEW.confirmed_at, now()))
  RETURNING id INTO _order;

  FOR _it IN
    SELECT i.product_name, i.quantity, i.unit_price, i.currency, p.price_usdt, p.reseller_product_id
    FROM public.shop_order_items i LEFT JOIN public.products p ON p.id = i.product_id
    WHERE i.order_id = NEW.id
  LOOP
    _crm := NULL;
    IF _it.reseller_product_id IS NOT NULL THEN
      SELECT * INTO _crm FROM public.crm_products WHERE reseller_product_id = _it.reseller_product_id;
    END IF;
    _unit := CASE WHEN upper(coalesce(_it.currency, NEW.currency)) = 'XTR' THEN coalesce(_it.price_usdt, 0) ELSE coalesce(_it.unit_price, 0) END;
    _cost := coalesce(_crm.wholesale_price, _crm.default_cost_price, 0);
    INSERT INTO public.crm_order_items (order_id, product_id, product_name, quantity, unit_sale_price, unit_cost_price, currency)
    VALUES (_order, _crm.id, _it.product_name, greatest(_it.quantity,1), _unit, _cost, _cur);
    _total := _total + round(_unit * greatest(_it.quantity,1), 2);
  END LOOP;

  UPDATE public.crm_orders SET subtotal = _total, total = _total WHERE id = _order;
  IF _total > 0 THEN
    INSERT INTO public.crm_payments (order_id, amount, currency, method, reference, status, paid_at, fee)
    VALUES (_order, _total, _cur, coalesce(nullif(NEW.payment_method_name,''), CASE WHEN NEW.currency='XTR' THEN 'Telegram Stars' ELSE 'other' END),
            NEW.telegram_charge_id, 'completed', now(), 0);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_log_shop_sale() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS shop_orders_log_crm_sale ON public.shop_orders;
CREATE TRIGGER shop_orders_log_crm_sale
AFTER INSERT OR UPDATE OF status ON public.shop_orders
FOR EACH ROW EXECUTE FUNCTION public.crm_log_shop_sale();