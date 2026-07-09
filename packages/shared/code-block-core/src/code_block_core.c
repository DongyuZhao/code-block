#include "code_block_core.h"

#include <ctype.h>
#include <regex.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <tree_sitter/api.h>

#include "queries.h"

/* ---- Grammar entry points (vendored parsers) --------------------------- */

const TSLanguage *tree_sitter_typescript(void);
const TSLanguage *tree_sitter_tsx(void);
const TSLanguage *tree_sitter_javascript(void);
const TSLanguage *tree_sitter_python(void);
const TSLanguage *tree_sitter_kotlin(void);
const TSLanguage *tree_sitter_swift(void);
const TSLanguage *tree_sitter_bash(void);
const TSLanguage *tree_sitter_c(void);
const TSLanguage *tree_sitter_css(void);
const TSLanguage *tree_sitter_go(void);
const TSLanguage *tree_sitter_html(void);
const TSLanguage *tree_sitter_java(void);
const TSLanguage *tree_sitter_json(void);
const TSLanguage *tree_sitter_markdown(void);
const TSLanguage *tree_sitter_markdown_inline(void);
const TSLanguage *tree_sitter_ruby(void);
const TSLanguage *tree_sitter_rust(void);

/* Resolve a normalized language name to the parser used to parse it. Note that
 * jsx/tsx reuse the javascript/typescript parsers but carry their own query. */
static const TSLanguage *language_for_name(const char *name) {
    if (strcmp(name, "typescript") == 0) return tree_sitter_typescript();
    if (strcmp(name, "tsx") == 0) return tree_sitter_tsx();
    if (strcmp(name, "javascript") == 0) return tree_sitter_javascript();
    if (strcmp(name, "jsx") == 0) return tree_sitter_javascript();
    if (strcmp(name, "python") == 0) return tree_sitter_python();
    if (strcmp(name, "kotlin") == 0) return tree_sitter_kotlin();
    if (strcmp(name, "swift") == 0) return tree_sitter_swift();
    if (strcmp(name, "bash") == 0) return tree_sitter_bash();
    if (strcmp(name, "c") == 0) return tree_sitter_c();
    if (strcmp(name, "css") == 0) return tree_sitter_css();
    if (strcmp(name, "go") == 0) return tree_sitter_go();
    if (strcmp(name, "html") == 0) return tree_sitter_html();
    if (strcmp(name, "java") == 0) return tree_sitter_java();
    if (strcmp(name, "json") == 0) return tree_sitter_json();
    if (strcmp(name, "markdown") == 0) return tree_sitter_markdown();
    if (strcmp(name, "ruby") == 0) return tree_sitter_ruby();
    if (strcmp(name, "rust") == 0) return tree_sitter_rust();
    return NULL;
}

/* ---- Language normalization (ported from prism-code-core.ts) ------------ */

typedef struct {
    const char *alias;
    const char *canonical;
} LanguageAlias;

static const LanguageAlias language_aliases[] = {
    {"cjs", "javascript"}, {"h", "c"},        {"js", "javascript"},
    {"htm", "html"},       {"kt", "kotlin"},  {"kts", "kotlin"},
    {"markup", "html"},    {"md", "markdown"}, {"mjs", "javascript"},
    {"py", "python"},      {"rb", "ruby"},    {"rs", "rust"},
    {"sh", "bash"},        {"shell", "bash"}, {"ts", "typescript"},
    {"tsx", "tsx"},        {"xml", "html"},
};

static const char *safe_string(const char *value) {
    return value != NULL ? value : "";
}

/* Lowercase + trim into `out`; returns `out`. */
static const char *normalize_language(const char *language, char *out, size_t out_size) {
    const char *value = safe_string(language);
    while (*value != '\0' && isspace((unsigned char)*value)) {
        value++;
    }
    size_t length = strlen(value);
    while (length > 0 && isspace((unsigned char)value[length - 1])) {
        length--;
    }
    if (length >= out_size) {
        length = out_size - 1;
    }
    for (size_t i = 0; i < length; i++) {
        out[i] = (char)tolower((unsigned char)value[i]);
    }
    out[length] = '\0';

    if (out[0] == '\0' || strcmp(out, "text") == 0 || strcmp(out, "txt") == 0 ||
        strcmp(out, "none") == 0 || strcmp(out, "plain") == 0) {
        strcpy(out, "plain");
        return out;
    }
    for (size_t i = 0; i < sizeof(language_aliases) / sizeof(language_aliases[0]); i++) {
        if (strcmp(out, language_aliases[i].alias) == 0) {
            strncpy(out, language_aliases[i].canonical, out_size - 1);
            out[out_size - 1] = '\0';
            return out;
        }
    }
    return out;
}

