## Fix: clear test orders and reset order_number sequence

Run the cleanup SQL directly against the database (via the insert tool, which has full privileges — not via `reset_order_number_seq()` RPC):

```sql
DELETE FROM public.order_items;
DELETE FROM public.orders;
SELECT setval('public.order_number_seq', 1, false);
```

Then verify with two read queries:
1. `SELECT count(*) FROM public.orders;` → expect 0
2. `SELECT last_value, is_called FROM public.order_number_seq;` → expect `last_value=1, is_called=false` so the next `nextval` returns 1

Then ask you to place a test order via /cashier and report back. If it still 409s, I'll surface the new error verbatim before making further changes.

No code/schema changes — data-only operation on existing tables.