import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const bundlePath = join(repoRoot, "packages/prism-code-core/generated/prism-code.js");

function createBridge() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(readFileSync(bundlePath, "utf8"), sandbox, {
    filename: "prism-code.js"
  });
  return sandbox.CodeBlockPrism;
}

test("native Prism bundle installs CodeBlockPrism.tokenizeJSON", () => {
  const bridge = createBridge();

  assert.equal(typeof bridge.tokenizeJSON, "function");
});

test("tokenizeJSON returns a flattened Prism token stream", () => {
  const payload = JSON.parse(
    createBridge().tokenizeJSON("const answer = 42;", { language: "javascript" })
  );

  assert.equal(payload.ok, true);
  assert.equal(payload.language, "javascript");
  assert.equal(payload.grammarFound, true);
  assert.equal(payload.code, "const answer = 42;");
  assert.ok(
    payload.tokens.some((token) => token.text === "const" && token.types.includes("keyword"))
  );
  assert.ok(payload.tokens.some((token) => token.text === "42" && token.types.includes("number")));
});

test("tokenizeJSON falls back to plain text for unknown languages", () => {
  const payload = JSON.parse(
    createBridge().tokenizeJSON("plain text", { language: "made-up-language" })
  );

  assert.equal(payload.ok, true);
  assert.equal(payload.language, "plain");
  assert.equal(payload.grammarFound, false);
  assert.deepEqual(payload.tokens, [{ text: "plain text", types: ["plain"] }]);
});