/* ---- JSON buffer -------------------------------------------------------- */

typedef struct {
    char *data;
    size_t length;
    size_t capacity;
} JsonBuffer;

static bool json_reserve(JsonBuffer *buffer, size_t extra) {
    if (buffer->length + extra + 1 <= buffer->capacity) {
        return true;
    }
    size_t next_capacity = buffer->capacity == 0 ? 256 : buffer->capacity;
    while (next_capacity < buffer->length + extra + 1) {
        next_capacity *= 2;
    }
    char *next = (char *)realloc(buffer->data, next_capacity);
    if (next == NULL) {
        return false;
    }
    buffer->data = next;
    buffer->capacity = next_capacity;
    return true;
}

static bool json_append_bytes(JsonBuffer *buffer, const char *text, size_t length) {
    if (!json_reserve(buffer, length)) {
        return false;
    }
    memcpy(buffer->data + buffer->length, text, length);
    buffer->length += length;
    buffer->data[buffer->length] = '\0';
    return true;
}

static bool json_append(JsonBuffer *buffer, const char *text) {
    return json_append_bytes(buffer, text, strlen(text));
}

static bool json_append_escaped(JsonBuffer *buffer, const char *text, size_t length) {
    if (!json_append(buffer, "\"")) {
        return false;
    }
    for (size_t i = 0; i < length; i++) {
        unsigned char ch = (unsigned char)text[i];
        switch (ch) {
            case '"':
                if (!json_append(buffer, "\\\"")) return false;
                break;
            case '\\':
                if (!json_append(buffer, "\\\\")) return false;
                break;
            case '\n':
                if (!json_append(buffer, "\\n")) return false;
                break;
            case '\r':
                if (!json_append(buffer, "\\r")) return false;
                break;
            case '\t':
                if (!json_append(buffer, "\\t")) return false;
                break;
            default:
                if (ch < 0x20) {
                    char escaped[7];
                    snprintf(escaped, sizeof(escaped), "\\u%04x", ch);
                    if (!json_append(buffer, escaped)) return false;
                } else if (!json_append_bytes(buffer, (const char *)&text[i], 1)) {
                    return false;
                }
                break;
        }
    }
    return json_append(buffer, "\"");
}

static char *plain_json(const char *code, const char *language) {
    JsonBuffer buffer = {0};
    if (!json_append(&buffer, "{\"language\":") ||
        !json_append_escaped(&buffer, language, strlen(language)) ||
        !json_append(&buffer, ",\"tokens\":[")) {
        free(buffer.data);
        return NULL;
    }
    if (code[0] != '\0') {
        if (!json_append(&buffer, "{\"text\":") ||
            !json_append_escaped(&buffer, code, strlen(code)) ||
            !json_append(&buffer, ",\"scope\":\"\"}")) {
            free(buffer.data);
            return NULL;
        }
    }
    if (!json_append(&buffer, "]}")) {
        free(buffer.data);
        return NULL;
    }
    return buffer.data;
}

/* ---- Query predicate evaluation ---------------------------------------- */

/* Translate the small subset of PCRE escapes used by the vendored highlight
 * queries (\d \w \s) into POSIX ERE bracket classes, then match. Anything that
 * fails to compile is treated as a pass so a single odd pattern never silences
 * a whole language. */
static bool regex_matches(const char *pattern, const char *text, size_t text_len) {
    char translated[512];
    size_t out = 0;
    for (size_t i = 0; pattern[i] != '\0' && out + 12 < sizeof(translated); i++) {
        if (pattern[i] == '\\' && pattern[i + 1] != '\0') {
            char next = pattern[i + 1];
            const char *klass = NULL;
            if (next == 'd') klass = "[0-9]";
            else if (next == 'w') klass = "[A-Za-z0-9_]";
            else if (next == 's') klass = "[ \t\r\n\f\v]";
            if (klass != NULL) {
                size_t len = strlen(klass);
                memcpy(translated + out, klass, len);
                out += len;
                i++;
                continue;
            }
            translated[out++] = pattern[i];
            translated[out++] = next;
            i++;
            continue;
        }
        translated[out++] = pattern[i];
    }
    translated[out] = '\0';

    regex_t regex;
    if (regcomp(&regex, translated, REG_EXTENDED) != 0) {
        return true;
    }
    char *buffer = (char *)malloc(text_len + 1);
    if (buffer == NULL) {
        regfree(&regex);
        return true;
    }
    memcpy(buffer, text, text_len);
    buffer[text_len] = '\0';
    int rc = regexec(&regex, buffer, 0, NULL, 0);
    free(buffer);
    regfree(&regex);
    return rc == 0;
}

