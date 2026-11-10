import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            [
              "/node_modules/react/",
              "/node_modules/react-dom/",
              "/node_modules/scheduler/",
            ].some((path) => id.includes(path))
          )
            return "react";
          if (id.includes("/node_modules/@mantine/")) return "mantine";
        },
      },
    },
  },
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
  test: {
    include: ["tests/*.test.{ts,tsx}"],
    environment: "jsdom",
    // Mantine integration cases exercise many real DOM interactions in jsdom.
    maxWorkers: 2,
    testTimeout: 15000,
    setupFiles: ["./tests/setup.ts"],
  },
});
