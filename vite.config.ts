import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// GitHub Pages serves a project site at /<repo>/. Derive the base from the
// GITHUB_REPOSITORY env var (auto-set in Actions, format "owner/repo") so any
// repo name works; local dev/preview keep "/".
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
