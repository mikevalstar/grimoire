import type { Preview } from "@storybook/tanstack-react";
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
};

export default preview;
