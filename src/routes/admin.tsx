import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowLeft, Save, X, Calendar, RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItem, Event } from "@/lib/booth-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Menu Admin — Booth Orders" },
      { name: "description", content: "Manage menu items." },
    ],
  }),
  component: AdminPage,
});

type Draft = {
  id?: string;
  name: string;
  price: string;
  ingredients: string[];
  sort_order: number;
};

const empty: Draft = { name: "", price: "0", ingredients: [], sort_order: 0 };

function AdminPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [newIng, setNewIng] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const editing = !!draft.id;

  const load = async (eventId: string | null) => {
    if (!eventId) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (data) setItems(data as MenuItem[]);
  };

  useEffect(() => {
    const loadActive = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      const ev = (data as Event | null) ?? null;
      setActiveEvent(ev);
      load(ev?.id ?? null);
    };
    loadActive();
    const ch = supabase
      .channel("admin_active_event")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, loadActive)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);


  const resetDraft = () => {
    setDraft(empty);
    setNewIng("");
  };

  const edit = (m: MenuItem) => {
    setDraft({
      id: m.id,
      name: m.name,
      price: String(m.price),
      ingredients: [...m.default_ingredients],
      sort_order: m.sort_order,
    });
    setNewIng("");
  };

  const save = async () => {
    if (!activeEvent) {
      toast.error("No active event");
      return;
    }
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const basePayload = {
      name,
      price: Number(draft.price) || 0,
      default_ingredients: draft.ingredients,
      sort_order: Number(draft.sort_order) || 0,
    };
    if (editing) {
      const { error } = await supabase
        .from("menu_items")
        .update(basePayload)
        .eq("id", draft.id!);
      if (error) return toast.error("Save failed");
      toast.success("Updated");
    } else {
      const { error } = await supabase
        .from("menu_items")
        .insert({ ...basePayload, event_id: activeEvent.id });
      if (error) return toast.error("Save failed");
      toast.success("Added");
    }
    resetDraft();
    load(activeEvent.id);
  };

  const del = async (m: MenuItem) => {
    if (!confirm(`Delete "${m.name}"?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", m.id);
    if (error) return toast.error("Delete failed");
    if (draft.id === m.id) resetDraft();
    load(activeEvent?.id ?? null);
  };


  const addIng = () => {
    const v = newIng.trim();
    if (!v) return;
    if (draft.ingredients.includes(v)) return;
    setDraft({ ...draft, ingredients: [...draft.ingredients, v] });
    setNewIng("");
  };
  const removeIng = (i: string) =>
    setDraft({ ...draft, ingredients: draft.ingredients.filter((x) => x !== i) });

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg active:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-black tracking-tight">Menu Admin</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setResetOpen(true)}
            aria-label="Reset order numbers"
            title="Reset Order #"
            className="p-2 rounded-lg border border-input bg-card active:scale-95 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset order numbering?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL existing orders and reset numbering to start at #1. This cannot be undone. Use this only for clearing test data before going live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const { error } = await supabase.rpc("reset_order_number_seq");
                if (error) toast.error("Could not reset order numbers");
                else toast.success("Order numbers reset — next order will be #1.");
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <Link
          to="/events"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 active:scale-[0.99]"
        >
          <Calendar className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Active event
            </div>
            <div className="font-black truncate">
              {activeEvent?.name ?? "None — tap to create or activate one"}
            </div>
          </div>
          <span className="text-sm font-bold text-primary">Switch</span>
        </Link>
      </div>

      <main className="max-w-4xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            Items
          </h2>
          <ul className="flex flex-col gap-2">
            {items.map((m) => (
              <li
                key={m.id}
                className={
                  "rounded-xl border p-3 flex items-center gap-3 " +
                  (draft.id === m.id
                    ? "bg-accent border-primary"
                    : "bg-card border-border")
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{m.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    ${m.price.toFixed(2)} · {m.default_ingredients.length} ingredients
                  </div>
                </div>
                <button
                  onClick={() => edit(m)}
                  className="px-3 h-10 rounded-lg bg-secondary text-secondary-foreground font-semibold active:scale-95"
                >
                  Edit
                </button>
                <button
                  onClick={() => del(m)}
                  className="w-10 h-10 rounded-lg bg-destructive/20 text-destructive grid place-items-center active:scale-95"
                  aria-label="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-center text-muted-foreground py-8 border-2 border-dashed border-border rounded-xl">
                No items yet
              </li>
            )}
          </ul>
        </section>

        <section className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            {editing ? "Edit item" : "New item"}
          </h2>
          <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="bg-input/50 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Smash Burger"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Price</span>
                <input
                  type="number"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  className="bg-input/50 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Sort order</span>
                <input
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                  className="bg-input/50 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Default ingredients</span>
              <div className="flex flex-wrap gap-2">
                {draft.ingredients.map((i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold"
                  >
                    {i}
                    <button
                      onClick={() => removeIng(i)}
                      className="w-6 h-6 rounded-full grid place-items-center hover:bg-destructive/30"
                      aria-label={`Remove ${i}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {draft.ingredients.length === 0 && (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newIng}
                  onChange={(e) => setNewIng(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addIng();
                    }
                  }}
                  placeholder="Add ingredient"
                  className="flex-1 bg-input/50 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={addIng}
                  className="px-4 rounded-lg bg-secondary text-secondary-foreground font-bold active:scale-95 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Save className="w-5 h-5" />
                {editing ? "Save" : "Add Item"}
              </button>
              {editing && (
                <button
                  onClick={resetDraft}
                  className="px-4 h-12 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-95"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
