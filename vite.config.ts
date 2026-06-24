import { defineConfig } from "vite";

// Deployed as a GitHub Pages project site at /undi-wrapped/
export default defineConfig({
  base: "/undi-wrapped/",
  build: { target: "es2020" },
});
