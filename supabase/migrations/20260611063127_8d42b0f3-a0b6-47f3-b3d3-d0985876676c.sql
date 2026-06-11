
CREATE OR REPLACE FUNCTION public.events_enforce_single_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
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
