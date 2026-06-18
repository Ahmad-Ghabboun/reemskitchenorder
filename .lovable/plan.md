## Goal
Replace the full-screen edit sheet with inline editing inside each Preparing card. Only one card editable at a time. Save uses the existing `save_order_edit` RPC.

## Scope note (small deviation from "PreparingAlerts only")
You asked me to only touch `PreparingAlerts.tsx` and delete `EditOrderSheet.tsx`. But `src/routes/cashier.tsx` currently imports `EditOrderSheet`, holds the `editing` state, and passes `onEdit` + `menu` plumbing. Deleting the file without touching cashier.tsx breaks the build.

Minimum unavoidable cashier.tsx edits (no behavior changes elsewhere):
- Remove `EditOrderSheet` import and the `<EditOrderSheet ... />` block.
- Remove `editing` state and the `onEdit` prop passed to `<PreparingAlerts>`.
- Pass `menu` to `<PreparingAlerts>` so inline edit can show "Already Added" chips from `default_ingredients`.

Everything else in cashier.tsx stays untouched. Confirm this is acceptable; otherwise I can leave `EditOrderSheet.tsx` on disk as dead code and just stop using it.

## Changes to `src/components/PreparingAlerts.tsx`

Props become:
```ts
type Props = { orders: Order[]; items: OrderItem[]; menu: MenuItem[] };
```
(No more `onEdit`.)

Internal state:
- `editingId: string | null` — at most one card in edit mode.
- `lines: EditLine[]` — working copy for the editing card only (seeded from that order's items + `menu.default_ingredients`).
- `saving: boolean`.

Per card render:
- **View mode** (default): unchanged layout. Top-right "Edit" button sets `editingId = o.id` and seeds `lines`.
- **Edit mode** (when `editingId === o.id`):
  - Header right side replaces the single "Edit" button with two same-size buttons in the same slot: `Cancel` (secondary) and `Save` (primary, warning-tinted). Same height/padding as the original Edit button.
  - Below the header, render the editable block per line:
    - Item name + quantity stepper (−/+), min 1.
    - "Already Added" label + chips from `default_ingredients`; tap toggles membership in `removed_ingredients` with the same red strikethrough styling as cashier cart.
    - Thin `border-t border-border` divider.
    - "Add-ons" label + "+ Hot Sauce" chip with the amber outline/fill toggle styling matching cashier.
    - Notes `<input>` bound to `line.notes`.
  - No add-item / delete-line UI (scope keeps it simple; can be added later if needed).

Save handler:
- Calls `supabase.rpc("save_order_edit", { p_order_id, p_items })` with `{ menu_item_id, name_snapshot, quantity, removed_ingredients, notes: notes.trim(), extra_hot_sauce }` per line.
- On success: toast, `setEditingId(null)`. Realtime push triggers the existing kitchen edit chime — no new wiring here.
- On error: toast, stay in edit mode.

Cancel handler: `setEditingId(null)` and drop `lines`. No writes.

Other cards in the strip remain in view mode and remain interactive (their "Edit" buttons stay enabled; tapping switches focus, discarding the previous unsaved edit after a confirm-on-dirty? — I'll keep it simple: tapping another card's Edit silently discards the prior working copy, matching the lightweight cashier feel).

## Delete
- `src/components/EditOrderSheet.tsx`.

## Verification
- Build passes.
- Open `/cashier`, place an order, tap "Edit" on the Preparing card → Cancel/Save appear top-right, controls render inline below. Screenshot.
- Save → card returns to view mode with updates; `/kitchen` plays the edit chime.
