## Goal

Item #1 (cashier ready alerts) is already implemented from the previous turn. This update adds **Item #2: a pleasant one-shot chime on `/kitchen` when a new pending order arrives**, plus a small audit pass on Item #1 to confirm everything is wired correctly.

## Changes

### 1. `src/lib/booth-audio.ts` — add a one-shot chime method

Add a `chime()` method to the existing `AudioEngine` class. Two-note bell-like tone using oscillators with a soft exponential decay envelope (e.g. E6 → A6, ~600ms total, triangle wave through gain). Respects mute/volume. No looping, no asset.

### 2. `src/routes/kitchen.tsx` — play chime on new pending orders

- Add a one-time "Enable Sounds" full-screen overlay (same pattern as cashier), gated by `sessionStorage` key `booth_kitchen_audio_unlocked`.
- Instantiate an `AudioEngine` ref on mount; call `unlock()` when user taps the overlay.
- In the existing realtime channel, add a dedicated listener for `INSERT` on `orders` (separate from the generic `load` handler) that calls `engine.chime()` — only fires when `audioUnlocked` is true.
  - Use a separate `.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, ...)` so updates (e.g. status → ready) don't trigger the chime.
- Add a small mute toggle in the kitchen header (icon-only, persisted to `localStorage` under `booth_kitchen_muted`) so the kitchen can silence it if needed.
- Dispose engine on unmount.

### 3. Audit pass on Item #1 (no functional change expected)

Verify, no edits unless a bug surfaces:
- `ready_at` column exists on `orders` and is in the generated types.
- Kitchen `markDone` writes `status='ready', ready_at=now()`.
- `ReadyAlerts` subscribes to `status='ready'`, supports snooze/picked-up, mute/volume, collapse, wake lock, and the enable-sounds overlay is wired from `/cashier`.

## Files

- `src/lib/booth-audio.ts` — add `chime()` method
- `src/routes/kitchen.tsx` — enable-sounds overlay, engine ref, INSERT listener → chime, mute toggle

## Open question

Chime character: **soft two-note bell (E6→A6, ~600ms)** by default — okay, or do you want something more distinctive (e.g. three-note ascending, or a single ding)?
