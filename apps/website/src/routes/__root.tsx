import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/features", label: "Features" },
  { to: "/requirements", label: "Requirements" },
  { to: "/tasks", label: "Tasks" },
  { to: "/decisions", label: "Decisions" },
] as const;

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 960,
        margin: "0 auto",
        padding: "1rem",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem 0" }}>Grimoire AI</h1>
        <nav style={{ display: "flex", gap: "0.25rem" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  color: isActive ? "#1d4ed8" : "#4b5563",
                  backgroundColor: isActive ? "#eff6ff" : "transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
