# Phase 2 Report — Web/React (Emscripten → wasm)

## Result

Phase 2 is complete. The C core now runs in the browser (and Node) as a
single-file WebAssembly ES module, and the React renderer consumes it directly.
Prism is gone from the React path. `pnpm test:react` (unit + browser pixel) is
green, and the pixel snapshots were re-recorded — they show the exact fix this
migration targets: custom types and parameters are now colored instead of gray.

This is the first fully-migrated platform (the "earliest all-green checkpoint"
for React). The remaining red is the deprecated Prism `test:shared` pipeline,
which is scheduled for deletion in Phase 5.

## What shipped

**wasm build (`packages/shared/code-block-core/gen/build-wasm.mjs`, `make wasm`,
`pnpm build:wasm`)**
- `emcmake cmake` reuses the existing `CMakeLists.txt` (per-grammar include
  isolation intact) to build `libcode_block_core.a` with the Emscripten
  toolchain, then `emcc` links it to `dist-wasm/cb-core.mjs` and publishes a copy
  into `packages/react-code-block/src/generated/cb-core.mjs`.
- Flags: `-O3 -sSINGLE_FILE=1 -sMODULARIZE=1 -sEXPORT_ES6=1
  -sEXPORT_NAME=createCbCore -sENVIRONMENT=web,worker,node
  -sINITIAL_MEMORY=67108864`, exporting only `_cb_tokenize_json` /
  `_cb_string_free` (+ `_malloc`/`_free`) and the runtime helpers `cwrap`,
  `UTF8ToString`, `stringToUTF8`, `lengthBytesUTF8`.
- **SINGLE_FILE**: the wasm is base64-embedded in the glue, so consumers need no
  separate `.wasm` asset and no bundler path wiring. ~10 MB on disk, ~1.4 MB
  gzipped (six full grammars; swift + kotlin dominate). The build is
  reproducible — a rerun produces a byte-identical artifact.
- **⚠️ Gotcha — no `ALLOW_MEMORY_GROWTH`.** A growable wasm heap exposes a
  *resizable* `ArrayBuffer`, and Chromium's `TextDecoder.decode` throws
  `The provided ArrayBuffer value must not be resizable` on the subarray
  Emscripten hands it. Emscripten 6 also removed the `TEXTDECODER=0` JS-fallback
  escape hatch. Fix: fixed 64 MB heap (`INITIAL_MEMORY=67108864`, no growth) —
  ample for source snippets, TextDecoder happy. Revisit only if a real input
  needs a bigger-than-64 MB heap.

**React highlighter (`packages/react-code-block`)**
- New `src/code-highlighter.ts`: lazily initializes the wasm module (promise
  cached), `cwrap`s the two ABI functions, and exposes
  `highlightCode(code, options): Promise<CodeTokens>` +
  `loadHighlighter()`. The C core owns normalization/aliases/fallback/plain
  degradation, so this layer only marshals strings and parses JSON.
- Types: `CodeToken = { text, scope }`, `CodeTokens = { language, tokens }`.
- `src/index.tsx`: `renderCode` async generator now awaits `highlightCode`
  (`pending → succeeded | failed`); failure is only invalid font/scale
  (`invalid-input`) or wasm init throwing (`highlighter-unavailable`) — tokenize
  never errors, it degrades to a plain run in the core. `defaultCodeTokenTheme`
  is keyed by tree-sitter capture (scope) names, and `colorForToken` resolves
  color by **hierarchical prefix fallback** (`variable.parameter` → `variable` →
  plain), so only base families + a few overrides need theme entries.
- Deleted the Prism generated copies (`generated/react-prism-code.ts`,
  `generated/prism-code-core.ts`), `prismjs-components.d.ts`, and the `prismjs`
  dependency from `package.json`.
- `scripts/copy-wasm-assets.mjs` copies the glue + its `.d.mts` shim into `dist`
  after `tsc` (tsc doesn't emit non-compiled files), so the published package is
  self-contained.

## Verification

- `pnpm test:react` (unit): 4/4 green — asserts JS `const`/`42`, TS `Result`/`T`
  as `type`, and plain fallback shape `{ text, scope: "" }`.
- `pnpm snapshot:react:visual` (browser pixel): 3/3 green, snapshots re-recorded.
  The typescript-generic shot shows `Result`/`T` in the type color and `unwrap`
  in the function color (were gray under Prism).
- `pnpm sample:react:build`: the sample app was ported to the async
  `highlightCode` + `scope` API and builds clean.
- `tsc --noEmit` on the package: clean.

## Notes / follow-ups for later phases

- `test:shared` (Prism bridge vs. the new-shape goldens) is red by design since
  Phase 1; retire it in Phase 5 along with `prism-code.js`, `build-prism-code.mjs`,
  and the `prismjs` assets.
- The Emscripten glue references `node:module` on its Node code path; Vite
  externalizes it for the browser (benign — that path isn't taken in-browser).
- Emscripten is a maintainer-only build dependency (not shipped); install it with
  `brew install emscripten` (currently 6.0.2). Consumers get the prebuilt glue.
