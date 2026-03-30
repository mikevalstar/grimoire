import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, CheckSquare, FileText, LayoutDashboard, ListChecks, Scale } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/features", label: "Features", icon: BookOpen },
  { to: "/requirements", label: "Requirements", icon: ListChecks },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/decisions", label: "Decisions", icon: Scale },
] as const;

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <FileText className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-bold tracking-tight text-white">Grimoire</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 text-xs text-sidebar-foreground/40">Grimoire AI</div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
