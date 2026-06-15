CREATE OR REPLACE FUNCTION public.reset_order_number_seq()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM setval('public.order_number_seq', 1, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_order_number_seq() TO anon, authenticated, service_role;