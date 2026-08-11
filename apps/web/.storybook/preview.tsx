import type { Preview } from "@storybook/tanstack-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
// The app's Tailwind entry, so components render with the real theme tokens.
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: "todo" },
  },
  // The app reads the theme off a class on <html> (src/lib/theme.ts), so the
  // toolbar toggle moves the same class the app does.
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "dark", icon: "moon", title: "Dark" },
          { value: "light", icon: "sun", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark" },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as "light" | "dark";
      useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.body.style.background = "var(--background)";
      }, [theme]);
      return <Story />;
    },
    // Components that fetch through TanStack Query need a client. One per
    // story, with retries off, so a stubbed fetch in one story can't leak into
    // the next through the cache.
    (Story) => {
      const [client] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      );
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
};

export default preview;
