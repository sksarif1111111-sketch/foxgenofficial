ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'manual';

ALTER TABLE public.task_completions
  ADD CONSTRAINT task_completions_verification_status_check
  CHECK (verification_status IN ('pending', 'completed', 'verified', 'failed')) NOT VALID;

ALTER TABLE public.task_completions
  ADD CONSTRAINT task_completions_verification_method_check
  CHECK (verification_method IN ('manual', 'telegram_api')) NOT VALID;

CREATE INDEX IF NOT EXISTS task_completions_user_status_idx
  ON public.task_completions (user_id, verification_status);

GRANT ALL ON public.task_completions TO service_role;