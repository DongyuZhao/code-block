# 用 tree-sitter(C core)替换 Prism —— 跨平台迁移计划

> **状态:Phase 6 已完成,tree-sitter 迁移收尾完成。** 这是一个跨多个 session 的大任务,本文是唯一真源的执行计划 + 进度追踪。每完成一个 Phase,更新下面的「进度追踪」勾选并追加要点。

## 进度追踪

- [x] **Phase 0** — 打通单语言 + spike(去风险,go/no-go)
- [x] **Phase 1** — C core 完整实现(7 语言)
- [x] **Phase 2** — Web/React(Emscripten → wasm)【最早的全绿检查点】
- [x] **Phase 3** — iOS/Swift(SPM C target,从源码编译)
- [x] **Phase 4** — Android/Kotlin(NDK + CMake,从源码编译)
- [x] **Phase 5** — 构建管线 + 清理
- [x] **Phase 6(可选)** — 收尾/文档打磨

**Session 交接备注:**(每个 session 结束时在这里补充当前进展、坑、下一步)
- 2026-07-09: Phase 0 完成。共享 core 放在 `packages/shared/code-block-core`。已打通 TypeScript spike:`make -C packages/shared/code-block-core test` 通过,`Result`/`T` 输出 `scope:"type"`,`result` 参数输出 `scope:"variable.parameter"`。Kotlin/Swift grammar 均有 `highlights.scm` 且 parser/scanner C 源可编译;Swift GitHub archive 不带 `parser.c`,但 npm `tree-sitter-swift@0.7.1` 源包带生成后的 `parser.c`/`scanner.c`。下一步 Phase 1:补正式 CMake、生成 `queries.h`、系统化 query predicate 处理、固定 grammar 版本/commit、扩到 7 语言。
- 2026-07-09: **Phase 1 完成。** 7 语言全部打通(ts/tsx/js/jsx/kotlin/swift/python),`ctest --test-dir build`(即 `make test`)全绿,7 语言逐一断言真实 scope。要点:
  - **Grammar 全部 vendor + pin(ABI 14,配 runtime `TREE_SITTER_LANGUAGE_VERSION 14`):** typescript/tsx `tree-sitter-typescript@0.23.2`、js/jsx `tree-sitter-javascript@0.23.1`、python `tree-sitter-python@0.23.6`;kotlin/swift 沿用 Phase 0。清单见 `vendor/VENDOR.md`。**注意:0.25.x 是 ABI 15,升级前必须先升 runtime。** Phase 0 vendor 的 typescript 是旧版(无 `ADVANCE_MAP`),Phase 1 已整体重取 0.23.2,并用 js tarball 里的现代 `tree_sitter/parser.h`(带 `ADVANCE_MAP`/`TSCharacterRange`/`set_contains`)喂给 typescript + tsx。
  - **`queries.h` 生成:** `gen/gen-queries.mjs` 把各语言 `highlights.scm` 按优先级顺序拼接后内嵌成 C 字符串(`?`→`\?` 防 trigraph)。拼接顺序=先广后专(flatten 里 tie 由后者胜)。**关键坑:** js `highlights-params.scm` 只适配 js 结构(`formal_parameters` 直接含 identifier),对 TS 会报 `TSQueryErrorStructure`(TS 参数在 `required/optional_parameter` 里);故 typescript/tsx 组合**不含** js params(TS 自己的 highlights 已覆盖参数)。
  - **Predicate 系统化:** `match_passes_predicates` 用 `ts_query_predicates_for_pattern` 统一评估 `#eq?`/`#match?`/`#any-of?`(含 `not-` 取反);`#match?` 走 POSIX ERE,`\d\w\s`→字符类;`#is-not? local` / 未知 predicate 一律放行(不误伤高亮)。`_` 前缀 capture 视作 predicate 辅助不上色。
  - **Flatten 优先级确定化:** span 存 `priority = match.pattern_index`,同范围 tie 用 priority(后 pattern 胜),嵌套用最内层胜——不再依赖 match 遍历顺序。
  - **Golden 已按用户纠正重做:** 不再以 Prism 极简 stream 为目标。`gen/gen-goldens.mjs` 跑 `cb_cli` 把 fixtures 打成**新形态真实 tree-sitter 快照**(`{language,tokens:[{text,scope}]}`),覆盖 `packages/prism-code-core/test/golden/token-stream/*.json`。**⚠️ 这会让仍读旧 Prism 形态的 react/swift/android golden 测试暂时失败——正常,Phase 2-4 改渲染层时重录。**
  - **构建:** `CMakeLists.txt` 为真源(每 grammar 独立 OBJECT lib + 各自 include 隔离 `tree_sitter/parser.h`;swift 只编 `parser.c` 不编 `parser_abi13/14.c`);Makefile 变成 cmake 薄封装(`make test`/`make queries`/`make all`)。`cb_cli`(stdin 代码 + argv 语言)+ `test/core_test.c`。`CB_DEBUG=1` 打印 query 编译错误。
  - **报告:** `packages/shared/code-block-core/docs/phase1-report.md`。
  - 下一步 **Phase 2(Web/React)**:`emcc` 编译 core→wasm,导出 `_cb_tokenize_json`/`_cb_string_free`;重写 react 高亮入口调 wasm;`colorForToken` 改层级前缀回退;更新 react golden/pixel 快照。
