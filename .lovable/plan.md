## Step 4: Hot Sauce tag on cashier strips

### Context
The `extra_hot_sauce` boolean is already stored on `order_items` (Step 1) and rendered on `/kitchen` (Step 3). The cashier's **Preparing** and **Ready** strips still omit it.

### Changes

#### `src/components/PreparingAlerts.tsx`
- For each order-item row, after the red "NO [ingredient]" block and before the notes block, add a conditional `+ HOT SAUCE` tag.
- Only render when `it.extra_hot_sauce === true`.
- Tag styling: `bg-warning text-warning-foreground rounded-md px-2 py-1 font-black uppercase tracking-wide text-sm`.
- Placed in its own `flex flex-wrap gap-2` container, separate from the removed-ingredient group.

#### `src/components/ReadyAlerts.tsx`
- Identical addition: same conditional tag, same styling, same placement (after removed ingredients, before notes).

### Verification
- Build passes.
- Test order with Hot Sauce + a removed ingredient on `/cashier` — confirm the **Preparing** card shows both the red "NO [ingredient]" group and the amber "+ HOT SAUCE" group separately.
- After kitchen marks it ready, confirm the **Ready** card also shows the tag.

### Scope
No changes to `cashier.tsx`, `kitchen.tsx`, or database schema in this step.