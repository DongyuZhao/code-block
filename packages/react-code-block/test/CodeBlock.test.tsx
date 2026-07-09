import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeBlock, highlightCode, renderCode, standard, type Theme } from "../src/index.js";

const normalizedThemeScopes = [
    "plain",
    "comment",
    "keyword",
    "keyword.operator",
    "string",
    "string.escape",
    "string.regexp",
    "character",
    "number",
    "boolean",
    "constant",
    "constant.builtin",
    "function",
    "type",
    "constructor",
    "module",
    "variable",
    "variable.builtin",
    "property",
    "attribute",
    "label",
    "markup",
    "tag",
    "operator",
    "punctuation"
];

const commonLanguageFixtures = [
    ["bash", '#!/usr/bin/env bash\nname="world"\necho "Hello, ${name}"'],
    ["c", "#include <stdio.h>\nint main(void) { return 0; }"],
    ["css", ".button { color: #0a7; display: grid; }"],
    ["go", 'package main\nfunc greet(name string) string { return "Hello, " + name }'],
    ["html", '<main class="app"><h1>Hello</h1></main>'],
    ["java", "record User(String name) {}"],
    ["json", '{"name":"code-block","enabled":true}'],
    ["markdown", "# Hello\n\nUse **tree-sitter**."],
    ["ruby", 'def greet(name)\n  "Hello, #{name}"\nend'],
    ["rust", 'fn greet(name: &str) -> String { format!("Hello, {name}") }']
] as const;

const presentationTheme: Theme = {
    light: {
        base: "#fafafa",
        text: "#101010",
        muted: "#606060",
        border: "#d0d0d0",
        tokens: { plain: "#101010" }
    },
    dark: {
        base: "#101010",
        text: "#fafafa",
        muted: "#a0a0a0",
        border: "#404040",
        tokens: { plain: "#fafafa" }
    }
};

const initialClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const initialShare = Object.getOwnPropertyDescriptor(navigator, "share");

