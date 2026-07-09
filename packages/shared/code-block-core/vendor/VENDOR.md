# Vendored sources

The runtime and grammars below are committed as source so SwiftPM, Android NDK,
and Emscripten all compile the same implementation. Every identity was verified
by byte-comparing the retained parser/runtime sources with the authoritative
release archive or commit listed here.

All retained grammars emit tree-sitter language ABI 14. The vendored v0.22.6
runtime accepts ABI 13 through 14. Upgrade the runtime before adopting an ABI 15
grammar.

## Provenance

| Component | Identity | Repository | Archive SHA-256 | License |
| --- | --- | --- | --- | --- |
| tree-sitter | v0.22.6 | https://github.com/tree-sitter/tree-sitter | `e2b687f74358ab6404730b7fb1a1ced7ddb3780202d37595ecd7b20a8f41861f` | `licenses/tree-sitter-LICENSE` |
| tree-sitter-javascript | 0.23.1 | https://github.com/tree-sitter/tree-sitter-javascript | `90e80b25a67517a4daf6ad751557bee21efbda7b7a5a554897933245d1734398` | `licenses/tree-sitter-javascript-LICENSE` |
| tree-sitter-typescript | 0.23.2 | https://github.com/tree-sitter/tree-sitter-typescript | `0fdf63c35930a75885145d75ee63cb879da2d49db9bfe454bd8e60b08ba778a1` | `licenses/tree-sitter-typescript-LICENSE` |
| tree-sitter-python | 0.23.6 | https://github.com/tree-sitter/tree-sitter-python | `aab5b860d93dbf84b37fed532f7dacc0468ede5387d0c74911d68f964287662a` | `licenses/tree-sitter-python-LICENSE` |
| tree-sitter-kotlin | c8ac3d2627240160b999a2c100de3babbdb8f419 | https://github.com/fwcd/tree-sitter-kotlin | source commit; retained `parser.c` SHA-256 `04f52fe1c452c396eaeccf135700c4f3367098c093dffb9d86796807db9d3fb7` | `licenses/tree-sitter-kotlin-LICENSE` |
| tree-sitter-swift | 0.7.1 | https://github.com/alex-pinkus/tree-sitter-swift | `abd89284f1b0f1375ba5efaa9ddf99ad4b16ac91fc7751ef10c5f013cca06f8c` | `licenses/tree-sitter-swift-LICENSE` |
| tree-sitter-bash | 0.23.3 | https://github.com/tree-sitter/tree-sitter-bash | `10f4d67f56e07bc6cc34c49afb34e232269c1e0a19933880dfdb5dd738a8fc7d` | `licenses/tree-sitter-bash-LICENSE` |
| tree-sitter-c | 0.23.6 | https://github.com/tree-sitter/tree-sitter-c | `88175d4425037ec0026233a44f82064a676573b1fd748fc709ae607332151243` | `licenses/tree-sitter-c-LICENSE` |
| tree-sitter-css | 0.23.2 | https://github.com/tree-sitter/tree-sitter-css | `7dd088805e0f206d6b15d13ce717f9be89b9ff023efcc7970ca5a9064aa45aba` | `licenses/tree-sitter-css-LICENSE` |
| tree-sitter-go | 0.23.4 | https://github.com/tree-sitter/tree-sitter-go | `8779d20d322b4319ad8c833ea72ecb6d109cf1fec8979bdcdb5315a2e511dd2c` | `licenses/tree-sitter-go-LICENSE` |
| tree-sitter-html | 0.23.2 | https://github.com/tree-sitter/tree-sitter-html | `6b024fc38fce2b4807d0ac35023487da682a15cd986ba2ee9d6c25feff9392ed` | `licenses/tree-sitter-html-LICENSE` |
| tree-sitter-java | 0.23.5 | https://github.com/tree-sitter/tree-sitter-java | `6b6c1b62605f9d8bb80efd2ebe5951a87b182faafa3eeb67c460a667818551b6` | `licenses/tree-sitter-java-LICENSE` |
| tree-sitter-json | 0.24.8 | https://github.com/tree-sitter/tree-sitter-json | `39e96d1e4231d200562ebd69105151cd43f58dda4b18a0e9a62fe2991da35b9c` | `licenses/tree-sitter-json-LICENSE` |
| tree-sitter-markdown | 0.3.2 | https://github.com/tree-sitter-grammars/tree-sitter-markdown | `f582346e65479e1d6d025e9b785421f623eb549390c550899005fd6f7f37d739` | `licenses/tree-sitter-markdown-LICENSE` |
| tree-sitter-ruby | 0.23.1 | https://github.com/tree-sitter/tree-sitter-ruby | `1f0f0c100e31ddf650962ebb1f1fb8420bdbabccd49582f6e731ea7478db639d` | `licenses/tree-sitter-ruby-LICENSE` |
| tree-sitter-rust | 0.23.3 | https://github.com/tree-sitter/tree-sitter-rust | `5c1d96a9628875c7ba122da1a3aa0bf62b547b5a720673fa318336de27506c66` | `licenses/tree-sitter-rust-LICENSE` |

