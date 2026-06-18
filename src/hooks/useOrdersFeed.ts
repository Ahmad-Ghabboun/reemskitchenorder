import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem } from "@/lib/booth-types";

type Feed = {
  pending: Order[];
  ready: Order[];
  items: OrderItem[];
};

/**
 * Single Realtime channel + debounced reload for cashier's two strips.
 * Replaces the per-component subscriptions that were stacking up on `orders`
 * and `order_items` and causing cross-device lag.
 */
export function useOrdersFeed(): Feed {
  const [pending, setPending] = useState<Order[]>([]);
  const [ready, setReady] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: o } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["pending", "ready"])
        .order("created_at", { ascending: true });
      if (!active) return;
      const list = (o ?? []) as Order[];
      const p = list.filter((x) => x.status === "pending");
      const r = list
        .filter((x) => x.status === "ready")
        .sort((a, b) => {
          const av = a.ready_at ? new Date(a.ready_at).getTime() : 0;
          const bv = b.ready_at ? new Date(b.ready_at).getTime() : 0;
          return av - bv;
        });
      setPending(p);
      setReady(r);
      if (list.length === 0) {
        setItems([]);
        return;
      }
      const { data: it } = await supabase
        .from("order_items")
        .select("*")
        .in(
          "order_id",
          list.map((x) => x.id),
        )
        .order("position", { ascending: true });
      if (active) setItems((it ?? []) as OrderItem[]);
    };

    const scheduleLoad = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        load();
      }, 150);
    };

    load();

    const ch = supabase
      .channel("cashier_orders_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleLoad)
      .subscribe();

    return () => {
      active = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, []);

  return useMemo(() => ({ pending, ready, items }), [pending, ready, items]);
}
