export type MenuItem = {
  id: string;
  name: string;
  price: number;
  default_ingredients: string[];
  sort_order: number;
  created_at: string;
  event_id: string | null;
};

export type Event = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  ready_at: string | null;
  edited_at: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  quantity: number;
  removed_ingredients: string[];
  notes: string;
  position: number;
  created_at: string;
  extra_hot_sauce: boolean;
};

export type CartLine = {
  uid: string;
  menu_item_id: string;
  name: string;
  default_ingredients: string[];
  removed_ingredients: string[];
  quantity: number;
  notes: string;
  extra_hot_sauce: boolean;
};
