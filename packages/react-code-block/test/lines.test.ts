import { describe, expect, it } from "vitest";
import { marks } from "../src/lines.js";

describe("marks", () => {
    it.each([
        ["", 1],
        ["one", 1],
        ["one\ntwo", 2],
        ["one\n", 2],
        ["one\r\ntwo", 2],
        ["one\rtwo", 2]
    ])("counts logical lines in %j", (code, count) => {
        expect(marks(code, 1)).toHaveLength(count);
    });

    it("clamps and truncates the start value", () => {
        expect(marks("a\nb", -4)).toEqual([1, 2]);
        expect(marks("a\nb", Number.NaN)).toEqual([1, 2]);
        expect(marks("a\nb", 8.9)).toEqual([8, 9]);
    });

    it("keeps every mark unique and safe at the maximum integer range", () => {
        const result = marks("a\nb\nc", Number.MAX_SAFE_INTEGER + 100);

        expect(result).toEqual([
            Number.MAX_SAFE_INTEGER - 2,
            Number.MAX_SAFE_INTEGER - 1,
            Number.MAX_SAFE_INTEGER
        ]);
        expect(result.every(Number.isSafeInteger)).toBe(true);
        expect(new Set(result).size).toBe(result.length);
    });
});
