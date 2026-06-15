## Goal
Add a "+ Hot Sauce" add-on chip to each cart line on `/cashier`, grouped under labeled "Already Added" and "Add-ons" sections with a divider between them. Persist `extra_hot_sauce` on order submission.

## Edits to `src/routes/cashier.tsx` (targeted, no rewrite)

### 1. Cart-line chip section (currently lines ~276–296)
Replace the single chip block with two labeled groups:

```text
[Already Added]
  Rice  Chicken  Garlic Sauce  ...     ← existing chips (unchanged behavior)
─────────────────────────────────────── ← divider (border-t border-border)
[Add-ons]
  + Hot Sauce                            ← new toggle chip
```

- Render the "Already Added" group only if `l.default_ingredients.length > 0`, with a small `text-xs uppercase tracking-wider text-muted-foreground font-bold` label. Existing chip rendering and `toggleIngredient` behavior unchanged.
- Always render the "Add-ons" group with the same label style.
- Divider: a thin `border-t border-border` between the two groups when both render; if "Already Added" is empty, only render "Add-ons" (no divider).

### 2. Hot Sauce chip
- One chip labeled `+ Hot Sauce`.
- `onClick`: `updateLine(l.uid, { extra_hot_sauce: !l.extra_hot_sauce })`.
- Not selected (default): amber outline — `bg-transparent border-2 border-warning text-warning`.
- Selected: solid amber — `bg-warning text-warning-foreground border-2 border-warning`.
- Same shape/padding as existing chips (`px-3 py-2 rounded-full text-sm font-semibold transition-colors`).

### 3. Order submission (line ~156)
Add `extra_hot_sauce: l.extra_hot_sauce` to the `items` map passed into `supabase.from("order_items").insert(items)`.

## Out of scope
- No changes to `kitchen.tsx`, `PreparingAlerts.tsx`, `ReadyAlerts.tsx`.
- No DB / type changes (Step 1 already handled).
- No changes to existing default-ingredient chip behavior.

## Verification
Build passes; place a test order with Hot Sauce selected on one line and a default ingredient removed on another; share a screenshot of the cart showing both labeled groups with the chip in its selected (solid amber) state.