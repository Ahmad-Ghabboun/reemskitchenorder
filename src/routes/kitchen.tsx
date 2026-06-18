import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ArrowLeft, Volume2, VolumeX } from "lucide-react";
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
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
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

  // Init engine once
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

  // If unlock flag persisted from session, unlock engine silently on mount
  useEffect(() => {
    if (audioUnlocked && !audioReadyRef.current) {
      engineRef.current?.unlock().then((ok) => {
        if (ok) audioReadyRef.current = true;
      });
    }
  }, [audioUnlocked]);

  // Wake audio context if iOS suspended it while the tab was hidden.
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
    const load = async () => {

      const { data: o } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (!active) return;
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
    load();
    const ch = supabase
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

    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
  }, []);

  const byOrder = useMemo(() => {
    const map: Record<string, OrderItem[]> = {};
    for (const it of items) (map[it.order_id] ||= []).push(it);
    return map;
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
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center gap-4">
        <Link to="/" className="p-2 -ml-2 rounded-lg active:bg-accent">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-3xl font-black tracking-tight">Kitchen</h1>
        <button
          onClick={() => setMuted((m) => !m)}
          className="ml-auto p-3 rounded-xl bg-card border border-border active:scale-95"
          aria-label={muted ? "Unmute chime" : "Mute chime"}
        >
          {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>
        <ThemeToggle />
        <span className="px-4 py-2 rounded-xl bg-card border border-border text-2xl font-black">
          {orders.length} <span className="text-base font-semibold text-muted-foreground">pending</span>
        </span>
      </header>


      <main className="p-6">
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-24 text-2xl">
            No pending orders.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {orders.map((o) => {
              const its = byOrder[o.id] ?? [];
              return (
                <article
                  key={o.id}
                  className="rounded-2xl bg-card border-2 border-border shadow-lg flex flex-col overflow-hidden"
                >
                  <div className="flex items-baseline justify-between px-5 py-4 bg-accent/40 border-b border-border">
                    <div className="text-5xl font-black tracking-tight text-primary">#{o.order_number}</div>
                    <div className="text-xl font-bold text-muted-foreground tabular-nums">
                      {timeAgo(o.created_at, now)}
                    </div>
                  </div>
                  <ul className="flex-1 px-5 py-4 flex flex-col gap-4">
                    {its.map((it) => (
                      <li key={it.id} className="border-b border-border/60 last:border-b-0 pb-3 last:pb-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black tabular-nums">{it.quantity}×</span>
                          <span className="text-2xl font-bold leading-tight">{it.name_snapshot}</span>
                        </div>
                        {it.removed_ingredients.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {it.removed_ingredients.map((ing) => (
                              <span
                                key={ing}
                                className="px-2 py-1 rounded-md bg-destructive/20 text-destructive font-black uppercase text-sm tracking-wide"
                              >
                                NO {ing}
                              </span>
                            ))}
                          </div>
                        )}
                        {it.extra_hot_sauce && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="px-2 py-1 rounded-md bg-warning text-warning-foreground font-black uppercase text-sm tracking-wide">
                              + HOT SAUCE
                            </span>
                          </div>
                        )}
                        {it.notes && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-warning/15 text-warning font-bold text-lg">
                            “{it.notes}”
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => markDone(o)}
                    className="w-full h-20 bg-success text-success-foreground font-black text-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
                  >
                    <Check className="w-8 h-8" />
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
