import { useMemo, useState } from "react";
import { ChefHat, ChevronUp, ChevronDown, Pencil, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItem, Order, OrderItem } from "@/lib/booth-types";

type Props = {
  orders: Order[];
  items: OrderItem[];
  menu: MenuItem[];
};

type EditLine = {
  id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  default_ingredients: string[];
  removed_ingredients: string[];
  quantity: number;
  notes: string;
  extra_hot_sauce: boolean;
};

export function PreparingAlerts({ orders, items, menu }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);

  const byOrder = useMemo(() => {
    const map: Record<string, OrderItem[]> = {};
    for (const it of items) (map[it.order_id] ||= []).push(it);
    return map;
  }, [items]);

  const menuById = useMemo(() => {
    const m: Record<string, MenuItem> = {};
    for (const x of menu) m[x.id] = x;
    return m;
  }, [menu]);

  if (orders.length === 0) return null;

  const startEdit = (o: Order) => {
    const its = byOrder[o.id] ?? [];
    setLines(
      its.map((it) => ({
        id: it.id,
        menu_item_id: it.menu_item_id,
        name_snapshot: it.name_snapshot,
        default_ingredients:
          (it.menu_item_id && menuById[it.menu_item_id]?.default_ingredients) || [],
        removed_ingredients: [...it.removed_ingredients],
        quantity: it.quantity,
        notes: it.notes,
        extra_hot_sauce: it.extra_hot_sauce,
      })),
    );
    setEditingId(o.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setLines([]);
  };

  const updateLine = (id: string, patch: Partial<EditLine>) =>
    setLines((c) => c.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const toggleIngredient = (id: string, ing: string) =>
    setLines((c) =>
      c.map((l) =>
        l.id === id
          ? {
              ...l,
              removed_ingredients: l.removed_ingredients.includes(ing)
                ? l.removed_ingredients.filter((x) => x !== ing)
                : [...l.removed_ingredients, ing],
            }
          : l,
      ),
    );

  const saveEdit = async (orderId: string, orderNumber: number) => {
    if (lines.length === 0 || saving) return;
    setSaving(true);
    try {
      const payload = lines.map((l) => ({
        menu_item_id: l.menu_item_id,
        name_snapshot: l.name_snapshot,
        quantity: l.quantity,
        removed_ingredients: l.removed_ingredients,
        notes: l.notes.trim(),
        extra_hot_sauce: l.extra_hot_sauce,
      }));
      const { error } = await supabase.rpc("save_order_edit", {
        p_order_id: orderId,
        p_items: payload,
      });
      if (error) throw error;
      toast.success(`Order #${orderNumber} updated`, { duration: 1800 });
      setEditingId(null);
      setLines([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

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
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {orders.map((o) => {
            const its = byOrder[o.id] ?? [];
            const isEditing = editingId === o.id;
            return (
              <li key={o.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-3xl font-black text-warning">#{o.order_number}</div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground font-bold text-sm active:scale-95 border border-border disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(o.id, o.order_number)}
                        disabled={saving || lines.length === 0}
                        className="px-3 py-2 rounded-lg bg-warning text-warning-foreground font-bold text-sm active:scale-95 border border-warning disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(o)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning/15 text-warning font-bold text-sm active:scale-95 border border-warning/40"
                      aria-label={`Edit order ${o.order_number}`}
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>

                {!isEditing && (
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
                )}

                {isEditing && (
                  <ul className="mt-3 flex flex-col gap-3">
                    {lines.map((l) => (
                      <li key={l.id} className="rounded-xl bg-background/40 border border-border p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base leading-tight">{l.name_snapshot}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => updateLine(l.id, { quantity: Math.max(1, l.quantity - 1) })}
                              className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground grid place-items-center active:scale-95"
                              aria-label="Decrease"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-7 text-center font-black text-lg tabular-nums">{l.quantity}</span>
                            <button
                              onClick={() => updateLine(l.id, { quantity: l.quantity + 1 })}
                              className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground grid place-items-center active:scale-95"
                              aria-label="Increase"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {l.default_ingredients.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">
                              Already Added
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {l.default_ingredients.map((ing) => {
                                const removed = l.removed_ingredients.includes(ing);
                                return (
                                  <button
                                    key={ing}
                                    onClick={() => toggleIngredient(l.id, ing)}
                                    className={
                                      "px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors " +
                                      (removed
                                        ? "bg-destructive/15 border-destructive text-destructive line-through"
                                        : "bg-secondary border-transparent text-secondary-foreground")
                                    }
                                  >
                                    {ing}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">
                            Add-ons
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => updateLine(l.id, { extra_hot_sauce: !l.extra_hot_sauce })}
                              className={
                                "px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors " +
                                (l.extra_hot_sauce
                                  ? "bg-warning text-warning-foreground border-warning"
                                  : "bg-transparent border-warning text-warning")
                              }
                            >
                              + Hot Sauce
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={l.notes}
                          onChange={(e) => updateLine(l.id, { notes: e.target.value })}
                          placeholder="Notes (e.g. extra spicy)"
                          className="mt-3 w-full bg-input/50 rounded-lg px-3 py-2.5 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
