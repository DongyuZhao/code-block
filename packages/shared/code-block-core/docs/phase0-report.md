# Phase 0 Report

## Result

Go for Phase 1.

The C core spike can parse the `typescript-generic` fixture with tree-sitter and emit the new payload shape:

```json
{"language":"typescript","tokens":[{"text":"Result","scope":"type"},{"text":"result","scope":"variable.parameter"}]}
```

This proves the original Prism limitation is addressed for the target case: named types and parameter identifiers are no longer forced through `plain`.

## Implemented

- Added the shared core under `packages/shared/code-block-core`.
- Vendored tree-sitter C runtime and TypeScript grammar sources for the spike.
- Added the public C ABI:
  - `char *cb_tokenize_json(const char *code, const char *language, const char *fallback_language)`
  - `void cb_string_free(char *value)`
- Added a minimal TypeScript highlighter:
  - parses with `tree_sitter_typescript`
  - runs `highlights.scm` through `TSQueryCursor`
  - flattens captures into non-overlapping `{text, scope}` runs
  - falls back to a single plain token for unsupported languages
- Added a C test harness in `test/phase0_typescript_test.c`.

## Verification

```sh
make -C packages/shared/code-block-core test
```

The test asserts:

- `language` is `typescript`
- `Result` is emitted with `scope:"type"`
- parameter `result` is emitted with `scope:"variable.parameter"`
- generic `T` is emitted with `scope:"type"`

Kotlin and Swift grammar source checks:

- Kotlin: `parser.c`, `scanner.c`, and `queries/highlights.scm` are present and compile as C objects.
- Swift: GitHub source archive does not include `parser.c`, but npm package `tree-sitter-swift@0.7.1` includes `parser.c`, `scanner.c`, and `queries/highlights.scm`; both C sources compile as objects.
- Swift scanner is C, not C++, so the expected SPM/NDK integration path is simpler than the risky case.

## Notes For Phase 1

- The C Query API does not evaluate text predicates such as `#match?` for us. The spike handles TypeScript's uppercase `identifier @type` predicate manually. Phase 1 should implement predicate handling systematically or vendor query subsets that do not depend on runtime predicates.
- The spike embeds the TypeScript query by hand in `code_block_core.c`. Phase 1 should replace this with generated `queries.h`.
- The spike uses a lightweight `Makefile` because `cmake` is not installed in this environment. Phase 1 should add the planned `CMakeLists.txt`.
- Kotlin was vendored from a GitHub `main` snapshot during the spike. Before Phase 1 lands broadly, pin grammar sources to explicit versions or commits and record them in a vendor manifest.
