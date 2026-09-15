CREATE OR REPLACE FUNCTION public.redeem_reward(_user_id uuid, _reward_id uuid, _generated_key text)
RETURNS TABLE (license_key text, duration_days integer, credits_used integer, reward_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.rewards%ROWTYPE;
  p public.profiles%ROWTYPE;
  redemption_id uuid;
  normalized_key text;
BEGIN
  normalized_key := upper(trim(_generated_key));
  IF normalized_key = '' OR normalized_key !~ '^FOXGEN-[A-Z0-9]{3}-[A-Z0-9]{3}$' THEN
    RAISE EXCEPTION 'invalid_generated_key';
  END IF;

  SELECT * INTO r
  FROM public.rewards
  WHERE id = _reward_id AND enabled;

  IF NOT FOUND OR r.duration_days <= 0 OR r.credit_cost <= 0 THEN
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

  INSERT INTO public.licenses (
    license_key,
    plan_days,
    duration_seconds,
    status,
    note
  )
  VALUES (
    normalized_key,
    r.duration_days,
    r.duration_days::bigint * 86400,
    'active',
    'Rewards Hub direct redemption'
  );

  INSERT INTO public.license_redemptions (
    user_id,
    license_key,
    duration_days,
    credits_used,
    reward_name
  )
  VALUES (
    _user_id,
    normalized_key,
    r.duration_days,
    r.credit_cost,
    r.name
  )
  RETURNING id INTO redemption_id;

  UPDATE public.profiles
  SET credits_available = credits_available - r.credit_cost,
      credits_spent = credits_spent + r.credit_cost,
      updated_at = now()
  WHERE id = _user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_id
  )
  VALUES (
    _user_id,
    -r.credit_cost,
    'license_redemption',
    'Redeemed ' || r.name,
    redemption_id
  );

  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (
    _user_id,
    'License redeemed',
    r.name || ' — ' || normalized_key,
    'license'
  );

  RETURN QUERY SELECT normalized_key, r.duration_days, r.credit_cost, r.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, text) TO service_role;