- 2026-07-09: **Phase 2 完成(React 全绿)。** `pnpm test:react`(unit + pixel)全绿,pixel 快照重录——类型/参数已上色(TS `Result`/`T` 走 type 色,不再灰)。报告 `packages/shared/code-block-core/docs/phase2-report.md`。要点:
  - **wasm 构建(`gen/build-wasm.mjs` / `make wasm` / `pnpm build:wasm`):** `emcmake cmake` 复用 `CMakeLists.txt`(每 grammar include 隔离不变)编 `libcode_block_core.a`,再 `emcc` link 成 **单文件** ES module `cb-core.mjs`(SINGLE_FILE base64 内嵌 wasm,消费方无需单独 `.wasm`),发布到 `packages/react-code-block/src/generated/cb-core.mjs`。~10MB/gzip ~1.4MB(6 语法,swift+kotlin 占大头)。构建可复现(重跑字节一致)。只导出 `_cb_tokenize_json`/`_cb_string_free`(+`_malloc`/`_free`)。
  - **⚠️ 关键坑 — 不能开 `ALLOW_MEMORY_GROWTH`。** 可增长堆 → resizable `ArrayBuffer` → Chromium `TextDecoder.decode` 抛 `must not be resizable`;emscripten 6 又删了 `TEXTDECODER=0` 退路。解法:**固定 64MB 堆**(`INITIAL_MEMORY=67108864`,不增长),源码片段够用。
  - **Emscripten 是维护者构建依赖**(不随包发布):`brew install emscripten`(当前 6.0.2,`emcc` 在 `/opt/homebrew/bin`,无需 source 任何 env)。
  - **React 层:** 新 `src/code-highlighter.ts` 懒加载 wasm(promise 缓存)+ `cwrap`,导出 `highlightCode(code,opts):Promise<CodeTokens>` / `loadHighlighter()`;C core 已包办 normalize/alias/fallback,JS 只搬字符串 + 解析 JSON。`index.tsx`:`renderCode` async generator await `highlightCode`;`CodeToken{text,scope}`;`defaultCodeTokenTheme` key=capture 名;`colorForToken` **层级前缀回退**(`variable.parameter`→`variable`→plain)。删 prism 生成副本 + `prismjs` 依赖;`scripts/copy-wasm-assets.mjs` 在 `tsc` 后把 glue+`.d.mts` 拷进 dist。sample App.tsx 已迁到新 async API 且 `sample:react:build` 通过。
  - **仍红(设计使然,Phase 5 清):** `pnpm test:shared`(Prism bridge 对新形态 golden)自 Phase 1 起就红,Phase 5 连同 `prism-code.js`/`build-prism-code.mjs`/prismjs 资产一并删。
  - 下一步 **Phase 3(iOS/Swift)**:SPM C target 从源码编译 core + vendor tree-sitter/grammars(swift scanner 是 C,纯 C 混编 OK);module map 暴露 `cb_tokenize_json`;`CodeHighlighter`+`CodeToken`/`CodeTokens`(Codable)替 `PrismBridge`/`JSContext`;`Theme` key→scope + 层级前缀回退;重录 swift 视觉快照。