/* First node captured under `capture_index` in this match, if any. */
static bool capture_node(const TSQueryMatch *match, uint32_t capture_index, TSNode *out) {
    for (uint16_t i = 0; i < match->capture_count; i++) {
        if (match->captures[i].index == capture_index) {
            *out = match->captures[i].node;
            return true;
        }
    }
    return false;
}

static bool node_text_equals(const char *code, TSNode node, const char *value, size_t value_len) {
    uint32_t start = ts_node_start_byte(node);
    uint32_t end = ts_node_end_byte(node);
    return (end - start) == value_len && strncmp(code + start, value, value_len) == 0;
}

/* Evaluate every `#...?` predicate on this pattern; the whole match is dropped
 * if any fails. Unsupported predicates (e.g. #is-not? local) pass through. */
static bool match_passes_predicates(
    const TSQuery *query,
    const TSQueryMatch *match,
    const char *code
) {
    uint32_t step_count = 0;
    const TSQueryPredicateStep *steps =
        ts_query_predicates_for_pattern(query, match->pattern_index, &step_count);
    if (step_count == 0) {
        return true;
    }

    uint32_t i = 0;
    while (i < step_count) {
        /* steps[i] is the operator name; args follow until a Done step. */
        if (steps[i].type != TSQueryPredicateStepTypeString) {
            i++;
            continue;
        }
        uint32_t op_len = 0;
        const char *op = ts_query_string_value_for_id(query, steps[i].value_id, &op_len);

        /* Gather this predicate's argument steps. */
        const TSQueryPredicateStep *args = &steps[i + 1];
        uint32_t arg_count = 0;
        while (i + 1 + arg_count < step_count &&
               args[arg_count].type != TSQueryPredicateStepTypeDone) {
            arg_count++;
        }

        bool negate = strncmp(op, "not-", 4) == 0;
        const char *base = negate ? op + 4 : op;

        bool handled = false;
        bool result = true;

        if ((strcmp(base, "eq?") == 0 || strcmp(base, "match?") == 0 ||
             strcmp(base, "any-of?") == 0) &&
            arg_count >= 1 && args[0].type == TSQueryPredicateStepTypeCapture) {
            TSNode node;
            if (capture_node(match, args[0].value_id, &node)) {
                uint32_t s = ts_node_start_byte(node);
                uint32_t e = ts_node_end_byte(node);
                const char *node_text = code + s;
                size_t node_len = e - s;

                if (strcmp(base, "match?") == 0 && arg_count >= 2 &&
                    args[1].type == TSQueryPredicateStepTypeString) {
                    uint32_t plen = 0;
                    const char *pat =
                        ts_query_string_value_for_id(query, args[1].value_id, &plen);
                    result = regex_matches(pat, node_text, node_len);
                    handled = true;
                } else if (strcmp(base, "eq?") == 0 && arg_count >= 2) {
                    if (args[1].type == TSQueryPredicateStepTypeString) {
                        uint32_t vlen = 0;
                        const char *val =
                            ts_query_string_value_for_id(query, args[1].value_id, &vlen);
                        result = node_text_equals(code, node, val, vlen);
                    } else {
                        TSNode other;
                        result = capture_node(match, args[1].value_id, &other) &&
                                 node_text_equals(code, node, code + ts_node_start_byte(other),
                                                  ts_node_end_byte(other) -
                                                      ts_node_start_byte(other));
                    }
                    handled = true;
                } else if (strcmp(base, "any-of?") == 0) {
                    result = false;
                    for (uint32_t a = 1; a < arg_count; a++) {
                        if (args[a].type != TSQueryPredicateStepTypeString) continue;
                        uint32_t vlen = 0;
                        const char *val =
                            ts_query_string_value_for_id(query, args[a].value_id, &vlen);
                        if (node_text_equals(code, node, val, vlen)) {
                            result = true;
                            break;
                        }
                    }
                    handled = true;
                }
            }
        }

        if (handled) {
            if (negate) result = !result;
            if (!result) {
                return false;
            }
        }

        /* Advance past args + the Done step. */
        i += 1 + arg_count + 1;
    }
    return true;
}

