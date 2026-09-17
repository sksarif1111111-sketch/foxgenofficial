CREATE OR REPLACE FUNCTION public.award_referral(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref public.referrals%ROWTYPE;
  verified_count integer;
  campaign_row public.campaigns%ROWTYPE;
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

  UPDATE public.referrals
  SET status = 'verified', credit_awarded = true, verified_at = now()
  WHERE id = ref.id AND status = 'pending' AND credit_awarded = false;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.profiles
  SET credits_available = credits_available + 1,
      credits_earned = credits_earned + 1,
      updated_at = now()
  WHERE id = ref.referrer_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (ref.referrer_id, 1, 'referral_reward', 'Friend joined via referral link', ref.id);

  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (ref.referrer_id, 'New Friend Joined!', 'You earned +1 Credit.', 'credit');

  SELECT count(*) INTO verified_count
  FROM public.referrals r
  WHERE r.referrer_id = ref.referrer_id
    AND r.status = 'verified'
    AND r.verified_at IS NOT NULL;

  FOR campaign_row IN
    SELECT * FROM public.campaigns
    WHERE status = 'active'
      AND campaign_type IN ('referral_competition', 'bonus_credit', 'leaderboard_event')
      AND bonus_credits > 0
      AND now() BETWEEN COALESCE(start_date, '-infinity'::timestamptz) AND COALESCE(end_date, 'infinity'::timestamptz)
      AND verified_count >= target_referrals
  LOOP
    INSERT INTO public.campaign_awards (campaign_id, user_id, credits_awarded)
    VALUES (campaign_row.id, ref.referrer_id, campaign_row.bonus_credits)
    ON CONFLICT (campaign_id, user_id) DO NOTHING;
    IF FOUND THEN
      UPDATE public.profiles
      SET credits_available = credits_available + campaign_row.bonus_credits,
          credits_earned = credits_earned + campaign_row.bonus_credits,
          updated_at = now()
      WHERE id = ref.referrer_id;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, reference_id)
      VALUES (ref.referrer_id, campaign_row.bonus_credits, 'campaign_bonus', campaign_row.name, campaign_row.id);
      INSERT INTO public.notifications (user_id, title, body, kind)
      VALUES (ref.referrer_id, 'Campaign reward unlocked!', campaign_row.name || ' — +' || campaign_row.bonus_credits || ' bonus credits.', 'credit');
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_referral(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_referral(uuid) TO service_role;