- 2026-07-09: **Phase 3 完成(Swift 全绿)。** `swift test --package-path .` 全绿(6 tests),`xcodebuild -project samples/swift-code-block-sample/SwiftCodeBlockSample.xcodeproj -scheme SwiftCodeBlockSample-iOS -destination 'generic/platform=iOS Simulator' build` 通过。报告 `packages/shared/code-block-core/docs/phase3-report.md`。要点:
  - **SPM C target:** 新增 `CodeBlockCore` target,包内 wrapper `.c` 文件 `#include` 共享 core/vendor 源码,不复制真源、不使用预编译二进制;module map 暴露 `cb_tokenize_json`/`cb_string_free`。
  - **Swift API 去 Prism:** 删除 `PrismBridge`、`CodeJavaScriptEnvironment` 和 bundled `Resources/Prism/prism-code.js`;新增 `CodeHighlighter` + `CodeToken{text,scope}` / `CodeTokens{language,tokens}`(`Codable`)。
  - **Renderer/theme:** `CodeRenderer` 改调 C core,失败只保留无效输入/高亮器异常兜底;`CodeBlock` 颜色表 key 切到 scope,并支持 `variable.parameter` → `variable` 的层级前缀回退。
  - **测试/快照:** 新增 `CodeHighlighterTests`,renderer 覆盖 TS type/parameter scope;Swift visual snapshots 已按 tree-sitter 输出重录。视觉测试仍保存 PNG,但校验改为解码后的 RGBA 像素,避免 SwiftPM/xctest runner 的 PNG 编码字节差异造成假红。
  - **环境备注:** 当前 Codex non-TTY 下 `pnpm test:swift`/`pnpm sample:swift:build` 会先触发 pnpm install 并因 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 未进入脚本;本阶段使用等价底层命令完成验证。
  - 下一步 **Phase 4(Android/Kotlin)**:NDK/CMake 接入同一 C core,替换 WebView Prism runtime 为 JNI runtime,同步 Kotlin data class/API、颜色 scope 回退与 Roborazzi 快照。
- 2026-07-09: **Phase 4 完成(Android 全绿)。** `:packages:compose-code-block:testDebugUnitTest`、`:packages:compose-code-block:verifyRoborazziDebug`、`:packages:compose-code-block:assembleDebug`、`:samples:compose-code-block-sample:assembleDebug`、`:samples:compose-code-block-sample:compileDebugAndroidTestKotlin` 全部通过。报告 `packages/shared/code-block-core/docs/phase4-report.md`。要点:
  - **NDK/CMake:** `packages/compose-code-block` 通过 `externalNativeBuild` 直接消费 `packages/shared/code-block-core/CMakeLists.txt`,开启 `CB_BUILD_JNI=ON`,构建 `arm64-v8a` / `armeabi-v7a` / `x86_64` 的 `libcode_block_core_jni.so`。
  - **JNI shim:** 新 `src/code_block_core_jni.c` 暴露 `NativeCodeHighlighter.nativeTokenize`,调用 `cb_tokenize_json` 并用 `cb_string_free` 释放 C 字符串;`nm` 确认导出 JNI 符号和 `cb_tokenize_json`。
  - **Kotlin API 去 Prism:** 删除 `PrismBridge`、`WebViewPrismRuntime`、`CodeJavaScriptRuntime` 和 `assets/code-block/prism-code.js`;新增 `CodeHighlighter` 接口 + `NativeCodeHighlighter`;payload 改为 `CodeToken{text,scope}` / `CodeTokens{language,tokens}`。
  - **Renderer/theme:** `CodeRenderer` 改调 highlighter;`CodeBlock` 直接使用 native highlighter;颜色表 key 切到 scope,支持 `variable.parameter` → `variable` 层级前缀回退。
  - **测试/快照:** Android token-stream golden 同步为新 `{text,scope}` 形态;Roborazzi 快照已重录;instrumentation contract 改为 native highlighter 编译检查。
  - **环境备注:** 当前 Codex 沙盒内 Gradle daemon/file-lock socket 受限,Android Gradle 命令使用沙盒外授权执行;`pnpm test:android` 仍可能受 pnpm non-TTY install/purge 行为影响,底层 Gradle 命令已验证。
  - 下一步 **Phase 5(构建管线 + 清理)**:替换/删除 Prism 构建与同步脚本,清理剩余 `prism-code-core` 命名和包职责,统一生成/分发 goldens 与 wasm。
