import { describe, expect, it } from "vitest";
import { pick, standard, tokenColor, type Palette } from "../src/theme.js";

describe("theme", () => {
    it("selects explicit and automatic palettes", () => {
        expect(pick(standard, "light", true)).toBe(standard.light);
        expect(pick(standard, "dark", false)).toBe(standard.dark);
        expect(pick(standard, "automatic", false)).toBe(standard.light);
        expect(pick(standard, "automatic", true)).toBe(standard.dark);
    });

    it("resolves exact, parent, and text fallback colors", () => {
        const palette: Palette = {
            base: "#ffffff",
            text: "#111111",
            muted: "#666666",
            border: "#dddddd",
            tokens: { string: "#123456", "string.escape": "#abcdef" }
        };
        expect(tokenColor("string.escape", palette)).toBe("#abcdef");
        expect(tokenColor("string.special", palette)).toBe("#123456");
        expect(tokenColor("unknown.scope", palette)).toBe("#111111");
    });

    it("deeply freezes the shared standard theme", () => {
        expect([
            Object.isFrozen(standard),
            Object.isFrozen(standard.light),
            Object.isFrozen(standard.light.tokens),
            Object.isFrozen(standard.dark),
            Object.isFrozen(standard.dark.tokens)
        ]).toEqual([true, true, true, true, true]);

        expect(() => Object.assign(standard, { light: standard.dark })).toThrow(TypeError);
        expect(() => Object.assign(standard.light, { base: "#000000" })).toThrow(TypeError);
        expect(() => Object.assign(standard.light.tokens, { plain: "#000000" })).toThrow(TypeError);
    });
});
