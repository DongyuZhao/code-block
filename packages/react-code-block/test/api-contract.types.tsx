import { createRef } from "react";

import {
    CodeBlock,
    standard,
    type CodeRenderFallback,
    type HighlightOptions,
    type Theme
} from "../src/index.js";

// @ts-expect-error CodeRenderOptions was removed before the first release.
import type { CodeRenderOptions } from "../src/index.js";
// @ts-expect-error CodeTokenTheme was removed before the first release.
import type { CodeTokenTheme } from "../src/index.js";
// @ts-expect-error defaultCodeTokenTheme was removed before the first release.
import { defaultCodeTokenTheme } from "../src/index.js";
// @ts-expect-error fixed was removed from the public package surface.
import { fixed } from "../src/index.js";
// @ts-expect-error pick is an implementation detail, not public API.
import { pick } from "../src/index.js";
// @ts-expect-error tokenColor is an implementation detail, not public API.
import { tokenColor } from "../src/index.js";
// @ts-expect-error The mutable cached highlighter implementation is module-private.
import { loadHighlighter } from "../src/index.js";

const options: HighlightOptions = { language: "typescript", fallbackLanguage: "plain" };
// @ts-expect-error HighlightOptions values are readonly.
options.language = "javascript";
// @ts-expect-error Presentation sizing is not a highlighting input.
const sizedOptions: HighlightOptions = { language: "plain", fontSize: 16 };

const fallback: CodeRenderFallback = { text: "exact source", error: "offline" };
void fallback;

const theme: Theme = standard;
// @ts-expect-error Adaptive theme palettes are deeply readonly.
theme.light.tokens.plain = "#000000";
// @ts-expect-error Compatibility token maps are not themes.
const tokenMapTheme: Theme = { plain: "#000000" };

const root = createRef<HTMLElement>();
const nativeSection = (
    <CodeBlock
        ref={root}
        code="const answer = 42;"
        id="example"
        data-kind="sample"
        aria-label="Example source"
        aria-describedby="details"
        onClick={() => undefined}
        style={{ fontSize: "1.25rem" }}
    />
);
void nativeSection;

// @ts-expect-error Dedicated fontSize was removed in favor of native style.
const legacySize = <CodeBlock code="x" fontSize={16} />;
// @ts-expect-error Dedicated scale was removed in favor of native style.
const legacyScale = <CodeBlock code="x" scale={2} />;
// @ts-expect-error ariaLabel was replaced by the native aria-label attribute.
const legacyLabel = <CodeBlock code="x" ariaLabel="Example" />;
// @ts-expect-error A fixed token map is not an adaptive Theme.
const legacyTheme = <CodeBlock code="x" theme={{ plain: "#000000" }} />;
// @ts-expect-error CodeBlock owns its children and does not accept an HTML replacement.
const unsafeHtml = <CodeBlock code="x" dangerouslySetInnerHTML={{ __html: "unsafe" }} />;

void sizedOptions;
void tokenMapTheme;
void legacySize;
void legacyScale;
void legacyLabel;
void legacyTheme;
void (undefined as unknown as CodeRenderOptions);
void (undefined as unknown as CodeTokenTheme);
void defaultCodeTokenTheme;
void fixed;
void pick;
void tokenColor;
void loadHighlighter;
void unsafeHtml;
