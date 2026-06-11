
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access events" ON public.events FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX events_one_active ON public.events (is_active) WHERE is_active;

CREATE OR REPLACE FUNCTION public.events_enforce_single_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.events SET is_active = false
      WHERE is_active = true AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_single_active
BEFORE INSERT OR UPDATE OF is_active ON public.events
FOR EACH ROW EXECUTE FUNCTION public.events_enforce_single_active();

ALTER TABLE public.menu_items
  ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;

CREATE INDEX menu_items_event_id_idx ON public.menu_items(event_id);

DO $$
DECLARE
  default_event_id uuid;
BEGIN
  INSERT INTO public.events (name, is_active) VALUES ('Default', true)
    RETURNING id INTO default_event_id;
  UPDATE public.menu_items SET event_id = default_event_id WHERE event_id IS NULL;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
