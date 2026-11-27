ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS credit_total integer,
  ADD COLUMN IF NOT EXISTS credit_balance integer;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_credit_range CHECK (
    (credit_total IS NULL AND credit_balance IS NULL)
    OR (credit_total IS NOT NULL AND credit_balance IS NOT NULL AND credit_total >= 0 AND credit_balance >= 0)
  );

CREATE TABLE public.license_credit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL DEFAULT 'prompt',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX license_credit_events_license_idx ON public.license_credit_events (license_id, created_at DESC);

GRANT SELECT ON public.license_credit_events TO authenticated;
GRANT ALL ON public.license_credit_events TO service_role;
ALTER TABLE public.license_credit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read licence credit events" ON public.license_credit_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.license_adjust_credits(p_license_id uuid, p_delta integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur integer;
  tot integer;
  nxt integer;
BEGIN
  SELECT credit_balance, credit_total INTO cur, tot FROM public.licenses WHERE id = p_license_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  cur := COALESCE(cur, 0);
  tot := COALESCE(tot, 0);
  IF p_delta < 0 AND cur < -p_delta THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_credits', 'credits', cur, 'total', tot);
  END IF;
  nxt := cur + p_delta;
  IF p_delta > 0 THEN
    tot := tot + p_delta;
  END IF;
  UPDATE public.licenses SET credit_balance = nxt, credit_total = tot WHERE id = p_license_id;
  INSERT INTO public.license_credit_events (license_id, delta, balance_after, reason)
  VALUES (p_license_id, p_delta, nxt, left(COALESCE(NULLIF(p_reason, ''), 'prompt'), 60));
  RETURN jsonb_build_object('ok', true, 'credits', nxt, 'total', tot, 'delta', p_delta);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.license_adjust_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.license_adjust_credits(uuid, integer, text) TO service_role;