import { afterEach, describe, expect, it, vi } from "vitest";
import { canShare, share } from "../src/actions.js";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("share", () => {
    it("detects and invokes the Web Share API with exact source", async () => {
        const run = vi.fn().mockResolvedValue(undefined);

        expect(canShare({ share: run })).toBe(true);
        await share("a\r\n", { share: run });

        expect(run).toHaveBeenCalledWith({ text: "a\r\n" });
    });

    it("returns false and does nothing when sharing is unavailable", async () => {
        expect(canShare({})).toBe(false);
        await expect(share("x", {})).resolves.toBeUndefined();
    });

    it("treats AbortError as cancellation", async () => {
        const port = {
            share: vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"))
        };

        await expect(share("x", port)).resolves.toBeUndefined();
    });

    it("rethrows non-cancellation errors", async () => {
        const failure = new Error("share failed");
        const port = { share: vi.fn().mockRejectedValue(failure) };

        await expect(share("x", port)).rejects.toBe(failure);
    });

    it("can be imported and queried without browser globals", async () => {
        vi.resetModules();
        vi.stubGlobal("window", undefined);
        vi.stubGlobal("navigator", undefined);

        const helpers = await import("../src/actions.js");

        expect(helpers.canShare()).toBe(false);
        await expect(helpers.share("x")).resolves.toBeUndefined();
    });
});
