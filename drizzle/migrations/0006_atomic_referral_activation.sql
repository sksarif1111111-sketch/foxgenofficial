ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'manual';

CREATE OR REPLACE FUNCTION public.activate_verified_profile(_user_id uuid)
RETURNS TABLE(activated boolean, referral_awarded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status text;
  did_activate boolean := false;
  did_award boolean := false;
BEGIN
  SELECT status INTO current_status
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF current_status = 'pending' THEN
    UPDATE public.profiles
    SET status = 'active', updated_at = now()
    WHERE id = _user_id;

    INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (_user_id, 'Account activated', 'All tasks completed. You can now earn credits and redeem licenses.', 'account');
    did_activate := true;
  ELSIF current_status <> 'active' THEN
    RAISE EXCEPTION 'account_cannot_be_activated';
  END IF;

  did_award := public.award_referral(_user_id);
  RETURN QUERY SELECT did_activate, did_award;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_verified_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_verified_profile(uuid) TO service_role;