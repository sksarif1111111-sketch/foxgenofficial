CREATE TABLE public.bot_error_logs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  message text not null,
  telegram_user_id bigint,
  context text,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.bot_error_logs TO service_role;
ALTER TABLE public.bot_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_error_logs_no_public_access" ON public.bot_error_logs FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE INDEX idx_bot_error_logs_created_at ON public.bot_error_logs (created_at DESC);

CREATE TABLE public.bot_action_locks (
  lock_key text primary key,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.bot_action_locks TO service_role;
ALTER TABLE public.bot_action_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_action_locks_no_public_access" ON public.bot_action_locks FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);