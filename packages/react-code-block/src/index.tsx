import React, {
    forwardRef,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore
} from "react";
import { canShare, share, type Action, type Actions } from "./actions.js";
import { html, write } from "./clip.js";
import {
    highlightCode,
    type CodeToken,
    type CodeTokens,
    type HighlightOptions
} from "./code-highlighter.js";
import { ClipIcon, MoreIcon, ShareIcon } from "./icons.js";
import { marks } from "./lines.js";
import {
    pick,
    standard,
    tokenColor,
    type Lines,
    type Mode,
    type Palette,
    type Theme
} from "./theme.js";

const darkModeQuery = "(prefers-color-scheme: dark)";
const defaultActions: Actions = {};
const defaultLines: Lines = {};
const noExtensions: readonly Action[] = [];
const pendingState: CodeRenderState = { status: "pending" };

export type CodeRenderFallback = {
    readonly text: string;
    readonly error?: string;
};

export type RenderedCodeBlock = {
    readonly code: string;
    readonly language: string;
    readonly tokens: CodeToken[];
};

export type CodeRenderState =
    | { readonly status: "pending" }
    | { readonly status: "succeeded"; readonly rendered: RenderedCodeBlock }
    | { readonly status: "failed"; readonly fallback: CodeRenderFallback };

