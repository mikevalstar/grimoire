import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Grimoire Books",
    identifier: "dev.valstar.grimoire",
    version: "0.0.1",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    // The web app is built by Vite into apps/web/dist and copied here by the
    // build:ui script; Electrobun bundles it as the mainview.
    copy: {
      "dist": "views/mainview",
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