- 2026-07-09: **Phase 5 完成。** `node --test packages/prism-code-core/test/*.test.mjs`、`make -C packages/shared/code-block-core test`、`node scripts/gen-compose-goldens.mjs`、`node packages/shared/code-block-core/gen/build-wasm.mjs`、`./node_modules/.bin/vitest run --project unit`(React)、`swift test --package-path .`、`:packages:compose-code-block:testDebugUnitTest` 全部通过。报告 `packages/shared/code-block-core/docs/phase5-report.md`。要点:
  - **构建脚本清理:** 根脚本改为 `build:queries` / `build:code-block-core` / `gen:goldens` / `build:wasm`;删除 `build:prism-code`、`check:prism-code`、`sync:prism` 及对应脚本。
  - **共享包退化为 fixtures/goldens:** 删除 `packages/prism-code-core/generated/prism-code.js`、旧 Prism TS bridge/source 和旧 bundle 测试;包名改为 `@code-block/fixtures`,只发布 fixtures + token-stream goldens。
  - **Golden 管线统一:** `scripts/gen-compose-goldens.mjs` 现在先构建 C core CLI,调用 `gen-goldens.mjs` 生成共享 tree-sitter goldens,再同步 Android resources + Kotlin corpus。Kotlin 生成器会保留 fixture `code` 并转义 `$`,避免截图测试编译失败。
  - **依赖清理:** `pnpm-lock.yaml` 中移除 `prismjs` / `@types/prismjs` 遗留项;README 改为 tree-sitter/C core/wasm 工作流。
  - **环境备注:** 当前 shell 无 `pnpm`/`corepack`,所以验证使用底层命令;wasm build 第一次在沙盒内因 Emscripten 写 `/opt/homebrew/.../cache` 失败,沙盒外授权后通过。Android Gradle 仍需沙盒外授权运行。
  - 下一步 **Phase 6(可选)**:全量 `pnpm test:all`(在有 pnpm 的环境)、三端视觉快照复核,并考虑把 `packages/prism-code-core` 目录名最终迁到 `packages/code-block-fixtures`。
- 2026-07-09: **Phase 6 完成。** 报告 `packages/shared/code-block-core/docs/phase6-report.md`。要点:
  - **全量等价验证:** 当前 shell 仍无 `pnpm`/`corepack`,无法字面运行 `pnpm test:all`;已运行其底层等价命令 + 三端 visual/sample checks:`node --test packages/prism-code-core/test/*.test.mjs`、`make -C packages/shared/code-block-core test`、React unit/pixel、`swift test --package-path .`(含 Swift visual snapshot)、Android unit、Android Roborazzi、Swift sample build、Android sample build、React package compile + wasm asset copy + React sample Vite build。
  - **文档/示例收尾:** README 已是 tree-sitter/C core 流程;React/Swift/Compose samples 都使用 `scope` 示例和 tree-sitter 文案;本计划状态更新到 Phase 6 完成。
  - **命名边角:** 活跃 runtime/build 路径已无 Prism bridge/bundle/js runtime;`packages/prism-code-core` 目录名暂保留为 fixtures/goldens 兼容路径,package metadata 已改为 `@code-block/fixtures`。后续若想彻底消除路径名,可单独做 `packages/code-block-fixtures` 目录迁移。
  - **环境备注:** React browser tests 需要绑定 localhost,Android Gradle/Roborazzi 需要 file-lock sockets,均需沙盒外授权;Vite sample build 对单文件 wasm 体积给出 chunk warning,符合 Phase 2 体积备注。
- 2026-07-09: **可靠性加固进行中。** 设计与执行计划见
  `docs/superpowers/specs/2026-07-09-tree-sitter-hardening-design.md` 和
  `docs/superpowers/plans/2026-07-09-tree-sitter-hardening.md`。已完成:
  - C core 拉平从逐 boundary 扫描全部 span 的 O(n²) 改为 event + active heap sweep;
    8,000 行 JavaScript 本机基准由约 4.01s 降至约 0.29s,并加入复杂度回归测试。
  - Android native tokenize 切到 `Dispatchers.Default`;library/JNI/highlighter 异常统一进入
    `HighlighterUnavailable` plain fallback,同时保留协程取消。
  - `queries.h` 新增只读 `--check` 漂移检查并接入 shared test contract。
  - runtime 精确确认为 tree-sitter v0.22.6;Kotlin 精确锁定到
    `c8ac3d2627240160b999a2c100de3babbdb8f419`;全部 runtime/grammar 许可证已保留。
  - ASan 发现 Swift 0.7.1 scanner 的 `calloc(0, sizeof(ScannerState))` 越界;
    vendor 保留最小 `calloc(1, ...)` safety patch,ASan core suite 通过。
  - 删除未编译的 Swift ABI 13/14 parser 及无消费方的 grammar 元数据、corpus 和非 highlight query。

