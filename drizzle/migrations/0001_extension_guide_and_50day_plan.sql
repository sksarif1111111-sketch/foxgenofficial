CREATE TABLE public.extension_guide_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heading TEXT NOT NULL,
  body TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.extension_guide_pages TO service_role;
ALTER TABLE public.extension_guide_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extension_guide_pages_service_only" ON public.extension_guide_pages FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.touch_extension_guide_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER extension_guide_pages_touch
BEFORE UPDATE ON public.extension_guide_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_extension_guide_updated_at();