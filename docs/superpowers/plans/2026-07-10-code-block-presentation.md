# Adaptive Code Block Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adaptive light/dark presentation, language labels, rich clipping, native sharing, extension actions, and optional line numbers to the React, SwiftUI, and Compose code-block bindings.

**Architecture:** Keep the shared C/tree-sitter core unchanged. Each binding adds native presentation types, a source-based line counter, rich clipboard serialization, and a platform-native header/action surface around its existing lossless token renderer. Cross-platform consistency is enforced through matching defaults and contract tests rather than shared UI code.

**Tech Stack:** React 18, TypeScript 5.5, DOM Clipboard/Web Share APIs, Vitest; Swift 5.9, SwiftUI, UIKit/AppKit pasteboards, ShareLink, XCTest; Kotlin 2.4, Jetpack Compose Material 3, Android ClipData/Intent, JUnit/Robolectric/Roborazzi.

## Decision Update — 2026-07-10

The package has not been distributed. Source, binary, and API compatibility with earlier repository revisions is therefore out of scope. The final API review must prefer the cleanest correct and ergonomic API for each platform and remove compatibility-only aliases, overloads, union inputs, and positional parameters.

This decision supersedes historical task text below that asks to preserve `defaultCodeTokenTheme`, accept a fixed React token map, retain `CodeBlockTheme` aliases or single-palette theme constructors, preserve Compose's former `color` parameter, or keep an earlier positional argument order. Clipboard rich-to-plain fallback and unchanged tokenizer contracts are functional requirements, not API compatibility promises.

Tasks 1–9 below are an archival execution record and their intermediate code
snippets are not public API reference material. Task 10 and
`.superpowers/sdd/api-design-implementation-addendum.md` are the binding final
surface; samples, README, consumer builds, and production declarations must
contain only that surface.

## Global Constraints

- Support React, SwiftUI, and Compose in the same change; do not change the C ABI, WASM payload, JNI contract, grammars, or token goldens.
- Preserve iOS 16.0, macOS 13.0, Android API 24, React 18, and the existing dependency floors.
- New public presentation concepts use the one-word names `mode`, `theme`, `label`, `lines`, and `actions`; prefer one-word names elsewhere when they remain clear.
- Avoid `y`, `k`, `g`, and `j` in new names when a clear alternative exists; platform terms, source language data, and `light`/`dark` are exempt.
- Defaults are `mode: automatic`, adaptive `theme: standard`, automatic resolved `label`, `lines: { show: false, start: 1 }`, and `actions: { show: true, extensions: [] }`.
- `theme` contains complete `light` and `dark` palettes; every custom theme supplies both.
- Clip always preserves the original source exactly as plain text and also writes the richest safe native representation available; header, label, actions, and line numbers never enter the payload.
- Share uses the original source as plain text and is omitted when no native share facility exists.
- Built-in action order is clip, share, then the extension menu; the menu is absent when extensions are empty.
- Line numbers count source lines across LF, CRLF, and CR, clamp invalid starts to `1`, are unselectable, and are hidden individually from assistive technology.
- Use icon-only built-in actions with accurate platform-appropriate accessibility names and icon-based success state; do not render visible `Copy` or `Copied` text.
- Write failing tests before production changes, preserve unrelated user changes, and commit after every task.

---

### Task 1: React adaptive theme and line model

**Files:**

- Create: `packages/react-code-block/src/theme.ts`
- Create: `packages/react-code-block/src/lines.ts`
- Create: `packages/react-code-block/test/theme.test.ts`
- Create: `packages/react-code-block/test/lines.test.ts`
- Modify: `packages/react-code-block/src/index.tsx`

**Interfaces:**

- Consumes: existing token scope strings and the current `CodeTokenTheme` map from `src/index.tsx`.
- Produces: `Mode`, `Palette`, `Theme`, `Lines`, `standard`, `fixed`, `pick`, `tokenColor`, and `marks` for later React tasks.

- [x] **Step 1: Write failing theme and line tests**

```ts
// test/theme.test.ts
import { describe, expect, it } from "vitest";
import { fixed, pick, standard, tokenColor, type Palette } from "../src/theme.js";

describe("theme", () => {
    it("selects explicit and automatic palettes", () => {
        expect(pick(standard, "light", true)).toBe(standard.light);
        expect(pick(standard, "dark", false)).toBe(standard.dark);
        expect(pick(standard, "automatic", false)).toBe(standard.light);
        expect(pick(standard, "automatic", true)).toBe(standard.dark);
    });

    it("maps a fixed token palette to both modes", () => {
        const theme = fixed({ plain: "#010203", string: "#112233" });
        expect(theme.light).toBe(theme.dark);
        expect(theme.dark.tokens.plain).toBe("#010203");
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
});
```

```ts
// test/lines.test.ts
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
});
```

- [x] **Step 2: Run the focused tests and confirm missing-module failures**

Run:

```bash
pnpm --dir packages/react-code-block exec vitest run --project unit test/theme.test.ts test/lines.test.ts
```

Expected: FAIL because `src/theme.ts` and `src/lines.ts` do not exist.

- [x] **Step 3: Implement the React presentation types and helpers**

Create `src/theme.ts` with this public shape and move the current dark token map into `standard.dark.tokens` unchanged. Add a complete light map with the same normalized scope keys.

```ts
export type CodeTokenTheme = Record<string, string>;
export type Mode = "automatic" | "light" | "dark";

export type Palette = {
    base: string;
    text: string;
    muted: string;
    border: string;
    tokens: CodeTokenTheme;
};

export type Theme = { light: Palette; dark: Palette };
export type Lines = { show?: boolean; start?: number };

const lightTokens: CodeTokenTheme = {
    plain: "#24292f",
    comment: "#6e7781",
    keyword: "#cf222e",
    "keyword.operator": "#24292f",
    function: "#8250df",
    type: "#953800",
    constructor: "#953800",
    variable: "#0550ae",
    "variable.builtin": "#0550ae",
    parameter: "#0550ae",
    property: "#0550ae",
    string: "#0a3069",
    "string.escape": "#116329",
    "string.regex": "#116329",
    "string.regexp": "#116329",
    number: "#0550ae",
    boolean: "#0550ae",
    constant: "#0550ae",
    "constant.builtin": "#0550ae",
    operator: "#24292f",
    punctuation: "#24292f",
    tag: "#116329",
    attribute: "#0550ae",
    label: "#8250df",
    markup: "#8250df",
    namespace: "#953800",
    module: "#953800",
    escape: "#116329",
    character: "#0a3069"
};

const darkTokens: CodeTokenTheme = {
    plain: "#d4d4d4",
    comment: "#6a9955",
    keyword: "#c586c0",
    "keyword.operator": "#d4d4d4",
    function: "#dcdcaa",
    type: "#4ec9b0",
    constructor: "#4ec9b0",
    variable: "#9cdcfe",
    "variable.builtin": "#569cd6",
    parameter: "#9cdcfe",
    property: "#9cdcfe",
    string: "#ce9178",
    "string.escape": "#d7ba7d",
    "string.regex": "#d16969",
    "string.regexp": "#d16969",
    number: "#b5cea8",
    boolean: "#569cd6",
    constant: "#4fc1ff",
    "constant.builtin": "#569cd6",
    operator: "#d4d4d4",
    punctuation: "#d4d4d4",
    tag: "#569cd6",
    attribute: "#9cdcfe",
    label: "#c586c0",
    markup: "#dcdcaa",
    namespace: "#4ec9b0",
    module: "#4ec9b0",
    escape: "#d7ba7d",
    character: "#ce9178"
};

export const standard: Theme = {
    light: {
        base: "#ffffff",
        text: "#24292f",
        muted: "#6e7781",
        border: "#d0d7de",
        tokens: lightTokens
    },
    dark: {
        base: "#1e1e1e",
        text: "#d4d4d4",
        muted: "#9d9d9d",
        border: "#3a3a3a",
        tokens: darkTokens
    }
};

export function fixed(tokens: CodeTokenTheme): Theme {
    const palette: Palette = { ...standard.dark, text: tokens.plain ?? standard.dark.text, tokens };
    return { light: palette, dark: palette };
}

export function pick(theme: Theme, mode: Mode, dark: boolean): Palette {
    return mode === "dark" || (mode === "automatic" && dark) ? theme.dark : theme.light;
}

export function tokenColor(scope: string, palette: Palette): string {
    let key = scope;
    while (key) {
        if (palette.tokens[key]) return palette.tokens[key];
        const dot = key.lastIndexOf(".");
        if (dot < 0) break;
        key = key.slice(0, dot);
    }
    return palette.tokens.plain ?? palette.text;
}
```

