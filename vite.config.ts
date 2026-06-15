import { defineConfig } from "vite";

// Static build for Cloudflare Pages.
//  - base "./" keeps all asset URLs relative so the site works from any path.
//  - outDir "dist" matches the documented Cloudflare "Build output directory".
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
