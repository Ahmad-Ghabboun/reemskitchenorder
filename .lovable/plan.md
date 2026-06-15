## Fix Reset Order Numbers (destructive clear + reset)

### Migration
New migration replacing `reset_order_number_seq()`:

```sql
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

GRANT EXECUTE ON FUNCTION public.reset_order_number_seq() TO anon, authenticated, service_role;
```

### UI (`src/routes/admin.tsx`)
Update the AlertDialog:
- Title: "Reset order numbering?"
- Description: "This will permanently delete ALL existing orders and reset numbering to start at #1. This cannot be undone. Use this only for clearing test data before going live."
- Success toast unchanged ("Order numbers reset — next order will be #1.")

### Verify
After migration applies, place an order on /cashier and confirm it's #1.
