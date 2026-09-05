CREATE TABLE public.telegram_processed_updates (
  update_id bigint PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_processed_updates TO service_role;
REVOKE ALL ON public.telegram_processed_updates FROM anon, authenticated;

ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny direct browser access"
ON public.telegram_processed_updates
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE INDEX telegram_processed_updates_processed_at_idx
ON public.telegram_processed_updates (processed_at);