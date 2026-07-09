#!/usr/bin/env node
// Regenerates the shared token-stream goldens by running each fixture snippet
// through the compiled core (cb_cli). These goldens are authoritative snapshots
// of the tree-sitter output in the new {language, tokens:[{text,scope}]} shape;
// they are NOT derived from (or compared against) the deprecated Prism stream.
//
// Build the CLI first:  make -C packages/shared/code-block-core all
// Then:                 node gen/gen-goldens.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = resolve(here, "..");

const cli = resolve(coreRoot, "build/cb_cli");
const fixturesPath = resolve(coreRoot, "fixtures/code-snippets.json");
const goldenDir = resolve(coreRoot, "test/golden/token-stream");

const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"));
rmSync(goldenDir, { recursive: true, force: true });
mkdirSync(goldenDir, { recursive: true });

for (const fixture of fixtures) {
    const stdout = execFileSync(cli, [fixture.language ?? ""], {
        input: fixture.code,
        encoding: "utf8"
    });
    const payload = JSON.parse(stdout);
    const dest = resolve(goldenDir, `${fixture.id}.json`);
    writeFileSync(dest, JSON.stringify(payload, null, 2) + "\n");
    console.log(`Wrote ${fixture.id}.json (${payload.language}, ${payload.tokens.length} tokens)`);
}