---

## Context(为什么做)

现在的高亮引擎是 Prism(纯正则,无语法分析)。实测确认:自定义类型标注(`user: User` 里的 `User`)、参数名/变量名都被 Prism 标成 `plain`,渲染成灰色 —— 这是 Prism 的语法能力上限,不是我们颜色配置的问题。同时 Android 端为跑这段 JS 起了一整个 **WebView**([WebViewPrismRuntime.kt](../packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/WebViewPrismRuntime.kt)),启动/内存/电量都是重负担;iOS 端在 `JSContext` 里跑 Prism 也拖着一个 JS VM。

目标:换成 **tree-sitter**(真正的解析器,C 核心)—— 它 *知道* `User` 在类型位、`name` 是参数定义,直接根治最初的着色问题;原生高性能,彻底干掉 Android 的 WebView 和 iOS 的 JSContext。tree-sitter 的 capture-name → color 模型和现有各端"type → color 映射表"架构一致。既然要重写引擎,顺带把 payload/命名从 Prism 时代的包袱里解放出来,换成更干净的 API。

## 已定的关键决策(经过讨论敲定)

- **核心语言:C**,对外暴露纯 **C ABI**。核心是一份 `code_block_core.c`(tokenize + 高亮拉平 + 别名/归一 + JSON 输出),编译进所有平台 —— **单一真源**。(用户明确不用 Rust。)
- **零外部工具链依赖:** iOS/Android **直接从 C 源码编译**,无预编译二进制;web 编译成 `.wasm`(维护者用 Emscripten,消费方拿预编译 `.wasm`)。
- **首期语言集(收敛):** `typescript / tsx / javascript / jsx / kotlin / swift / python`。后续加语言 = vendor 一份 grammar,纯增量。
- **全新干净 API(payload 可破坏性变更,用户已同意):**
  ```
  CodeToken  = { text: string, scope: string }   // scope = tree-sitter capture 名(如 "variable.parameter"),plain 为 ""
  CodeTokens = { language: string, tokens: CodeToken[] }   // language 为实际解析用的语言,未识别则 "plain"
  ```
  砍掉 Prism 时代的 `ok`/`error`/`grammarFound`/`requestedLanguage` 和嵌套 `types[]`。tree-sitter 拉平后每个 run 只有一个胜出 scope → 单个 dotted 字符串即可。任何失败退化成单个 plain token,渲染层无错误分支。
- **颜色解析:层级前缀回退。** `variable.parameter` 查不到 → 去尾段查 `variable` → 再不中 → 默认色。取代现有"types 数组倒序找"。
- **命名一开始就去 Prism:** `PrismCodePayload`→`CodeTokens`、`CodeTokenRun{text,types}`→`CodeToken{text,scope}`、`PrismBridge`→`CodeHighlighter`。JS 端 `CodeBlockPrism`/`tokenizeJSON` 随 JS runtime 一起删。
- **主题模型:** 沿用各端现有颜色表(scope → color),不把颜色搬进 core。
- **ABI(显式参数,C 端不解析 JSON,只输出):**
  `char* cb_tokenize_json(const char* code, const char* language, const char* fallback_language)` → 返回 `{language, tokens:[{text,scope}]}` 的 JSON;`void cb_string_free(char*)` 释放。

## 架构

```
packages/shared/code-block-core/
  include/code_block_core.h        # 公开 C ABI 头(手写)
  src/code_block_core.c            # normalize_language + aliases(移植 prism-code-core.ts 语义)
                                   #   tokenize(code, lang, fallback) -> CodeTokens
                                   #   高亮拉平:跑 highlights.scm -> {text, scope} runs(单一胜出 scope)
                                   #   plain fallback(未识别语言 / 解析失败 -> 单个 plain token)
  src/json_writer.{c,h}            # 最小 JSON 输出 + 字符串转义
  src/queries.h                    # 各语言 highlights.scm 内嵌为 C 字符串(生成)
  vendor/tree-sitter/              # tree-sitter runtime(lib/src amalgamation)
  vendor/grammars/<lang>/          # 每语言:parser.c(+ scanner.c/.cc)+ queries/highlights.scm
  CMakeLists.txt                   # 本地/测试构建 + Android NDK externalNativeBuild 复用
  test/                            # C 单测:跑 fixtures,比对 golden
  gen/gen_goldens                  # 小 harness(C 可执行),读 fixtures 产出各端共用 golden
```

