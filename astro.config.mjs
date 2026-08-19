// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  build: {
    // The stylesheet is ~3.8 KB gzipped but cost a full round trip as a
    // separate render-blocking file. Inlining it removes that from the
    // critical path entirely.
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
