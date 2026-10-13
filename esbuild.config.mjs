import { build } from "esbuild";

await build({
  entryPoints: ["api/boot.ts"],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: "dist",
  banner: {
    js: `import { createRequire } from "module"; const require = createRequire(import.meta.url);`,
  },
});