**高亮拉平(C 手写,替代 Rust 的 tree-sitter-highlight):**
用 tree-sitter C 查询 API(`ts_query_new` / `TSQueryCursor` / `ts_query_cursor_exec`)跑 `highlights.scm`,收集每个 capture 的 `(start_byte, end_byte, capture_name)`;做一次 sweep 产出**不重叠的 runs**,每个 byte 归属"最内层/最后开始"的 capture,得到单一胜出 `scope`(未命中的字节 → `scope:""` plain run)。首版用此简化优先级,足够对齐效果;后续可细化到 tree-sitter-highlight 的完整优先级。

**内存/所有权:** `cb_tokenize_json` 返回 `malloc` 的 `char*`,调用方用 `cb_string_free` 释放。各 wrapper(Swift/JNI/wasm)成对调用。

## 分阶段推进(每阶段尽量留下可构建/可验证的检查点)

### Phase 0 — 打通单语言 + spike(去风险,go/no-go)
- 本地 CMake:vendor tree-sitter runtime + `tree-sitter-typescript`,跑 `highlights.scm`,对 `typescript-generic` fixture 打出 scope,**确认 `User`/`Person`/参数名从 plain 变成 `type`/`variable.parameter`**(最初 bug 已修的实锤)。
- 验证 `tree-sitter-kotlin`(社区语法)/ `tree-sitter-swift`(external scanner,可能是 C++ `scanner.cc`)能 vendor 且 `highlights.scm` 齐全 —— **本阶段最大风险点**。
- 交付:scope 对比报告 + kotlin/swift 可用性结论 + 高亮拉平最小实现。

### Phase 1 — C core 完整实现
- 全量:`aliases`/`normalizeLanguage`/plain fallback 语义(移植);7 语言注册表(lang → `TSLanguage*` + highlights 字符串);拉平;JSON 输出。
- C 单测跑 fixtures;`gen_goldens` 落地。
- 用新 `{language,tokens:[{text,scope}]}` 结构重新生成共用 golden(`packages/prism-code-core/test/golden/token-stream/*.json`)。

### Phase 2 — Web/React(Emscripten → wasm)【最早的全绿检查点】
- `emcc` 编译 core → 单个 `.wasm` + JS glue,导出 `_cb_tokenize_json`/`_cb_string_free`,放进 `packages/react-code-block`。
- 重写 [react-prism-code.ts](../packages/prism-code-core/src/react-prism-code.ts) → 新 `highlightCode(code, options): CodeTokens`,内部调 wasm;删 prismjs。
- wasm 初始化异步:复用现有 `renderCode` async generator + `useCodeRenderState` 的 pending→result 流程接住 init。
- 改 [index.tsx](../packages/react-code-block/src/index.tsx):`CodeToken{text,scope}`;`defaultCodeTokenTheme` key → scope 名;`colorForToken` 改为**层级前缀回退**。
- 更新 react golden + 重录 pixel 快照。
- 验证:`pnpm test:react` / `pnpm snapshot:react:visual` / `pnpm sample:react:dev` 肉眼确认类型/参数上色。

### Phase 3 — iOS/Swift(SPM C target,从源码编译,无二进制)
- swift 包新增 **C target**,直接编译 core C 源 + vendor 的 tree-sitter/grammars(swift scanner 若 C++ 则混编);module map 暴露 `cb_tokenize_json`。**无 xcframework/预编译**。
- 用 C 调用封装替换 [PrismBridge.swift](../packages/swift-code-block/Sources/SwiftCodeBlock/Utils/PrismBridge.swift) / [CodeJavaScriptEnvironment.swift](../packages/swift-code-block/Sources/SwiftCodeBlock/Utils/CodeJavaScriptEnvironment.swift):新 `CodeHighlighter` + `CodeToken`/`CodeTokens`(`Codable`);**删 JSContext 和 prism-code.js 资源**。
- 改 [CodeBlock.swift](../packages/swift-code-block/Sources/SwiftCodeBlock/Render/CodeBlock.swift):`Theme.colors` key → scope,`color(for:)` 层级前缀回退;重录视觉快照;更新测试。
- 验证:`pnpm test:swift` / `pnpm snapshot:swift:visual` / `pnpm sample:swift:build`。