/* ---- Capture scope normalization ---------------------------------------- */

/* Captures that carry editor metadata (spellchecking regions), not colors. */
static bool scope_is_metadata(const char *name, size_t length) {
    return (length == 5 && strncmp(name, "spell", 5) == 0) ||
           (length == 7 && strncmp(name, "nospell", 7) == 0);
}

typedef struct {
    const char *legacy;
    const char *modern;
} ScopeAlias;

/* The vendored queries mix modern capture names with legacy nvim-treesitter
 * (pre-0.10) ones. Normalize to the modern hierarchy so themes only need the
 * standard base families; dotted specializations inherit via the scope walk. */
static const ScopeAlias scope_aliases[] = {
    {"conditional", "keyword.conditional"},
    {"delimiter", "punctuation.delimiter"},
    {"embedded", "markup.embedded"},
    {"escape", "string.escape"},
    {"exception", "keyword.exception"},
    {"float", "number.float"},
    {"include", "keyword.import"},
    {"namespace", "module"},
    {"parameter", "variable.parameter"},
    {"repeat", "keyword.repeat"},
    {"string.regex", "string.regexp"},
    {"text.literal", "markup.raw"},
    {"text.emphasis", "markup.emphasis"},
    {"text.reference", "markup.link.label"},
    {"text.strong", "markup.strong"},
    {"text.title", "markup.heading"},
    {"text.uri", "markup.link.url"},
};

static void normalize_scope(char *scope) {
    for (size_t i = 0; i < sizeof(scope_aliases) / sizeof(scope_aliases[0]); i++) {
        if (strcmp(scope, scope_aliases[i].legacy) == 0) {
            strcpy(scope, scope_aliases[i].modern);
            return;
        }
    }
}

/* ---- Highlight flatten -------------------------------------------------- */

typedef struct {
    uint32_t start;
    uint32_t end;
    uint32_t priority; /* query pass + pattern index; later patterns win ties */
    char scope[64];
} CaptureSpan;

typedef enum {
    CAPTURE_END,
    CAPTURE_START,
} CaptureEventKind;

typedef struct {
    uint32_t offset;
    CaptureEventKind kind;
    size_t span_index;
} CaptureEvent;

static int compare_capture_events(const void *left, const void *right) {
    const CaptureEvent *left_event = (const CaptureEvent *)left;
    const CaptureEvent *right_event = (const CaptureEvent *)right;
    if (left_event->offset != right_event->offset) {
        return (left_event->offset > right_event->offset) -
               (left_event->offset < right_event->offset);
    }
    if (left_event->kind != right_event->kind) {
        return (left_event->kind > right_event->kind) -
               (left_event->kind < right_event->kind);
    }
    return (left_event->span_index > right_event->span_index) -
           (left_event->span_index < right_event->span_index);
}

/* Innermost span wins; identical ranges break the tie by pattern priority. */
static bool span_index_is_better(
    const CaptureSpan *spans,
    size_t candidate_index,
    size_t best_index
) {
    const CaptureSpan *candidate = &spans[candidate_index];
    const CaptureSpan *best = &spans[best_index];
    if (candidate->start != best->start) {
        return candidate->start > best->start;
    }
    if (candidate->end != best->end) {
        return candidate->end < best->end;
    }
    if (candidate->priority != best->priority) {
        return candidate->priority > best->priority;
    }
    /* The old linear scan replaced the winner on a complete tie, so the later
     * capture retains deterministic precedence. */
    return candidate_index > best_index;
}

static void heap_push(
    size_t *heap,
    size_t *heap_count,
    const CaptureSpan *spans,
    size_t span_index
) {
    size_t child = (*heap_count)++;
    heap[child] = span_index;
    while (child > 0) {
        size_t parent = (child - 1) / 2;
        if (!span_index_is_better(spans, heap[child], heap[parent])) {
            break;
        }
        size_t temporary = heap[parent];
        heap[parent] = heap[child];
        heap[child] = temporary;
        child = parent;
    }
}

