import { beforeEach, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
    pointer: 1,
    payload: ""
}));

vi.mock("../src/generated/cb-core.mjs", () => ({
    default: vi.fn(async () => ({
        cwrap: (name: string) =>
            name === "cb_tokenize_json" ? () => core.pointer : () => undefined,
        UTF8ToString: () => core.payload
    }))
}));

import { highlightCode } from "../src/code-highlighter.js";

beforeEach(() => {
    core.pointer = 1;
    core.payload = JSON.stringify({
        language: "plain",
        tokens: [{ text: "source", scope: "" }]
    });
});

it("rejects a null native result", async () => {
    core.pointer = 0;

    await expect(highlightCode("source")).rejects.toThrow("no token payload");
});

it("rejects a decoded payload without a token array", async () => {
    core.payload = JSON.stringify({ language: "plain" });

    await expect(highlightCode("source")).rejects.toThrow("invalid token payload");
});

it("rejects malformed token entries", async () => {
    core.payload = JSON.stringify({
        language: "plain",
        tokens: [{ text: "source" }]
    });

    await expect(highlightCode("source")).rejects.toThrow("invalid token payload");
});

it("rejects a token stream that cannot reconstruct the exact source", async () => {
    core.payload = JSON.stringify({
        language: "plain",
        tokens: [{ text: "other", scope: "" }]
    });

    await expect(highlightCode("source")).rejects.toThrow("source-mismatched token payload");
});

it("accepts a valid core-resolved plain token stream", async () => {
    await expect(highlightCode("source")).resolves.toEqual({
        language: "plain",
        tokens: [{ text: "source", scope: "" }]
    });
});

it("accepts an empty token stream for empty source", async () => {
    core.payload = JSON.stringify({ language: "plain", tokens: [] });

    await expect(highlightCode("")).resolves.toEqual({
        language: "plain",
        tokens: []
    });
});
