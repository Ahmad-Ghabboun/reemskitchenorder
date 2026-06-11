## Goal

Add an Events system so the booth can run multiple menus. One event is active at a time; cashier/kitchen/admin all scope to the active event.

## Backend (single migration)

1. `CREATE TABLE public.events` — `id uuid pk default gen_random_uuid()`, `name text not null`, `is_active boolean not null default false`, `created_at timestamptz not null default now()`.
2. GRANT `SELECT, INSERT, UPDATE, DELETE` on `events` to `anon, authenticated`; GRANT ALL to `service_role` (the app has no auth, so anon needs full access — same pattern as existing tables).
3. Enable RLS + public policy `FOR ALL USING (true) WITH CHECK (true)` (matches existing tables).
4. Partial unique index `CREATE UNIQUE INDEX events_one_active ON public.events (is_active) WHERE is_active` to enforce at most one active event.
5. Trigger `BEFORE INSERT OR UPDATE ON events`: when `NEW.is_active = true`, set all other rows' `is_active = false`. (Avoids race with the unique index and gives one-call activation.)
6. `ALTER TABLE public.menu_items ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE`. Nullable for legacy rows.
7. Seed: insert one event "Default" with `is_active=true`. Backfill `UPDATE menu_items SET event_id = <default id> WHERE event_id IS NULL`.
8. Add `events` to the `supabase_realtime` publication so the dashboard updates live.

(No change to `orders` / `order_items` — orders remain global and historical.)

## Frontend

### `src/lib/booth-types.ts`

- Add `Event = { id, name, is_active, created_at }`.
- Extend `MenuItem` with `event_id: string | null`.

### New route `src/routes/events.tsx` (`/events`)

- Lists all events (newest first) with name, created date, active badge.
- "Set Active" button on each row → `UPDATE events SET is_active=true WHERE id=...` (trigger handles deactivating others). Active event shows a filled badge instead of the button.
- "Create New Event" form: single name input + Create button → inserts event (inactive by default).
- Delete button (trash icon) with `confirm()` warning that all menu items in that event will be deleted (cascade). Disabled for the currently active event to prevent accidental nuke.
- Realtime subscription on `events` to refresh list.
- Touch-friendly, matches existing dark theme.

### `src/routes/admin.tsx`

- Load the active event on mount + subscribe to `events` changes.
- Header strip shows "Active event: &nbsp;" with a `<Link to="/events">Switch</Link>`.
- `load()` filters `menu_items` by `event_id = activeEvent.id` (and skips load if none).
- `save()` insert sets `event_id: activeEvent.id`. Update keeps existing `event_id`.
- If no active event exists, show a full-card empty state with a CTA linking to `/events` to create/activate one; hide the new-item form.

### `src/routes/cashier.tsx`

- Same active-event lookup + subscription.
- Menu query filters by `event_id = activeEvent.id`.
- If no active event, show "No active event" message in place of the menu.

### `src/routes/kitchen.tsx`

- No change required (orders are global). Skip.

### `src/routes/index.tsx`

- Add a tile/link to `/events` alongside Cashier/Kitchen/Admin.

## Files

- `supabase/migrations/<new>.sql` — events table, grants, RLS, trigger, menu_items.event_id, seed/backfill, realtime publication
- `src/lib/booth-types.ts`
- `src/routes/events.tsx` (new)
- `src/routes/admin.tsx`
- `src/routes/cashier.tsx`
- `src/routes/index.tsx`

## Open questions

1. **Deleting the active event** — block (current plan) or allow with extra-strong confirm?
2. **Pending orders when switching events** — leave them in the kitchen queue (current plan, since orders are global), or auto-mark them done on switch?  
  
**Deleting the active event** — keep the current plan (block it). Forcing the user to switch to another event first before deleting is a small extra step but prevents accidentally nuking the menu you're currently using mid-service.
3. **Pending orders when switching events** — leave them in the kitchen queue (current plan). Auto-marking them done would hide real, unfulfilled orders from the kitchen, which could mean food never gets made. If you're switching events mid-day, any pending orders are presumably real orders that still need to be cooked regardless of which menu is "active" — so they should stay visible until the kitchen actually marks them ready.