Create `src/lines.ts`:

```ts
export function marks(code: string, start = 1): number[] {
    let count = 1;
    for (let index = 0; index < code.length; index += 1) {
        if (code[index] === "\r") {
            if (code[index + 1] === "\n") index += 1;
            count += 1;
        } else if (code[index] === "\n") {
            count += 1;
        }
    }
    const first = Number.isFinite(start) && start >= 1 ? Math.floor(start) : 1;
    return Array.from({ length: count }, (_, index) => first + index);
}
```

Move `CodeTokenTheme`, color resolution, and the exported legacy `defaultCodeTokenTheme` alias out of `index.tsx`; export `defaultCodeTokenTheme = standard.dark.tokens` for compatibility.

- [x] **Step 4: Run focused tests and the existing React suite**

Run:

```bash
pnpm --dir packages/react-code-block exec vitest run --project unit test/theme.test.ts test/lines.test.ts
pnpm run test:react
```

Expected: both commands PASS; existing theme tests continue to pass through the compatibility export.

- [x] **Step 5: Commit the React model**

```bash
git add packages/react-code-block/src/theme.ts packages/react-code-block/src/lines.ts packages/react-code-block/src/index.tsx packages/react-code-block/test/theme.test.ts packages/react-code-block/test/lines.test.ts
git commit -m "feat(react): add adaptive presentation model"
```

---

### Task 2: React rich clip and native action helpers

**Files:**

- Create: `packages/react-code-block/src/clip.ts`
- Create: `packages/react-code-block/src/actions.tsx`
- Create: `packages/react-code-block/test/clip.test.ts`
- Create: `packages/react-code-block/test/actions.test.ts`

**Interfaces:**

- Consumes: `CodeToken`, `Palette`, and `tokenColor` from Task 1.
- Produces: `Clip`, `html`, `write`, `Action`, `Actions`, `canShare`, and `share` for the React surface.

- [x] **Step 1: Write failing serialization and capability tests**

```ts
// test/clip.test.ts
import { describe, expect, it, vi } from "vitest";
import { html, write } from "../src/clip.js";
import { standard } from "../src/theme.js";

describe("clip", () => {
    it("escapes source and preserves exact plain text", () => {
        const code = '<script>x & "y"</script>\r\n';
        const payload = html(code, [{ text: code, scope: "string" }], standard.light);
        expect(payload.plain).toBe(code);
        expect(payload.rich).toContain("&lt;script&gt;x &amp; &quot;y&quot;&lt;/script&gt;");
        expect(payload.rich).not.toContain("<script>");
    });

    it("falls back to plain clipboard text when rich write fails", async () => {
        const port = {
            write: vi.fn().mockRejectedValue(new Error("blocked")),
            writeText: vi.fn().mockResolvedValue(undefined)
        };
        await expect(write({ plain: "x", rich: "<pre>x</pre>" }, port)).resolves.toBe("plain");
        expect(port.writeText).toHaveBeenCalledWith("x");
    });
});
```

```ts
// test/actions.test.ts
import { describe, expect, it, vi } from "vitest";
import { canShare, share } from "../src/actions.js";

describe("share", () => {
    it("detects and invokes the Web Share API with exact source", async () => {
        const run = vi.fn().mockResolvedValue(undefined);
        expect(canShare({ share: run })).toBe(true);
        await share("a\r\n", { share: run });
        expect(run).toHaveBeenCalledWith({ text: "a\r\n" });
    });

    it("treats AbortError as cancellation", async () => {
        const port = { share: vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")) };
        await expect(share("x", port)).resolves.toBeUndefined();
    });
});
```

- [x] **Step 2: Run the focused tests and confirm missing-module failures**

Run:

```bash
pnpm --dir packages/react-code-block exec vitest run --project unit test/clip.test.ts test/actions.test.ts
```

Expected: FAIL because the helper modules do not exist.

- [x] **Step 3: Implement safe rich serialization and clipboard fallback**

```ts
// src/clip.ts
import type { CodeToken } from "./code-highlighter.js";
import { tokenColor, type Palette } from "./theme.js";

export type Clip = { plain: string; rich: string };
type Port = {
    write?: (data: ClipboardItems) => Promise<void>;
    writeText: (text: string) => Promise<void>;
};

const esc = (value: string) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

export function html(code: string, tokens: CodeToken[], palette: Palette): Clip {
    const exact = tokens.map((token) => token.text).join("") === code;
    const runs = exact ? tokens : [{ text: code, scope: "" }];
    const body = runs
        .map(
            (token) =>
                `<span style="color:${esc(tokenColor(token.scope, palette))}">${esc(token.text)}</span>`
        )
        .join("");
    return {
        plain: code,
        rich: `<pre style="margin:0;background:${esc(palette.base)};color:${esc(palette.text)};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre">${body}</pre>`
    };
}

export async function write(
    payload: Clip,
    port: Port = navigator.clipboard
): Promise<"rich" | "plain"> {
    if (port.write && typeof ClipboardItem !== "undefined") {
        try {
            await port.write([
                new ClipboardItem({
                    "text/plain": new Blob([payload.plain], { type: "text/plain" }),
                    "text/html": new Blob([payload.rich], { type: "text/html" })
                })
            ]);
            return "rich";
        } catch {
            // The plain write below is the required compatibility fallback.
        }
    }
    await port.writeText(payload.plain);
    return "plain";
}
```

Implement `src/actions.tsx`:

```tsx
import type { ReactNode } from "react";

export type Action = {
    id: string;
    label: string;
    icon?: ReactNode;
    run: () => void | Promise<void>;
};
export type Actions = { show?: boolean; extensions?: readonly Action[] };
type SharePort = { share?: (data: ShareData) => Promise<void> };

export function canShare(port: SharePort = navigator): boolean {
    return typeof port.share === "function";
}

export async function share(code: string, port: SharePort = navigator): Promise<void> {
    if (!port.share) return;
    try {
        await port.share({ text: code });
    } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    }
}
```

- [x] **Step 4: Run focused and full React tests**

Run:

```bash
pnpm --dir packages/react-code-block exec vitest run --project unit test/clip.test.ts test/actions.test.ts
pnpm run test:react
```

Expected: PASS.

- [x] **Step 5: Commit React action helpers**