afterEach(() => {
    restoreNavigatorProperty("clipboard", initialClipboard);
    restoreNavigatorProperty("share", initialShare);
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("highlightCode", () => {
    it("returns tree-sitter token runs for JavaScript", async () => {
        const result = await highlightCode("const answer = 42;", { language: "javascript" });

        expect(result.language).toBe("javascript");
        expect(result.tokens).toContainEqual({ text: "const", scope: "keyword" });
        expect(result.tokens).toContainEqual({ text: "42", scope: "number" });
    });

    it("scopes custom types and parameters instead of leaving them plain", async () => {
        const result = await highlightCode("type Result<T> = { value: T };", {
            language: "typescript"
        });

        expect(result.language).toBe("typescript");
        expect(result.tokens).toContainEqual({ text: "Result", scope: "type" });
        expect(result.tokens).toContainEqual({ text: "T", scope: "type" });
    });

    it("falls back to plain text for unknown languages", async () => {
        const result = await highlightCode("hello", { language: "unknown-language" });

        expect(result.language).toBe("plain");
        expect(result.tokens).toEqual([{ text: "hello", scope: "" }]);
    });

    it("matches token snapshots for common languages", async () => {
        const results = await Promise.all(
            commonLanguageFixtures.map(async ([language, code]) => ({
                requestedLanguage: language,
                result: await highlightCode(code, { language })
            }))
        );

        expect(results.map(({ result }) => result.language)).toEqual(
            commonLanguageFixtures.map(([language]) => language)
        );
        expect(results).toMatchSnapshot();
    });

    it("keeps the exact source on a successful rendered value", async () => {
        const states = [];

        for await (const state of renderCode("const answer = 42;", {
            language: "javascript"
        })) {
            states.push(state);
        }

        expect(states.at(-1)).toMatchObject({
            status: "succeeded",
            rendered: { code: "const answer = 42;", language: "javascript" }
        });
    });
});

describe("<CodeBlock>", () => {
    it("defines colors for every normalized theme scope", () => {
        expect(Object.keys(standard.light.tokens)).toEqual(
            expect.arrayContaining(normalizedThemeScopes)
        );
        expect(Object.keys(standard.dark.tokens)).toEqual(
            expect.arrayContaining(normalizedThemeScopes)
        );
    });

    it("renders highlighted native DOM spans without HTML injection", async () => {
        const { container } = render(<CodeBlock code="const answer = 42;" language="javascript" />);

        const block = await screen.findByRole("region", {
            name: "javascript code block"
        });

        await waitFor(() => {
            expect(container.querySelector(".token.keyword")).not.toBeNull();
        });
        expect(block.querySelector("code")).not.toBeNull();
        expect(container.innerHTML).not.toContain("dangerouslySetInnerHTML");
        expect(container.querySelector("code")?.textContent).toBe("const answer = 42;");
    });

    it("resolves exact, parent, and plain theme colors for tree-sitter scopes", async () => {
        const palette = {
            ...standard.light,
            text: "#010203",
            tokens: {
                plain: "#010203",
                string: "#112233",
                "string.escape": "#445566",
                punctuation: "#778899"
            }
        };
        const { container } = render(
            <CodeBlock
                code={'const text = "line\\n";'}
                language="javascript"
                theme={{ light: palette, dark: palette }}
            />
        );

        await waitFor(() => {
            expect(container.querySelector(".token.string.escape")).not.toBeNull();
        });
        expect(container.querySelector<HTMLElement>(".token.string.escape")?.style.color).toBe(
            "rgb(68, 85, 102)"
        );
        expect(
            container.querySelector<HTMLElement>(".token.punctuation.delimiter")?.style.color
        ).toBe("rgb(119, 136, 153)");
        expect(container.querySelector<HTMLElement>(".token.plain")?.style.color).toBe(
            "rgb(1, 2, 3)"
        );
    });

    it("renders resolved label, line marks, built-ins, and extensions", async () => {
        installNavigatorProperty("share", vi.fn().mockResolvedValue(undefined));
        const run = vi.fn();

        render(
            <CodeBlock
                code={"a\nb"}
                language="js"
                lines={{ show: true, start: 8 }}
                actions={{ extensions: [{ id: "open", label: "Open", run }] }}
            />
        );

        expect(await screen.findByText("javascript")).toBeVisible();
        expect(screen.getByTestId("code-lines").textContent).toBe("8\n9");
        expect(screen.getByTestId("code-lines")).toHaveAttribute("aria-hidden", "true");
        expect(screen.getByTestId("code-lines")).toHaveStyle({ userSelect: "none" });
        expect(screen.getByRole("button", { name: /copy/i })).toBeVisible();
        expect(screen.getByRole("button", { name: /share/i })).toBeVisible();
        expect(screen.getByRole("button", { name: /more/i })).toBeVisible();
        expect(
            within(screen.getByTestId("code-head"))
                .getAllByRole("button")
                .map((button) => button.getAttribute("aria-label"))
        ).toEqual(["Copy code", "Share code", "More actions"]);
    });

    it("describes visible line numbers without changing a custom region name", () => {
        render(
            <CodeBlock
                code={"first\nsecond"}
                aria-label="Example source"
                lines={{ show: true }}
                actions={{ show: false }}
            />
        );

        const region = screen.getByRole("region", { name: "Example source" });
        expect(region).toHaveAccessibleName("Example source");
        expect(region).toHaveAccessibleDescription("Line numbers visible");
        expect(screen.getByTestId("code-lines")).toHaveAttribute("aria-hidden", "true");
    });

    it("supports custom and hidden labels and a hidden action group", async () => {
        const { rerender } = render(
            <CodeBlock code="x" language="plain" label="Text" actions={{ show: false }} />
        );

        expect(await screen.findByText("Text")).toBeVisible();
        expect(screen.queryByRole("button")).toBeNull();

        rerender(<CodeBlock code="x" language="plain" label={false} actions={{ show: false }} />);
        expect(screen.queryByTestId("code-head")).toBeNull();
    });

    it("uses the requested language while pending and the canonical language on success", async () => {
        render(<CodeBlock code="x" language="unknown-language" actions={{ show: false }} />);
        expect(screen.getByText("unknown-language")).toBeVisible();
        expect(await screen.findByText("plain")).toBeVisible();
    });

    it("copies the exact source immediately and resets its accessible success state", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        installNavigatorProperty("clipboard", { writeText });
        vi.stubGlobal("ClipboardItem", undefined);
        const code = "const value = '<exact>';";

        const { container } = render(<CodeBlock code={code} language="javascript" />);
        await waitFor(() => {
            expect(container.querySelector(".token")).not.toBeNull();
        });
        vi.useFakeTimers();

        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
        expect(writeText).toHaveBeenCalledWith(code);

        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
        expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_500);
        });
        expect(screen.getByRole("button", { name: "Copy code" })).toBeVisible();
        expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("treats a successful rich clipboard write as copied", async () => {
        const write = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn();
        const ClipboardItem = vi.fn(function (this: object) {
            return this;
        });
        installNavigatorProperty("clipboard", { write, writeText });
        vi.stubGlobal("ClipboardItem", ClipboardItem);

        render(<CodeBlock code="rich source" language="plain" />);
        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

        expect(ClipboardItem).toHaveBeenCalledOnce();
        expect(write).toHaveBeenCalledOnce();
        expect(writeText).not.toHaveBeenCalled();
        expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    });

    it("does not show copied state when every clipboard path fails", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("denied"));
        installNavigatorProperty("clipboard", { writeText });
        vi.stubGlobal("ClipboardItem", undefined);

        const { container } = render(<CodeBlock code="still rendered" language="plain" />);
        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith("still rendered"));
        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
        expect(screen.getByRole("button", { name: "Copy code" })).toBeVisible();
        expect(screen.getByRole("status")).toHaveTextContent("Unable to copy code");
        expect(container.querySelector("code")?.textContent).toBe("still rendered");
    });

    it("shares the exact source and omits share when unsupported", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        installNavigatorProperty("share", share);
        const code = "share this exact source";

        const { unmount } = render(<CodeBlock code={code} language="plain" />);
        fireEvent.click(screen.getByRole("button", { name: "Share code" }));
        expect(share).toHaveBeenCalledWith({ text: code });
        unmount();

        installNavigatorProperty("share", undefined);
        render(<CodeBlock code={code} language="plain" />);
        expect(screen.queryByRole("button", { name: "Share code" })).toBeNull();
    });

    it("opens the extension menu from a click and focuses its first item", async () => {
        render(
            <CodeBlock
                code="x"
                actions={{
                    extensions: [
                        { id: "first", label: "First", run: () => undefined },
                        { id: "second", label: "Second", run: () => undefined }
                    ]
                }}
            />
        );
        const trigger = screen.getByRole("button", { name: "More actions" });

        expect(trigger).toHaveAttribute("aria-haspopup", "menu");
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute("aria-expanded", "true");
        await waitFor(() => expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus());
        expect(screen.getAllByRole("menuitem")).toHaveLength(2);
        expect(screen.getByRole("menuitem", { name: "First" })).toHaveAttribute("tabindex", "-1");
    });

    it("supports arrow, Home, and End navigation inside the extension menu", async () => {
        render(
            <CodeBlock
                code="x"
                actions={{
                    extensions: [
                        { id: "first", label: "First", run: () => undefined },
                        { id: "second", label: "Second", run: () => undefined },
                        { id: "third", label: "Third", run: () => undefined }
                    ]
                }}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "More actions" }));
        const first = screen.getByRole("menuitem", { name: "First" });
        const second = screen.getByRole("menuitem", { name: "Second" });
        const third = screen.getByRole("menuitem", { name: "Third" });
        await waitFor(() => expect(first).toHaveFocus());

        fireEvent.keyDown(first, { key: "ArrowDown" });
        expect(second).toHaveFocus();
        fireEvent.keyDown(second, { key: "ArrowUp" });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: "ArrowUp" });
        expect(third).toHaveFocus();
        fireEvent.keyDown(third, { key: "Home" });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: "End" });
        expect(third).toHaveFocus();
        fireEvent.keyDown(third, { key: "ArrowDown" });
        expect(first).toHaveFocus();
    });

    it("opens from trigger arrow keys and Escape closes with trigger focus", async () => {
        render(
            <CodeBlock
                code="x"
                actions={{
                    extensions: [
                        { id: "first", label: "First", run: () => undefined },
                        { id: "last", label: "Last", run: () => undefined }
                    ]
                }}
            />
        );
        const trigger = screen.getByRole("button", { name: "More actions" });
        trigger.focus();

        fireEvent.keyDown(trigger, { key: "ArrowDown" });
        await waitFor(() => expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus());
        fireEvent.keyDown(screen.getByRole("menuitem", { name: "First" }), { key: "Escape" });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(trigger).toHaveFocus();

        fireEvent.keyDown(trigger, { key: "ArrowUp" });
        await waitFor(() => expect(screen.getByRole("menuitem", { name: "Last" })).toHaveFocus());
    });

    it("closes the extension menu on pointer down outside", async () => {
        render(
            <>
                <CodeBlock
                    code="x"
                    actions={{
                        extensions: [{ id: "open", label: "Open", run: () => undefined }]
                    }}
                />
                <button type="button">Outside</button>
            </>
        );
        const trigger = screen.getByRole("button", { name: "More actions" });
        fireEvent.click(trigger);
        await waitFor(() => expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus());

        fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));

        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("menuitem")).toBeNull();
    });

    it("closes the extension menu on Tab without cancelling native focus movement", async () => {
        render(
            <CodeBlock
                code="x"
                actions={{
                    extensions: [{ id: "open", label: "Open", run: () => undefined }]
                }}
            />
        );
        const trigger = screen.getByRole("button", { name: "More actions" });
        fireEvent.click(trigger);
        const item = screen.getByRole("menuitem", { name: "Open" });
        await waitFor(() => expect(item).toHaveFocus());

        expect(fireEvent.keyDown(item, { key: "Tab" })).toBe(true);

        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("menuitem")).toBeNull();
    });

    it("keeps extension icons out of menu item accessible names", async () => {
        render(
            <CodeBlock
                code="x"
                actions={{
                    extensions: [
                        {
                            id: "open",
                            label: "Open",
                            icon: <span>Decorative icon</span>,
                            run: () => undefined
                        }
                    ]
                }}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "More actions" }));
        const item = screen.getByRole("menuitem");

        expect(item).toHaveAccessibleName("Open");
        expect(screen.getByText("Decorative icon").parentElement).toHaveAttribute(
            "aria-hidden",
            "true"
        );
    });

    it("runs an extension, closes its menu, and restores focus to the trigger", async () => {
        const run = vi.fn();
        render(
            <CodeBlock code="x" actions={{ extensions: [{ id: "open", label: "Open", run }] }} />
        );
        const trigger = screen.getByRole("button", { name: "More actions" });

        fireEvent.click(trigger);
        await waitFor(() => expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus());
        fireEvent.click(screen.getByRole("menuitem", { name: "Open" }));

        expect(run).toHaveBeenCalledOnce();
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("menuitem")).toBeNull();
        expect(trigger).toHaveFocus();
    });

    it("subscribes automatic mode to color-scheme changes", () => {
        const media = installMatchMedia(false);
        render(<CodeBlock code="x" theme={presentationTheme} actions={{ show: false }} />);
        const region = screen.getByRole("region");

        expect(region).toHaveStyle({ background: "#fafafa" });
        expect(media.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

        act(() => media.setMatches(true));
        expect(region).toHaveStyle({ background: "#101010" });
    });

    it("keeps a forced mode stable when the media query changes", () => {
        const media = installMatchMedia(false);
        render(
            <CodeBlock code="x" mode="light" theme={presentationTheme} actions={{ show: false }} />
        );
        const region = screen.getByRole("region");

        expect(region).toHaveStyle({ background: "#fafafa" });
        act(() => media.setMatches(true));
        expect(region).toHaveStyle({ background: "#fafafa" });
    });

    it("uses the light automatic snapshot during server rendering", () => {
        installMatchMedia(true);

        const markup = renderToString(
            <CodeBlock code="x" theme={presentationTheme} actions={{ show: false }} />
        );
        const container = document.createElement("div");
        container.innerHTML = markup;

        expect(container.querySelector("section")).toHaveStyle({ background: "#fafafa" });
    });

    it("hydrates runtime share capability without replacing the server surface", async () => {
        installNavigatorProperty("share", undefined);
        const element = <CodeBlock code="x" language="plain" />;
        const container = document.createElement("div");
        container.innerHTML = renderToString(element);
        document.body.append(container);
        installNavigatorProperty("share", vi.fn().mockResolvedValue(undefined));
        const errors: unknown[] = [];
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const root = hydrateRoot(container, element, {
            onRecoverableError: (error) => errors.push(error)
        });

        try {
            await waitFor(() => {
                expect(within(container).getByRole("button", { name: "Share code" })).toBeVisible();
            });
            expect(errors).toEqual([]);
        } finally {
            await act(async () => root.unmount());
            consoleError.mockRestore();
            container.remove();
        }
    });

    it("ignores a successful clip after the source changes", async () => {
        let resolveWrite!: () => void;
        const writeText = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveWrite = resolve;
                })
        );
        installNavigatorProperty("clipboard", { writeText });
        vi.stubGlobal("ClipboardItem", undefined);
        const { rerender } = render(<CodeBlock code="first" language="plain" />);

        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
        rerender(<CodeBlock code="second" language="plain" />);
        await act(async () => resolveWrite());

        expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
        expect(screen.getByRole("button", { name: "Copy code" })).toBeVisible();
    });

    it("invalidates a pending clip across an A-B-A source transition", async () => {
        let resolveWrite!: () => void;
        const writeText = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveWrite = resolve;
                })
        );
        installNavigatorProperty("clipboard", { writeText });
        vi.stubGlobal("ClipboardItem", undefined);
        const { rerender } = render(<CodeBlock code="A" language="plain" />);

        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
        rerender(<CodeBlock code="B" language="plain" />);
        rerender(<CodeBlock code="A" language="plain" />);
        await act(async () => resolveWrite());

        expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
        expect(screen.getByRole("button", { name: "Copy code" })).toBeVisible();
        expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("clears copied feedback when its timer expires on another source", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        installNavigatorProperty("clipboard", { writeText });
        vi.stubGlobal("ClipboardItem", undefined);
        const { container, rerender } = render(<CodeBlock code="A" language="plain" />);
        await waitFor(() => expect(container.querySelector(".token")).not.toBeNull());
        vi.useFakeTimers();

        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
        await act(async () => Promise.resolve());
        expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();

        rerender(<CodeBlock code="B" language="plain" />);
        await act(async () => vi.advanceTimersByTimeAsync(1_500));
        rerender(<CodeBlock code="A" language="plain" />);

        expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
        expect(screen.getByRole("button", { name: "Copy code" })).toBeVisible();
        expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("keeps the newest clip result when an earlier operation settles last", async () => {
        let rejectFirst!: (error: Error) => void;
        const writeText = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<void>((_resolve, reject) => {
                        rejectFirst = reject;
                    })
            )
            .mockResolvedValueOnce(undefined);
        installNavigatorProperty("clipboard", { writeText });
        vi.stubGlobal("ClipboardItem", undefined);
        render(<CodeBlock code="source" language="plain" />);
        const copy = screen.getByRole("button", { name: "Copy code" });

        fireEvent.click(copy);
        fireEvent.click(copy);
        expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
        await act(async () => rejectFirst(new Error("older failure")));

        expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
        expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");
    });
});

function installNavigatorProperty(name: "clipboard" | "share", value: unknown): void {
    Object.defineProperty(navigator, name, { configurable: true, value });
}

function restoreNavigatorProperty(
    name: "clipboard" | "share",
    descriptor: PropertyDescriptor | undefined
): void {
    if (descriptor) {
        Object.defineProperty(navigator, name, descriptor);
    } else {
        Reflect.deleteProperty(navigator, name);
    }
}

function installMatchMedia(initialMatches: boolean) {
    let matches = initialMatches;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const addEventListener = vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.add(listener);
        }
    );
    const removeEventListener = vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.delete(listener);
        }
    );
    const mediaQueryList = {
        get matches() {
            return matches;
        },
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addEventListener,
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
    } as unknown as MediaQueryList;

    vi.stubGlobal(
        "matchMedia",
        vi.fn(() => mediaQueryList)
    );

    return {
        addEventListener,
        setMatches(nextMatches: boolean) {
            matches = nextMatches;
            for (const listener of listeners) {
                if (typeof listener === "function") {
                    listener(new Event("change"));
                } else {
                    listener.handleEvent(new Event("change"));
                }
            }
        }
    };
}