static void heap_pop(size_t *heap, size_t *heap_count, const CaptureSpan *spans) {
    (*heap_count)--;
    if (*heap_count == 0) {
        return;
    }
    heap[0] = heap[*heap_count];
    size_t parent = 0;
    while (true) {
        size_t left = parent * 2 + 1;
        if (left >= *heap_count) {
            break;
        }
        size_t right = left + 1;
        size_t better_child = left;
        if (right < *heap_count &&
            span_index_is_better(spans, heap[right], heap[left])) {
            better_child = right;
        }
        if (!span_index_is_better(spans, heap[better_child], heap[parent])) {
            break;
        }
        size_t temporary = heap[parent];
        heap[parent] = heap[better_child];
        heap[better_child] = temporary;
        parent = better_child;
    }
}

static void heap_discard_inactive(
    size_t *heap,
    size_t *heap_count,
    const CaptureSpan *spans,
    const bool *active
) {
    while (*heap_count > 0 && !active[heap[0]]) {
        heap_pop(heap, heap_count, spans);
    }
}

static bool append_token(
    JsonBuffer *buffer,
    bool *has_token,
    const char *text,
    uint32_t start,
    uint32_t end,
    const char *scope
) {
    if (start == end) {
        return true;
    }
    if (*has_token && !json_append(buffer, ",")) {
        return false;
    }
    *has_token = true;
    return json_append(buffer, "{\"text\":") &&
           json_append_escaped(buffer, text + start, end - start) &&
           json_append(buffer, ",\"scope\":") &&
           json_append_escaped(buffer, scope, strlen(scope)) &&
           json_append(buffer, "}");
}

static bool collect_query_spans(
    const char *debug_name,
    const TSLanguage *language,
    TSTree *tree,
    const char *query_source,
    const char *code,
    uint32_t code_length,
    uint32_t priority_offset,
    CaptureSpan **spans,
    size_t *span_count,
    size_t *span_capacity
) {
    uint32_t error_offset = 0;
    TSQueryError error_type = TSQueryErrorNone;
    TSQuery *query = ts_query_new(
        language, query_source, (uint32_t)strlen(query_source), &error_offset, &error_type);
    if (query == NULL) {
        if (getenv("CB_DEBUG") != NULL) {
            fprintf(stderr, "cb: query compile failed for %s: type=%d offset=%u near \"%.40s\"\n",
                    debug_name, (int)error_type, error_offset, query_source + error_offset);
        }
        return false;
    }

    TSQueryCursor *cursor = ts_query_cursor_new();
    if (cursor == NULL) {
        ts_query_delete(query);
        return false;
    }
    ts_query_cursor_exec(cursor, query, ts_tree_root_node(tree));

    bool ok = true;
    TSQueryMatch match;
    while (ok && ts_query_cursor_next_match(cursor, &match)) {
        if (!match_passes_predicates(query, &match, code)) {
            continue;
        }
        for (uint16_t i = 0; i < match.capture_count; i++) {
            TSQueryCapture capture = match.captures[i];
            TSNode node = capture.node;
            uint32_t start = ts_node_start_byte(node);
            uint32_t end = ts_node_end_byte(node);
            if (start >= end || end > code_length) {
                continue;
            }
            uint32_t name_length = 0;
            const char *scope_name =
                ts_query_capture_name_for_id(query, capture.index, &name_length);
            if (name_length == 0 || scope_name[0] == '_' ||
                scope_is_metadata(scope_name, name_length)) {
                continue;
            }
            if (*span_count == *span_capacity) {
                size_t next_capacity = *span_capacity * 2;
                CaptureSpan *next =
                    (CaptureSpan *)realloc(*spans, next_capacity * sizeof(CaptureSpan));
                if (next == NULL) {
                    ok = false;
                    break;
                }
                *spans = next;
                *span_capacity = next_capacity;
            }
            size_t copy_length = name_length < sizeof((*spans)[0].scope) - 1
                                     ? name_length
                                     : sizeof((*spans)[0].scope) - 1;
            CaptureSpan *span = &(*spans)[(*span_count)++];
            span->start = start;
            span->end = end;
            span->priority = priority_offset + match.pattern_index;
            memcpy(span->scope, scope_name, copy_length);
            span->scope[copy_length] = '\0';
            normalize_scope(span->scope);
        }
    }

    ts_query_cursor_delete(cursor);
    ts_query_delete(query);
    return ok;
}