```bash
git add packages/react-code-block/src/clip.ts packages/react-code-block/src/actions.tsx packages/react-code-block/test/clip.test.ts packages/react-code-block/test/actions.test.ts
git commit -m "feat(react): add rich clip and share helpers"
```

---

### Task 3: React adaptive surface and sample

**Files:**

- Create: `packages/react-code-block/src/icons.tsx`
- Modify: `packages/react-code-block/src/index.tsx`
- Modify: `packages/react-code-block/test/CodeBlock.test.tsx`
- Modify: `packages/react-code-block/test/pixel.browser.test.tsx`
- Modify: `samples/react-code-block-sample/src/App.tsx`
- Modify: `samples/react-code-block-sample/src/styles.css`

**Interfaces:**

- Consumes: all React helpers from Tasks 1-2.
- Produces: `CodeBlockProps` with `mode?: Mode`, `theme?: Theme | CodeTokenTheme`, `label?: string | false`, `lines?: Lines`, and `actions?: Actions`; a complete header/action/body surface.

- [x] **Step 1: Add failing surface contract tests**

Extend `test/CodeBlock.test.tsx` with tests that:

```tsx
it("renders resolved label, line marks, built-ins, and extensions", async () => {
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
    expect(screen.getByTestId("code-lines")).toHaveTextContent("8\n9");
    expect(screen.getByTestId("code-lines")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: /copy/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /more/i })).toBeVisible();
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
```

Also mock `navigator.clipboard` and `navigator.share` to verify clip receives exact source, share receives `{ text: code }`, unsupported share is absent, extension selection calls `run`, and a successful clip changes the accessible state before resetting.

- [x] **Step 2: Run the surface tests and confirm failures**

Run:

```bash
pnpm --dir packages/react-code-block exec vitest run --project unit test/CodeBlock.test.tsx
```

Expected: FAIL because the new props and surface controls are not implemented.

- [x] **Step 3: Implement the adaptive React surface**

Use `useSyncExternalStore` around `matchMedia("(prefers-color-scheme: dark)")` for `automatic`; return `false` during server rendering. Resolve a legacy token map through `fixed`. Change the DOM from one `<pre role="region">` to this structure while keeping code text in one selectable `<pre><code>`:

```tsx
<section
    className={className}
    style={surfaceStyle}
    role="region"
    aria-label={ariaLabel ?? `${shownLanguage} code block`}
>
    {headVisible && (
        <div data-testid="code-head" style={headStyle}>
            {shownLanguage !== false && <span>{shownLanguage}</span>}
            {actionsShown && (
                <div style={actionStyle}>
                    <button
                        type="button"
                        aria-label={clipped ? "Copied" : "Copy code"}
                        onClick={onClip}
                    >
                        <ClipIcon done={clipped} />
                    </button>
                    {shareAvailable && (
                        <button
                            type="button"
                            aria-label="Share code"
                            onClick={() => void share(code)}
                        >
                            <ShareIcon />
                        </button>
                    )}
                    {extensions.length > 0 && (
                        <details ref={menuRef}>
                            <summary role="button" aria-label="More actions">
                                <MoreIcon />
                            </summary>
                            <div role="menu">
                                {extensions.map((action) => (
                                    <button
                                        role="menuitem"
                                        key={action.id}
                                        onClick={() => {
                                            void action.run();
                                            menuRef.current?.removeAttribute("open");
                                        }}
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    )}
    <div style={bodyStyle}>
        {lineMarks && (
            <pre aria-hidden="true" style={gutterStyle}>
                {lineMarks.join("\n")}
            </pre>
        )}
        <pre style={codeStyle}>
            <code>{content}</code>
        </pre>
    </div>
</section>
```

Implement `onClip` by building `html(code, renderedTokensOrPlain, activePalette)`, calling `write`, setting the icon state for 1.5 seconds, and exposing an `aria-live="polite"` status node. Apply `userSelect: "none"` to the gutter and chrome. Keep the existing font-size validation and asynchronous rendering flow unchanged.

Add `code` to `RenderedCodeBlock` and populate it in `renderCode`; continue taking clip/share payloads directly from the component's original `code` prop. Update the existing injection test to assert `container.querySelector("code")?.textContent` instead of the outer container text, because the outer region now intentionally contains chrome.

Create dependency-free inline SVG icons in `src/icons.tsx`; each icon is `aria-hidden` and uses `currentColor`.

- [x] **Step 4: Preserve legacy snapshots and add representative presentation snapshots**

In the existing all-language loop, pass:

```tsx
mode="dark"
label={false}
actions={{ show: false }}
```

Add representative browser cases for forced light, forced dark, `lines={{ show: true, start: 8 }}`, and one extension menu. Record new files only for those new cases; the 19 existing language images must remain unchanged.

Run:

```bash
pnpm run snapshot:react:visual:record
pnpm run snapshot:react:visual
```

Expected: both commands PASS and only named presentation screenshots are new.

- [x] **Step 5: Update the React sample and build it**

Pass an adaptive custom `theme`, `lines={{ show: true, start: 1 }}`, and one extension action to the sample `CodeBlock`. Add only layout CSS needed by the new outer surface; do not style internal implementation classes from the sample.

Run:

```bash
pnpm run sample:react:build
pnpm run test:react
```

Expected: both commands PASS.

- [x] **Step 6: Commit the React surface**

```bash
git add packages/react-code-block/src packages/react-code-block/test samples/react-code-block-sample
git commit -m "feat(react): add adaptive code block surface"
```

---

### Task 4: SwiftUI adaptive presentation model

**Files:**

- Create: `packages/swift-code-block/Sources/SwiftCodeBlock/Render/Presentation.swift`
- Create: `packages/swift-code-block/Sources/SwiftCodeBlock/Render/Marks.swift`
- Create: `packages/swift-code-block/Tests/SwiftCodeBlockTests/CodeBlockPresentationTests.swift`
- Modify: `packages/swift-code-block/Sources/SwiftCodeBlock/Render/CodeBlock.swift`
- Modify: `packages/swift-code-block/Tests/SwiftCodeBlockTests/CodeBlockThemeTests.swift`

**Interfaces:**

- Consumes: current SwiftUI `CodeBlockTheme` behavior and `CodeToken` scopes.
- Produces: nested `CodeBlock.Mode`, `Label`, `Palette`, `Theme`, `Lines`, `Action`, `Actions`; compatibility alias `CodeBlockTheme`; internal `Marks.make(code:start:)`.

- [x] **Step 1: Write failing model tests**

```swift
#if canImport(SwiftUI)
import SwiftUI
@testable import SwiftCodeBlock
import XCTest

final class CodeBlockPresentationTests: XCTestCase {
    func testModeSelectsExplicitAndAutomaticPalette() {
        let theme = CodeBlock.Theme(
            light: .init(base: .white, text: .black, muted: .gray, border: .gray, tokens: [:]),
            dark: .init(base: .black, text: .white, muted: .gray, border: .gray, tokens: [:])
        )
        XCTAssertEqual(CodeBlock.Mode.light.pick(theme, scheme: .dark).base, .white)
        XCTAssertEqual(CodeBlock.Mode.dark.pick(theme, scheme: .light).base, .black)
        XCTAssertEqual(CodeBlock.Mode.automatic.pick(theme, scheme: .dark).base, .black)
    }

    func testFixedThemeUsesOnePaletteForBothModes() {
        let fixed = CodeBlock.Theme(colors: ["plain": .red], background: .blue)
        XCTAssertEqual(fixed.light.base, .blue)
        XCTAssertEqual(fixed.dark.base, .blue)
        XCTAssertEqual(fixed.light.tokens["plain"], .red)
    }

    func testMarksHandleEverySeparatorAndClampStart() {
        XCTAssertEqual(Marks.make(code: "", start: 1), [1])
        XCTAssertEqual(Marks.make(code: "a\nb\r\nc\rd", start: 8), [8, 9, 10, 11])
        XCTAssertEqual(Marks.make(code: "a\n", start: 0), [1, 2])
    }
}
#endif
```

