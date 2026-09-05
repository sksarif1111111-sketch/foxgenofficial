CREATE OR REPLACE FUNCTION public.prevent_referrer_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.referred_by IS DISTINCT FROM NEW.referred_by THEN
    RAISE EXCEPTION 'referrer_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_referrer_change ON public.profiles;
CREATE TRIGGER profiles_prevent_referrer_change
BEFORE UPDATE OF referred_by ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_referrer_change();

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_referral_reward_uidx
ON public.credit_transactions (reference_id)
WHERE transaction_type = 'referral_reward' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.award_referral(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref public.referrals%ROWTYPE;
  referred_status text;
BEGIN
  SELECT r.* INTO ref
  FROM public.referrals r
  WHERE r.referred_user_id = _referred_user_id
  FOR UPDATE;

  IF NOT FOUND OR ref.credit_awarded OR ref.status <> 'pending' THEN
    RETURN false;
  END IF;

  IF ref.referrer_id = ref.referred_user_id THEN
    UPDATE public.referrals SET status = 'rejected' WHERE id = ref.id;
    INSERT INTO public.fraud_flags (user_id, reason, details)
    VALUES (_referred_user_id, 'self_referral', 'Referral rejected automatically because referrer and referred user matched.');
    RETURN false;
  END IF;

  SELECT status INTO referred_status
  FROM public.profiles
  WHERE id = _referred_user_id;

  IF referred_status IS DISTINCT FROM 'active' THEN
    RETURN false;
  END IF;

  UPDATE public.referrals
  SET status = 'verified', credit_awarded = true, verified_at = now()
  WHERE id = ref.id AND status = 'pending' AND credit_awarded = false;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET credits_available = credits_available + 1,
      credits_earned = credits_earned + 1,
      updated_at = now()
  WHERE id = ref.referrer_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (ref.referrer_id, 1, 'referral_reward', 'Verified Referral', ref.id);

  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (ref.referrer_id, 'New Referral Verified!', 'You earned +1 Credit.', 'credit');

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_referral(_referral_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.referrals
  SET status = 'rejected', verified_at = NULL
  WHERE id = _referral_id
    AND status = 'pending'
    AND credit_awarded = false;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_referrer_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_referral(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_referral(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_referrer_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.award_referral(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_referral(uuid) TO service_role;