import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(readFileSync(resolve(coreRoot, "fixtures/code-snippets.json"), "utf8"));
const goldenDir = resolve(coreRoot, "test/golden/token-stream");
const supportedLanguages = [
    "bash",
    "c",
    "css",
    "go",
    "html",
    "java",
    "javascript",
    "jsx",
    "json",
    "kotlin",
    "markdown",
    "python",
    "ruby",
    "rust",
    "swift",
    "tsx",
    "typescript"
];
const normalizedThemeScopes = [
    "comment",
    "keyword",
    "keyword.operator",
    "string",
    "string.escape",
    "string.regexp",
    "character",
    "number",
    "boolean",
    "constant",
    "constant.builtin",
    "function",
    "type",
    "constructor",
    "module",
    "variable",
    "variable.builtin",
    "property",
    "attribute",
    "label",
    "markup",
    "tag",
    "operator",
    "punctuation"
];

function goldenFor(fixture) {
    return JSON.parse(readFileSync(resolve(goldenDir, `${fixture.id}.json`), "utf8"));
}

test("visual corpus covers every supported language", () => {
    const fixtureIds = fixtures.map((fixture) => fixture.id);
    assert.equal(new Set(fixtureIds).size, fixtureIds.length, "fixture ids must be unique");

    const languages = new Set(fixtures.map((fixture) => fixture.language));
    assert.deepEqual(
        supportedLanguages.filter((language) => !languages.has(language)),
        []
    );
});

for (const fixture of fixtures) {
    test(`tree-sitter golden token stream shape: ${fixture.id}`, () => {
        const payload = goldenFor(fixture);
        assert.equal(payload.language, fixture.language);
        assert.ok(Array.isArray(payload.tokens));
        assert.equal(
            payload.tokens.map((token) => token.text).join(""),
            fixture.code,
            "token runs must preserve the source exactly"
        );
        for (const token of payload.tokens) {
            assert.equal(typeof token.text, "string");
            assert.equal(typeof token.scope, "string");
        }
    });
}

test("visual corpus exercises every normalized theme scope", () => {
    const scopes = fixtures.flatMap((fixture) =>
        goldenFor(fixture).tokens.map((token) => token.scope)
    );
    const missingScopes = normalizedThemeScopes.filter(
        (expected) =>
            !scopes.some((scope) => scope === expected || scope.startsWith(`${expected}.`))
    );
    assert.deepEqual(missingScopes, []);
    assert.ok(scopes.includes(""), "visual corpus must exercise the plain fallback");
});

test("golden token stream directory has no stale files", () => {
    const expected = fixtures.map((fixture) => `${fixture.id}.json`).sort();
    const actual = readdirSync(goldenDir)
        .filter((name) => name.endsWith(".json"))
        .sort();
    assert.deepEqual(actual, expected);
});
