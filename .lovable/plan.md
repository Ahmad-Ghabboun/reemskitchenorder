# Order Ready Alert System

Add a third order status `ready` between `pending` and `done`. Kitchen marks orders ready → cashier device alerts loudly until each is picked up.

## Backend

- No schema change needed — `orders.status` is already free-form text. Just use a new value `'ready'`.
- Kitchen "Done" button: update from `status='pending', completed_at=null` to `status='ready', ready_at=now()`.
  - Add a `ready_at timestamptz` column to `orders` (nullable) so we can order alerts oldest-first and show wait time.
- Final pickup writes `status='done', completed_at=now()`.

## `/kitchen` changes

- Query/subscription filter stays `status = 'pending'` (ready orders disappear from kitchen, same as today).
- "Done" button writes `status='ready', ready_at=now()` instead of `done`.

## `/cashier` changes

### Realtime subscription

- New channel subscribed to `orders` where `status='ready'`, plus their `order_items`.
- Maintain a `readyOrders` list (oldest `ready_at` first).

### Alert UI

- Prominent fixed banner/list above the menu (or as a full-width overlay strip at top) showing each ready order as a card:
  - Big order number (`#12`)
  - All items with quantity, removed ingredients ("NO onions" red chips), notes
  - Two large buttons: **Picked Up** (green) and **Snooze** (secondary)
- Stacks vertically when multiple are ready.

### Audio

- Add a short alert tone asset (`src/assets/alert.mp3`) OR generate via WebAudio oscillator (no asset, avoids binary file). I'll use WebAudio oscillator beep (2 quick beeps) scheduled on a `setInterval` every 2.5s — works offline, no asset to bundle.
- One-time "Enable Sounds" gate: on first load, show a full-screen tap-to-enable overlay. Tap creates/resumes the `AudioContext` and plays a silent buffer to unlock iOS audio. Persist "unlocked" in `sessionStorage` so it doesn't reappear on every nav within the session.
- Looping logic: while any non-snoozed ready order exists AND not muted, beep every 2.5s. Stop when list empty or all snoozed or muted.

### Mute / volume

- Header toggle: mute button (icon) + volume slider. State kept in component + persisted to `localStorage`.

### Snooze

- "Snooze" marks that order's id as snoozed until `Date.now() + 75_000` in component state (Map<orderId, untilMs>).
- A `setInterval(1000)` clears expired snoozes → order reappears and beeping resumes.
- Snooze state is local to device only (not persisted across reload — acceptable; reload re-alerts).

### Picked Up

- Updates DB: `status='done', completed_at=now()`. Realtime removes it from list; if list becomes empty/all snoozed, beep stops.

### Screen Wake Lock

- On mount (after sounds enabled), request `navigator.wakeLock.request('screen')`.
- Re-acquire on `visibilitychange` when page becomes visible (wake lock auto-releases on hide).
- Release on unmount. Silently no-op if API unsupported (older iOS).

## Files

- `supabase/migrations/<new>.sql` — add `ready_at timestamptz` to `orders`.
- `src/routes/kitchen.tsx` — change `markDone` to set `status='ready', ready_at=now()`.
- `src/routes/cashier.tsx` — add ready-orders subscription, alert UI, audio engine, snooze map, mute toggle, wake lock, enable-sounds gate.
- `src/lib/booth-audio.ts` — small helper: `AudioEngine` class wrapping WebAudio (unlock, beep, mute, volume).
- `src/lib/booth-types.ts` — extend `Order` with `ready_at: string | null`.

## Open question

Beep style: should it be a short urgent double-beep (default I'll use), or do you want a specific sound file uploaded? I'll default to a synthesized double-beep so nothing extra is needed.  
  
**Additions to Order Ready Alert System plan:**

**Beep style:** Yes, default to the synthesized double-beep — no audio file needed.

**Ready list height constraint:** The ready-orders banner/list should have a `max-height` with internal vertical scroll (rather than pushing the menu/cart down indefinitely). This keeps the menu and "Send Order" button accessible even when 3+ orders are ready at once.

**Collapse/expand toggle:** Add a collapse/expand control to the ready banner — when collapsed, it shrinks to a slim bar showing just a count badge (e.g. "🔔 2 ready") while still blinking and still triggering audio; expanding reveals the full stacked cards. State can be local to the component (no need to persist).