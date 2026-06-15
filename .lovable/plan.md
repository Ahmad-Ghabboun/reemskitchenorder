## Reset Order Numbers — Admin Header Button

### 1. Database (migration)
Create a `SECURITY DEFINER` function so the no-auth client can reset the sequence safely:

```sql
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
```

`setval(..., 1, false)` makes the next `nextval` return exactly `1`. Existing rows in `orders` are untouched.

### 2. Admin UI (`src/routes/admin.tsx`)
- Import `RotateCcw` from `lucide-react`, `AlertDialog*` from `@/components/ui/alert-dialog`, `Button` from `@/components/ui/button`.
- Add `const [resetOpen, setResetOpen] = useState(false)`.
- In the existing header (next to `<ThemeToggle />`), add a button styled to match the toggle (icon-only, `variant="outline"`, `size="icon"`, rounded), with `RotateCcw` icon and `aria-label="Reset order numbers"`. Tooltip/title: "Reset Order #".
- Clicking opens an `AlertDialog`:
  - Title: "Reset order numbering?"
  - Description: "Reset order numbering back to #1? This only affects new orders going forward — existing order history is not changed."
  - Cancel + Confirm ("Reset") actions.
- On confirm:
  ```ts
  const { error } = await supabase.rpc("reset_order_number_seq");
  if (error) toast.error("Could not reset order numbers");
  else toast.success("Order numbers reset — next order will be #1.");
  ```
- Regenerated `src/integrations/supabase/types.ts` (after migration) will type the rpc.

### Notes
- No changes to `cashier`, `kitchen`, or `events` routes.
- No effect on existing orders; only the sequence's next value changes.
- Consistent with project's no-auth public-access posture (function is intentionally callable by `anon`).
