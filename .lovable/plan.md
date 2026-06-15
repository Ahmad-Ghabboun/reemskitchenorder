Step 3 — Kitchen Display: Hot Sauce Tag

1. **Query check** — `kitchen.tsx` already uses `.select("*")` on `order_items`, so `extra_hot_sauce` is fetched. No query change needed.

2. **Render the tag** — In each order-item card inside `kitchen.tsx`, after the existing "NO [ingredient]" block and before the notes block, conditionally render a separate row for hot sauce:
   - Only when `it.extra_hot_sauce === true`
   - Tag text: bold uppercase "+ HOT SAUCE"
   - Styling: amber/warning color scheme using the same tokens as `/cashier` (`bg-warning text-warning-foreground` with rounded-md, px-2 py-1, font-black, uppercase, tracking-wide, text-sm)
   - Placed in its own `flex flex-wrap gap-2` container with `mt-2` spacing, so it never mixes with the red removed-ingredient tags.

3. **Scope** — No changes to `cashier.tsx`, `PreparingAlerts.tsx`, or `ReadyAlerts.tsx`.

4. **Verify** — Build must pass. After that, place a test order with hot sauce + a removed ingredient, then screenshot `/kitchen` to confirm both tag groups appear separately.