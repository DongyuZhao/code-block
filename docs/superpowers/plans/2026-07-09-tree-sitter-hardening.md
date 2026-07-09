# Tree-sitter Migration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the staged Tree-sitter migration performant, failure-safe, auditable, and minimal without changing public token APIs or existing golden semantics.

**Architecture:** Preserve the C query pipeline and replace only the quadratic span selection with a deterministic event sweep. Keep platform wrappers thin: Android supplies background execution and exception containment, while React and Swift consume the unchanged C ABI. Treat vendored sources and generated artifacts as reproducible inputs with explicit provenance, licenses, and drift checks.

**Tech Stack:** C11, CMake/CTest, Node.js, Emscripten, React/TypeScript/Vitest, Kotlin/Coroutines/Gradle, Swift/SwiftPM.

## Global Constraints

- Do not introduce Rust or `tree-sitter-highlight`.
- Do not change `cb_tokenize_json`, `cb_string_free`, `CodeToken`, or `CodeTokens` public shapes.
- Preserve the seven supported language names and current golden token streams.
- SwiftPM and Android continue compiling native code from source.
- React continues publishing a single-file prebuilt WebAssembly module.
- Do not create commits or alter unrelated staged content unless the user explicitly requests it.

---

### Task 1: Linearithmic Capture Sweep

**Files:**

- Modify: `packages/shared/code-block-core/src/code_block_core.c`
- Modify: `packages/shared/code-block-core/test/core_test.c`
- Modify: `packages/shared/code-block-core/Makefile`
- Create: `packages/shared/code-block-core/test/benchmark_scaling.sh`

**Interfaces:**

- Consumes: existing `CaptureSpan {start, end, priority, scope}` records.
- Produces: unchanged JSON from `cb_tokenize_json`; internal sorted `CaptureEvent` sweep with the existing innermost/later-pattern winner rule.

- [x] **Step 1: Add a failing scaling regression**

    Extend `core_test.c` with a generated large JavaScript input and elapsed-time assertion that permits normal CI variation but fails the current quadratic implementation. Add `benchmark_scaling.sh` to print timings for 1,000/2,000/4,000/8,000 lines and a `make bench` target.

- [x] **Step 2: Verify the regression fails for the expected performance reason**

    Run: `make -C packages/shared/code-block-core test`

    Expected before the fix: the large-input scaling assertion fails while all semantic assertions pass.

- [x] **Step 3: Implement the event sweep**

    Replace boundary creation plus `scope_for_range` full scans with:

    ```c
    typedef enum { CAPTURE_END, CAPTURE_START } CaptureEventKind;
    typedef struct {
        uint32_t offset;
        CaptureEventKind kind;
        size_t span_index;
    } CaptureEvent;
    ```

    Sort by offset; process end events before start events at the same offset; maintain active span indexes in a binary heap ordered by `span_is_better`; lazily remove inactive heap entries; emit `[previous_offset, offset)` using the winner before applying events at `offset`. Merge adjacent equal scopes through the existing run accumulator.

- [x] **Step 4: Verify exact semantics and scaling**

    Run:

    ```bash
    make -C packages/shared/code-block-core test
    make -C packages/shared/code-block-core bench
    node --test packages/prism-code-core/test/*.test.mjs
    ```

    Expected: semantic tests and shared golden tests pass; benchmark growth is no longer quadratic.

### Task 2: Android Background Execution and Failure Containment

**Files:**

- Modify: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/CodeHighlighter.kt`
- Modify: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/CodeRenderer.kt`
- Modify: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/CodeHighlighterContractTest.kt`
- Modify: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/CodeRendererContractTest.kt`

**Interfaces:**

- Consumes: existing suspending `CodeHighlighter.tokenize` contract.
- Produces: `NativeCodeHighlighter` that executes on an injected/default background dispatcher and returns `null` on native availability/execution failure; renderer maps unexpected highlighter failures to `HighlighterUnavailable`.

- [x] **Step 1: Add failing dispatcher and exception tests**

    Add a test dispatcher with a named worker thread and assert the injected native call executes there. Add a renderer test whose highlighter throws and assert the flow emits `Pending` followed by `Failed(HighlighterUnavailable)` containing the original source.

- [x] **Step 2: Verify both tests fail for the expected reasons**

    Run:

    ```bash
    GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest
    ```

    Expected before the fix: native work remains on the caller thread and the throwing highlighter cancels the flow.

- [x] **Step 3: Add injectable native boundary and dispatcher**

    Introduce an internal `NativeTokenizer` function interface and internal `NativeCodeHighlighter` constructor/state that uses `withContext(dispatcher) { runCatching { tokenizer(...) }.getOrNull() }`. Make `System.loadLibrary` lazy and execute it inside the guarded tokenizer boundary. Keep the public singleton behavior unchanged.

- [x] **Step 4: Contain renderer exceptions**

    Wrap `highlighter.tokenize(code, options)` in `try/catch`; rethrow `CancellationException`; map every other throwable to `Failed(HighlighterUnavailable)` with the original source text.

- [x] **Step 5: Verify Android unit and visual behavior**

    Run:

    ```bash
    GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest :packages:compose-code-block:verifyRoborazziDebug
    ```

    Expected: tests pass and snapshots are unchanged.

### Task 3: Generated Query Drift Check

**Files:**

- Modify: `packages/shared/code-block-core/gen/gen-queries.mjs`
- Modify: `package.json`
- Modify: `packages/prism-code-core/test/sample-scaffold.test.mjs`

**Interfaces:**

