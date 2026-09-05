CREATE INDEX IF NOT EXISTS license_inventory_duration_status_added_idx
ON public.license_inventory (duration_days, status, added_at);

CREATE OR REPLACE FUNCTION public.redeem_reward(_user_id uuid, _reward_id uuid, _generated_key text)
RETURNS TABLE (license_key text, duration_days integer, credits_used integer, reward_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.rewards%ROWTYPE;
  p public.profiles%ROWTYPE;
  inv public.license_inventory%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM public.rewards
  WHERE id = _reward_id AND enabled;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward_unavailable';
  END IF;

  SELECT * INTO p
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF p.status <> 'active' THEN
    RAISE EXCEPTION 'account_not_active';
  END IF;

  IF p.credits_available < r.credit_cost THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  SELECT * INTO inv
  FROM public.license_inventory
  WHERE status = 'available'
    AND duration_days = r.duration_days
  ORDER BY added_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_empty';
  END IF;

  UPDATE public.license_inventory
  SET status = 'redeemed',
      redeemed_by = _user_id,
      redeemed_at = now()
  WHERE id = inv.id
    AND status = 'available';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_conflict';
  END IF;

  INSERT INTO public.licenses (license_key, plan_days, duration_seconds, status, note)
  VALUES (inv.license_key, r.duration_days, r.duration_days * 86400, 'active', 'Rewards Hub redemption')
  ON CONFLICT (license_key) DO UPDATE
  SET plan_days = EXCLUDED.plan_days,
      duration_seconds = EXCLUDED.duration_seconds,
      status = 'active',
      note = EXCLUDED.note;

  UPDATE public.profiles
  SET credits_available = credits_available - r.credit_cost,
      credits_spent = credits_spent + r.credit_cost,
      updated_at = now()
  WHERE id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (_user_id, -r.credit_cost, 'license_redemption', 'Redeemed ' || r.name, inv.id);

  INSERT INTO public.license_redemptions (user_id, license_key, duration_days, credits_used, reward_name)
  VALUES (_user_id, inv.license_key, r.duration_days, r.credit_cost, r.name);

  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (_user_id, 'License redeemed', r.name || ' — ' || inv.license_key, 'license');

  RETURN QUERY SELECT inv.license_key, r.duration_days, r.credit_cost, r.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, text) TO service_role;