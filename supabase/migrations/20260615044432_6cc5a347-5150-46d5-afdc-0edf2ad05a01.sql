CREATE OR REPLACE FUNCTION public.reset_order_number_seq()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.order_items WHERE true;
  DELETE FROM public.orders WHERE true;
  PERFORM setval('public.order_number_seq', 1, false);
END;
$$;