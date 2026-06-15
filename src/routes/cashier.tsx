import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Minus, X, Send, ArrowLeft, Volume2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ReadyAlerts } from "@/components/ReadyAlerts";
import { PreparingAlerts } from "@/components/PreparingAlerts";
import { readMenuCache, writeMenuCache, sweepMenuCaches, menuListsEqual } from "@/lib/menu-cache";
import type { MenuItem, CartLine, Event } from "@/lib/booth-types";


const LS_AUDIO_UNLOCKED = "booth_cashier_audio_unlocked";

export const Route = createFileRoute("/cashier")({
  head: () => ({
    meta: [
      { title: "Cashier — Booth Orders" },
      { name: "description", content: "Take orders on the phone." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
    ],
  }),
  component: CashierPage,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function CashierPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sending, setSending] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(LS_AUDIO_UNLOCKED) === "1";
  });

  const enableAudio = () => {
    sessionStorage.setItem(LS_AUDIO_UNLOCKED, "1");
    setAudioUnlocked(true);
  };

  useEffect(() => {
    let active = true;
    const loadMenu = async (eventId: string | null) => {
      if (!eventId) {
        if (active) setMenu([]);
        return;
      }
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error || !data) {
        // Network/fetch failure — keep whatever is on screen (cache or empty)
        const hasCache = !!readMenuCache(eventId);
        if (!hasCache) setLoadError(true);
        return;
      }
      setLoadError(false);
      const fresh = data as MenuItem[];
      setMenu((prev) => (menuListsEqual(prev, fresh) ? prev : fresh));
      writeMenuCache(eventId, fresh);
    };
    const loadActive = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (!active) return;
      if (error) {
        // Couldn't reach the server — rely on any cached menu for the previously known event.
        return;
      }
      const ev = (data as Event | null) ?? null;
      setActiveEvent(ev);
      sweepMenuCaches(ev?.id ?? null);
      // Hydrate instantly from cache if present
      if (ev) {
        const cached = readMenuCache(ev.id);
        if (cached) setMenu(cached.items);
        else setMenu([]);
      } else {
        setMenu([]);
      }
      loadMenu(ev?.id ?? null);
    };
    loadActive();
    const ch = supabase
      .channel("menu_items_cashier")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadActive)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, loadActive)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  const addToCart = (m: MenuItem) => {
    setCart((c) => [
      ...c,
      {
        uid: uid(),
        menu_item_id: m.id,
        name: m.name,
        default_ingredients: m.default_ingredients,
        removed_ingredients: [],
        quantity: 1,
        notes: "",
      },
    ]);
  };

  const updateLine = (u: string, patch: Partial<CartLine>) =>
    setCart((c) => c.map((l) => (l.uid === u ? { ...l, ...patch } : l)));
  const removeLine = (u: string) => setCart((c) => c.filter((l) => l.uid !== u));
  const toggleIngredient = (u: string, ing: string) =>
    setCart((c) =>
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

  const sendOrder = async () => {
    if (cart.length === 0 || sending) return;
    setSending(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({})
        .select("*")
        .single();
      if (error || !order) throw error ?? new Error("Failed to create order");

      const items = cart.map((l, i) => ({
        order_id: order.id,
        menu_item_id: l.menu_item_id,
        name_snapshot: l.name,
        quantity: l.quantity,
        removed_ingredients: l.removed_ingredients,
        notes: l.notes.trim(),
        position: i,
      }));
      const { error: e2 } = await supabase.from("order_items").insert(items);
      if (e2) throw e2;
      toast.success(`Order #${order.order_number} sent`, { duration: 1800 });
      setCart([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send order");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg active:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-black tracking-tight">Cashier</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {cart.length} {cart.length === 1 ? "item" : "items"}
        </span>
        <ThemeToggle />
      </header>

      <ReadyAlerts audioUnlocked={audioUnlocked} onRequestUnlock={enableAudio} />

      {!audioUnlocked && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-6">
          <button
            onClick={enableAudio}
            className="w-full max-w-sm rounded-2xl bg-primary text-primary-foreground p-6 flex flex-col items-center gap-3 active:scale-[0.98] shadow-2xl"
          >
            <Volume2 className="w-10 h-10" />
            <span className="font-black text-2xl">Enable Sounds</span>
            <span className="text-sm font-semibold opacity-90 text-center">
              Tap to allow order-ready alerts on this device. Required once per session.
            </span>
          </button>
        </div>
      )}


      <section className="px-4 pt-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Menu</h2>
        <div className="grid grid-cols-2 gap-3">
          {menu.map((m) => (
            <button
              key={m.id}
              onClick={() => addToCart(m)}
              className="text-left rounded-xl bg-card border border-border p-4 min-h-24 active:scale-95 transition-transform shadow"
            >
              <div className="font-bold text-base leading-tight">{m.name}</div>
              <div className="mt-1 text-primary font-black text-lg">${m.price.toFixed(2)}</div>
            </button>
          ))}
          {menu.length === 0 && (
            <div className="col-span-2 text-center text-muted-foreground py-8">
              {loadError
                ? <span className="text-destructive font-bold">Menu unavailable — check connection.</span>
                : activeEvent
                  ? <>No menu items in <span className="font-bold text-foreground">{activeEvent.name}</span>. Add some in <Link to="/admin" className="text-primary underline">Admin</Link>.</>
                  : <>No active event. Go to <Link to="/events" className="text-primary underline">Events</Link> to activate one.</>}
            </div>
          )}


        </div>
      </section>

      <section className="px-4 pt-6">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Cart</h2>
        {cart.length === 0 ? (
          <div className="text-muted-foreground text-center py-8 border-2 border-dashed border-border rounded-xl">
            Tap a menu item to add it
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {cart.map((l) => (
              <li key={l.uid} className="rounded-xl bg-card border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base truncate">{l.name}</div>
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
                  <div className="mt-3 flex flex-wrap gap-2">
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
                          {removed ? "−" : ""}{ing}
                        </button>
                      );
                    })}
                  </div>
                )}

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

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={sendOrder}
          disabled={cart.length === 0 || sending}
          className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-black text-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
        >
          <Send className="w-6 h-6" />
          {sending ? "Sending…" : "Send Order"}
        </button>
      </div>
    </div>
  );
}
