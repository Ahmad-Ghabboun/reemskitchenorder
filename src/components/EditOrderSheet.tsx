import { useMemo, useState } from "react";
import { Plus, Minus, X, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItem, Order, OrderItem } from "@/lib/booth-types";

type EditLine = {
  uid: string;
  menu_item_id: string | null;
  name_snapshot: string;
  default_ingredients: string[];
  removed_ingredients: string[];
  quantity: number;
  notes: string;
  extra_hot_sauce: boolean;
};

type Props = {
  order: Order;
  items: OrderItem[];
  menu: MenuItem[];
  onClose: () => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function EditOrderSheet({ order, items, menu, onClose }: Props) {
  const menuById = useMemo(() => {
    const m: Record<string, MenuItem> = {};
    for (const x of menu) m[x.id] = x;
    return m;
  }, [menu]);

  const [lines, setLines] = useState<EditLine[]>(() =>
    items.map((it) => ({
      uid: uid(),
      menu_item_id: it.menu_item_id,
      name_snapshot: it.name_snapshot,
      default_ingredients: (it.menu_item_id && menuById[it.menu_item_id]?.default_ingredients) || [],
      removed_ingredients: [...it.removed_ingredients],
      quantity: it.quantity,
      notes: it.notes,
      extra_hot_sauce: it.extra_hot_sauce,
    })),
  );
  const [saving, setSaving] = useState(false);

  const addItem = (m: MenuItem) => {
    setLines((c) => [
      ...c,
      {
        uid: uid(),
        menu_item_id: m.id,
        name_snapshot: m.name,
        default_ingredients: m.default_ingredients,
        removed_ingredients: [],
        quantity: 1,
        notes: "",
        extra_hot_sauce: false,
      },
    ]);
  };

  const updateLine = (u: string, patch: Partial<EditLine>) =>
    setLines((c) => c.map((l) => (l.uid === u ? { ...l, ...patch } : l)));
  const removeLine = (u: string) => setLines((c) => c.filter((l) => l.uid !== u));
  const toggleIngredient = (u: string, ing: string) =>
    setLines((c) =>
      c.map((l) =>
        l.uid === u
          ? {
              ...l,
              removed_ingredients: l.removed_ingredients.includes(ing)
                ? l.removed_ingredients.filter((x) => x !== ing)
                : [...l.removed_ingredients, ing],
            }
          : l,
      ),
    );

  const save = async () => {
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
        p_order_id: order.id,
        p_items: payload,
      });
      if (error) throw error;
      toast.success(`Order #${order.order_number} updated`, { duration: 1800 });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 rounded-lg active:bg-accent" aria-label="Cancel">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black tracking-tight">
          Edit #{order.order_number}
        </h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {lines.length} {lines.length === 1 ? "item" : "items"}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <section className="px-4 pt-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Items</h2>
          {lines.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 border-2 border-dashed border-border rounded-xl">
              Add at least one item below.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((l) => (
                <li key={l.uid} className="rounded-xl bg-card border border-border p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base truncate">{l.name_snapshot}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateLine(l.uid, { quantity: Math.max(1, l.quantity - 1) })}
                        className="w-10 h-10 rounded-lg bg-secondary text-secondary-foreground grid place-items-center active:scale-95"
                        aria-label="Decrease"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="w-8 text-center font-black text-lg">{l.quantity}</span>
                      <button
                        onClick={() => updateLine(l.uid, { quantity: l.quantity + 1 })}
                        className="w-10 h-10 rounded-lg bg-secondary text-secondary-foreground grid place-items-center active:scale-95"
                        aria-label="Increase"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => removeLine(l.uid)}
                        className="w-10 h-10 rounded-lg bg-destructive/20 text-destructive grid place-items-center active:scale-95 ml-1"
                        aria-label="Remove"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {l.default_ingredients.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Already Added</div>
                      <div className="flex flex-wrap gap-2">
                        {l.default_ingredients.map((ing) => {
                          const removed = l.removed_ingredients.includes(ing);
                          return (
                            <button
                              key={ing}
                              onClick={() => toggleIngredient(l.uid, ing)}
                              className={
                                "px-3 py-2 rounded-full text-sm font-semibold border-2 transition-colors " +
                                (removed
                                  ? "bg-destructive/15 border-destructive text-destructive line-through"
                                  : "bg-secondary border-transparent text-secondary-foreground")
                              }
                            >
                              {removed ? "−" : ""}
                              {ing}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={l.default_ingredients.length > 0 ? "mt-3 pt-3 border-t border-border" : "mt-3"}>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Add-ons</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => updateLine(l.uid, { extra_hot_sauce: !l.extra_hot_sauce })}
                        className={
                          "px-3 py-2 rounded-full text-sm font-semibold border-2 transition-colors " +
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
                    onChange={(e) => updateLine(l.uid, { notes: e.target.value })}
                    placeholder="Notes (e.g. extra spicy)"
                    className="mt-3 w-full bg-input/50 rounded-lg px-3 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {menu.length > 0 && (
          <section className="px-4 pt-6">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Add an item</h2>
            <div className="grid grid-cols-2 gap-3">
              {menu.map((m) => (
                <button
                  key={m.id}
                  onClick={() => addItem(m)}
                  className="text-left rounded-xl bg-card border border-border p-4 min-h-24 active:scale-95 transition-transform shadow"
                >
                  <div className="font-bold text-base leading-tight">{m.name}</div>
                  <div className="mt-1 text-primary font-black text-lg">${m.price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 h-16 rounded-2xl bg-secondary text-secondary-foreground font-black text-lg active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={lines.length === 0 || saving}
          className="flex-[2] h-16 rounded-2xl bg-primary text-primary-foreground font-black text-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
        >
          <Save className="w-6 h-6" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