### Phase 4 — Android/Kotlin(NDK + CMake,从源码编译)
- gradle `externalNativeBuild` → `packages/shared/code-block-core/CMakeLists.txt`,NDK 为 arm64-v8a/armeabi-v7a/x86_64 编译 `.so`(含手写 JNI shim `Java_..._nativeTokenize` 调 `cb_tokenize_json`)。
- **删 [WebViewPrismRuntime.kt](../packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/WebViewPrismRuntime.kt) 和整套 WebView 管线**,换 JNI runtime(`external fun`);新 `CodeToken`/`CodeTokens` data class。
- 改 [CodeBlock.kt](../packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlock.kt):颜色表 key → scope + 层级前缀回退;重录 Roborazzi 快照;更新测试。
- 验证:`pnpm test:android` / `pnpm snapshot:android:visual` / `pnpm sample:android:build`。

### Phase 5 — 构建管线 + 清理
- 新构建脚本替换 [build-prism-code.mjs](../scripts/build-prism-code.mjs) / [sync-prism-assets.mjs](../scripts/sync-prism-assets.mjs):编排 Emscripten wasm 落位 + 生成 `queries.h`;更新 `package.json` scripts。
- `gen-compose-goldens.mjs` 改为消费 C `gen_goldens` 输出(fixtures 仍是唯一 corpus)。
- 移除 `prismjs` 依赖、prism-code.js 资产、`native-prism-code.ts`、各端死掉的 JS runtime;`prism-code-core` 包退化为"共享 fixtures + golden"(或重命名 `code-block-fixtures`)。
- 更新 README/docs(grammar vendor/更新流程、Emscripten 只在 web 构建时需要、新 API 说明)。

### Phase 6(可选)— 收尾/文档打磨
- 全量 `pnpm test:all` + 三端 visual snapshot 复核;补充新 API 使用示例;清理遗留 Prism 命名的边角。

## 复用的现有资产
- 语言别名表 + `normalizeLanguage` + `flattenTokenStream`/`appendRun` 语义 → 已移植到 C:[code_block_core.c](../packages/shared/code-block-core/src/code_block_core.c)。
- 颜色解析(现"types 倒序找")→ 改为 scope 层级前缀回退:[index.tsx](../packages/react-code-block/src/index.tsx) `colorForToken` / [CodeBlock.swift](../packages/swift-code-block/Sources/SwiftCodeBlock/Render/CodeBlock.swift) `color(for:)`。
- 测试 corpus 单一真源:[code-snippets.json](../packages/prism-code-core/fixtures/code-snippets.json);golden 分发套路参考 [gen-compose-goldens.mjs](../scripts/gen-compose-goldens.mjs)。

## 风险与备注
- **高亮拉平自己写**(`tree-sitter-highlight` 有 Rust 实现及 Rust-backed C ABI,但无纯 C 实现):优先级语义有细节。缓解:golden + 复杂度测试兜底,保持"最内层/后 pattern 胜出"。
- **grammar 手动 vendor**:每语言拷 `parser.c`(+scanner)+ `highlights.scm`,无版本管理器;swift scanner 可能 C++ → core target 需混编。
- **kotlin/swift 语法成熟度**(Phase 0 先探):不达标则 vendor 修补或该语言暂缓。
- **Emscripten** 是 web 端唯一新增构建工具(仅维护者/CI,消费方拿预编译 `.wasm`)。
- **破坏性 API 变更**:payload/类型名全变,三端渲染层 + 所有 golden/快照都要改并重录(已在各 Phase 覆盖)。
- **体积利好**:core 总量几百 KB,远小于 TextMate JSON;iOS/Android 零二进制、从源码编译。

## 验证(端到端)
- Core:C 单测(golden)+ Phase 0 scope 对比报告证明 `User`/参数已上色。
- React:`pnpm test:react` / `pnpm snapshot:react:visual` / `pnpm sample:react:dev`。
- Swift:`pnpm test:swift` / `pnpm snapshot:swift:visual` / `pnpm sample:swift:build`。
- Android:`pnpm test:android` / `pnpm snapshot:android:visual` / `pnpm sample:android:build`。
- 全量:`pnpm test:all` + 三端 visual snapshot 全部重录并复核颜色。