- [x] **Step 2: Run the focused test and confirm missing-type failures**

Run:

```bash
swift test --package-path . --filter CodeBlockPresentationTests
```

Expected: FAIL because the presentation types and `Marks` do not exist.

- [x] **Step 3: Implement native Swift value types**

Move the palette logic out of `CodeBlock.swift` and define this shape in `Presentation.swift`:

```swift
#if canImport(SwiftUI)
import SwiftUI

extension CodeBlock {
    public enum Mode: Sendable { case automatic, light, dark }
    public enum Label: Equatable, Sendable { case automatic, text(String), hidden }

    public struct Lines: Equatable, Sendable {
        public var show: Bool
        public var start: Int { didSet { start = max(start, 1) } }
        public init(show: Bool = false, start: Int = 1) { self.show = show; self.start = max(start, 1) }
    }

    public struct Palette {
        public var base: Color
        public var text: Color
        public var muted: Color
        public var border: Color
        public var tokens: [String: Color]

        public init(base: Color, text: Color, muted: Color, border: Color, tokens: [String: Color]) {
            self.base = base; self.text = text; self.muted = muted; self.border = border; self.tokens = tokens
        }

        func color(for scope: String) -> Color {
            var key = scope
            while !key.isEmpty {
                if let color = tokens[key] { return color }
                guard let dot = key.lastIndex(of: ".") else { break }
                key = String(key[..<dot])
            }
            return tokens["plain"] ?? text
        }
    }

    public struct Theme {
        public var light: Palette
        public var dark: Palette
        public init(light: Palette, dark: Palette) { self.light = light; self.dark = dark }
        public init(colors: [String: Color], background: Color = Color(red: 0.12, green: 0.12, blue: 0.12)) {
            let fixed = Palette(base: background, text: colors["plain"] ?? Color(red: 0.83, green: 0.83, blue: 0.83), muted: Color(red: 0.62, green: 0.62, blue: 0.62), border: Color(red: 0.23, green: 0.23, blue: 0.23), tokens: colors)
            self.init(light: fixed, dark: fixed)
        }
        public var colors: [String: Color] {
            get { dark.tokens }
            set { light.tokens = newValue; dark.tokens = newValue }
        }
        public var background: Color {
            get { dark.base }
            set { light.base = newValue; dark.base = newValue }
        }
        public static let standard = Theme(light: standardLight, dark: standardDark)
    }

    public struct Action: Identifiable {
        public let id: String
        public let label: String
        public let icon: Image?
        public let run: @MainActor () -> Void
        public init(id: String, label: String, icon: Image? = nil, run: @escaping @MainActor () -> Void) {
            self.id = id; self.label = label; self.icon = icon; self.run = run
        }
    }

    public struct Actions {
        public var show: Bool
        public var extensions: [Action]
        public init(show: Bool = true, extensions: [Action] = []) { self.show = show; self.extensions = extensions }
    }
}

public typealias CodeBlockTheme = CodeBlock.Theme

extension CodeBlock.Mode {
    func pick(_ theme: CodeBlock.Theme, scheme: ColorScheme) -> CodeBlock.Palette {
        switch self { case .light: theme.light; case .dark: theme.dark; case .automatic: scheme == .dark ? theme.dark : theme.light }
    }
}
#endif
```

Define `standardLight` with the React light semantic colors expressed as `Color` values and move the current standard colors unchanged into `standardDark`. Both maps must contain every normalized scope already asserted by `CodeBlockThemeTests`.

Create `Marks.swift`:

```swift
enum Marks {
    static func make(code: String, start: Int) -> [Int] {
        var count = 1
        var index = code.startIndex
        while index < code.endIndex {
            if code[index] == "\r" {
                let next = code.index(after: index)
                if next < code.endIndex, code[next] == "\n" { index = next }
                count += 1
            } else if code[index] == "\n" {
                count += 1
            }
            index = code.index(after: index)
        }
        let first = max(start, 1)
        return (0..<count).map { first + $0 }
    }
}
```

- [x] **Step 4: Run focused and full Swift tests**

Run:

```bash
swift test --package-path . --filter CodeBlockPresentationTests
pnpm run test:swift
```

Expected: PASS, including the external consumer build.

- [x] **Step 5: Commit the Swift model**

```bash
git add packages/swift-code-block/Sources/SwiftCodeBlock/Render packages/swift-code-block/Tests/SwiftCodeBlockTests
git commit -m "feat(swift): add adaptive presentation model"
```

---

### Task 5: Swift rich clip adapter

**Files:**

- Create: `packages/swift-code-block/Sources/SwiftCodeBlock/Utils/Clip.swift`
- Create: `packages/swift-code-block/Tests/SwiftCodeBlockTests/CodeBlockClipTests.swift`

**Interfaces:**

- Consumes: `CodeToken` and `CodeBlock.Palette` from Task 4.
- Produces: internal `Clip.Data`, `Clip.make(code:tokens:palette:fontSize:)`, and `Clip.write(_:)` used by the SwiftUI action row.

- [x] **Step 1: Write failing rich-data tests**

```swift
#if canImport(SwiftUI) && (canImport(UIKit) || canImport(AppKit))
import Foundation
import SwiftUI
@testable import SwiftCodeBlock
import XCTest

final class CodeBlockClipTests: XCTestCase {
    func testPayloadKeepsExactPlainTextAndReadableRTF() throws {
        let code = "let text = \"<&>\"\r\n"
        let palette = CodeBlock.Theme.standard.light
        let payload = Clip.make(code: code, tokens: [CodeToken(text: code, scope: "string")], palette: palette, fontSize: 14)
        XCTAssertEqual(payload.plain, code)
        let decoded = try NSAttributedString(data: XCTUnwrap(payload.rtf), options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil)
        XCTAssertEqual(decoded.string, code)
    }

    func testMismatchedTokensFallBackToExactSource() throws {
        let payload = Clip.make(code: "source", tokens: [CodeToken(text: "other", scope: "keyword")], palette: CodeBlock.Theme.standard.light, fontSize: 14)
        XCTAssertEqual(payload.plain, "source")
        let decoded = try NSAttributedString(data: XCTUnwrap(payload.rtf), options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil)
        XCTAssertEqual(decoded.string, "source")
    }
}
#endif
```

- [x] **Step 2: Run the test and confirm missing-type failures**

Run:

```bash
swift test --package-path . --filter CodeBlockClipTests
```

Expected: FAIL because `Clip` does not exist.

- [x] **Step 3: Implement attributed payload generation and native pasteboards**

In `Clip.swift`, conditionally alias `NativeColor`/`NativeFont` to UIKit or AppKit types, build an `NSMutableAttributedString` from exact token runs, and fall back to one plain run when concatenated token text differs from `code`. RTF encoding failure must leave `plain` intact with a nil `rtf`, so the writer can return `.plain` instead of failing the action.

