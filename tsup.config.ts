import { defineConfig } from "tsup";

/**
 * Build configuration for @buildaureon/sdk.
 * Emits ESM + declaration files from the public entrypoint.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  treeshake: true,
  splitting: false,
  outDir: "dist",
  external: [],
});
