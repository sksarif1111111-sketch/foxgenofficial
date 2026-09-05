ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS duration_seconds bigint;
UPDATE public.licenses SET duration_seconds = plan_days * 86400 WHERE duration_seconds IS NULL;
ALTER TABLE public.licenses ALTER COLUMN plan_days DROP NOT NULL;