```swift
enum Clip {
    struct Data: Equatable { let plain: String; let rtf: Foundation.Data? }
    enum Outcome: Equatable { case rich, plain, failed }

    static func make(code: String, tokens: [CodeToken], palette: CodeBlock.Palette, fontSize: CGFloat) -> Data {
        let exact = tokens.map(\.text).joined() == code
        let runs = exact ? tokens : [CodeToken(text: code, scope: "")]
        let value = NSMutableAttributedString(string: "")
        for token in runs {
            value.append(NSAttributedString(string: token.text, attributes: [
                .font: NativeFont.monospacedSystemFont(ofSize: fontSize, weight: .regular),
                .foregroundColor: NativeColor(palette.color(for: token.scope)),
                .backgroundColor: NativeColor(palette.base)
            ]))
        }
        let range = NSRange(location: 0, length: value.length)
        let rtf = try? value.data(from: range, documentAttributes: [.documentType: NSAttributedString.DocumentType.rtf])
        return Data(plain: code, rtf: rtf)
    }

    @MainActor static func write(_ data: Data) -> Outcome {
        #if canImport(UIKit)
        var item: [String: Any] = [UTType.utf8PlainText.identifier: data.plain]
        if let rtf = data.rtf { item[UTType.rtf.identifier] = rtf }
        UIPasteboard.general.setItems([item])
        guard UIPasteboard.general.string == data.plain else { return .failed }
        return data.rtf == nil ? .plain : .rich
        #elseif canImport(AppKit)
        let board = NSPasteboard.general
        board.clearContents()
        let plain = board.setString(data.plain, forType: .string)
        guard plain else { return .failed }
        guard let rtf = data.rtf else { return .plain }
        return board.setData(rtf, forType: .rtf) ? .rich : .plain
        #else
        return .failed
        #endif
    }
}
```

Import `UniformTypeIdentifiers` for UIKit. `NativeColor` conversion must use `UIColor(Color)` or `NSColor(Color)` on the package's supported OS versions.

- [x] **Step 4: Run Swift tests and formatting checks**

Run:

```bash
swift test --package-path . --filter CodeBlockClipTests
pnpm run format:swift:check
pnpm run test:swift
```

Expected: PASS.

- [x] **Step 5: Commit the Swift clip adapter**

```bash
git add packages/swift-code-block/Sources/SwiftCodeBlock/Utils/Clip.swift packages/swift-code-block/Tests/SwiftCodeBlockTests/CodeBlockClipTests.swift
git commit -m "feat(swift): add rich clip adapter"
```

---

### Task 6: SwiftUI header, actions, lines, snapshots, and sample

**Files:**

- Modify: `packages/swift-code-block/Sources/SwiftCodeBlock/Render/CodeBlock.swift`
- Modify: `packages/swift-code-block/Tests/SwiftCodeBlockTests/CodeBlockVisualSnapshotTests.swift`
- Create: `packages/swift-code-block/Tests/SwiftCodeBlockTests/CodeBlockSurfaceTests.swift`
- Modify: `packages/swift-code-block/Tests/Consumer/Sources/Consumer/main.swift`
- Modify: `samples/swift-code-block-sample/Sources/SwiftCodeBlockSample/SampleApp.swift`

**Interfaces:**

- Consumes: Tasks 4-5.
- Produces: the public SwiftUI initializer with `mode`, `theme`, `label`, `lines`, and `actions`; native clip, `ShareLink`, and extension `Menu` controls.

- [x] **Step 1: Write failing surface state and consumer tests**

Add pure internal helpers testable without UI inspection:

```swift
func testResolvedLabelUsesRenderedLanguageUnlessOverriddenOrHidden() {
    XCTAssertEqual(CodeBlockSurface.label(for: .automatic, requested: "js", rendered: "javascript"), "javascript")
    XCTAssertEqual(CodeBlockSurface.label(for: .text("JS"), requested: "js", rendered: "javascript"), "JS")
    XCTAssertNil(CodeBlockSurface.label(for: .hidden, requested: "js", rendered: "javascript"))
}

func testHeaderVisibilityTracksLabelAndActions() {
    XCTAssertFalse(CodeBlockSurface.hasHeader(label: nil, actions: .init(show: false)))
    XCTAssertTrue(CodeBlockSurface.hasHeader(label: "swift", actions: .init(show: false)))
    XCTAssertTrue(CodeBlockSurface.hasHeader(label: nil, actions: .init(show: true)))
}
```

Update the consumer source to compile an adaptive call:

```swift
let view = CodeBlock(
    "let answer = 42",
    language: "swift",
    mode: .automatic,
    label: .automatic,
    lines: .init(show: true, start: 8),
    actions: .init(extensions: [.init(id: "open", label: "Open", run: {})])
)
_ = view
```

- [x] **Step 2: Run focused tests and confirm failures**

Run:

```bash
swift test --package-path . --filter CodeBlockSurfaceTests
swift build --package-path packages/swift-code-block/Tests/Consumer
```

Expected: FAIL because the initializer and helpers do not exist.

- [x] **Step 3: Implement the SwiftUI surface**

Extend the initializer exactly as follows while retaining existing highlight arguments:

```swift
public init(
    _ code: String,
    language: String = "plain",
    fallbackLanguage: String = "plain",
    fontSize: CGFloat = 14,
    theme: Theme = .standard,
    mode: Mode = .automatic,
    label: Label = .automatic,
    lines: Lines = .init(),
    actions: Actions = .init()
)
```

Read `@Environment(\.colorScheme)` in `CodeBlock`, resolve the active palette with `mode.pick`, and pass the original source plus presentation values into `CodeBlockSurface`. The surface must:

- use a `VStack(spacing: 0)` with an optional leading-label/trailing-action header;
- render icon-only `Button` for clip, `ShareLink(item: code)` for share, and `Menu` only when extensions are non-empty;
- invoke `Clip.make` with successful tokens or one plain fallback run and call `Clip.write`;
- treat both `.rich` and `.plain` as success, change `doc.on.doc` to `checkmark` for 1.5 seconds, and expose an accessibility value; keep the normal glyph for `.failed`;
- render the gutter as a separate monospaced `Text` from `Marks.make`, marked `.accessibilityHidden(true)` and `.textSelection(.disabled)`;
- retain `.textSelection(.enabled)` on code content;
- remove the header entirely when the label is hidden and actions are not visible.

Use `Divider().overlay(palette.border)` between header and code, and palette colors for all chrome. Do not use a custom share sheet because `ShareLink` is available at iOS 16/macOS 13.

- [x] **Step 4: Preserve legacy images and add representative snapshots**

Pass a forced dark palette, `.hidden` label, and `Actions(show: false)` to the existing 19-fixture snapshot loop so its baselines remain unchanged. Add four named snapshot cases for light, dark, lines starting at 8, and one extension menu closed state.

Run:

```bash
pnpm run snapshot:swift:visual:record
pnpm run snapshot:swift:visual
```

Expected: PASS; existing fixture pixels remain unchanged and only the four new images are added.

- [x] **Step 5: Update the Swift sample and verify all Swift targets**

Show automatic mode, one custom adaptive theme, `Lines(show: true)`, and one extension action in `SampleApp.swift`.

Run:

```bash
pnpm run format:swift
pnpm run test:swift
pnpm run sample:swift:build
```

Expected: PASS.

- [x] **Step 6: Commit the SwiftUI surface**

```bash
git add packages/swift-code-block samples/swift-code-block-sample
git commit -m "feat(swift): add adaptive code block surface"
```

---

### Task 7: Compose adaptive model, line marks, and rich clip

