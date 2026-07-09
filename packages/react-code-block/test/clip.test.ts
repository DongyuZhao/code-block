import { afterEach, describe, expect, it, vi } from "vitest";
import { html, write } from "../src/clip.js";
import { standard, type Palette } from "../src/theme.js";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("clip", () => {
    it("escapes source and preserves exact plain text", () => {
        const code = '<script>x & "y"</script>\r\n';
        const payload = html(code, [{ text: code, scope: "string" }], standard.light);

        expect(payload.plain).toBe(code);
        expect(payload.rich).toContain("&lt;script&gt;x &amp; &quot;y&quot;&lt;/script&gt;\r\n");
        expect(payload.rich).not.toContain("<script>");
    });

    it("escapes palette values used in HTML attributes", () => {
        const unsafe = `#fff\" onmouseover=\"alert(1)&<'`;
        const palette: Palette = {
            ...standard.light,
            base: unsafe,
            text: unsafe,
            tokens: { plain: unsafe }
        };

        const payload = html("x", [{ text: "x", scope: "plain" }], palette);

        expect(payload.rich).toContain("#fff&quot; onmouseover=&quot;alert(1)&amp;&lt;&#39;");
        expect(payload.rich).not.toContain('onmouseover="alert(1)');
    });

    it("uses one plain-color run when tokens do not reconstruct the source", () => {
        const code = "const x = 1;";
        const payload = html(code, [{ text: "different", scope: "keyword" }], standard.light);

        expect(payload.plain).toBe(code);
        expect(payload.rich.match(/<span/g)).toHaveLength(1);
        expect(payload.rich).toContain(`color:${standard.light.tokens.plain}`);
        expect(payload.rich).toContain(code);
        expect(payload.rich).not.toContain("different");
    });

    it("writes rich clipboard data when supported", async () => {
        class TestClipboardItem {
            constructor(readonly data: Record<string, Blob>) {}
        }
        vi.stubGlobal("ClipboardItem", TestClipboardItem);
        const port = {
            write: vi.fn().mockResolvedValue(undefined),
            writeText: vi.fn().mockResolvedValue(undefined)
        };

        await expect(write({ plain: "x", rich: "<pre>x</pre>" }, port)).resolves.toBe("rich");
        expect(port.write).toHaveBeenCalledOnce();
        expect(port.writeText).not.toHaveBeenCalled();
    });

    it("falls back to plain clipboard text when rich write fails", async () => {
        class TestClipboardItem {
            constructor(readonly data: Record<string, Blob>) {}
        }
        vi.stubGlobal("ClipboardItem", TestClipboardItem);
        const port = {
            write: vi.fn().mockRejectedValue(new Error("blocked")),
            writeText: vi.fn().mockResolvedValue(undefined)
        };

        await expect(write({ plain: "x", rich: "<pre>x</pre>" }, port)).resolves.toBe("plain");
        expect(port.writeText).toHaveBeenCalledWith("x");
    });

    it("rejects when rich and plain clipboard writes both fail", async () => {
        class TestClipboardItem {
            constructor(readonly data: Record<string, Blob>) {}
        }
        vi.stubGlobal("ClipboardItem", TestClipboardItem);
        const plainError = new Error("plain blocked");
        const port = {
            write: vi.fn().mockRejectedValue(new Error("rich blocked")),
            writeText: vi.fn().mockRejectedValue(plainError)
        };

        await expect(write({ plain: "x", rich: "<pre>x</pre>" }, port)).rejects.toBe(plainError);
        expect(port.writeText).toHaveBeenCalledWith("x");
    });

    it("can be imported without browser clipboard globals", async () => {
        vi.resetModules();
        vi.stubGlobal("navigator", undefined);
        vi.stubGlobal("ClipboardItem", undefined);

        await expect(import("../src/clip.js")).resolves.toMatchObject({
            html: expect.any(Function),
            write: expect.any(Function)
        });
    });

    it("reports an unavailable clipboard only when write is called", async () => {
        vi.stubGlobal("navigator", undefined);

        await expect(write({ plain: "x", rich: "<pre>x</pre>" })).rejects.toThrow(
            "Clipboard API is unavailable"
        );
    });
});
