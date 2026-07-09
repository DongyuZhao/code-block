# Phase 5 Report — Build Pipeline and Cleanup

Phase 5 retires the remaining Prism build pipeline and makes the tree-sitter C core the only source for generated token-stream artifacts.

## What Changed

- Replaced root Prism scripts with C core scripts:
  - `build:queries` regenerates `src/queries.h`.
  - `build:code-block-core` builds the CMake CLI/test targets.
  - `gen:goldens` regenerates shared tree-sitter token-stream goldens through `cb_cli`.
  - `build:wasm` builds and publishes the React wasm module.
- Deleted the old Prism bundle pipeline:
  - `scripts/build-prism-code.mjs`
  - `scripts/sync-prism-assets.mjs`
  - `packages/prism-code-core/generated/prism-code.js`
  - `packages/prism-code-core/src/*.ts`
  - the old Prism bundle tests
- Converted `packages/prism-code-core` into a fixture/golden package. Its package name is now `@code-block/fixtures`, and its `files` list only includes fixtures and token-stream goldens.
- Updated shared tests to validate the new golden shape:
  - top-level `{ language, tokens }`
  - token shape `{ text, scope }`
  - token text reconstructs the source fixture
  - no stale goldens or generated Prism bundle
- Updated `scripts/gen-compose-goldens.mjs` so Android goldens are derived from the C core pipeline:
  - builds `packages/shared/code-block-core`
  - runs `gen-goldens.mjs`
  - copies shared goldens into Android test resources
  - regenerates `GoldenCodeCorpus.kt`
- Kept fixture source code in the generated Android corpus for screenshot tests. The generator now escapes `$` in Kotlin string literals so JavaScript template snippets and Kotlin string interpolation examples compile correctly.
- Removed stale `prismjs` / `@types/prismjs` lockfile entries.
- Updated README and sample copy to describe tree-sitter token streams instead of Prism.

## Verification

Commands run on 2026-07-09:

```sh
node --test packages/prism-code-core/test/*.test.mjs
make -C packages/shared/code-block-core test
node scripts/gen-compose-goldens.mjs
node packages/shared/code-block-core/gen/build-wasm.mjs
./node_modules/.bin/vitest run --project unit
swift test --package-path .
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest
```

All commands passed. The wasm build required running outside the sandbox because Emscripten writes cache files under `/opt/homebrew`. The Android Gradle test also required sandbox escalation for Gradle file-lock sockets.

## Remaining Optional Cleanup

- In a shell with `pnpm` available, run `pnpm test:all` as the final aggregate check.
- Re-run all visual snapshot tasks for a final Phase 6 review.
- Consider renaming the directory `packages/prism-code-core` to `packages/code-block-fixtures`; the package metadata is already renamed, but the directory path remains stable to avoid churning every fixture reference during Phase 5.
