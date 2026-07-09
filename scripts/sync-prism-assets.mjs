import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

execFileSync(process.execPath, [join(repoRoot, "scripts/build-prism-code.mjs")], {
  stdio: "inherit"
});

const copies = [
  [
    "packages/prism-code-core/generated/prism-code.js",
    "packages/swift-code-block/Sources/SwiftCodeBlock/Resources/Prism/prism-code.js"
  ],
  [
    "packages/prism-code-core/generated/prism-code.js",
    "packages/compose-code-block/src/main/assets/code-block/prism-code.js"
  ],
  [
    "packages/prism-code-core/src/prism-code-core.ts",
    "packages/react-code-block/src/generated/prism-code-core.ts"
  ],
  [
    "packages/prism-code-core/src/react-prism-code.ts",
    "packages/react-code-block/src/generated/react-prism-code.ts"
  ]
];

for (const [source, destination] of copies) {
  const destinationPath = join(repoRoot, destination);
  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(join(repoRoot, source), destinationPath);
  console.log(`synced ${source} -> ${destination}`);
}
