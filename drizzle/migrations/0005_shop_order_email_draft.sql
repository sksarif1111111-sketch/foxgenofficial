ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS email_draft_generated_at timestamptz;