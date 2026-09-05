DROP POLICY "admins manage licenses" ON public.licenses;
CREATE POLICY "admins manage licenses" ON public.licenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));
DROP FUNCTION IF EXISTS public.is_admin(uuid);