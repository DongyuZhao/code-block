# Phase 3 Report — Swift Tree-sitter Core

## Summary

Swift now consumes the shared C tree-sitter core directly through SwiftPM. The Swift package builds the core and all vendored grammars from source, replaces the JSContext/Prism bridge with a native `CodeHighlighter`, and renders `{ text, scope }` token streams.

## Implementation

- Added `CodeBlockCore`, a SwiftPM C target in the repository-root `Package.swift`.
- The C target compiles the core/runtime/grammar sources directly from
	`packages/shared/code-block-core`, preserving a single source of truth without
	cross-package relative-include wrappers or prebuilt binaries.
- Exposed the public C ABI through the shared core's `include/code_block_core.h`.
- Replaced `PrismBridge` and `CodeJavaScriptEnvironment` with `CodeHighlighter`, which calls `cb_tokenize_json` and decodes `CodeTokens`.
- Removed the bundled `Resources/Prism/prism-code.js` asset from the Swift package.
- Updated `CodeRenderer` and `CodeBlock` to use `CodeToken.scope` instead of Prism `types`.
- Updated Swift theme lookup to use scope keys and dotted-prefix fallback, e.g. `variable.parameter` falls back to `variable`.

## Tests And Snapshots

- Added native C-core highlighter tests for JavaScript tokenization and unknown-language plain fallback.
- Updated renderer tests to assert tree-sitter scopes, including TypeScript `type` and `variable.parameter`.
- Re-recorded Swift visual snapshots for the new highlighter output.
- Visual snapshot verification now compares decoded RGBA pixels rather than PNG container bytes. SwiftPM and direct `xctest` can encode identical rendered images into different PNG byte streams.

## Verification

- `swift test --package-path .`
- `swift build --package-path packages/swift-code-block/Tests/Consumer`
- `xcodebuild -project samples/swift-code-block-sample/SwiftCodeBlockSample.xcodeproj -scheme SwiftCodeBlockSample-iOS -destination 'generic/platform=iOS Simulator' build`

Both commands passed on 2026-07-09.

## Notes

`pnpm test:swift` and `pnpm sample:swift:build` did not reach their script bodies in the current non-TTY Codex environment because pnpm attempted an install and aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. The underlying Swift and Xcode commands were run directly instead.
