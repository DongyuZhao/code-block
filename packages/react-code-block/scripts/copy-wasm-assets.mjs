// tsc only emits the TypeScript it compiles, so the prebuilt Emscripten glue
// (cb-core.mjs) and its declaration shim are copied into dist alongside the
// compiled output. Runs as the build step after `tsc`.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(pkgRoot, "src", "generated");
const distDir = join(pkgRoot, "dist", "generated");

mkdirSync(distDir, { recursive: true });
for (const file of ["cb-core.mjs", "cb-core.d.mts"]) {
    copyFileSync(join(srcDir, file), join(distDir, file));
}
console.log("copied wasm glue + declaration into dist/generated");
