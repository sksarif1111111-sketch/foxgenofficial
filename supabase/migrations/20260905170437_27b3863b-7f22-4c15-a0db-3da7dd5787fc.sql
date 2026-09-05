
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_referral(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_referral(uuid) TO service_role;
