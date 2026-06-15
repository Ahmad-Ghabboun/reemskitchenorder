## Goal

Add a parallel "Preparing" strip to `/cashier` showing orders with `status='pending'`, alongside the existing red "Ready" strip. No alarm, no action buttons — purely informational.

## Approach

Create a new `PreparingAlerts` component modeled on `ReadyAlerts`, but stripped down. Render it on `/cashier` directly above (or below) `<ReadyAlerts/>` so both can coexist as sticky, collapsible strips.

## New file: `src/components/PreparingAlerts.tsx`

- Subscribe to `orders` where `status='pending'`, ordered by `created_at` ascending, plus their `order_items`. Use a `supabase.channel("cashier_preparing")` subscription on `orders` + `order_items` that re-runs the load (same pattern as `ReadyAlerts`).
- State: `orders`, `items`, `collapsed`. No mute, volume, snooze, wake lock, audio engine, beep loop.
- Returns `null` when `orders.length === 0`.
- Header: `bg-warning text-warning-foreground` (amber/yellow already in design tokens), icon `ChefHat` from lucide-react, label `"{n} Preparing"`, collapse/expand chevron only (no mute, no volume).
- Container: `sticky top-14 z-10` (lower z than Ready's `z-20` so Ready overlaps if both pinned), `border-2 border-warning`, rounded card, same `mx-2 mt-2` layout.
- Per-order card: same visual structure as Ready (large `#order_number`, item list with `qty × name`, `NO {ingredient}` chips, notes block) — but no "Picked Up" / "Snooze" buttons. Order number color: `text-warning` instead of `text-primary`. Chip color stays the same destructive red for `NO X` (it's a removal indicator, not a state indicator).
- Same `max-h-[55vh] overflow-y-auto` scroll behavior so multiple pending orders stack without pushing menu/cart down.

## Edit: `src/routes/cashier.tsx`

- Import `PreparingAlerts`.
- Render `<PreparingAlerts />` next to `<ReadyAlerts ... />` (right above it, so Ready's sticky z-20 sits on top if both pin). No prop wiring needed.

## Realtime transition

When kitchen marks an order ready, its `status` flips `pending → ready`. Both subscriptions fire on the same UPDATE; `PreparingAlerts` re-queries and the row drops out of its list, `ReadyAlerts` re-queries and the row appears in its list. No extra wiring required.

## Hot sauce tags note

The user mentioned "hot sauce tags if applicable" — current `ReadyAlerts` does not render any hot-sauce-specific tag (only `removed_ingredients` and `notes`). I'll mirror exactly what Ready renders, so feature parity is preserved automatically. If hot-sauce is encoded in `notes` or `removed_ingredients`, it already shows.

## Verification

1. Build passes (no TS errors).
2. On `/cashier`, place a test order → yellow "1 Preparing" strip appears with order details, no sound.
3. On `/kitchen`, mark it ready → card disappears from yellow strip and appears in red "Ready" strip with alarm.
4. Strips collapse/expand independently.  
  
Before finalizing positioning values (top offset, z-index), check the actual current values used in `ReadyAlerts.tsx` rather than assuming, to ensure the two strips stack cleanly without overlapping.

## Out of scope

- No changes to `ReadyAlerts` appearance, sound, or buttons.
- No DB / migration changes (pending status already exists).
- No changes to kitchen route.