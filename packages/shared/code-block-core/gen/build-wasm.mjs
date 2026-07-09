#!/usr/bin/env node
// Builds the tree-sitter C core to a single self-contained WebAssembly ES module
// and drops it into the React package as a prebuilt artifact.
//
// Requires Emscripten (emcmake, emcc) on PATH. Install once with:
//   brew install emscripten
//
// Then:  node gen/build-wasm.mjs   (or `make wasm`)
//
// The core C, the amalgamated tree-sitter runtime, and every vendored grammar are
// first compiled to a static library via the existing CMakeLists (emcmake reuses
// the per-grammar include isolation), then linked into wasm with only the two
// public ABI symbols exported.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(coreRoot, "../../..");
const buildDir = join(coreRoot, "build-wasm");
const distDir = join(coreRoot, "dist-wasm");
const glue = join(distDir, "cb-core.mjs");
const reactGenerated = join(repoRoot, "packages/react-code-block/src/generated/cb-core.mjs");
const checkOnly = process.argv.includes("--check");

function run(cmd, args, opts = {}) {
    console.log(`$ ${cmd} ${args.join(" ")}`);
    execFileSync(cmd, args, { stdio: "inherit", cwd: coreRoot, ...opts });
}

// 1. Configure + build the static library with the Emscripten toolchain.
run("emcmake", ["cmake", "-S", ".", "-B", "build-wasm", "-DCMAKE_BUILD_TYPE=Release"]);
run("cmake", ["--build", "build-wasm", "--target", "code_block_core", "-j"]);

// 2. Link to a single-file wasm ES module.
//    - SINGLE_FILE base64-embeds the wasm so consumers need no separate asset.
//    - No ALLOW_MEMORY_GROWTH: a growable heap yields a resizable ArrayBuffer that
//      Chromium's TextDecoder rejects; a fixed 64 MB heap is ample for source code.
mkdirSync(distDir, { recursive: true });
run("emcc", [
    join(buildDir, "libcode_block_core.a"),
    "-o",
    glue,
    "-O3",
    "-sSINGLE_FILE=1",
    "-sMODULARIZE=1",
    "-sEXPORT_ES6=1",
    "-sEXPORT_NAME=createCbCore",
    "-sENVIRONMENT=web,worker,node",
    "-sINITIAL_MEMORY=67108864",
    "-sEXPORTED_FUNCTIONS=_cb_tokenize_json,_cb_string_free,_malloc,_free",
    "-sEXPORTED_RUNTIME_METHODS=cwrap,stringToUTF8,UTF8ToString,lengthBytesUTF8"
]);

// 3. Publish the prebuilt glue, or verify the committed artifact without
//    changing the source tree.
console.log(`\nWrote ${glue}`);
if (checkOnly) {
    const built = readFileSync(glue);
    const committed = existsSync(reactGenerated) ? readFileSync(reactGenerated) : null;
    if (committed == null || !built.equals(committed)) {
        console.error("React cb-core.mjs is out of date; run pnpm run build:wasm");
        process.exitCode = 1;
    } else {
        console.log("React cb-core.mjs is current");
    }
} else {
    mkdirSync(dirname(reactGenerated), { recursive: true });
    copyFileSync(glue, reactGenerated);
    console.log(`Published ${reactGenerated}`);
}
