
CREATE OR REPLACE FUNCTION public.save_order_edit(p_order_id uuid, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  idx int := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array';
  END IF;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, menu_item_id, name_snapshot, quantity,
      removed_ingredients, notes, position, extra_hot_sauce
    ) VALUES (
      p_order_id,
      NULLIF(item->>'menu_item_id','')::uuid,
      item->>'name_snapshot',
      COALESCE((item->>'quantity')::int, 1),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(item->'removed_ingredients')), '{}'::text[]),
      COALESCE(item->>'notes', ''),
      idx,
      COALESCE((item->>'extra_hot_sauce')::boolean, false)
    );
    idx := idx + 1;
  END LOOP;

  UPDATE public.orders SET edited_at = now() WHERE id = p_order_id;
END;
$$;
