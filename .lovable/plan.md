# Diagnosis & Plan — 3 fixes

## 1. Realtime lag between devices

### Findings

Each page now opens multiple independent Realtime channels that all listen to the same broad tables (`orders`, `order_items`):

- **/cashier** opens **3** channels: `menu_items_cashier`, `cashier_preparing` (new, from PreparingAlerts), and `cashier_ready` (from ReadyAlerts). The last two **both** subscribe to `event: "*"` on `orders` AND `order_items`.
- **/kitchen** opens `kitchen_live` with **two overlapping** `.on()` handlers for `orders` (one INSERT-only for the chime, one `*` that calls `load`).

Every row change therefore wakes 2–3 subscriptions per device, and each one runs a full `load()` that does **two sequential** Supabase queries (orders, then order_items). That's 4–6 round-trips per single status change, plus the extra fan-out work Realtime does per subscription on the server side. Adding PreparingAlerts pushed the cashier from 1 listener on orders → 2, which is where the user-visible "several seconds" lag began.

There's also an unrelated correctness issue: `cashier_ready`'s effect has `[]` deps but its `load` closes over no stale state — fine — yet the `clean expired snoozes` effect runs on every render with no deps, which is wasteful but not the lag cause.

### Proposed fix

- **Consolidate cashier subscriptions** into one shared channel/source of truth: a small `useOrdersFeed()` hook (or a context) that opens **one** channel `cashier_orders_feed` listening once to `orders` + `order_items`, fetches both pending and ready in a single pair of queries, and exposes `{ pending, ready, items }` to both PreparingAlerts and ReadyAlerts. Net listeners on cashier: **1** (orders feed) + 1 (menu) instead of 3.
- **Debounce the reload** inside the feed: collapse bursts of postgres_changes events within 150 ms into a single `load()` to avoid the 2-query storm when an order with many items is inserted/edited.
- **Kitchen**: keep one `.on("*", "orders", load)` plus the INSERT-only chime handler (already correct), but also debounce `load` the same way.
- No schema changes for this item.

## 2. Alert sound goes silent after extended use

### Findings

Root cause is the `AudioContext` lifecycle, not the loop logic:

- On iOS/iPadOS Safari, an `AudioContext` is auto-suspended after the tab is idle, the screen locks, audio is interrupted (a call, Siri, another app), or the page is backgrounded. After suspension, `osc.start()` / `g.gain.setValueAtTime()` calls still succeed silently — no error, no sound.
- `booth-audio.ts` calls `ctx.resume()` **only inside `unlock()**`, which only runs on the initial user-gesture tap. There's no listener on `ctx.statechange`, no `visibilitychange` resume, and no resume inside `beep()`/`chime()`. Once the ctx flips to `suspended` or `interrupted`, every subsequent `beep()` is a no-op forever until the page is reloaded — exactly what the user reports.
- The Wake Lock in ReadyAlerts reduces but does not prevent this (Wake Lock is released when the tab is hidden, and audio can still be interrupted while the screen stays on).

### Proposed fix

In `src/lib/booth-audio.ts`:

- Track whether the user has ever unlocked (`this.unlocked` already exists).
- Add a private `ensureRunning()` helper that, if `ctx.state !== "running"` and we were previously unlocked, calls `ctx.resume()` (fire-and-forget) before scheduling any sound. Call it at the top of `beep()`, `chime()`, and the new `editChime()`.
- Attach `ctx.onstatechange` in `unlock()` to re-resume when the state becomes `suspended` or `interrupted`.
- Expose a `resume()` method, and in **ReadyAlerts** and **kitchen.tsx** add a `visibilitychange` + `focus` listener that calls `engineRef.current?.resume()` when the page becomes visible again.
- Inside `startLoop()`, also call `ensureRunning()` on every tick so a long-running loop self-heals if iOS suspends mid-loop.

## 3. Edit pending order from the Preparing strip

### Schema change (one migration)

- Add `orders.edited_at timestamptz NULL`. Set it whenever the cashier saves an edit. Kitchen uses the change in this column to play a distinct alert.

### UI / behavior

- **PreparingAlerts**: each order card gets an **Edit** button next to `#<order_number>`. Tapping it opens a full-screen modal (a new component `EditOrderSheet.tsx`) prefilled from the order's current items.
- **EditOrderSheet** lets the cashier:
  - change `quantity` (± buttons),
  - toggle `removed_ingredients` chips (same UI as /cashier cart),
  - toggle `extra_hot_sauce`,
  - edit `notes`,
  - delete a line,
  - add a new line by tapping a menu item from the active event's menu (loaded via the existing menu_cache so it's instant).
- **Save** runs in a single client transaction-equivalent flow:
  1. `delete from order_items where order_id = $1`
  2. `insert into order_items (...)` with the new lines (reusing `name_snapshot` for existing lines, `menu_items.name` for newly added ones, `position` recomputed by array index).
  3. `update orders set edited_at = now() where id = $1`.
  If any step fails, toast an error; the kitchen's realtime view stays consistent because step 3 only fires on success.
- **Cancel** closes the sheet with no writes.
- No new order row is ever created.

### Kitchen alert for edits

- In `src/lib/booth-audio.ts`, add `editChime()` — a distinct three-note descending motif (e.g. A6 → E6 → C6, triangle, ~0.5s total) so it's clearly different from the ascending new-order chime.
- In `src/routes/kitchen.tsx`, extend the existing `kitchen_live` channel with an UPDATE handler on `orders` that compares `payload.new.edited_at` against `payload.old.edited_at`; if it changed and the row is still `status === "pending"` and `audioReadyRef.current`, call `engineRef.current?.editChime()`. The existing `load` handler already refreshes the card contents.
- Do **not** play `editChime` on /cashier — only /kitchen.

### Scope guard

- No changes to `events`, `menu_items`, or `admin.tsx`.
- Edit is only offered for `status = 'pending'` orders; the Ready strip is unchanged.

## Technical notes (for the implementer)

```text
Files touched
  src/lib/booth-audio.ts            ensureRunning(), resume(), onstatechange, editChime()
  src/components/PreparingAlerts.tsx  Edit button; consume shared feed
  src/components/ReadyAlerts.tsx     consume shared feed; visibilitychange resume
  src/components/EditOrderSheet.tsx  NEW — modal editor
  src/hooks/useOrdersFeed.ts        NEW — single channel, debounced load
  src/routes/cashier.tsx            wire feed provider once
  src/routes/kitchen.tsx            debounced load; edited_at UPDATE → editChime; visibility resume
  supabase migration                ALTER TABLE orders ADD COLUMN edited_at timestamptz
```

No new dependencies. No auth changes. RLS policies on `orders` already allow `ALL` for public, so the new column and update path work without policy edits.  
  
Before you proceed, please add one thing to the Fix #3 plan: For the edit save operation in `EditOrderSheet`, please implement it as a single Postgres RPC function (e.g., `save_order_edit(order_id uuid, new_items jsonb)`) that performs the delete, reinsert, and `edited_at` update atomically in one server-side transaction — rather than three sequential client-side calls. This prevents a partial-save state (empty order on kitchen) if the network drops between steps. Add this function to the migration alongside the `edited_at` column addition. Grant EXECUTE to `anon, authenticated` consistent with existing RPC grants.