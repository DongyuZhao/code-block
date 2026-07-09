# Tree-sitter Migration Hardening Design

## Goal

Harden the staged Tree-sitter migration without changing the public C, React,
Swift, or Kotlin token APIs. The result must preserve current token semantics,
remove avoidable UI blocking and crash paths, make vendored sources auditable,
and reduce the staged source footprint to files required for building and
maintaining the seven supported language names.

## Constraints

- Keep the core implementation in C. Do not introduce Rust or
  `tree-sitter-highlight`.
- Keep `cb_tokenize_json(const char *, const char *, const char *)` and
  `cb_string_free(char *)` unchanged.
- Keep the `{language, tokens:[{text, scope}]}` payload unchanged.
- Keep the supported language names unchanged: TypeScript, TSX, JavaScript,
  JSX, Kotlin, Swift, and Python.
- Continue compiling native libraries from source for SwiftPM and Android.
- Continue publishing a prebuilt, single-file WebAssembly module for React.
- Preserve the current golden token streams unless a test proves an existing
  stream is incorrect.

## Chosen Approach

Retain the existing query execution and predicate evaluator, but replace the
quadratic flattening pass with an event-driven sweep. Move Android tokenization
off the caller/main dispatcher and make native loading and execution failures
explicit fallback results. Audit and trim vendored sources, add upstream
licenses and exact provenance, then add generated-artifact and performance
checks so the same problems cannot silently return.

## Core Flattening

The current implementation collects capture spans, creates every start/end
boundary, and scans every span for every boundary. This is quadratic in the
number of captures.

The replacement will:

1. Convert every capture span into a start event and an end event.
2. Sort events by byte offset with deterministic ordering for simultaneous
   starts and ends.
3. Maintain the active spans in a priority structure ordered by the existing
   rule: later start wins, then earlier end, then later query pattern index.
4. Emit a run whenever the winning scope changes.
5. Merge adjacent runs with the same scope.

The output rule remains exactly the same as today: the innermost capture wins;
identical ranges use the later query pattern. Existing goldens are the semantic
compatibility contract.

The core tests will include a large synthetic JavaScript input and a generous
runtime ceiling intended to catch an O(n²) regression without becoming a
machine-speed benchmark. A separate benchmark command will report scaling for
manual verification.

## Android Execution and Failure Handling

`NativeCodeHighlighter.tokenize` will execute native parsing through
`withContext(Dispatchers.Default)`. The synchronous entry point remains
available for instrumentation and focused native tests, but Compose rendering
will not call it on the main dispatcher.

Native library loading will be lazy and represented as a result instead of an
eager object-initialization side effect. `UnsatisfiedLinkError`, JNI failures,
and malformed payloads will return `null` from the highlighter. `CodeRenderer`
will also guard the highlighter boundary so an injected implementation cannot
cancel the flow with an unexpected exception. These failures map to the
existing `HighlighterUnavailable` fallback and always preserve the original
source text.

Tests will prove both dispatcher switching and exception-to-fallback behavior.
They will use injected dispatchers/loaders where necessary rather than loading
the production `.so` in a host JVM unit test.

## React Execution

The C optimization removes the dominant blocking work for React. This hardening
pass will not introduce a Web Worker because doing so would change bundling and
initialization behavior beyond the reviewed defects. React will gain a large
input regression test against the optimized core and will continue to use the
same async initialization API.

## Vendored Source Policy

Each vendored component will record:

- upstream repository URL;
- exact release version and commit or package-integrity identity;
- grammar ABI;
- files intentionally retained;
- license file path.

The repository will retain the license text for Tree-sitter and every grammar.
The build will keep only files required to compile parsers/scanners, generate
highlight queries, or satisfy license/provenance requirements. In particular,
the unused Swift `parser_abi13.c` and `parser_abi14.c` variants will be removed.
Unused corpus, grammar-generation inputs, node-type metadata, and unrelated
queries will be removed unless a generator in this repository consumes them.

`VENDOR.md` will be corrected to match `gen-queries.mjs`, including the fact
that TypeScript and TSX do not include the JavaScript parameter query.

## Generated Artifact Reliability

Committed generated files are `src/queries.h` and the React `cb-core.mjs`.
Generators will gain check modes that build or render expected output into a
temporary location and compare it with the committed artifact without changing
the working tree. CI-facing package scripts will run these checks where the
required toolchain is present.

The query drift check is mandatory in the normal shared test path. The WASM
drift check remains a maintainer/build check because it requires Emscripten.

## Testing and Acceptance

The implementation is accepted when:

- existing core, shared, React, Swift, and Android unit tests pass;
- existing visual snapshots remain unchanged unless an independently verified
  semantic correction requires an update;
- Android exceptions produce the existing plain-text failure surface;
- Android tokenization is verified off the caller/main dispatcher;
- the large-input core regression no longer exhibits quadratic scaling;
- `git diff --cached --check` has no errors in files maintained by this repo;
- every vendored component has exact provenance and a retained license;
- no unused Swift parser ABI variants or unrelated vendor artifacts remain;
- generated query drift is detected by an automated test.

## Non-goals

- Adopting Rust or the upstream `tree-sitter-highlight` crate.
- Changing public token or renderer APIs.
- Adding new languages.
- Implementing injected-language highlighting.
- Moving React highlighting into a Worker in this pass.
- Renaming `packages/prism-code-core`; that compatibility cleanup remains a
  separate change.
