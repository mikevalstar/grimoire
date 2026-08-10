import type { StorybookConfig } from "@storybook/tanstack-react";

const config: StorybookConfig = {
  // Stories live next to the components they document.
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/tanstack-react",
};

export default config;
