# Food Booth Ordering System

A two-device real-time ordering app: iPhone takes orders, iPad shows the kitchen queue, both synced via Supabase realtime. No auth, no payments.

## Routes

- `/cashier` — iPhone, single-column, thumb-friendly menu + cart + Send Order
- `/kitchen` — iPad, grid of live order cards with Done button
- `/admin` — simple CRUD for menu items and their default ingredients
- `/` — landing with three big buttons linking to the three routes

## Backend (Lovable Cloud / Supabase)

Enable Lovable Cloud. No auth required — tables are publicly readable/writable (booth-only internal tool, single LAN-ish use). I'll note this tradeoff; if you'd rather lock it behind a shared PIN later we can add that.

Tables:

- `menu_items` — `id`, `name`, `price` (numeric), `default_ingredients` (text[]), `sort_order`, `created_at`
- `orders` — `id`, `order_number` (int, sequential via Postgres sequence), `status` ('pending' | 'done'), `created_at`, `completed_at`
- `order_items` — `id`, `order_id` (fk), `menu_item_id` (fk, nullable on delete set null), `name_snapshot`, `quantity`, `removed_ingredients` (text[]), `notes` (text)

Sequential order numbers come from a Postgres sequence so numbers never collide across devices. Realtime enabled on `orders` and `order_items`.

Permissive RLS policies (anon select/insert/update/delete) since there's no login. Menu management is on the same open policy — fine for an internal device, easy to tighten later.

## Cashier View (`/cashier`)

- Top: scrollable menu grid (2 cols on phone) — each tile shows name + price, big tap target
- Tap a tile → adds line to cart with all default ingredients selected
- Cart section below menu, each line shows:
  - Item name + qty stepper (− 1 +) with large buttons
  - Ingredient chips: tap to toggle removed (strikethrough + minus prefix, distinct color)
  - Notes input (single-line, expands)
  - Remove line (X)
- Sticky bottom "Send Order" button (full width, large). On send:
  - Insert order + items in a single RPC/transaction, get back order_number
  - Toast: "Order #12 sent" for ~1.5s
  - Clear cart

## Kitchen Display (`/kitchen`)

- Header: title + live order count
- Grid of cards (2–3 cols on iPad landscape), oldest first
- Each card: large order #, time ago (auto-updating), list of items with qty, removed ingredients shown bold/red as "NO onions", notes block
- Big "Done" button at bottom of card → updates status to 'done' (row disappears on both devices instantly via realtime)
- Realtime subscription on `orders` filtered to `status=pending`; refetch items when a new order appears

## Admin (`/admin`)

- List of menu items with edit/delete
- Add/edit form: name, price, ingredients (add/remove rows of text inputs), sort order
- Changes propagate to cashier via realtime subscription on `menu_items`

## Design

- High-contrast palette: near-black background or white background with bold accent (warm orange/red for primary action, green for Done, red for removed ingredients)
- System font stack, large sizes (cashier base 16–18, kitchen 20–24, order numbers 48+)
- Minimum 44pt tap targets everywhere
- No fancy animations — only a brief toast for "Order sent"
- Tailwind tokens defined in `src/styles.css` (semantic colors), no hardcoded colors in components

## Technical Details

- TanStack Start file routes: `src/routes/cashier.tsx`, `src/routes/kitchen.tsx`, `src/routes/admin.tsx`, update `index.tsx` as launcher
- Supabase browser client for queries + realtime channels (these are public/anon flows, no server fns needed)
- Cart state local to cashier route (React state) — only sent to Supabase on "Send Order"
- Order number via `nextval('order_number_seq')` in a SQL function `create_order(items jsonb)` that inserts order + items atomically and returns the new order

## Open Questions

Before I build, two quick choices (I'll pick sensible defaults if you don't say):

1. Color theme — bold dark mode (black + orange) or bright light mode (white + red)?
2. Should completed orders be hard-deleted, or kept (status='done') for any later review? I'd default to keeping them in the DB but hiding from the kitchen view.  
  
Color theme: bold dark mode (black background, orange/red accents for primary actions and alerts, green for Done).
3. Completed orders: keep them in the database with status='done', just hide them from the kitchen view (no hard delete).

Proceed with the rest of the plan as outlined.