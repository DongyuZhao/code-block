# Phase 4 Report — Android Tree-sitter Core

## Summary

Android now builds and uses the shared C tree-sitter core through the NDK. The Compose package no longer embeds Prism JavaScript or starts a WebView; rendering consumes native `{ text, scope }` token streams from `NativeCodeHighlighter`.

## Implementation

- Added `externalNativeBuild` to `packages/compose-code-block`, pointing at `packages/shared/code-block-core/CMakeLists.txt`.
- Added `CB_BUILD_JNI=ON` to build `libcode_block_core_jni.so`.
- Builds native libraries for `arm64-v8a`, `armeabi-v7a`, and `x86_64`.
- Added `src/code_block_core_jni.c`, which exposes `NativeCodeHighlighter.nativeTokenize` and calls `cb_tokenize_json`.
- Deleted `PrismBridge`, `WebViewPrismRuntime`, `CodeJavaScriptRuntime`, and the bundled `assets/code-block/prism-code.js`.
- Added `CodeHighlighter` and `NativeCodeHighlighter`.
- Replaced `CodeTokenRun{text, types}` / `PrismCodePayload` with `CodeToken{text, scope}` / `CodeTokens{language, tokens}`.
- Updated `CodeRenderer` and `CodeBlock` to use native highlighter output.
- Updated theme lookup to use scope keys and dotted-prefix fallback.

## Tests And Snapshots

- Updated Android unit contracts for the new native highlighter and renderer API.
- Synced Android golden token streams to the tree-sitter `{ text, scope }` shape.
- Re-recorded Roborazzi snapshots for the new highlighter output.
- Updated sample instrumentation tests to compile against `NativeCodeHighlighter`.

## Verification

- `./gradlew :packages:compose-code-block:testDebugUnitTest`
- `./gradlew :packages:compose-code-block:verifyRoborazziDebug`
- `./gradlew :packages:compose-code-block:assembleDebug`
- `./gradlew :samples:compose-code-block-sample:assembleDebug`
- `./gradlew :samples:compose-code-block-sample:compileDebugAndroidTestKotlin`

All commands passed on 2026-07-09. The native library was built for `arm64-v8a`, `armeabi-v7a`, and `x86_64`; `nm` confirmed the JNI export and `cb_tokenize_json` symbol in the arm64 library.

## Notes

Gradle commands required sandbox escalation in this Codex environment because the Gradle daemon/file-lock socket is blocked by the filesystem sandbox. `pnpm test:android` may still be blocked before reaching Gradle by pnpm's non-TTY install/purge prompt; the underlying Gradle commands were run directly.
