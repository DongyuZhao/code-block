/* Fixture-driven assertions over the core tokenizer. Each case tokenizes a
 * snippet and checks that specific {text,scope} runs appear in the JSON. These
 * are snapshots of real tree-sitter output (NOT the deprecated Prism stream):
 * the point is that named types and parameters get real scopes instead of the
 * gray `plain` Prism produced. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "code_block_core.h"

static int failures = 0;
static int checks = 0;

static void expect_contains(const char *label, const char *json, const char *needle) {
    checks++;
    if (strstr(json, needle) == NULL) {
        failures++;
        fprintf(stderr, "FAIL [%s]: missing %s\n  in: %s\n", label, needle, json);
    }
}

static void expect_absent(const char *label, const char *json, const char *needle) {
    checks++;
    if (strstr(json, needle) != NULL) {
        failures++;
        fprintf(stderr, "FAIL [%s]: unexpected %s\n  in: %s\n", label, needle, json);
    }
}

static char *tok(const char *code, const char *language, const char *fallback) {
    char *json = cb_tokenize_json(code, language, fallback);
    if (json == NULL) {
        fprintf(stderr, "FATAL: cb_tokenize_json returned NULL\n");
        exit(1);
    }
    return json;
}

static char *javascript_fixture(size_t line_count) {
    const size_t bytes_per_line = 48;
    char *source = (char *)malloc(line_count * bytes_per_line + 1);
    if (source == NULL) {
        fprintf(stderr, "FATAL: could not allocate scaling fixture\n");
        exit(1);
    }

    size_t offset = 0;
    for (size_t i = 0; i < line_count; i++) {
        int written = snprintf(
            source + offset,
            line_count * bytes_per_line + 1 - offset,
            "const value%zu = call(arg%zu);\n",
            i,
            i
        );
        if (written < 0) {
            free(source);
            fprintf(stderr, "FATAL: could not generate scaling fixture\n");
            exit(1);
        }
        offset += (size_t)written;
    }
    return source;
}

static double tokenize_seconds(size_t line_count) {
    char *source = javascript_fixture(line_count);
    clock_t started = clock();
    char *json = tok(source, "javascript", "");
    clock_t finished = clock();
    cb_string_free(json);
    free(source);
    return (double)(finished - started) / CLOCKS_PER_SEC;
}

static void expect_near_linear_scaling(void) {
    const size_t small_lines = 1000;
    const size_t large_lines = 4000;
    double small_seconds = tokenize_seconds(small_lines);
    double large_seconds = tokenize_seconds(large_lines);
    double ratio = large_seconds / (small_seconds > 0.000001 ? small_seconds : 0.000001);

    checks++;
    if (ratio >= 8.0) {
        failures++;
        fprintf(
            stderr,
            "FAIL [scaling]: %zu lines %.3fs, %zu lines %.3fs, ratio %.2f (expected < 8)\n",
            small_lines,
            small_seconds,
            large_lines,
            large_seconds,
            ratio
        );
    }
}

int main(void) {
    char *json;

    /* TypeScript: the original bug. Named type + generic + parameter must all
     * get real scopes rather than being forced to plain. */
    json = tok("type Result<T> = { ok: true; value: T };\n\n"
               "export function unwrap<T>(result: Result<T>): T {\n"
               "  return result.value;\n}",
               "typescript", "");
    expect_contains("ts.language", json, "\"language\":\"typescript\"");
    expect_contains("ts.type", json, "\"text\":\"Result\",\"scope\":\"type\"");
    expect_contains("ts.param", json, "\"text\":\"result\",\"scope\":\"variable.parameter\"");
    expect_contains("ts.generic", json, "\"text\":\"T\",\"scope\":\"type\"");
    expect_contains("ts.keyword", json, "\"text\":\"export\",\"scope\":\"keyword\"");
    free(json);

    /* JavaScript: parameter + function name. */
    json = tok("const answer = 42;\nfunction greet(name) {\n  return name;\n}", "javascript", "");
    expect_contains("js.language", json, "\"language\":\"javascript\"");
    expect_contains("js.param", json, "\"text\":\"name\",\"scope\":\"variable.parameter\"");
    expect_contains("js.func", json, "\"text\":\"greet\",\"scope\":\"function\"");
    expect_contains("js.number", json, "\"text\":\"42\",\"scope\":\"number\"");
    free(json);

    /* The local escape overlay is appended to every JavaScript-family query. */
    const char *escape_languages[] = {"javascript", "jsx", "typescript", "tsx"};
    const char *escape_checks[] = {"js.escape", "jsx.escape", "ts.escape", "tsx.escape"};
    for (size_t i = 0; i < sizeof(escape_languages) / sizeof(escape_languages[0]); i++) {
        json = tok("const text = \"line\\n\";", escape_languages[i], "");
        expect_contains(
            escape_checks[i], json, "\"text\":\"\\\\n\",\"scope\":\"string.escape\""
        );
        free(json);
    }

    /* Kotlin: parameter + builtin type. Legacy nvim capture names must be
     * normalized to the modern hierarchy (parameter -> variable.parameter,
     * conditional -> keyword.conditional, ...). */
    json = tok("@Composable\nfun Greeting(name: String) {\n    Text(\"Hello, $name\")\n}", "kotlin", "");
    expect_contains("kt.language", json, "\"language\":\"kotlin\"");
    expect_contains("kt.param", json, "\"text\":\"name\",\"scope\":\"variable.parameter\"");
    expect_contains("kt.type", json, "\"text\":\"String\",\"scope\":\"type.builtin\"");
    expect_contains("kt.keyword", json, "\"text\":\"fun\",\"scope\":\"keyword.function\"");
    expect_contains("kt.annotation", json, "\"text\":\"@Composable\",\"scope\":\"attribute\"");
    expect_contains("kt.interp", json, "\"text\":\"$\",\"scope\":\"punctuation.special\"");
    expect_contains("kt.interp.none", json, "\"text\":\"name\",\"scope\":\"none\"");
    free(json);

    /* Kotlin control-flow keywords arrive under keyword.* after scope
     * normalization so themes color them via the keyword family. */
    json = tok("import a.b\nfun f(x: Boolean) {\n    if (x) return else throw Error()\n    val d = 1.5f\n}",
               "kotlin", "");
    expect_contains("kt.conditional", json, "\"text\":\"if\",\"scope\":\"keyword.conditional\"");
    expect_contains("kt.exception", json, "\"text\":\"throw\",\"scope\":\"keyword.exception\"");
    expect_contains("kt.include", json, "\"text\":\"import\",\"scope\":\"keyword.import\"");
    expect_contains("kt.float", json, "\"text\":\"1.5f\",\"scope\":\"number.float\"");
    free(json);

    json = tok("package demo.app\nfun scan(items: List<String>) {\n"
               "loop@ for (item in items) {\n"
               "if (item.matches(Regex(\"\\\\d+\"))) break@loop\n"
               "}\n}",
               "kotlin", "");
    expect_contains("kt.namespace", json, "\"scope\":\"module\"");
    expect_contains("kt.repeat", json, "\"text\":\"for\",\"scope\":\"keyword.repeat\"");
    expect_contains("kt.regex", json, "\"scope\":\"string.regexp\"");
    free(json);

    /* Python: keyword + annotated type. */
    json = tok("def greet(name: str) -> str:\n    return \"line\\n\"", "python", "");
    expect_contains("py.language", json, "\"language\":\"python\"");
    expect_contains("py.keyword", json, "\"text\":\"def\",\"scope\":\"keyword\"");
    expect_contains("py.type", json, "\"text\":\"str\",\"scope\":\"type\"");
    expect_contains("py.func", json, "\"text\":\"greet\",\"scope\":\"function\"");
    expect_contains("py.escape", json, "\"text\":\"\\\\n\",\"scope\":\"string.escape\"");
    free(json);

    /* Swift: parameter + type. Comments are captured as both @comment and
     * @spell upstream; the metadata capture must not shadow the color. */
    json = tok("// docs\nfunc greet(name: String) -> String {\n    return \"hi \\(name)\"\n}", "swift", "");
    expect_contains("swift.language", json, "\"language\":\"swift\"");
    expect_contains("swift.param", json, "\"text\":\"name\",\"scope\":\"variable.parameter\"");
    expect_contains("swift.type", json, "\"text\":\"String\",\"scope\":\"type\"");
    expect_contains("swift.comment", json, "\"text\":\"// docs\",\"scope\":\"comment\"");
    expect_contains("swift.interp", json, "\"text\":\"\\\\(\",\"scope\":\"punctuation.special\"");
    free(json);

    /* Common languages retained by the former Prism bundle plus C and
     * Markdown, whose aliases existed before their parsers were registered. */
    json = tok("echo \"$HOME\"", "bash", "");
    expect_contains("bash.language", json, "\"language\":\"bash\"");
    expect_contains("bash.function", json, "\"text\":\"echo\",\"scope\":\"function\"");
    expect_contains("bash.variable", json, "\"text\":\"HOME\",\"scope\":\"property\"");
    free(json);

    json = tok("int main(void) { return 0; }", "c", "");
    expect_contains("c.language", json, "\"language\":\"c\"");
    expect_contains("c.function", json, "\"text\":\"main\",\"scope\":\"function\"");
    free(json);

    json = tok(".button { color: red; }", "css", "");
    expect_contains("css.language", json, "\"language\":\"css\"");
    expect_contains("css.property", json, "\"text\":\"color\",\"scope\":\"property\"");
    free(json);

    json = tok("package main\nfunc greet(name string) string { return name }", "go", "");
    expect_contains("go.language", json, "\"language\":\"go\"");
    expect_contains("go.keyword", json, "\"text\":\"func\",\"scope\":\"keyword\"");
    expect_contains("go.type", json, "\"text\":\"string\",\"scope\":\"type\"");
    free(json);

    json = tok("<main class=\"app\">Hello</main>", "html", "");
    expect_contains("html.language", json, "\"language\":\"html\"");
    expect_contains("html.tag", json, "\"text\":\"main\",\"scope\":\"tag\"");
    expect_contains("html.attribute", json, "\"text\":\"class\",\"scope\":\"attribute\"");
    free(json);

    json = tok("record User(String name) {}", "java", "");
    expect_contains("java.language", json, "\"language\":\"java\"");
    expect_contains("java.keyword", json, "\"text\":\"record\",\"scope\":\"keyword\"");
    expect_contains("java.type", json, "\"text\":\"String\",\"scope\":\"type\"");
    free(json);

    json = tok("{\"enabled\":true}", "json", "");
    expect_contains("json.language", json, "\"language\":\"json\"");
    expect_contains("json.string", json, "\"text\":\"\\\"enabled\\\"\",\"scope\":\"string\"");
    expect_contains("json.boolean", json, "\"text\":\"true\",\"scope\":\"constant.builtin\"");
    free(json);

    json = tok("# Hello\n\nUse *emphasis*, **strong**, `code`, and [docs](https://example.com).\n",
               "markdown", "");
    expect_contains("markdown.language", json, "\"language\":\"markdown\"");
    expect_contains("markdown.heading", json, "\"text\":\"#\",\"scope\":\"punctuation.special\"");
    expect_contains("markdown.title", json, "\"text\":\" Hello\\n\",\"scope\":\"markup.heading\"");
    expect_contains("markdown.emphasis", json, "\"text\":\"emphasis\",\"scope\":\"markup.emphasis\"");
    expect_contains("markdown.strong", json, "\"text\":\"strong\",\"scope\":\"markup.strong\"");
    expect_contains("markdown.code", json, "\"text\":\"code\",\"scope\":\"markup.raw\"");
    expect_contains("markdown.link", json, "\"text\":\"docs\",\"scope\":\"markup.link.label\"");
    expect_contains("markdown.url", json, "\"text\":\"https://example.com\",\"scope\":\"markup.link.url\"");
    free(json);

    json = tok("```\n**literal**\n```\n", "markdown", "");
    expect_contains("markdown.fence", json, "\"text\":\"**literal**\\n\",\"scope\":\"none\"");
    expect_absent("markdown.fence.strong", json, "markup.strong");
    free(json);

    json = tok("def greet(name)\n  name\nend", "ruby", "");
    expect_contains("ruby.language", json, "\"language\":\"ruby\"");
    expect_contains("ruby.function", json, "\"text\":\"greet\",\"scope\":\"function.method\"");
    expect_contains("ruby.param", json, "\"text\":\"name\",\"scope\":\"variable.parameter\"");
    free(json);

    json = tok("fn greet(name: &str) -> String { name.into() }", "rust", "");
    expect_contains("rust.language", json, "\"language\":\"rust\"");
    expect_contains("rust.function", json, "\"text\":\"greet\",\"scope\":\"function\"");
    expect_contains("rust.type", json, "\"text\":\"str\",\"scope\":\"type.builtin\"");
    free(json);

    const char *common_aliases[] = {"h", "md", "rb", "sh", "markup"};
    const char *canonical_languages[] = {"c", "markdown", "ruby", "bash", "html"};
    for (size_t i = 0; i < sizeof(common_aliases) / sizeof(common_aliases[0]); i++) {
        json = tok("sample", common_aliases[i], "");
        char expected[64];
        snprintf(expected, sizeof(expected), "\"language\":\"%s\"", canonical_languages[i]);
        expect_contains("common.alias", json, expected);
        free(json);
    }

    /* tsx/jsx parse without collapsing to a single plain token. */
    json = tok("const App = () => <Box>{name}</Box>;", "tsx", "");
    expect_contains("tsx.language", json, "\"language\":\"tsx\"");
    expect_contains("tsx.keyword", json, "\"text\":\"const\",\"scope\":\"keyword\"");
    free(json);

    /* Alias: ts -> typescript. */
    json = tok("const x = 1;", "ts", "");
    expect_contains("alias.ts", json, "\"language\":\"typescript\"");
    free(json);

    /* Empty language falls back to the fallback language. */
    json = tok("const x = 1;", "", "javascript");
    expect_contains("fallback", json, "\"language\":\"javascript\"");
    free(json);

    /* Unknown language degrades to a single plain token. */
    json = tok("hello world", "made-up-lang", "");
    expect_contains("plain.language", json, "\"language\":\"plain\"");
    expect_contains("plain.token", json, "\"text\":\"hello world\",\"scope\":\"\"");
    free(json);

    /* text/txt/none normalize to plain. */
    json = tok("plain content", "text", "");
    expect_contains("text.plain", json, "\"language\":\"plain\"");
    free(json);

    /* Empty code yields an empty token list, not a phantom token. */
    json = tok("", "typescript", "");
    expect_contains("empty.language", json, "\"language\":\"typescript\"");
    expect_absent("empty.tokens", json, "\"text\"");
    free(json);

    /* Four times more input must not approach the 16x growth of the old
     * boundary-by-span O(n^2) flattener. This ratio is deliberately generous
     * so it remains a complexity guard rather than a machine-speed benchmark. */
    expect_near_linear_scaling();

    printf("%d checks, %d failures\n", checks, failures);
    return failures == 0 ? 0 : 1;
}
