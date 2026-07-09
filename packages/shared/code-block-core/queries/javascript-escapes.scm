; Local overlay (not vendored). Upstream tree-sitter-javascript's highlight
; query captures strings and template strings but not the escape sequences
; inside them; Kotlin/Python/Swift all do. Appended after the base query for
; javascript, jsx, typescript, and tsx (see gen/gen-queries.mjs).

(escape_sequence) @string.escape
