import { defineConfig } from "tsdown";
import { cp } from "fs/promises";
import { join } from "path";

export default defineConfig({
  entry: ["./src/index.ts"],
  outDir: "dist",
  format: ["esm", "cjs"],
  clean: true,
  dts: true,
  sourcemap: true,
  hooks: {
    "build:done": async (ctx) => {
      // Copy python directory to dist
      const pythonSrc = join(process.cwd(), "python");
      const pythonDest = join(ctx.options.outDir, "python");
      await cp(pythonSrc, pythonDest, { recursive: true });
      console.log("[tsdown] ✓ Copied python/ to dist/python/");
    },
  },
});
