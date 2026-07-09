# Phase 1 Report

## Result

Phase 1 is complete. The C core is a full 7-language tokenizer emitting the new
`{language, tokens:[{text, scope}]}` payload. `make test` (ctest) is green with
per-language scope assertions.

Languages: `typescript`, `tsx`, `javascript`, `jsx`, `kotlin`, `swift`,
`python`.

## The original bug, fixed for real

TypeScript fixture output (via `cb_cli`) — every run carries a real tree-sitter
scope; nothing that mattered is forced to `plain`:

```
'Result'  -> type
'result'  -> variable.parameter     # Prism forced this to gray plain
'T'       -> type
'unwrap'  -> function
'export'  -> keyword
```

This is intentionally *richer* than the deprecated Prism goldens (which tagged
`T` as `class-name`/`constant` and dumped parameters into `plain`). We do not
flatten toward the Prism stream — the new goldens are authoritative snapshots of
the tree-sitter output.

## Implemented

- **7-language registry** in `src/code_block_core.c` (`language_for_name`) plus
  ported `normalizeLanguage` + alias table + text/txt/none/plain and
  fallback-language semantics from `prism-code-core.ts`. jsx/tsx reuse the
  javascript/typescript parsers but carry their own composed query.
- **Systematic query predicates** (`match_passes_predicates`): `#eq?`,
  `#match?`, `#any-of?` and their `not-` negations, evaluated through
  `ts_query_predicates_for_pattern`. `#match?` uses POSIX ERE with `\d\w\s`
  translated to bracket classes. `#is-not? local` and any unknown predicate pass
  through (never silence highlighting). `_`-prefixed captures are treated as
  predicate helpers and never colored.
- **Deterministic flatten priority**: each span records `priority =
  match.pattern_index`; identical ranges break ties by priority (later pattern
  wins), nested ranges resolve innermost-wins. No longer order-dependent on match
  iteration.
- **`queries.h` generation** (`gen/gen-queries.mjs`): composes each language's
  highlights from the vendored `.scm` in precedence order and embeds them as C
  strings (`?` escaped to avoid trigraphs). See `vendor/VENDOR.md` for the
  composition table.
- **CMake build** (`CMakeLists.txt`): one OBJECT library per grammar with
  isolated includes so each parser sees its own bundled `tree_sitter/parser.h`;
  the runtime and grammars link into `libcode_block_core.a`. Swift compiles only
  `parser.c` (not the `parser_abi13/14.c` variants). Reusable as an Android NDK
  `externalNativeBuild` subdirectory (CLI/tests are gated to the top-level
  project). The Makefile is now a thin cmake wrapper.
- **Tooling**: `gen/cb_cli.c` (stdin code + argv language → JSON) and
  `gen/gen-goldens.mjs` (fixtures → new-shape goldens). `CB_DEBUG=1` prints query
  compile errors.

## Vendoring (pinned, ABI 14)

| Language         | package                 | version |
| ---------------- | ----------------------- | ------- |
| typescript / tsx | tree-sitter-typescript  | 0.23.2  |
| javascript / jsx | tree-sitter-javascript  | 0.23.1  |
| python           | tree-sitter-python      | 0.23.6  |
| kotlin           | tree-sitter-kotlin      | Phase 0 |
| swift            | tree-sitter-swift       | 0.7.1   |

Runtime is ABI 14 (`TREE_SITTER_LANGUAGE_VERSION 14`); 0.25.x grammars are ABI 15
and must not be pulled without upgrading the runtime. Manifest: `vendor/VENDOR.md`.

## Notable gotchas resolved

- **TS param query is a structural mismatch.** js `highlights-params.scm`
  matches `(formal_parameters (identifier) @variable.parameter)`, valid only for
  the javascript grammar. TypeScript wraps parameters in
  `required_parameter`/`optional_parameter`, so appending js params to the TS
  query raised `TSQueryErrorStructure` and collapsed the whole language to plain.
  Fix: ts/tsx compose js highlights + ts highlights only (TS highlights already
  covers parameters); js/jsx keep the params query.
- **Grammar/header ABI skew.** The Phase 0 typescript parser was an older
  generation without `ADVANCE_MAP`, while tsx 0.23.2 requires the modern
  `tree_sitter/parser.h`. Re-vendored the whole typescript grammar at 0.23.2 and
  supplied the modern header (from the js tarball) to both typescript and tsx.

## Verification

```sh
make -C packages/shared/code-block-core test
```

Asserts real scopes across all 7 languages (types → `type`, parameters →
`variable.parameter`/`parameter`, keywords, functions), alias resolution
(`ts` → typescript), empty-language fallback, and plain degradation for unknown
languages / `text`/`txt`/`none` / empty code.

## Impact on downstream (for Phase 2+)

Regenerating `packages/prism-code-core/test/golden/token-stream/*.json` in the
new shape **will break the react/swift/android tests that still parse the old
Prism payload**. That is expected and handled when those render layers are
rewritten in Phases 2–4.

## Notes for Phase 2 (Web/React)

- Compile the core with `emcc` → single `.wasm` + JS glue exporting
  `_cb_tokenize_json` / `_cb_string_free`. POSIX `<regex.h>` is available under
  Emscripten (musl), so predicate matching carries over unchanged.
- Rewrite the react highlight entry to call the wasm; switch `colorForToken` to
  hierarchical scope-prefix fallback; rebuild react goldens + pixel snapshots
  from the new payload.
