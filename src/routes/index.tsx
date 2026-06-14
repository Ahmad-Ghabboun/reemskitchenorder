import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, Smartphone, Settings, Calendar } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Booth Orders" },
      { name: "description", content: "Real-time food booth ordering system." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
          Booth Orders
        </h1>
        <p className="mt-2 text-muted-foreground">Pick a device view</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
        <Link
          to="/cashier"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary text-primary-foreground p-8 font-bold text-xl shadow-lg active:scale-95 transition-transform"
        >
          <Smartphone className="w-12 h-12" />
          Cashier
          <span className="text-sm font-normal opacity-80">iPhone</span>
        </Link>
        <Link
          to="/kitchen"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-success text-success-foreground p-8 font-bold text-xl shadow-lg active:scale-95 transition-transform"
        >
          <ChefHat className="w-12 h-12" />
          Kitchen
          <span className="text-sm font-normal opacity-80">iPad</span>
        </Link>
        <Link
          to="/admin"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-card text-card-foreground border-2 border-border p-8 font-bold text-xl shadow-lg active:scale-95 transition-transform"
        >
          <Settings className="w-12 h-12" />
          Menu Admin
        </Link>
        <Link
          to="/events"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-card text-card-foreground border-2 border-border p-8 font-bold text-xl shadow-lg active:scale-95 transition-transform"
        >
          <Calendar className="w-12 h-12" />
          Events
        </Link>
      </div>
    </div>
  );
}