type ClipFeedback = {
    source: string;
    status: "idle" | "copied" | "failed";
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

export { highlightCode } from "./code-highlighter.js";
export type { CodeToken, CodeTokens, HighlightOptions };
export { standard } from "./theme.js";
export type { Lines, Mode, Palette, Theme } from "./theme.js";
export type { Action, Actions } from "./actions.js";

export async function* renderCode(
    code: string,
    options: HighlightOptions = {}
): AsyncGenerator<CodeRenderState> {
    yield { status: "pending" };

    try {
        const result = await highlightCode(code, {
            language: options.language ?? "plain",
            fallbackLanguage: options.fallbackLanguage ?? "plain"
        });
        yield {
            status: "succeeded",
            rendered: { code, language: result.language, tokens: result.tokens }
        };
    } catch (error) {
        if (isAbortError(error)) {
            throw error;
        }
        yield {
            status: "failed",
            fallback: {
                text: code,
                error: error instanceof Error ? error.message : String(error)
            }
        };
    }
}

export function useCodeRenderState(code: string, options: HighlightOptions = {}): CodeRenderState {
    const language = options.language ?? "plain";
    const fallbackLanguage = options.fallbackLanguage ?? "plain";
    const request = useMemo(
        () => ({ code, language, fallbackLanguage }),
        [code, language, fallbackLanguage]
    );
    const [result, setResult] = useState(() => ({ request, state: pendingState }));

    useEffect(() => {
        let active = true;

        async function run() {
            try {
                for await (const nextState of renderCode(request.code, {
                    language: request.language,
                    fallbackLanguage: request.fallbackLanguage
                })) {
                    if (!active) {
                        return;
                    }
                    setResult({ request, state: nextState });
                }
            } catch (error) {
                if (!isAbortError(error)) {
                    throw error;
                }
            }
        }

        void run();
        return () => {
            active = false;
        };
    }, [request]);

    return result.request === request ? result.state : pendingState;
}

export const CodeBlock: React.ForwardRefExoticComponent<
    CodeBlockProps & React.RefAttributes<HTMLElement>
> = forwardRef<HTMLElement, CodeBlockProps>(function CodeBlock(
    {
        code,
        language = "plain",
        fallbackLanguage = "plain",
        mode = "automatic",
        theme = standard,
        label,
        lines = defaultLines,
        actions = defaultActions,
        style,
        role = "region",
        "aria-label": ariaLabel,
        "aria-describedby": describedBy,
        ...unsafeSectionProps
    },
    ref
) {
    const { dangerouslySetInnerHTML: _ignoredDangerouslySetInnerHTML, ...sectionProps } =
        unsafeSectionProps as typeof unsafeSectionProps & {
            dangerouslySetInnerHTML?: unknown;
        };
    const state = useCodeRenderState(code, { language, fallbackLanguage });
    const dark = useSyncExternalStore(
        mode === "automatic" ? subscribeToDarkMode : subscribeNever,
        mode === "automatic" ? darkModeSnapshot : lightModeSnapshot,
        lightModeSnapshot
    );
    const shareSupported = useSyncExternalStore(subscribeNever, canShare, lightModeSnapshot);
    const palette = pick(theme, mode, dark);
    const shownLanguage =
        label === false
            ? false
            : (label ?? (state.status === "succeeded" ? state.rendered.language : language));
    const actionsShown = actions.show !== false;
    const extensions = actions.extensions ?? noExtensions;
    const shareAvailable = actionsShown && shareSupported;
    const headVisible = shownLanguage !== false || actionsShown;
    const lineMarks = lines.show ? marks(code, lines.start) : null;
    const [clipFeedback, setClipFeedback] = useState<ClipFeedback>({
        source: code,
        status: "idle"
    });
    const clipTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const clipGenerationRef = useRef(0);
    const currentCodeRef = useRef(code);
    const clipSourceRef = useRef(code);
    const lineDescriptionId = useId();
    currentCodeRef.current = code;
    const clipState = clipFeedback.source === code ? clipFeedback.status : "idle";
    const clipped = clipState === "copied";
    const clipMessage =
        clipState === "copied"
            ? "Copied to clipboard"
            : clipState === "failed"
              ? "Unable to copy code"
              : "";
    const regionLanguage = shownLanguage === false ? language : shownLanguage;
    const resolvedAriaLabel = ariaLabel ?? `${regionLanguage} code block`;
    const resolvedDescription = [describedBy, lineMarks ? lineDescriptionId : undefined]
        .filter((value): value is string => Boolean(value))
        .join(" ");
    const resolvedSurfaceStyle = codeBlockStyle(style, palette);
    const resolvedHeadStyle = headStyle(palette);
    const resolvedBodyStyle = bodyStyle();
    const resolvedGutterStyle = gutterStyle(palette);
    const resolvedCodeStyle = codeStyle(palette);
    const resolvedActionStyle = actionStyle();
    const resolvedControlStyle = controlStyle(palette);
    const resolvedMenuStyle = menuStyle(palette);
    const resolvedMenuItemStyle = menuItemStyle(palette);

    useEffect(() => {
        if (clipSourceRef.current === code) {
            return;
        }
        clipSourceRef.current = code;
        clipGenerationRef.current += 1;
        if (clipTimerRef.current !== undefined) {
            clearTimeout(clipTimerRef.current);
            clipTimerRef.current = undefined;
        }
        setClipFeedback({ source: code, status: "idle" });
    }, [code]);

    useEffect(
        () => () => {
            clipGenerationRef.current += 1;
            if (clipTimerRef.current !== undefined) {
                clearTimeout(clipTimerRef.current);
                clipTimerRef.current = undefined;
            }
        },
        []
    );

    const content = useMemo(() => {
        if (state.status === "succeeded") {
            return renderTokenSpans(state.rendered.tokens, palette);
        }
        if (state.status === "failed") {
            return state.fallback.text;
        }
        return null;
    }, [state, palette]);

    function onClip(): void {
        if (clipTimerRef.current !== undefined) {
            clearTimeout(clipTimerRef.current);
            clipTimerRef.current = undefined;
        }
        const generation = ++clipGenerationRef.current;
        const source = code;
        setClipFeedback({ source, status: "idle" });

        const tokens =
            state.status === "succeeded" && state.rendered.code === code
                ? state.rendered.tokens
                : [{ text: code, scope: "" }];
        const payload = html(code, tokens, palette);
        const result = write(payload);

        void result.then(
            () => {
                if (clipGenerationRef.current !== generation || currentCodeRef.current !== source) {
                    return;
                }
                setClipFeedback({ source, status: "copied" });
                clipTimerRef.current = setTimeout(() => {
                    if (clipGenerationRef.current !== generation) {
                        return;
                    }
                    clipTimerRef.current = undefined;
                    setClipFeedback({ source, status: "idle" });
                }, 1_500);
            },
            () => {
                if (clipGenerationRef.current === generation && currentCodeRef.current === source) {
                    setClipFeedback({ source, status: "failed" });
                }
            }
        );
    }

    return (
        <section
            {...sectionProps}
            ref={ref}
            style={resolvedSurfaceStyle}
            role={role}
            aria-label={resolvedAriaLabel}
            aria-describedby={resolvedDescription || undefined}
        >
            {headVisible ? (
                <div data-testid="code-head" style={resolvedHeadStyle}>
                    {shownLanguage !== false ? (
                        <span aria-hidden="true">{shownLanguage}</span>
                    ) : null}
                    {actionsShown ? (
                        <div style={resolvedActionStyle}>
                            <button
                                type="button"
                                aria-label={clipped ? "Copied" : "Copy code"}
                                onClick={onClip}
                                style={resolvedControlStyle}
                            >
                                <ClipIcon done={clipped} />
                            </button>
                            {shareAvailable ? (
                                <button
                                    type="button"
                                    aria-label="Share code"
                                    onClick={() => void share(code)}
                                    style={resolvedControlStyle}
                                >
                                    <ShareIcon />
                                </button>
                            ) : null}
                            {extensions.length > 0 ? (
                                <ExtensionMenu
                                    extensions={extensions}
                                    control={resolvedControlStyle}
                                    menu={resolvedMenuStyle}
                                    item={resolvedMenuItemStyle}
                                />
                            ) : null}
                            <span role="status" aria-live="polite" style={statusStyle}>
                                {clipMessage}
                            </span>
                        </div>
                    ) : null}
                </div>
            ) : null}
            {lineMarks ? (
                <span id={lineDescriptionId} style={statusStyle}>
                    Line numbers visible
                </span>
            ) : null}
            <div style={resolvedBodyStyle}>
                {lineMarks ? (
                    <pre data-testid="code-lines" aria-hidden="true" style={resolvedGutterStyle}>
                        {lineMarks.join("\n")}
                    </pre>
                ) : null}
                <pre style={resolvedCodeStyle}>
                    <code>{content}</code>
                </pre>
            </div>
        </section>
    );
});

type ExtensionMenuProps = {
    extensions: readonly Action[];
    control: React.CSSProperties;
    menu: React.CSSProperties;
    item: React.CSSProperties;
};

function ExtensionMenu({ extensions, control, menu, item }: ExtensionMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const edgeRef = useRef<"first" | "last">("first");
    const triggerId = useId();
    const menuId = useId();

    useEffect(() => {
        if (!open) {
            return;
        }
        const items = menuItems(menuRef.current);
        const target = edgeRef.current === "first" ? items[0] : items.at(-1);
        target?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        function onPointerDown(event: PointerEvent): void {
            const target = event.target;
            if (target instanceof Node && rootRef.current?.contains(target)) {
                return;
            }
            setOpen(false);
        }

        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [open]);

    function openAt(edge: "first" | "last"): void {
        edgeRef.current = edge;
        if (open) {
            const items = menuItems(menuRef.current);
            const target = edge === "first" ? items[0] : items.at(-1);
            target?.focus();
        } else {
            setOpen(true);
        }
    }

    function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return;
        }
        event.preventDefault();
        openAt(event.key === "ArrowDown" ? "first" : "last");
    }

    function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
        if (event.key === "Tab") {
            setOpen(false);
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }

        const items = menuItems(menuRef.current);
        if (items.length === 0) {
            return;
        }
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | undefined;
        if (event.key === "ArrowDown") {
            next = current < 0 ? 0 : (current + 1) % items.length;
        } else if (event.key === "ArrowUp") {
            next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
        } else if (event.key === "Home") {
            next = 0;
        } else if (event.key === "End") {
            next = items.length - 1;
        }
        if (next === undefined) {
            return;
        }
        event.preventDefault();
        items[next]?.focus();
    }

    function runExtension(action: Action): void {
        try {
            void action.run();
        } finally {
            setOpen(false);
            triggerRef.current?.focus();
        }
    }

    return (
        <div ref={rootRef} style={{ position: "relative" }}>
            <button
                id={triggerId}
                ref={triggerRef}
                type="button"
                aria-controls={menuId}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="More actions"
                onClick={() => {
                    edgeRef.current = "first";
                    setOpen((value) => !value);
                }}
                onKeyDown={onTriggerKeyDown}
                style={control}
            >
                <MoreIcon />
            </button>
            <div
                id={menuId}
                ref={menuRef}
                role="menu"
                aria-labelledby={triggerId}
                hidden={!open}
                onKeyDown={onMenuKeyDown}
                style={menu}
            >
                {extensions.map((action) => (
                    <button
                        role="menuitem"
                        type="button"
                        tabIndex={-1}
                        key={action.id}
                        onClick={() => runExtension(action)}
                        style={item}
                    >
                        {action.icon === undefined || action.icon === null ? null : (
                            <span aria-hidden="true">{action.icon}</span>
                        )}
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function menuItems(menu: HTMLDivElement | null): HTMLButtonElement[] {
    return menu ? Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')) : [];
}

function renderTokenSpans(tokens: CodeToken[], palette: Palette): React.ReactNode {
    return tokens.map((token, index) => (
        <span
            className={tokenClassName(token)}
            style={{ color: tokenColor(token.scope, palette) }}
            key={`${index}:${token.text}`}
        >
            {token.text}
        </span>
    ));
}

function tokenClassName(token: CodeToken): string {
    if (token.scope.length === 0) {
        return "token plain";
    }
    return `token ${token.scope.split(".").map(cssIdentifier).join(" ")}`;
}

function cssIdentifier(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function codeBlockStyle(
    style: React.CSSProperties | undefined,
    palette: Palette
): React.CSSProperties {
    return {
        display: "flex",
        flexDirection: "column",
        margin: 0,
        overflow: "visible",
        borderRadius: 8,
        background: palette.base,
        color: palette.text,
        fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 14,
        lineHeight: 1.55,
        ...style
    };
}

function headStyle(palette: Palette): React.CSSProperties {
    return {
        display: "flex",
        flex: "0 0 auto",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 32,
        paddingBlock: 7,
        paddingInlineStart: 12,
        paddingInlineEnd: 8,
        borderBottom: `1px solid ${palette.border}`,
        color: palette.muted,
        fontSize: "0.86em",
        lineHeight: 1,
        userSelect: "none"
    };
}

function bodyStyle(): React.CSSProperties {
    return {
        display: "flex",
        flex: "1 1 auto",
        minWidth: 0,
        minHeight: 0,
        overflow: "auto"
    };
}

function gutterStyle(palette: Palette): React.CSSProperties {
    return {
        flex: "0 0 auto",
        margin: 0,
        paddingBlock: 12,
        paddingInlineStart: 12,
        paddingInlineEnd: 10,
        borderInlineEnd: `1px solid ${palette.border}`,
        background: "transparent",
        color: palette.muted,
        font: "inherit",
        lineHeight: "inherit",
        textAlign: "end",
        userSelect: "none",
        whiteSpace: "pre"
    };
}

function codeStyle(palette: Palette): React.CSSProperties {
    return {
        boxSizing: "border-box",
        flex: "1 0 auto",
        minWidth: 0,
        minHeight: "100%",
        margin: 0,
        padding: 12,
        overflow: "visible",
        background: "transparent",
        color: palette.text,
        font: "inherit",
        lineHeight: "inherit",
        whiteSpace: "pre"
    };
}

function actionStyle(): React.CSSProperties {
    return {
        display: "flex",
        alignItems: "center",
        gap: 2,
        marginInlineStart: "auto",
        userSelect: "none"
    };
}

function controlStyle(palette: Palette): React.CSSProperties {
    return {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        width: 30,
        height: 30,
        margin: 0,
        padding: 0,
        border: 0,
        borderRadius: 6,
        background: "transparent",
        color: palette.muted,
        cursor: "pointer",
        listStyle: "none",
        userSelect: "none"
    };
}

function menuStyle(palette: Palette): React.CSSProperties {
    return {
        position: "absolute",
        insetBlockStart: "calc(100% + 6px)",
        insetInlineEnd: 0,
        zIndex: 1,
        minWidth: 144,
        padding: 4,
        border: `1px solid ${palette.border}`,
        borderRadius: 7,
        background: palette.base,
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
        userSelect: "none"
    };
}

function menuItemStyle(palette: Palette): React.CSSProperties {
    return {
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        minHeight: 30,
        paddingBlock: 5,
        paddingInline: 8,
        border: 0,
        borderRadius: 4,
        background: "transparent",
        color: palette.text,
        font: "inherit",
        textAlign: "start",
        cursor: "pointer",
        userSelect: "none"
    };
}

const statusStyle: React.CSSProperties = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
    userSelect: "none"
};

function darkMediaQuery(): MediaQueryList | undefined {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return undefined;
    }
    return window.matchMedia(darkModeQuery);
}

function subscribeToDarkMode(notify: () => void): () => void {
    const query = darkMediaQuery();
    if (!query) {
        return () => undefined;
    }
    query.addEventListener("change", notify);
    return () => query.removeEventListener("change", notify);
}

function subscribeNever(): () => void {
    return () => undefined;
}

function darkModeSnapshot(): boolean {
    return darkMediaQuery()?.matches ?? false;
}

function lightModeSnapshot(): boolean {
    return false;
}

function isAbortError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
    );
}
