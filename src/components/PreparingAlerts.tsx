import { useMemo } from "react";
import { useState } from "react";
import { ChefHat, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import type { Order, OrderItem } from "@/lib/booth-types";

type Props = {
  orders: Order[];
  items: OrderItem[];
  onEdit: (order: Order) => void;
};

export function PreparingAlerts({ orders, items, onEdit }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const byOrder = useMemo(() => {
    const map: Record<string, OrderItem[]> = {};
    for (const it of items) (map[it.order_id] ||= []).push(it);
    return map;
  }, [items]);

  if (orders.length === 0) return null;

  return (
    <div className="sticky top-14 z-10 mx-2 mt-2 rounded-2xl border-2 border-warning shadow-xl overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-3 py-2 bg-warning text-warning-foreground">
        <ChefHat className="w-5 h-5" />
        <span className="font-black text-base">{orders.length} Preparing</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-lg active:scale-95"
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <ul className="max-h-[40vh] overflow-y-auto divide-y divide-border">
          {orders.map((o) => {
            const its = byOrder[o.id] ?? [];
            return (
              <li key={o.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-black text-warning">#{o.order_number}</div>
                  <button
                    onClick={() => onEdit(o)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning/15 text-warning font-bold text-sm active:scale-95 border border-warning/40"
                    aria-label={`Edit order ${o.order_number}`}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {its.map((it) => (
                    <li key={it.id}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black tabular-nums">{it.quantity}×</span>
                        <span className="text-lg font-bold leading-tight">{it.name_snapshot}</span>
                      </div>
                      {it.removed_ingredients.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.removed_ingredients.map((ing) => (
                            <span
                              key={ing}
                              className="px-2 py-0.5 rounded-md bg-destructive/20 text-destructive font-black uppercase text-xs tracking-wide"
                            >
                              NO {ing}
                            </span>
                          ))}
                        </div>
                      )}
                      {it.extra_hot_sauce && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="px-2 py-1 rounded-md bg-warning text-warning-foreground font-black uppercase tracking-wide text-sm">
                            + HOT SAUCE
                          </span>
                        </div>
                      )}
                      {it.notes && (
                        <div className="mt-1 px-2 py-1 rounded-md bg-warning/15 text-warning font-bold text-sm">
                          "{it.notes}"
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