static bool parse_markdown_inline_tree(
    const char *code,
    uint32_t code_length,
    TSTree *block_tree,
    TSTree **inline_tree
) {
    static const char *range_query_source = "(inline) @content";
    *inline_tree = NULL;

    uint32_t error_offset = 0;
    TSQueryError error_type = TSQueryErrorNone;
    TSQuery *range_query = ts_query_new(
        tree_sitter_markdown(), range_query_source, (uint32_t)strlen(range_query_source),
        &error_offset, &error_type);
    if (range_query == NULL) {
        return false;
    }
    TSQueryCursor *cursor = ts_query_cursor_new();
    if (cursor == NULL) {
        ts_query_delete(range_query);
        return false;
    }
    ts_query_cursor_exec(cursor, range_query, ts_tree_root_node(block_tree));

    size_t range_capacity = 8;
    size_t range_count = 0;
    TSRange *ranges = (TSRange *)calloc(range_capacity, sizeof(TSRange));
    bool ok = ranges != NULL;
    TSQueryMatch match;
    while (ok && ts_query_cursor_next_match(cursor, &match)) {
        for (uint16_t i = 0; i < match.capture_count; i++) {
            TSNode node = match.captures[i].node;
            uint32_t start = ts_node_start_byte(node);
            uint32_t end = ts_node_end_byte(node);
            if (start >= end || end > code_length) {
                continue;
            }
            if (range_count == range_capacity) {
                range_capacity *= 2;
                TSRange *next = (TSRange *)realloc(ranges, range_capacity * sizeof(TSRange));
                if (next == NULL) {
                    ok = false;
                    break;
                }
                ranges = next;
            }
            ranges[range_count++] = (TSRange){
                .start_point = ts_node_start_point(node),
                .end_point = ts_node_end_point(node),
                .start_byte = start,
                .end_byte = end,
            };
        }
    }

    ts_query_cursor_delete(cursor);
    ts_query_delete(range_query);
    if (!ok || range_count == 0) {
        free(ranges);
        return ok;
    }

    TSParser *parser = ts_parser_new();
    ok = parser != NULL && ts_parser_set_language(parser, tree_sitter_markdown_inline()) &&
         ts_parser_set_included_ranges(parser, ranges, (uint32_t)range_count);
    if (ok) {
        *inline_tree = ts_parser_parse_string(parser, NULL, code, code_length);
        ok = *inline_tree != NULL;
    }
    if (parser != NULL) {
        ts_parser_delete(parser);
    }
    free(ranges);
    return ok;
}

