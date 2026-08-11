import type { Preview } from "@storybook/tanstack-react";
import { useEffect } from "react";
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
  ],
};

export default preview;
