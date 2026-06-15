## Goal
Add a new `extra_hot_sauce` boolean field to track a "Hot Sauce" add-on per order item, without any UI changes.

## Files to modify

### 1. `src/lib/booth-types.ts`
- Add `extra_hot_sauce: boolean` to the `CartLine` type.
- Add `extra_hot_sauce: boolean` to the `OrderItem` type.
- **Do NOT modify `MenuItem`** — it must keep exactly its current fields: `id`, `name`, `price`, `default_ingredients`, `sort_order`, `created_at`, `event_id`.

### 2. Supabase migration
- Run a new migration that adds the column:
  ```sql
  ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS extra_hot_sauce boolean NOT NULL DEFAULT false;
  ```
- No other table changes, no policy changes, no function changes.

### 3. `src/integrations/supabase/types.ts`
- Add `extra_hot_sauce: boolean` to the `order_items` Row type.
- Add `extra_hot_sauce?: boolean` to the `order_items` Insert type.
- Add `extra_hot_sauce?: boolean` to the `order_items` Update type.
- Do not touch any other table definitions.

## Out of scope
- No changes to `cashier.tsx`, `kitchen.tsx`, `PreparingAlerts.tsx`, or `ReadyAlerts.tsx` in this step.
- No UI changes of any kind.

## Verification
After implementation, show a diff of `booth-types.ts` so the user can confirm `MenuItem` is unchanged, and confirm the build has no errors.