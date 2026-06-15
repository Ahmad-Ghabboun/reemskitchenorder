## Goal
Add a working "Reset Order #" button on `/admin` that clears all orders and resets the order number sequence to 1.

## Changes

**1. Migration — recreate `reset_order_number_seq()`**
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

REVOKE ALL ON FUNCTION public.reset_order_number_seq() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_order_number_seq() TO anon, authenticated;
```

Matches the same no-auth trust model already in place on `events`/`menu_items`/`orders`/`order_items` (all `FOR ALL USING(true)`).

**2. Update `@security-memory`**
Add a note that `public.reset_order_number_seq()` is an intentionally unauthenticated `SECURITY DEFINER` RPC for the booth admin, same rationale as the public RLS policies. Future scans should not flag it.

**3. `src/routes/admin.tsx`** — add a destructive "Reset Order #" button in the header (next to ThemeToggle), with a `confirm()` dialog. On click: `supabase.rpc('reset_order_number_seq')`, then toast success or error.

## Out of scope
- No changes to cashier/kitchen flow.
- No changes to existing RLS or other RPCs.
