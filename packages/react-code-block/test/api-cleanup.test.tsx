import { createElement, createRef, type ComponentType } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeBlock } from "../src/index.js";
import * as publicApi from "../src/index.js";

describe("first-release React API", () => {
    it("does not expose compatibility-only theme helpers", () => {
        expect(publicApi).not.toHaveProperty("defaultCodeTokenTheme");
        expect(publicApi).not.toHaveProperty("fixed");
        expect(publicApi).not.toHaveProperty("loadHighlighter");
        expect(publicApi).not.toHaveProperty("marks");
        expect(publicApi).not.toHaveProperty("pick");
        expect(publicApi).not.toHaveProperty("tokenColor");
    });

    it("drops dangerouslySetInnerHTML at runtime instead of forwarding conflicting content", () => {
        const UnsafeCodeBlock = CodeBlock as unknown as ComponentType<{
            code: string;
            actions: { show: boolean };
            dangerouslySetInnerHTML: { __html: string };
        }>;

        expect(() =>
            render(
                createElement(UnsafeCodeBlock, {
                    code: "exact source",
                    actions: { show: false },
                    dangerouslySetInnerHTML: { __html: "untrusted replacement" }
                })
            )
        ).not.toThrow();
        expect(screen.getByRole("region")).not.toHaveTextContent("untrusted replacement");
    });

    it("forwards native section attributes and the root ref", () => {
        const onClick = vi.fn();
        const ref = createRef<HTMLElement>();

        render(
            <>
                <p id="consumer-description">Consumer description</p>
                <CodeBlock
                    ref={ref}
                    code={"first\nsecond"}
                    id="example"
                    data-kind="sample"
                    aria-label="Example source"
                    aria-describedby="consumer-description"
                    onClick={onClick}
                    lines={{ show: true }}
                    actions={{ show: false }}
                />
            </>
        );

        const region = screen.getByRole("region", { name: "Example source" });
        expect(ref.current).toBe(region);
        expect(region).toHaveAttribute("id", "example");
        expect(region).toHaveAttribute("data-kind", "sample");
        expect(region).toHaveAccessibleDescription("Consumer description Line numbers visible");
        expect(region.getAttribute("aria-describedby")?.split(" ")).toContain(
            "consumer-description"
        );

        fireEvent.click(region);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("uses a 14px root default and lets native style override it", () => {
        const view = render(<CodeBlock code="x" actions={{ show: false }} />);
        expect(screen.getByRole("region")).toHaveStyle({ fontSize: "14px" });

        view.rerender(
            <CodeBlock code="x" actions={{ show: false }} style={{ fontSize: "1.25rem" }} />
        );
        expect(screen.getByRole("region")).toHaveStyle({ fontSize: "1.25rem" });
    });
});
