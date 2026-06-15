CREATE OR REPLACE FUNCTION public.reset_order_number_seq()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.order_items;
  DELETE FROM public.orders;
  PERFORM setval('public.order_number_seq', 1, false);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_order_number_seq() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_order_number_seq() TO anon, authenticated;