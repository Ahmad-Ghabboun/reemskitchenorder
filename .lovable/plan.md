5 changes, each scoped to the file(s) named. No DB migrations; existing schema and RPCs cover all cases (delete is plain DELETE; swap reuses `save_order_edit`).

---

### 1. Delete order from edit mode

File: `src/components/PreparingAlerts.tsx`

- Add a red "Delete Order" button rendered only when `isEditing === true`, placed at the bottom of the inline edit body (full-width, below the last line item, separated by a divider) so it doesn't crowd the top-right Cancel/Save.
- Tap opens a confirmation: use the existing `AlertDialog` from `@/components/ui/alert-dialog` with title "Delete order #X?" and body "This cannot be undone."
- On confirm:
  1. `await supabase.from("order_items").delete().eq("order_id", o.id)`
  2. `await supabase.from("orders").delete().eq("id", o.id)`
  3. Toast success, clear local edit state. Realtime feed removes the card on both devices.
- On error: toast `"Failed to delete order"`, keep edit mode open.
- Order numbers are NOT reassigned — sequence keeps marching forward; gaps are expected.

---

### 2. Swap item type in edit mode

File: `src/components/PreparingAlerts.tsx` (already receives `menu: MenuItem[]` filtered to the active event — reuse it).

Layout decision: keep the current line structure intact. The line currently shows `name_snapshot` as plain text in the top-left of each edit-mode line card. Convert that name into a **tap target** (button styled like the name) that opens a floating popover listing all menu items by name. Use the existing `Popover` from `@/components/ui/popover` so it auto-positions and dismisses on outside tap — no custom overlay code.

Popover content: scrollable `<ul>` of `menu` (filtered to active event, already the case), each row showing the item name in a large tap-friendly button. Tapping a row:

- Updates that `EditLine` with: `menu_item_id = picked.id`, `name_snapshot = picked.name`, `default_ingredients = picked.default_ingredients`, `removed_ingredients = []`, `extra_hot_sauce = false`, `notes = ""`.
- Quantity is preserved.
- Closes popover.

Selecting the same item is a no-op.

No changes to `save_order_edit` — it already accepts the new `menu_item_id` and snapshot.

---

### 3. Item count pills in kitchen header

File: `src/routes/kitchen.tsx`

- Compute `itemTotals` via `useMemo` over current `items`: aggregate `quantity` keyed by `name_snapshot`, output sorted by descending qty.
- Render a horizontally scrollable row of pills inserted between `<h1>Kitchen</h1>` and the mute button:
  ```
  <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex gap-1.5">
    {itemTotals.map(([name, qty]) => (
      <span className="shrink-0 px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/40 text-[12px] font-bold whitespace-nowrap">
        {name} × {qty}
      </span>
    ))}
  </div>
  ```
- Mute, ThemeToggle, and pending count stay on the right. The `ml-auto` on the mute button is removed since the pill row is now the flex spacer.
- Updates live because `items` already updates via realtime.

---

### 4. Kitchen card layout — 3-column grid, flush Ready button, time-ago

File: `src/routes/kitchen.tsx`

- Replace the responsive `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5` with fixed `grid grid-cols-3 gap-2 p-2` (per spec). Drop the `p-6` on `<main>`.
- Card: `flex flex-col` (already), keep `rounded-2xl border-2 overflow-hidden`.
- Header: `flex items-baseline justify-between px-3 py-2 bg-accent/40 border-b`. Order number `text-[26px] font-black text-primary`, time on right `text-sm font-bold text-muted-foreground tabular-nums`.
- Content `<ul>`: `flex-1 px-3 py-2 flex flex-col gap-2` (smaller padding to fit 3-up).
- Replace the existing countdown — `timeAgo()` already exists and returns "Xs / Xm Ys / Xh Ym". Keep the 1s `setInterval` updating `now` (already there) — spec says 30s but 1s is what's already wired and harmless; I'll relax the interval to 30s as specified to reduce re-renders.
- Ready button: keep full-width green, remove any wrapping margin so it sits flush at the bottom — the article already has `overflow-hidden` and the button is the last child, so it's already flush; verify `h-20` is appropriate at 3-up width and reduce to `h-14 text-xl` for a tighter fit.
- Header changes from #3 (mute, ThemeToggle, pending count, item pills) are preserved.  
  
Keep the `setInterval` at 1s, not 30s — the 'time ago' display shows seconds for recent orders and a 30s interval would make it feel stale for new orders."

---

### 5. iOS PWA realtime reconnect

Investigation: realtime subscriptions live in two places — `src/hooks/useOrdersFeed.ts` (cashier) and `src/routes/kitchen.tsx` (kitchen). No shared hook. iOS suspends WebSockets when the PWA is backgrounded; on resume the Supabase channel stays in a half-open state and stops delivering events until manual reload.

Fix (added to BOTH owners, no duplication risk because each owns its own channel):

Inside each `useEffect` that creates a channel, add a visibility/focus handler that:

1. Calls the existing `scheduleLoad()` (debounced reload) — guarantees data is fresh on resume even if the socket missed events.
2. Calls `supabase.realtime.connect()` if `supabase.realtime.isConnected()` is false, then removes and recreates the channel if its state is not `joined`.

Concretely, factor the channel setup into a local `subscribe()` function inside the effect so resume can tear down (`supabase.removeChannel(ch); ch = subscribe();`) and rebuild cleanly. Listeners:

```ts
const onResume = () => {
  if (document.visibilityState !== "visible") return;
  scheduleLoad();
  if (ch.state !== "joined") {
    supabase.removeChannel(ch);
    ch = subscribe();
  }
};
document.addEventListener("visibilitychange", onResume);
window.addEventListener("focus", onResume);
window.addEventListener("pageshow", onResume); // iOS PWA resume from bfcache
```

Cleanup removes all three.

Optional indicator: add a small "Reconnecting…" badge (top-right of header on both pages) driven by a `reconnecting` state that flips true when we detect a non-joined channel and false once the next `scheduleLoad` resolves. Keep it subtle (warning-colored pill, auto-hides).

Files changed: `src/hooks/useOrdersFeed.ts`, `src/routes/kitchen.tsx`.

---

### Technical notes

- All five items touch only: `src/components/PreparingAlerts.tsx`, `src/routes/kitchen.tsx`, `src/hooks/useOrdersFeed.ts`. No new files, no migrations, no schema changes.
- After implementation: build, then screenshot (a) a Preparing card in edit mode showing Delete button + tap-to-swap line + existing pulse, and (b) the kitchen 3-col grid with item-count pills in the header.  
  
Before proceeding, please add two clarifications to the plan:
  **#3 addition:** If `itemTotals` is empty (no pending orders), render a `flex-1` spacer div in place of the pill row to keep the mute/toggle/count controls right-aligned — don't let them shift left when there are no pills.
  **#5 addition:** Before using `supabase.realtime.isConnected()` and `supabase.realtime.connect()`, verify these methods exist in the installed version of `@supabase/supabase-js`. If not available, skip that call entirely and rely solely on `supabase.removeChannel(ch); ch = subscribe()` for reconnection — this is sufficient since channel recreation implicitly reconnects the underlying socket.
  Please confirm these are incorporated into the plan, then proceed with implementation.