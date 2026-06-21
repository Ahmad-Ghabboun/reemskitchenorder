import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ArrowLeft, Volume2, VolumeX, Wifi } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AudioEngine } from "@/lib/booth-audio";
import type { Order, OrderItem } from "@/lib/booth-types";

const LS_KITCHEN_AUDIO_UNLOCKED = "booth_kitchen_audio_unlocked";
const LS_KITCHEN_MUTED = "booth_kitchen_muted";


export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen — Booth Orders" },
      { name: "description", content: "Live kitchen order display." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
    ],
  }),
  component: KitchenPage,
});

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [reconnecting, setReconnecting] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(LS_KITCHEN_AUDIO_UNLOCKED) === "1";
  });
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_KITCHEN_MUTED) === "1";
  });
  const engineRef = useRef<AudioEngine | null>(null);
  const audioReadyRef = useRef(false);

  useEffect(() => {
    const eng = new AudioEngine();
    eng.setMuted(muted);
    engineRef.current = eng;
    return () => {
      eng.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KITCHEN_MUTED, muted ? "1" : "0");
    engineRef.current?.setMuted(muted);
  }, [muted]);

  const enableAudio = async () => {
    const ok = await engineRef.current?.unlock();
    if (ok) {
      sessionStorage.setItem(LS_KITCHEN_AUDIO_UNLOCKED, "1");
      setAudioUnlocked(true);
      audioReadyRef.current = true;
    }
  };

  useEffect(() => {
    if (audioUnlocked && !audioReadyRef.current) {
      engineRef.current?.unlock().then((ok) => {
        if (ok) audioReadyRef.current = true;
      });
    }
  }, [audioUnlocked]);

  useEffect(() => {
    if (!audioUnlocked) return;
    const onWake = () => {
      if (document.visibilityState === "visible") {
        engineRef.current?.resume();
      }
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [audioUnlocked]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: o, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (!active) return;
      if (!error) setReconnecting(false);
      const orderList = (o ?? []) as Order[];
      setOrders(orderList);
      if (orderList.length === 0) {
        setItems([]);
        return;
      }
      const { data: it } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderList.map((x) => x.id))
        .order("position", { ascending: true });
      if (active) setItems((it ?? []) as OrderItem[]);
    };
    const scheduleLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        load();
      }, 150);
    };

    const subscribe = () =>
      supabase
        .channel("kitchen_live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            const row = payload.new as Partial<Order> | undefined;
            if (row?.status === "pending" && audioReadyRef.current) {
              engineRef.current?.chime();
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => {
            const newRow = payload.new as Partial<Order> | undefined;
            const oldRow = payload.old as Partial<Order> | undefined;
            if (
              audioReadyRef.current &&
              newRow?.status === "pending" &&
              newRow?.edited_at &&
              newRow.edited_at !== oldRow?.edited_at
            ) {
              engineRef.current?.editChime();
            }
          },
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleLoad)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleLoad)
        .subscribe();

    load();
    ch = subscribe();

    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      const joined = ch?.state === "joined";
      if (!joined) {
        setReconnecting(true);
        try {
          if (!supabase.realtime.isConnected()) supabase.realtime.connect();
        } catch {
          /* noop */
        }
        if (ch) supabase.removeChannel(ch);
        ch = subscribe();
      }
      scheduleLoad();
    };

    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);

    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  const byOrder = useMemo(() => {
    const map: Record<string, OrderItem[]> = {};
    for (const it of items) (map[it.order_id] ||= []).push(it);
    return map;
  }, [items]);

  const itemTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.name_snapshot, (m.get(it.name_snapshot) ?? 0) + it.quantity);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const markDone = async (o: Order) => {
    const prev = orders;
    setOrders((c) => c.filter((x) => x.id !== o.id));
    const { error } = await supabase
      .from("orders")
      .update({ status: "ready", ready_at: new Date().toISOString() })
      .eq("id", o.id);
    if (error) {
      console.error(error);
      toast.error("Failed to mark ready");
      setOrders(prev);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg active:bg-accent shrink-0">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight shrink-0">Kitchen</h1>
        {itemTotals.length > 0 ? (
          <div
            className="flex-1 min-w-0 overflow-x-auto flex gap-1.5 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {itemTotals.map(([name, qty]) => (
              <span
                key={name}
                className="shrink-0 px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/40 font-bold whitespace-nowrap"
                style={{ fontSize: 12, borderRadius: 999 }}
              >
                {name} × {qty}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {reconnecting && (
          <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-warning/15 text-warning border border-warning/40 text-xs font-bold shrink-0">
            <Wifi className="w-3 h-3 animate-pulse" />
            Reconnecting…
          </span>
        )}
        <button
          onClick={() => setMuted((m) => !m)}
          className="p-2.5 rounded-xl bg-card border border-border active:scale-95 shrink-0"
          aria-label={muted ? "Unmute chime" : "Mute chime"}
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <ThemeToggle />
        <span className="px-3 py-1.5 rounded-xl bg-card border border-border text-xl font-black shrink-0">
          {orders.length} <span className="text-sm font-semibold text-muted-foreground">pending</span>
        </span>
      </header>


      <main>
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-24 text-2xl">
            No pending orders.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-2">
            {orders.map((o) => {
              const its = byOrder[o.id] ?? [];
              return (
                <article
                  key={o.id}
                  className="rounded-2xl bg-card border-2 border-border shadow-lg flex flex-col overflow-hidden"
                >
                  <div className="flex items-baseline justify-between px-3 py-2 bg-accent/40 border-b border-border">
                    <div className="font-black tracking-tight text-primary" style={{ fontSize: 26, lineHeight: 1 }}>
                      #{o.order_number}
                    </div>
                    <div className="text-sm font-bold text-muted-foreground tabular-nums">
                      {timeAgo(o.created_at, now)}
                    </div>
                  </div>
                  <ul className="flex-1 px-3 py-2 flex flex-col gap-2">
                    {its.map((it) => (
                      <li key={it.id} className="border-b border-border/60 last:border-b-0 pb-2 last:pb-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black tabular-nums">{it.quantity}×</span>
                          <span className="text-lg font-bold leading-tight">{it.name_snapshot}</span>
                        </div>
                        {it.removed_ingredients.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {it.removed_ingredients.map((ing) => (
                              <span
                                key={ing}
                                className="px-1.5 py-0.5 rounded-md bg-destructive/20 text-destructive font-black uppercase text-xs tracking-wide"
                              >
                                NO {ing}
                              </span>
                            ))}
                          </div>
                        )}
                        {it.extra_hot_sauce && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="px-1.5 py-0.5 rounded-md bg-warning text-warning-foreground font-black uppercase text-xs tracking-wide">
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
                  <button
                    onClick={() => markDone(o)}
                    className="w-full h-14 bg-success text-success-foreground font-black text-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <Check className="w-6 h-6" />
                    Ready
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {!audioUnlocked && (
        <button
          onClick={enableAudio}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col items-center justify-center gap-4 p-8 text-center"
        >
          <Volume2 className="w-16 h-16 text-primary" />
          <div className="text-4xl font-black">Enable Sounds</div>
          <div className="text-xl text-muted-foreground max-w-md">
            Tap anywhere to enable the new-order chime on this device.
          </div>
        </button>
      )}
    </div>

  );
}
