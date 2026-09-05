
-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL UNIQUE,
  telegram_username text,
  first_name text,
  last_name text,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  web_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  credits_available integer NOT NULL DEFAULT 0,
  credits_earned integer NOT NULL DEFAULT 0,
  credits_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  credit_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL,
  description text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.social_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  platform text NOT NULL,
  url text,
  verification_type text NOT NULL DEFAULT 'manual_confirmation',
  telegram_chat_id text,
  required boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_tasks TO service_role;
ALTER TABLE public.social_tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.social_tasks(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  UNIQUE (user_id, task_id)
);
GRANT ALL ON public.task_completions TO service_role;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_days integer NOT NULL,
  credit_cost integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.license_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  duration_days integer NOT NULL,
  status text NOT NULL DEFAULT 'available',
  redeemed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  added_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.license_inventory TO service_role;
ALTER TABLE public.license_inventory ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.license_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_key text NOT NULL,
  duration_days integer NOT NULL,
  credits_used integer NOT NULL,
  reward_name text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.license_redemptions TO service_role;
ALTER TABLE public.license_redemptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  image_url text,
  button_text text,
  button_url text,
  publish_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  bonus_credits integer NOT NULL DEFAULT 0,
  conditions text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- atomic redemption
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
  key_out text;
BEGIN
  SELECT * INTO r FROM public.rewards WHERE id = _reward_id AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'reward_unavailable'; END IF;

  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF p.status <> 'active' THEN RAISE EXCEPTION 'account_not_active'; END IF;
  IF p.credits_available < r.credit_cost THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  SELECT * INTO inv FROM public.license_inventory
    WHERE status = 'available' AND duration_days = r.duration_days
    ORDER BY added_at LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    key_out := inv.license_key;
    UPDATE public.license_inventory
      SET status = 'redeemed', redeemed_by = _user_id, redeemed_at = now()
      WHERE id = inv.id;
  ELSE
    key_out := _generated_key;
    INSERT INTO public.license_inventory (license_key, duration_days, status, redeemed_by, redeemed_at)
      VALUES (key_out, r.duration_days, 'redeemed', _user_id, now());
  END IF;

  INSERT INTO public.licenses (license_key, plan_days, duration_seconds, status, note)
    VALUES (key_out, r.duration_days, r.duration_days * 86400, 'active', 'Rewards Hub redemption')
    ON CONFLICT DO NOTHING;

  UPDATE public.profiles
    SET credits_available = credits_available - r.credit_cost,
        credits_spent = credits_spent + r.credit_cost,
        updated_at = now()
    WHERE id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (_user_id, -r.credit_cost, 'license_redemption', r.name);

  INSERT INTO public.license_redemptions (user_id, license_key, duration_days, credits_used, reward_name)
    VALUES (_user_id, key_out, r.duration_days, r.credit_cost, r.name);

  INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (_user_id, 'License redeemed', r.name || ' — ' || key_out, 'license');

  RETURN QUERY SELECT key_out, r.duration_days, r.credit_cost, r.name;
END;
$$;

-- award a verified referral credit exactly once
CREATE OR REPLACE FUNCTION public.award_referral(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ref public.referrals%ROWTYPE;
BEGIN
  SELECT * INTO ref FROM public.referrals WHERE referred_user_id = _referred_user_id FOR UPDATE;
  IF NOT FOUND OR ref.credit_awarded THEN RETURN false; END IF;

  UPDATE public.referrals SET status = 'verified', credit_awarded = true, verified_at = now() WHERE id = ref.id;

  UPDATE public.profiles
    SET credits_available = credits_available + 1,
        credits_earned = credits_earned + 1,
        updated_at = now()
    WHERE id = ref.referrer_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (ref.referrer_id, 1, 'referral_reward', 'Verified referral', ref.id);

  INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (ref.referrer_id, 'Referral verified', 'You earned +1 credit.', 'credit');

  RETURN true;
END;
$$;

-- unique unified license key across the extension table
CREATE UNIQUE INDEX IF NOT EXISTS licenses_license_key_uidx ON public.licenses (license_key);

-- defaults
INSERT INTO public.rewards (name, description, duration_days, credit_cost, display_order) VALUES
  ('15 Days License', 'Lovable Unlimited Extension for 15 days', 15, 5, 1),
  ('30 Days License', 'Lovable Unlimited Extension for 30 days', 30, 10, 2),
  ('60 Days License', 'Lovable Unlimited Extension for 60 days', 60, 20, 3);

INSERT INTO public.social_tasks (name, description, platform, url, verification_type, telegram_chat_id, required, display_order) VALUES
  ('Join Telegram Channel 1', 'Join our main Telegram channel', 'telegram', '', 'telegram_auto_verification', '', true, 1),
  ('Join Telegram Channel 2', 'Join our updates Telegram channel', 'telegram', '', 'telegram_auto_verification', '', true, 2),
  ('Subscribe on YouTube', 'Subscribe to our YouTube channel', 'youtube', '', 'manual_confirmation', NULL, true, 3),
  ('Join WhatsApp Channel', 'Follow our WhatsApp channel', 'whatsapp', '', 'manual_confirmation', NULL, true, 4),
  ('Follow on Facebook', 'Follow our Facebook page', 'facebook', '', 'manual_confirmation', NULL, true, 5);

INSERT INTO public.app_settings (key, value) VALUES
  ('brand_name', 'FoxGEN PRO Rewards Hub'),
  ('brand_description', 'Earn. Refer. Unlock.'),
  ('bot_username', ''),
  ('site_url', 'https://first-word-platform.lovable.app'),
  ('extension_name', 'FoxGEN Pro Extension'),
  ('extension_version', '16.73'),
  ('extension_download_url', '/foxgen-extension.zip'),
  ('installation_guide_url', ''),
  ('tutorial_url', ''),
  ('youtube_url', ''),
  ('whatsapp_url', ''),
  ('facebook_url', ''),
  ('telegram_channel_1', ''),
  ('telegram_channel_2', ''),
  ('support_url', ''),
  ('referral_message', 'Join FoxGEN PRO Rewards Hub and unlock free Lovable Unlimited licenses!'),
  ('min_inventory_alert', '5');
