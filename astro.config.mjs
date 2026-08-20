// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  // Required for absolute URLs. Open Graph tags are fetched by a scraper with
  // no page context, so a relative image path is simply dropped and the link
  // previews as a bare URL.
  site: "https://jazmyngillies.com",
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
