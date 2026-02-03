import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/server-http.ts"],
  outDir: "dist",
  format: ["esm", "cjs"],
  clean: true,
  dts: true,
  sourcemap: true,
});
