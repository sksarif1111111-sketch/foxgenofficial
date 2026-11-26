CREATE TABLE IF NOT EXISTS public.shop_cron_jobs (name text PRIMARY KEY, job_id bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.shop_cron_jobs TO service_role;
ALTER TABLE public.shop_cron_jobs ENABLE ROW LEVEL SECURITY;
INSERT INTO public.shop_cron_jobs(name, job_id) VALUES ('shop-crm-outbox-retry', 1) ON CONFLICT (name) DO NOTHING;
CREATE OR REPLACE FUNCTION public.shop_set_crm_cron(_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j bigint;
BEGIN
  SELECT job_id INTO j FROM public.shop_cron_jobs WHERE name = 'shop-crm-outbox-retry';
  IF j IS NOT NULL THEN
    BEGIN PERFORM cron.alter_job(j, active := _active); EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.shop_set_crm_cron(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_set_crm_cron(boolean) TO service_role;
DO $$
DECLARE f record; d text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('shop_pause_crm_when_drained','shop_enqueue_crm_order','shop_enqueue_customer','shop_enqueue_topup') LOOP
    d := regexp_replace(pg_get_functiondef(f.oid), 'cron\.alter_job\s*\(\s*1\s*,\s*active\s*:=\s*(true|false)\s*\)', 'public.shop_set_crm_cron(\1)', 'gi');
    EXECUTE d;
  END LOOP;
END $$;