**Files:**

- Create: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/Presentation.kt`
- Create: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/Marks.kt`
- Create: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/Clip.kt`
- Create: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlockPresentationTest.kt`
- Create: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlockClipTest.kt`
- Modify: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlock.kt`
- Modify: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlockThemeTest.kt`

**Interfaces:**

- Consumes: current `CodeBlockTheme`, `CodeToken`, and Android minSdk 24.
- Produces: `Mode`, `Label`, `Palette`, `Theme`, `Lines`, `Action`, `Actions`, compatibility alias `CodeBlockTheme`, `marks`, `ClipData`, `rich`, and `writeClip`.

- [x] **Step 1: Write failing presentation and clip tests**

```kotlin
class CodeBlockPresentationTest {
    @Test fun modeSelectsExplicitAndAutomaticPalette() {
        assertEquals(Theme.Standard.light, Mode.Light.pick(Theme.Standard, dark = false))
        assertEquals(Theme.Standard.dark, Mode.Dark.pick(Theme.Standard, dark = false))
        assertEquals(Theme.Standard.dark, Mode.Automatic.pick(Theme.Standard, dark = true))
    }

    @Test fun fixedThemeMapsOnePaletteToBothModes() {
        val fixed = Theme(colors = mapOf("plain" to Color.Red), background = Color.Blue)
        assertEquals(fixed.light, fixed.dark)
    }

    @Test fun marksCountSeparatorsAndClampStart() {
        assertEquals(listOf(1), marks("", 1))
        assertEquals(listOf(8, 9, 10, 11), marks("a\nb\r\nc\rd", 8))
        assertEquals(listOf(1, 2), marks("a\n", -2))
    }
}
```

```kotlin
@RunWith(RobolectricTestRunner::class)
class CodeBlockClipTest {
    @Test fun richClipKeepsExactPlainTextAndEscapesHtml() {
        val code = "<tag>&\"x\"</tag>\r\n"
        val payload = rich(code, listOf(CodeToken(code, "string")), Theme.Standard.light)
        assertEquals(code, payload.plain)
        assertTrue(payload.html.contains("&lt;tag&gt;&amp;&quot;x&quot;&lt;/tag&gt;"))
        assertFalse(payload.html.contains("<tag>"))
    }

    @Test fun writerAddsPlainAndHtmlToOnePrimaryClip() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertTrue(writeClip(context, ClipData("a\r\n", "<pre>a\r\n</pre>")))
        val board = context.getSystemService(ClipboardManager::class.java)
        assertEquals("a\r\n", board.primaryClip!!.getItemAt(0).text.toString())
        assertEquals("<pre>a\r\n</pre>", board.primaryClip!!.getItemAt(0).htmlText)
    }
}
```

- [x] **Step 2: Run focused tests and confirm missing-type failures**

Run:

```bash
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest --tests "*CodeBlockPresentationTest" --tests "*CodeBlockClipTest"
```

Expected: FAIL because the new model and clip helpers do not exist.

- [x] **Step 3: Implement Compose-native value types and compatibility**

Create `Presentation.kt`:

```kotlin
package io.github.dongyuzhao.composecodeblock

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

enum class Mode { Automatic, Light, Dark }
sealed interface Label { data object Automatic : Label; data class Text(val value: String) : Label; data object Hidden : Label }
data class Lines(val show: Boolean = false, val start: Int = 1)

data class Palette(
    val base: Color,
    val text: Color,
    val muted: Color,
    val border: Color,
    val tokens: Map<String, Color>
) {
    fun color(scope: String): Color {
        var key = scope
        while (key.isNotEmpty()) {
            tokens[key]?.let { return it }
            key = key.substringBeforeLast(".", "")
        }
        return tokens["plain"] ?: text
    }
}

data class Theme(val light: Palette, val dark: Palette) {
    constructor(colors: Map<String, Color>, background: Color = Color(0xFF1E1E1E)) : this(
        Palette(background, colors["plain"] ?: Color.White, Color(0xFF9D9D9D), Color(0xFF3A3A3A), colors),
        Palette(background, colors["plain"] ?: Color.White, Color(0xFF9D9D9D), Color(0xFF3A3A3A), colors)
    )
    val colors: Map<String, Color> get() = dark.tokens
    val background: Color get() = dark.base
    fun colorFor(token: CodeToken, fallback: Color): Color {
        var key = token.scope
        while (key.isNotEmpty()) {
            colors[key]?.let { return it }
            key = key.substringBeforeLast(".", "")
        }
        return colors["plain"] ?: fallback
    }
    companion object { val Standard = Theme(light = standardLight, dark = standardDark) }
}

typealias CodeBlockTheme = Theme

data class Action(val id: String, val label: String, val icon: (@Composable () -> Unit)? = null, val run: () -> Unit)
data class Actions(val show: Boolean = true, val extensions: List<Action> = emptyList())

internal fun Mode.pick(theme: Theme, dark: Boolean): Palette = when (this) {
    Mode.Light -> theme.light
    Mode.Dark -> theme.dark
    Mode.Automatic -> if (dark) theme.dark else theme.light
}
```

Move the exact current token map into `standardDark`; add the complete light map from Task 1 using `Color(0xFF...)`. Keep `CodeBlockTheme(colors, background)`, `.colors`, `.background`, and `.Standard` source-compatible.

Create `Marks.kt`:

```kotlin
internal fun marks(code: String, start: Int): List<Int> {
    var count = 1
    var index = 0
    while (index < code.length) {
        if (code[index] == '\r') {
            if (index + 1 < code.length && code[index + 1] == '\n') index++
            count++
        } else if (code[index] == '\n') {
            count++
        }
        index++
    }
    val first = start.coerceAtLeast(1)
    return List(count) { first + it }
}
```

- [x] **Step 4: Implement safe HTML and Android clipboard writing**

Create `Clip.kt`:

Import `android.content.ClipboardManager`, `android.content.Context`, `androidx.compose.ui.graphics.Color`, and `androidx.compose.ui.graphics.toArgb`.

```kotlin
internal data class ClipData(val plain: String, val html: String)

private fun esc(value: String) = value
    .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    .replace("\"", "&quot;").replace("'", "&#39;")

private fun Color.css(): String = String.format("#%06X", toArgb() and 0xFFFFFF)

internal fun rich(code: String, tokens: List<CodeToken>?, palette: Palette): ClipData {
    val exact = tokens != null && tokens.joinToString("") { it.text } == code
    val runs = if (exact) tokens!! else listOf(CodeToken(code, ""))
    val body = runs.joinToString("") { token ->
        "<span style=\"color:${esc(palette.color(token.scope).css())}\">${esc(token.text)}</span>"
    }
    return ClipData(
        plain = code,
        html = "<pre style=\"margin:0;background:${palette.base.css()};color:${palette.text.css()};font-family:monospace;white-space:pre\">$body</pre>"
    )
}

