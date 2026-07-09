import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryRoot = mkdtempSync(join(tmpdir(), "react-code-block-package-"));

try {
    const packOutput = execFileSync(
        "npm",
        ["pack", "--json", "--pack-destination", temporaryRoot],
        {
            cwd: packageRoot,
            encoding: "utf8",
            env: { ...process.env, npm_config_cache: join(temporaryRoot, "npm-cache") }
        }
    );
    const [{ filename }] = JSON.parse(packOutput);
    const archive = join(temporaryRoot, filename);
    const installedPackage = join(temporaryRoot, "node_modules", "@dongyuzhao", "react-code-block");
    mkdirSync(installedPackage, { recursive: true });
    execFileSync("tar", ["-xzf", archive, "--strip-components=1", "-C", installedPackage], {
        stdio: "pipe"
    });

    const reactLink = join(temporaryRoot, "node_modules", "react");
    symlinkSync(realpathSync(join(packageRoot, "node_modules", "react")), reactLink, "junction");

    const consumer = `
        const api = await import("@dongyuzhao/react-code-block");
        if (!("CodeBlock" in api) || !("standard" in api)) {
            throw new Error("The root package did not expose the supported API.");
        }
        for (const path of [
            "@dongyuzhao/react-code-block/dist/theme.js",
            "@dongyuzhao/react-code-block/dist/code-highlighter.js",
            "@dongyuzhao/react-code-block/theme"
        ]) {
            try {
                await import(path);
                throw new Error(\`Internal package subpath resolved: \${path}\`);
            } catch (error) {
                if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
                    throw error;
                }
            }
        }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", consumer], {
        cwd: temporaryRoot,
        encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const manifest = JSON.parse(readFileSync(join(installedPackage, "package.json"), "utf8"));
    assert.deepEqual(manifest.exports, {
        ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
            default: "./dist/index.js"
        }
    });
    assert.ok(
        existsSync(join(installedPackage, "dist", "index.d.ts")),
        "The packed root declaration file is missing."
    );
} finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
}