Except for Kotlin, the grammar archives are the corresponding npm release
tarballs. Kotlin is pinned to the exact upstream commit because the original
migration used a GitHub `main` snapshot; the retained source is byte-identical
to that commit. The Markdown package's block and inline grammars are both
retained; the core feeds block-tree `inline` ranges through the inline parser in
a second query pass.

## Local safety patch

The Swift 0.7.1 scanner is retained with one audited fix:

- `tree_sitter_swift_external_scanner_create` uses
  `calloc(1, sizeof(struct ScannerState))`. The release source used `calloc(0,
  ...)`, allocating a zero-length state that AddressSanitizer proved was read by
  `eat_raw_str_part`. The parser, queries, and all other scanner bytes remain
  from the recorded 0.7.1 archive.

## Retained file policy

Keep only:

- tree-sitter `lib/include` and `lib/src`, which are included by `lib.c`;
- each grammar's `parser.c`, external `scanner.c`, scanner-specific headers, and
  required `src/tree_sitter/*.h` headers;
- TypeScript's shared `common/scanner.h`;
- highlight query files consumed by `gen/gen-queries.mjs`;
- this manifest and the upstream license texts.

Do not retain grammar corpora, `grammar.json`, `node-types.json`, generator
JavaScript, tests, unused parser ABI variants, or unrelated query files.

## Refresh procedure

1. Fetch an authoritative release archive or exact commit.
2. Verify its checksum and record it above.
3. Replace only the retained files listed in the policy.
4. Preserve the upstream license text.
5. Run `pnpm run build:queries` and `pnpm run check:queries`.
6. Run clean C, Swift, Android, and React builds before updating this manifest.

## Highlight query composition

Composition order is broad to specific; identical ranges use the later query
pattern:

- `javascript` = JavaScript `highlights.scm` + `highlights-params.scm` + local
  `javascript-escapes.scm`
- `jsx` = JavaScript `highlights.scm` + `highlights-jsx.scm` +
  `highlights-params.scm` + local `javascript-escapes.scm`
- `typescript` = JavaScript `highlights.scm` + TypeScript `highlights.scm` +
  local `javascript-escapes.scm`
- `tsx` = JavaScript `highlights.scm` + `highlights-jsx.scm` + TypeScript
  `highlights.scm` + local `javascript-escapes.scm`
- `markdown` = upstream block `highlights.scm` + local `markdown.scm`, then the
  upstream inline `highlights.scm` over injected `inline` ranges
- all other languages use their own `highlights.scm`

The JavaScript parameter query is intentionally excluded from TypeScript and
TSX: those grammars wrap identifiers in required/optional parameter nodes and
their own query already covers them.

The local `queries/javascript-escapes.scm` overlay captures `escape_sequence`
as `string.escape` for all four JavaScript-family grammars. It is appended after
the upstream queries because those queries capture the enclosing strings but
not their escapes, and it lives outside `vendor/` to keep retained upstream
sources byte-identical.

The local `queries/markdown.scm` overlay colors complete heading nodes. The
upstream block query captures heading content as `text.title`; the core
normalizes that legacy name to `markup.heading` for cross-platform themes.