internal fun writeClip(context: Context, data: ClipData): Boolean = runCatching {
    val board = context.getSystemService(ClipboardManager::class.java)
    board.setPrimaryClip(android.content.ClipData.newHtmlText("code", data.plain, data.html))
}.isSuccess
```

- [x] **Step 5: Run focused and full Compose tests**

Run:

```bash
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest --tests "*CodeBlockPresentationTest" --tests "*CodeBlockClipTest"
pnpm run test:android
```

Expected: PASS.

- [x] **Step 6: Commit the Compose model**

```bash
git add packages/compose-code-block/src/main/kotlin packages/compose-code-block/src/test/kotlin
git commit -m "feat(compose): add adaptive presentation model"
```

---

### Task 8: Compose header, actions, share, lines, snapshots, and sample

**Files:**

- Create: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/Glyph.kt`
- Modify: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlock.kt`
- Create: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlockActionTest.kt`
- Modify: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlockScreenshotTest.kt`
- Modify: `samples/compose-code-block-sample/app/src/main/kotlin/io/github/dongyuzhao/composecodeblocksample/MainActivity.kt`

**Interfaces:**

- Consumes: Task 7.
- Produces: public Compose presentation parameters, Canvas-based built-in glyphs, Android share chooser, extension `DropdownMenu`, and the full adaptive surface.

- [x] **Step 1: Add failing Compose UI contracts**

Use `createComposeRule()` and an internal `CodeBlockSurface` capability injection to test:

```kotlin
@Test fun surfaceShowsBuiltInsAndInvokesExtensionFromMenu() {
    var ran = false
    rule.setContent {
        CodeBlockSurface(
            code = "a\nb",
            renderState = CodeRenderState.Succeeded(RenderedCodeBlock("a\nb", "kotlin", listOf(CodeToken("a\nb", "")))),
            options = CodeRenderOptions(language = "kotlin"),
            palette = Theme.Standard.light,
            label = Label.Automatic,
            lines = Lines(show = true, start = 8),
            actions = Actions(extensions = listOf(Action("open", "Open", run = { ran = true }))),
            clip = { true },
            share = {}
        )
    }
    rule.onNodeWithContentDescription("Copy code").assertExists()
    rule.onNodeWithContentDescription("Share code").assertExists()
    rule.onNodeWithContentDescription("More actions").performClick()
    rule.onNodeWithText("Open").performClick()
    assertTrue(ran)
}
```

Add tests for custom/hidden labels, absent header, `actions.show = false`, absent share capability, exact line-mark text with hidden semantics, clip success state, and render fallback with available actions.

- [x] **Step 2: Run the UI test and confirm signature failures**

Run:

```bash
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest --tests "*CodeBlockActionTest"
```

Expected: FAIL because the adaptive surface signature and actions do not exist.

- [x] **Step 3: Implement dependency-free glyphs and Android share**

Create `Glyph.kt` with an internal `Glyph` enum (`Clip`, `Done`, `Share`, `More`) and one `Canvas` composable. Draw clip as two offset rectangles, done as two joined strokes, share as three circles with two connecting lines, and more as three circles. Use `LocalContentColor`; the Canvas is decorative and receives no semantics.

In `CodeBlock.kt`, define:

```kotlin
private fun sharePort(context: Context, code: String): (() -> Unit)? {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, code)
    if (send.resolveActivity(context.packageManager) == null) return null
    return {
        val chooser = Intent.createChooser(send, null)
        if (context !is Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }
}
```

The shared text must be the original source only. Do not add an Android share dependency.

- [x] **Step 4: Implement the adaptive Compose surface**

Preserve the existing first five arguments for source compatibility and append presentation arguments:

```kotlin
@Composable
fun CodeBlock(
    code: String,
    modifier: Modifier = Modifier,
    options: CodeRenderOptions = CodeRenderOptions(),
    theme: Theme = Theme.Standard,
    color: Color = LocalContentColor.current,
    mode: Mode = Mode.Automatic,
    label: Label = Label.Automatic,
    lines: Lines = Lines(),
    actions: Actions = Actions()
)
```

Keep `LaunchedEffect(code, options)` unchanged so presentation changes never retokenize. Resolve `mode` with `isSystemInDarkTheme()`. Refactor `CodeBlockSurface` into:

```kotlin
Column(modifier.clip(RoundedCornerShape(8.dp)).background(palette.base)) {
    if (headVisible) Header(labelText, actions, clip, share, palette)
    if (headVisible) HorizontalDivider(color = palette.border)
    Row(Modifier.horizontalScroll(rememberScrollState()).padding(12.dp)) {
        if (lines.show) Text(marks(code, lines.start).joinToString("\n"), Modifier.clearAndSetSemantics { }, color = palette.muted, style = mono)
        SelectionContainer { CodeContent(renderState, palette, color, mono) }
    }
}
```

The header uses `IconButton` in clip/share/menu order. `DropdownMenu` is composed only when extensions are non-empty. Invoke extension `run` and close the menu. Clip uses `rich(code, successfulTokensOrNull, palette)` and `writeClip`; success swaps the glyph for 1.5 seconds and announces state through semantics. All icons are icon-only; extension labels are visible only inside the menu.

- [x] **Step 5: Preserve legacy images and add representative Compose snapshots**

Pass forced dark mode, hidden label, actions off, and lines off to the existing 19-fixture loop. Add four named Roborazzi cases for light, dark, lines starting at 8, and the closed extension action surface.

Run:

```bash
pnpm run snapshot:android:visual:record
pnpm run snapshot:android:visual
```

Expected: PASS; existing images remain unchanged and only four presentation images are added.

- [x] **Step 6: Update the Compose sample and verify builds**

Demonstrate automatic mode, a custom two-palette `Theme`, `Lines(show = true)`, and one extension `Action` in `MainActivity.kt`.

Run:

```bash
pnpm run test:android
pnpm run sample:android:build
```

Expected: PASS.

- [x] **Step 7: Commit the Compose surface**

```bash
git add packages/compose-code-block samples/compose-code-block-sample
git commit -m "feat(compose): add adaptive code block surface"
```

---

### Task 9: Cross-platform documentation and final verification

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-10-code-block-presentation.md` only to mark completed checkboxes during execution

**Interfaces:**

- Consumes: completed public APIs from Tasks 1-8.
- Produces: copy-ready usage for all bindings and final evidence that every contract passes together.

- [x] **Step 1: Update README usage and behavior tables**

Add one concise example per binding showing `mode`, a custom adaptive `theme`, automatic/custom/hidden `label`, `lines`, and one extension in `actions`. Document that clip writes exact plain plus rich data, share is capability-gated, extensions live in a trailing menu, and a fixed legacy palette applies to both modes.

Also list the defaults exactly:

```text
mode: automatic
theme: standard light + dark
label: resolved language
lines: hidden, start 1
actions: shown, no extensions
```

- [ ] **Step 2: Run format and source-contract checks**

Run:

```bash
pnpm run format
pnpm run format:check
pnpm run format:swift
pnpm run format:swift:check
pnpm run test:shared
```

Expected: all commands PASS and shared token/query/golden files are unchanged.

Execution note (2026-07-10): scoped Prettier checks for every changed file, Swift formatting,
and shared source-contract checks pass. The repository-wide Prettier check still reports eight
pre-existing legacy/vendor Markdown files; they remain untouched to avoid an unrelated rewrite.

- [x] **Step 3: Run every unit and integration suite**

Run:

```bash
pnpm run test:all
```

Expected: shared, React, Swift, Swift consumer, and Compose tests PASS.

- [x] **Step 4: Run all visual suites**

Run:

```bash
pnpm run snapshot:react:visual
pnpm run snapshot:swift:visual
pnpm run snapshot:android:visual
```

Expected: all visual suites PASS against committed baselines.

- [x] **Step 5: Build all samples and package targets**

Run:

```bash
pnpm --dir packages/react-code-block run build
pnpm run sample:react:build
pnpm run sample:swift:build
pnpm run sample:android:build
```

Expected: all builds PASS.

