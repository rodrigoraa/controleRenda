import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["server/index.ts", "server/manage-users.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist-server",
  clean: true,
  sourcemap: true,
  splitting: true,
});
