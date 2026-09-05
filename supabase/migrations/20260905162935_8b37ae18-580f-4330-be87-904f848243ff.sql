CREATE POLICY "Deny public storage select" ON storage.objects FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public storage insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public storage update" ON storage.objects FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public storage delete" ON storage.objects FOR DELETE TO anon, authenticated USING (false);
REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated, anon;