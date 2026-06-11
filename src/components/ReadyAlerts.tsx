import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Check, Clock, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AudioEngine } from "@/lib/booth-audio";
import type { Order, OrderItem } from "@/lib/booth-types";

const SNOOZE_MS = 75_000;
const LS_MUTE = "booth_cashier_muted";
const LS_VOL = "booth_cashier_volume";

type Props = {
  audioUnlocked: boolean;
  onRequestUnlock: () => void;
};

export function ReadyAlerts({ audioUnlocked, onRequestUnlock }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [, setNowTick] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_MUTE) === "1";
  });
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === "undefined") return 0.8;
    const v = Number(localStorage.getItem(LS_VOL));
    return Number.isFinite(v) && v > 0 ? Math.min(1, v) : 0.8;
  });

  const engineRef = useRef<AudioEngine | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Init audio engine once
  useEffect(() => {
    const eng = new AudioEngine();
    eng.setMuted(muted);
    eng.setVolume(volume);
    engineRef.current = eng;
    return () => {
      eng.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist + sync mute/volume
  useEffect(() => {
    localStorage.setItem(LS_MUTE, muted ? "1" : "0");
    engineRef.current?.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    localStorage.setItem(LS_VOL, String(volume));
    engineRef.current?.setVolume(volume);
  }, [volume]);

  // Unlock audio when user enables
  useEffect(() => {
    if (audioUnlocked) {
      engineRef.current?.unlock();
    }
  }, [audioUnlocked]);

  // Wake Lock
  useEffect(() => {
    if (!audioUnlocked) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
        };
        if (!nav.wakeLock) return;
        const wl = await nav.wakeLock.request("screen");
        if (cancelled) {
          wl.release().catch(() => {});
          return;
        }
        wakeLockRef.current = wl;
        wl.addEventListener("release", () => {
          if (wakeLockRef.current === wl) wakeLockRef.current = null;
        });
      } catch (e) {
        console.warn("Wake lock failed", e);
      }
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [audioUnlocked]);

  // Load + subscribe to ready orders
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: o } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "ready")
        .order("ready_at", { ascending: true, nullsFirst: true });
      if (!active) return;
      const list = (o ?? []) as Order[];
      setOrders(list);
      if (list.length === 0) {
        setItems([]);
        return;
      }
      const { data: it } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", list.map((x) => x.id))
        .order("position", { ascending: true });
      if (active) setItems((it ?? []) as OrderItem[]);
    };
    load();
    const ch = supabase
      .channel("cashier_ready")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  // Tick every second for snooze expiry + countdown labels
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Clean expired snoozes
  useEffect(() => {
    const now = Date.now();
    const expired = Object.entries(snoozed).filter(([, until]) => until <= now);
    if (expired.length > 0) {
      setSnoozed((s) => {
        const next = { ...s };
        for (const [id] of expired) delete next[id];
        return next;
      });
    }
  });

  const byOrder = useMemo(() => {
    const map: Record<string, OrderItem[]> = {};
    for (const it of items) (map[it.order_id] ||= []).push(it);
    return map;
  }, [items]);

  const now = Date.now();
  const activeAlerts = orders.filter((o) => !snoozed[o.id] || snoozed[o.id] <= now);
  const shouldBeep = audioUnlocked && !muted && activeAlerts.length > 0;

  // Drive the beep loop
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (shouldBeep) eng.startLoop();
    else eng.stopLoop();
  }, [shouldBeep]);

  const markPickedUp = async (o: Order) => {
    const prev = orders;
    setOrders((c) => c.filter((x) => x.id !== o.id));
    const { error } = await supabase
      .from("orders")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", o.id);
    if (error) {
      console.error(error);
      toast.error("Failed to mark picked up");
      setOrders(prev);
    }
  };

  const snooze = (o: Order) => {
    setSnoozed((s) => ({ ...s, [o.id]: Date.now() + SNOOZE_MS }));
  };

  if (orders.length === 0) return null;

  const headerColor = activeAlerts.length > 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground";

  return (
    <div className="sticky top-14 z-20 mx-2 mt-2 rounded-2xl border-2 border-destructive shadow-2xl overflow-hidden bg-card">
      <div className={`flex items-center gap-2 px-3 py-2 ${headerColor} ${activeAlerts.length > 0 && !muted ? "animate-pulse" : ""}`}>
        <Bell className="w-5 h-5" />
        <span className="font-black text-base">
          {orders.length} Ready
        </span>
        {Object.keys(snoozed).length > 0 && (
          <span className="text-xs font-bold opacity-80">
            ({Object.keys(snoozed).length} snoozed)
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setMuted((m) => !m)}
            className="p-2 rounded-lg active:scale-95"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 accent-current"
            aria-label="Volume"
          />
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
        <ul className="max-h-[55vh] overflow-y-auto divide-y divide-border">
          {orders.map((o) => {
            const its = byOrder[o.id] ?? [];
            const snoozeUntil = snoozed[o.id];
            const isSnoozed = snoozeUntil && snoozeUntil > now;
            const snoozeLeft = isSnoozed ? Math.max(0, Math.ceil((snoozeUntil - now) / 1000)) : 0;
            return (
              <li key={o.id} className={`p-3 ${isSnoozed ? "opacity-50" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-black text-primary">#{o.order_number}</div>
                  {isSnoozed && (
                    <div className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
                      <Clock className="w-4 h-4" /> {snoozeLeft}s
                    </div>
                  )}
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
                      {it.notes && (
                        <div className="mt-1 px-2 py-1 rounded-md bg-warning/15 text-warning font-bold text-sm">
                          “{it.notes}”
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => markPickedUp(o)}
                    className="flex-1 h-12 rounded-xl bg-success text-success-foreground font-black text-base flex items-center justify-center gap-1 active:scale-[0.98]"
                  >
                    <Check className="w-5 h-5" /> Picked Up
                  </button>
                  <button
                    onClick={() => snooze(o)}
                    disabled={!!isSnoozed}
                    className="flex-1 h-12 rounded-xl bg-secondary text-secondary-foreground font-bold text-base flex items-center justify-center gap-1 active:scale-[0.98] disabled:opacity-50"
                  >
                    <BellOff className="w-5 h-5" /> Snooze
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!audioUnlocked && (
        <button
          onClick={onRequestUnlock}
          className="w-full py-2 bg-primary text-primary-foreground font-black text-sm"
        >
          Tap to enable alert sounds
        </button>
      )}
    </div>
  );
}
