import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Event } from "@/lib/booth-types";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Booth Orders" },
      { name: "description", content: "Manage booth events and active menu." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEvents(data as Event[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("events_dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.from("events").insert({ name, is_active: false });
    setBusy(false);
    if (error) return toast.error("Failed to create event");
    toast.success("Event created");
    setNewName("");
  };

  const activate = async (e: Event) => {
    if (e.is_active) return;
    const { error } = await supabase
      .from("events")
      .update({ is_active: true })
      .eq("id", e.id);
    if (error) return toast.error("Failed to activate");
    toast.success(`Activated "${e.name}"`);
  };

  const remove = async (e: Event) => {
    if (e.is_active) return;
    if (
      !confirm(
        `Delete event "${e.name}"?\n\nAll menu items in this event will be permanently deleted.`,
      )
    )
      return;
    const { error } = await supabase.from("events").delete().eq("id", e.id);
    if (error) return toast.error("Delete failed");
    toast.success("Event deleted");
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg active:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-black tracking-tight">Events</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 flex flex-col gap-6">
        <section className="rounded-2xl bg-card border border-border p-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            Create new event
          </h2>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
              placeholder="e.g. Saturday Market"
              className="flex-1 bg-input/50 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={create}
              disabled={busy || !newName.trim()}
              className="px-4 h-12 rounded-xl bg-primary text-primary-foreground font-black flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" /> Create
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            All events
          </h2>
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li
                key={e.id}
                className={
                  "rounded-xl border p-4 flex items-center gap-3 " +
                  (e.is_active ? "bg-primary/10 border-primary" : "bg-card border-border")
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="font-black text-lg truncate flex items-center gap-2">
                    {e.is_active ? (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    {e.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                {e.is_active ? (
                  <span className="px-3 h-10 rounded-lg bg-primary text-primary-foreground font-black grid place-items-center text-sm">
                    Active
                  </span>
                ) : (
                  <button
                    onClick={() => activate(e)}
                    className="px-3 h-10 rounded-lg bg-secondary text-secondary-foreground font-bold active:scale-95"
                  >
                    Set Active
                  </button>
                )}
                <button
                  onClick={() => remove(e)}
                  disabled={e.is_active}
                  title={e.is_active ? "Switch to another event before deleting" : "Delete"}
                  className="w-10 h-10 rounded-lg bg-destructive/20 text-destructive grid place-items-center active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            ))}
            {events.length === 0 && (
              <li className="text-center text-muted-foreground py-8 border-2 border-dashed border-border rounded-xl">
                No events yet
              </li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
