
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  default_ingredients text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number int NOT NULL UNIQUE DEFAULT nextval('public.order_number_seq'),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT USAGE ON SEQUENCE public.order_number_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.order_number_seq TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  removed_ingredients text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_orders_status_created ON public.orders(status, created_at);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

INSERT INTO public.menu_items (name, price, default_ingredients, sort_order) VALUES
  ('Smash Burger', 9.50, ARRAY['bun','patty','cheese','lettuce','tomato','onions','pickles','sauce'], 1),
  ('Chicken Sandwich', 9.00, ARRAY['bun','chicken','lettuce','mayo','pickles'], 2),
  ('Loaded Fries', 7.00, ARRAY['fries','cheese','bacon','green onions','sour cream'], 3),
  ('Hot Dog', 6.00, ARRAY['bun','dog','mustard','ketchup','onions','relish'], 4),
  ('Soda', 3.00, ARRAY['ice'], 5);
