import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import path from "path";

// GitHub Pages serves a project site at /<repo>/. Derive the base from the
// GITHUB_REPOSITORY env var (auto-set in Actions, format "owner/repo") so any
// repo name works; local dev/preview keep "/".
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : "/";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  base,
  plugins: lazyPlugins(() => [react()]),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // three.js is inherently large; split heavy vendors into their own chunks
    // for better browser caching and to keep the app chunk lean.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("three")) return "three";
            if (id.includes("@react-three")) return "r3f";
            if (id.includes("react")) return "react-vendor";
            return "vendor";
          }
        },
      },
    },
  },
});