- [x] **Step 6: Check the final diff for scope and generated artifacts**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Expected: only planned source, tests, docs, sample changes, and intentional new presentation snapshots are present; no C core, generated token payload, `.build`, Gradle cache, `dist`, or unrelated files are staged.

- [x] **Step 7: Commit documentation and final adjustments**

```bash
git add README.md docs/superpowers/plans/2026-07-10-code-block-presentation.md
git commit -m "docs: document adaptive code block controls"
```

---

### Task 10: Review remediation and first-release API cleanup

**Files:**

- Modify: `packages/react-code-block/src/index.tsx`
- Modify: `packages/react-code-block/src/theme.ts`
- Modify: `packages/react-code-block/src/actions.tsx`
- Modify: `packages/react-code-block/test/*.test.tsx`
- Modify: `packages/react-code-block/test/*.test.ts`
- Modify: `packages/swift-code-block/Sources/SwiftCodeBlock/Render/CodeBlock.swift`
- Modify: `packages/swift-code-block/Sources/SwiftCodeBlock/Render/CodeRenderer.swift`
- Modify: `packages/swift-code-block/Sources/SwiftCodeBlock/Render/Presentation.swift`
- Modify: `packages/swift-code-block/Sources/SwiftCodeBlock/Utils/CodeHighlighter.swift`
- Modify: `packages/swift-code-block/Tests/SwiftCodeBlockTests/*.swift`
- Modify: `packages/compose-code-block/src/main/AndroidManifest.xml`
- Modify: `packages/compose-code-block/src/main/kotlin/io/github/dongyuzhao/composecodeblock/{CodeBlock,CodeHighlighter,CodeRenderer,CodeTypes,Presentation}.kt`
- Modify: `packages/compose-code-block/src/test/kotlin/io/github/dongyuzhao/composecodeblock/*.kt`
- Modify: all three samples, `README.md`, and this design/plan pair where their public signatures are shown

**Interfaces:**

- Highlighting accepts only `HighlightOptions { language, fallbackLanguage }` on every platform.
- React sizing uses the native root `style`; SwiftUI keeps `fontSize: CGFloat`; Compose accepts `style: TextStyle`.
- Render state is only pending, succeeded, or failed. A failure carries exact source plus an optional diagnostic string, with no public reason enum.
- Every theme is adaptive. Compatibility-only token-map inputs, fixed constructors, aliases, and setters are absent.
- React forwards native section attributes and a root ref. Compose exposes `Theme.standard` using Kotlin casing.

- [x] **Step 1: Correct review-confirmed behavior defects with focused RED → GREEN tests**

Cover complete render-request identity, extreme starting line values, accessibility naming and line descriptions, React menu keyboard/focus/overflow behavior, Android share visibility and launch races, palette fallback, and decorative extension icons.

- [x] **Step 2: Write failing first-release API and presentation-separation contracts**

The desired public signatures are:

```ts
export type HighlightOptions = {
    readonly language?: string;
    readonly fallbackLanguage?: string;
};

export type CodeBlockProps = Omit<
    React.ComponentPropsWithoutRef<"section">,
    "children" | "dangerouslySetInnerHTML"
> &
    HighlightOptions & {
        readonly code: string;
        readonly mode?: Mode;
        readonly theme?: Theme;
        readonly label?: string | false;
        readonly lines?: Lines;
        readonly actions?: Actions;
    };
```

```swift
public struct HighlightOptions: Equatable, Sendable {
    public var language: String
    public var fallbackLanguage: String
}

public init(
    _ code: String,
    language: String = "plain",
    fallbackLanguage: String = "plain",
    fontSize: CGFloat = 14,
    mode: Mode = .automatic,
    theme: Theme = .standard,
    label: Label = .automatic,
    lines: Lines = .init(),
    actions: Actions = .init()
)
```

```kotlin
data class HighlightOptions(
    val language: String = "plain",
    val fallbackLanguage: String = "plain"
)

@Composable
fun CodeBlock(
    code: String,
    modifier: Modifier = Modifier,
    language: String = "plain",
    fallbackLanguage: String = "plain",
    mode: Mode = Mode.Automatic,
    theme: Theme = Theme.standard,
    style: TextStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp),
    label: Label = Label.Automatic,
    lines: Lines = Lines(),
    actions: Actions = Actions()
)
```

Tests must first fail because sizing still participates in highlight requests, old theme forms remain accepted, React does not yet forward native root props/ref, or Compose does not yet accept `TextStyle`.

- [x] **Step 3: Remove compatibility-only theme surfaces**

React accepts only `Theme` and removes `CodeTokenTheme`, `defaultCodeTokenTheme`, `fixed`, public helper re-exports, and runtime shape checks. Swift removes `CodeBlockTheme`, `Theme(colors:background:)`, `colors`, and `background`. Compose removes `CodeBlockTheme`, the fixed constructor, `colors`, `background`, and `colorFor`; rename `Theme.Standard` to `Theme.standard`.

- [x] **Step 4: Separate highlighting from presentation and make requests exact**

Rename Swift and Compose `CodeRenderOptions` to `HighlightOptions`. Remove font size and scale from every renderer request. React uses root CSS with an internal `14px` default, Swift clamps and scales its view-only `fontSize`, and Compose applies one native `TextStyle` to highlighted, fallback, and gutter text. Theme, mode, style, label, lines, actions, and Dynamic Type changes must not restart tokenization.

- [x] **Step 5: Collapse render failures to one truthful failed state**

Remove `CodeRenderFailureReason` and each fallback `reason` field. Keep exact source and an optional diagnostic. Cancellation closes or propagates without emitting failure. Add `Equatable, Sendable` to Swift `CodeRenderState`; add `Hashable, CaseIterable` to Swift `Mode`.

- [x] **Step 6: Finish native surface cleanup and docs**

React uses `forwardRef`, inherited safe section attributes, native `aria-label`, combined `aria-describedby`, deeply readonly and runtime-frozen standard theme values, logical CSS positioning, and a root-only package export boundary. Update samples, consumer builds, README, design, and examples to contain only the final API.

- [x] **Step 7: Run focused and full verification**

Run:

```bash
pnpm --dir packages/react-code-block run build
pnpm --dir packages/react-code-block exec vitest run --project unit
pnpm run snapshot:react:visual
pnpm run format:swift
pnpm run test:swift
pnpm run snapshot:swift:visual
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest
pnpm run snapshot:android:visual
pnpm run sample:react:build
pnpm run sample:swift:build
pnpm run sample:android:build
```

Expected: all commands PASS, merged Android manifests contain the `ACTION_SEND`/`text/plain` query, and no presentation-only change restarts tokenization.

Current status: focused and aggregate verification is complete. React browser
tests pass 28/28, Android unit tests pass 68/68, Android Roborazzi verification
and all three sample builds pass, and the merged library and sample manifests
contain the `ACTION_SEND`/`text/plain` query.

- [x] **Step 8: Commit the reviewed remediation**

```bash
git add README.md docs packages samples
git commit -m "fix: refine cross-platform code block APIs"
```

---

## Completion Criteria

- All three bindings expose idiomatic forms of `mode`, adaptive `theme`, `label`, `lines`, and `actions` with the approved defaults.
- Clip writes exact plain source and a rich representation; share uses exact plain source; neither contains chrome or line numbers.
- The header has stable built-in order and a conditional extension menu.
- Existing token streams and C integration remain untouched.
- Unit, visual, consumer, package, and sample commands above all pass from a clean checkout.
