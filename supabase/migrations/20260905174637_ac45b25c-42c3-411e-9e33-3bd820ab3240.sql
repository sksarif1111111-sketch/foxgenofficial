INSERT INTO public.app_settings (key, value, updated_at) VALUES
  ('brand_name','FoxGEN PRO Rewards Hub', now()),
  ('brand_description','🦊 FoxGEN PRO — Lovable Unlimited updates, tutorials, offers and support. ⚡ Premium Access • Unlimited Possibilities.', now()),
  ('site_url','https://nextgen.lovableunlimitedc.workers.dev', now()),
  ('youtube_url','https://youtube.com/@mirza-p7x6s?si=er4Vs-kPWskxY_JW', now()),
  ('whatsapp_url','https://whatsapp.com/channel/0029VbDK6SHKLaHn5vxOQa0v', now()),
  ('facebook_url','https://www.facebook.com/share/1DYdDK9qCq/', now()),
  ('telegram_channel_1','https://t.me/foxgenofficial', now()),
  ('telegram_channel_1_name','FoxGEN Official', now()),
  ('telegram_channel_2','https://t.me/lovableunlimitedfoxgen', now()),
  ('telegram_channel_2_name','Lovable Unlimited FoxGEN', now()),
  ('support_url','https://wa.me/917699355860', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();