- Consumes: the existing query composition map.
- Produces: `node gen-queries.mjs --check`, which exits non-zero when `src/queries.h` differs and never writes the file.

- [x] **Step 1: Add a failing script-contract test**

    Extend `sample-scaffold.test.mjs` to assert `package.json` exposes `check:queries` and `test:shared` runs it before shared tests.

- [x] **Step 2: Verify the contract test fails**

    Run: `node --test packages/prism-code-core/test/sample-scaffold.test.mjs`

    Expected before the fix: missing `check:queries` assertion fails.

- [x] **Step 3: Add generator check mode**

    Refactor query generation into a pure `renderQueries()` function. With `--check`, compare rendered text to `src/queries.h`, print a remediation command, and set exit code 1 on drift; otherwise write as today.

- [x] **Step 4: Wire and verify scripts**

    Add `"check:queries": "node packages/shared/code-block-core/gen/gen-queries.mjs --check"` and make `test:shared` execute it first.

    Run:

    ```bash
    node packages/shared/code-block-core/gen/gen-queries.mjs --check
    node --test packages/prism-code-core/test/*.test.mjs
    ```

    Expected: both commands pass without modifying the working tree.

### Task 4: Vendor Provenance, Licenses, and Minimal File Set

**Files:**

- Modify: `packages/shared/code-block-core/vendor/VENDOR.md`
- Create: `packages/shared/code-block-core/vendor/licenses/tree-sitter-LICENSE`
- Create: one retained upstream license file for each JavaScript, TypeScript, Python, Kotlin, and Swift grammar source
- Delete: unused Swift parser ABI variants, corpora, grammar-generation metadata, node-type metadata, and unrelated query files not consumed by `CMakeLists.txt` or `gen-queries.mjs`
- Modify: `docs/tree-sitter-migration-plan.md`

**Interfaces:**

- Consumes: exact existing vendored parser/scanner/query inputs.
- Produces: a minimal auditable vendor tree; no runtime API changes.

- [x] **Step 1: Add a failing vendor audit test**

    Extend `golden-token-stream.test.mjs` to parse `VENDOR.md` and assert every listed component has a version or commit, repository URL, ABI, and existing license path. Assert forbidden unused Swift parser variants are absent.

- [x] **Step 2: Verify the audit fails on missing provenance/licenses**

    Run: `node --test packages/prism-code-core/test/golden-token-stream.test.mjs`

    Expected before the fix: Kotlin/runtime provenance and license-path assertions fail.

- [x] **Step 3: Establish exact provenance from existing package metadata and staged sources**

    Use local package metadata, source headers, and existing migration reports first. If any exact upstream identity cannot be proven locally, fetch only the authoritative upstream package/repository metadata and record the verified release/commit; do not guess.

- [x] **Step 4: Retain upstream license texts**

    Copy the exact license text distributed by each authoritative upstream into `vendor/licenses`, preserving attribution and recording the path in `VENDOR.md`.

- [x] **Step 5: Remove files not consumed by the build or generators**

    Delete `parser_abi13.c` and `parser_abi14.c`, corpus directories, `grammar.json`, `node-types.json`, grammar JavaScript/test files, Swift non-highlight query files, and other files absent from the explicit keep list. Preserve parser/scanner sources, required `tree_sitter/*.h`, highlight queries, Tree-sitter runtime sources/headers required by `lib.c`, and licenses.

- [x] **Step 6: Correct documentation contradictions**

    Make `VENDOR.md` query composition match `gen-queries.mjs`: TypeScript and TSX exclude `highlights-params`. Update the migration status notes so they no longer claim unverified pins.

- [x] **Step 7: Rebuild all native consumers after trimming**

    Run:

    ```bash
    make -C packages/shared/code-block-core clean
    make -C packages/shared/code-block-core test
    swift test --package-path .
    GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest
    ```

    Expected: clean rebuilds pass without a deleted-file reference.

### Task 5: Cross-platform Regression and Final Audit

**Files:**

- Modify only if a verification command exposes a defect in the preceding tasks.
- Update: `docs/tree-sitter-migration-plan.md` with verified hardening results.

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces: evidence that the staged migration is ready for commit review.

- [x] **Step 1: Run shared and platform tests**

    ```bash
    node --test packages/prism-code-core/test/*.test.mjs
    make -C packages/shared/code-block-core test
    ./node_modules/.bin/vitest run --project unit
    swift test --package-path .
    GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest
    ```

- [x] **Step 2: Run visual and sample checks**

    ```bash
    ./node_modules/.bin/vitest run --project browser
    swift test --package-path . --filter CodeBlockVisualSnapshotTests
    GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:verifyRoborazziDebug :samples:compose-code-block-sample:assembleDebug
    xcodebuild -project samples/swift-code-block-sample/SwiftCodeBlockSample.xcodeproj -scheme SwiftCodeBlockSample-iOS -destination 'generic/platform=iOS Simulator' build
    ```

- [x] **Step 3: Verify performance and repository cleanliness**

    ```bash
    make -C packages/shared/code-block-core bench
    node packages/shared/code-block-core/gen/gen-queries.mjs --check
    git diff --cached --check
    git diff --check
    git status --short
    ```

    Expected: scaling is non-quadratic, generated queries are current, maintained files have no whitespace errors, and only intended staged/working-tree changes are present.

- [x] **Step 4: Record only observed results**

    Update the migration plan with commands actually run, their outcomes, the measured scaling numbers, retained vendor versions/licenses, and any environment-limited checks. Do not claim an unrun check passed.
