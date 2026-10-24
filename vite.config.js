import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const configuredBasePath = process.env.VERCEL
  ? "/"
  : process.env.VITE_BASE_PATH || "/intro2driving-system";
const basePath =
  configuredBasePath === "/"
    ? "/"
    : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}/`;

export default defineConfig({
  plugins: [react({ include: /\.[jt]sx?$/ })],
  base: basePath,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: false,
  },
});