static char *highlight(const char *code, const char *name) {
    const TSLanguage *language = language_for_name(name);
    const char *query_source = cb_query_source(name);
    if (language == NULL || query_source == NULL) {
        return plain_json(code, "plain");
    }

    uint32_t code_length = (uint32_t)strlen(code);
    TSParser *parser = ts_parser_new();
    if (parser == NULL || !ts_parser_set_language(parser, language)) {
        if (parser != NULL) ts_parser_delete(parser);
        return plain_json(code, name);
    }

    TSTree *tree = ts_parser_parse_string(parser, NULL, code, code_length);
    if (tree == NULL) {
        ts_parser_delete(parser);
        return plain_json(code, name);
    }

    size_t span_capacity = 64;
    size_t span_count = 0;
    CaptureSpan *spans = (CaptureSpan *)calloc(span_capacity, sizeof(CaptureSpan));
    if (spans == NULL) {
        ts_tree_delete(tree);
        ts_parser_delete(parser);
        return NULL;
    }

    bool collected = collect_query_spans(
        name, language, tree, query_source, code, code_length, 0,
        &spans, &span_count, &span_capacity);
    if (collected && strcmp(name, "markdown") == 0) {
        TSTree *inline_tree = NULL;
        collected = parse_markdown_inline_tree(code, code_length, tree, &inline_tree);
        if (collected && inline_tree != NULL) {
            collected = collect_query_spans(
                "markdown_inline", tree_sitter_markdown_inline(), inline_tree,
                cb_query_markdown_inline, code, code_length, UINT32_C(1) << 30,
                &spans, &span_count, &span_capacity);
            ts_tree_delete(inline_tree);
        }
    }
    if (!collected) {
        free(spans);
        ts_tree_delete(tree);
        ts_parser_delete(parser);
        return plain_json(code, name);
    }

    size_t event_count = span_count * 2;
    CaptureEvent *events =
        (CaptureEvent *)calloc(event_count > 0 ? event_count : 1, sizeof(CaptureEvent));
    bool *active = (bool *)calloc(span_count > 0 ? span_count : 1, sizeof(bool));
    size_t *heap = (size_t *)calloc(span_count > 0 ? span_count : 1, sizeof(size_t));
    if (events == NULL || active == NULL || heap == NULL) {
        free(heap);
        free(active);
        free(events);
        free(spans);
        ts_tree_delete(tree);
        ts_parser_delete(parser);
        return NULL;
    }
    for (size_t i = 0; i < span_count; i++) {
        events[i * 2] = (CaptureEvent){
            .offset = spans[i].start,
            .kind = CAPTURE_START,
            .span_index = i,
        };
        events[i * 2 + 1] = (CaptureEvent){
            .offset = spans[i].end,
            .kind = CAPTURE_END,
            .span_index = i,
        };
    }
    qsort(events, event_count, sizeof(CaptureEvent), compare_capture_events);

    JsonBuffer buffer = {0};
    bool ok = json_append(&buffer, "{\"language\":") &&
              json_append_escaped(&buffer, name, strlen(name)) &&
              json_append(&buffer, ",\"tokens\":[");
    bool has_token = false;
    uint32_t run_start = 0;
    uint32_t run_end = 0;
    const char *run_scope = NULL;
    size_t heap_count = 0;
    size_t event_index = 0;
    uint32_t previous_offset = 0;

    while (ok && event_index < event_count) {
        uint32_t offset = events[event_index].offset;
        if (previous_offset < offset) {
            heap_discard_inactive(heap, &heap_count, spans, active);
            const char *scope = heap_count > 0 ? spans[heap[0]].scope : "";
            if (run_scope != NULL && strcmp(run_scope, scope) == 0 && run_end == previous_offset) {
                run_end = offset;
            } else {
                if (run_scope != NULL) {
                    ok = append_token(&buffer, &has_token, code, run_start, run_end, run_scope);
                }
                run_start = previous_offset;
                run_end = offset;
                run_scope = scope;
            }
        }

        while (event_index < event_count && events[event_index].offset == offset) {
            CaptureEvent event = events[event_index++];
            if (event.kind == CAPTURE_END) {
                active[event.span_index] = false;
            } else {
                active[event.span_index] = true;
                heap_push(heap, &heap_count, spans, event.span_index);
            }
        }
        heap_discard_inactive(heap, &heap_count, spans, active);
        previous_offset = offset;
    }

    if (ok && previous_offset < code_length) {
        const char *scope = heap_count > 0 ? spans[heap[0]].scope : "";
        if (run_scope != NULL && strcmp(run_scope, scope) == 0 && run_end == previous_offset) {
            run_end = code_length;
        } else {
            if (run_scope != NULL) {
                ok = append_token(&buffer, &has_token, code, run_start, run_end, run_scope);
            }
            run_start = previous_offset;
            run_end = code_length;
            run_scope = scope;
        }
    }
    if (ok && run_scope != NULL) {
        ok = append_token(&buffer, &has_token, code, run_start, run_end, run_scope);
    }
    if (ok) {
        ok = json_append(&buffer, "]}");
    }

    free(heap);
    free(active);
    free(events);
    free(spans);
    ts_tree_delete(tree);
    ts_parser_delete(parser);

    if (!ok) {
        free(buffer.data);
        return NULL;
    }
    return buffer.data;
}

/* ---- Public ABI --------------------------------------------------------- */

char *cb_tokenize_json(const char *code, const char *language, const char *fallback_language) {
    const char *source = safe_string(code);

    char requested[64];
    char fallback[64];
    const char *primary = safe_string(language);
    if (primary[0] == '\0') {
        primary = fallback_language;
    }
    normalize_language(primary, requested, sizeof(requested));
    normalize_language(fallback_language, fallback, sizeof(fallback));

    if (language_for_name(requested) != NULL) {
        return highlight(source, requested);
    }
    if (language_for_name(fallback) != NULL) {
        return highlight(source, fallback);
    }
    return plain_json(source, "plain");
}

void cb_string_free(char *value) {
    free(value);
}
