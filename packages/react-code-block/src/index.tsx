import React, { useEffect, useMemo, useState } from "react";
import {
  renderCodeToPrismTokens,
  type PrismCodeOptions,
  type PrismCodePayload,
  type PrismTokenRun
} from "./generated/react-prism-code.js";

export type CodeRenderOptions = PrismCodeOptions & {
  fontSize?: number;
  scale?: number;
};

export type CodeRenderFailureReason = "invalid-input" | "bridge-unavailable" | "tokenize-failed";

export type CodeRenderFallback = {
  text: string;
  reason: CodeRenderFailureReason;
  error?: string;
};

export type RenderedCodeBlock = {
  code: string;
  language: string;
  grammarFound: boolean;
  tokens: PrismTokenRun[];
};

export type CodeRenderState =
  | { status: "pending" }
  | { status: "succeeded"; rendered: RenderedCodeBlock }
  | { status: "failed"; fallback: CodeRenderFallback };

export type CodeTokenTheme = Record<string, string>;

export type CodeBlockProps = CodeRenderOptions & {
  code: string;
  className?: string;
  style?: React.CSSProperties;
  theme?: CodeTokenTheme;
  ariaLabel?: string;
};

export type { PrismCodePayload, PrismTokenRun };

export const defaultCodeTokenTheme: CodeTokenTheme = {
  plain: "#d4d4d4",
  comment: "#6a9955",
  punctuation: "#d4d4d4",
  property: "#9cdcfe",
  tag: "#569cd6",
  boolean: "#569cd6",
  number: "#b5cea8",
  constant: "#4fc1ff",
  symbol: "#b5cea8",
  selector: "#d7ba7d",
  attrName: "#9cdcfe",
  "attr-name": "#9cdcfe",
  string: "#ce9178",
  char: "#ce9178",
  builtin: "#4ec9b0",
  inserted: "#b5cea8",
  operator: "#d4d4d4",
  entity: "#d4d4d4",
  url: "#ce9178",
  variable: "#9cdcfe",
  atrule: "#c586c0",
  attrValue: "#ce9178",
  "attr-value": "#ce9178",
  function: "#dcdcaa",
  className: "#4ec9b0",
  "class-name": "#4ec9b0",
  keyword: "#c586c0",
  regex: "#d16969",
  important: "#569cd6",
  deleted: "#d16969"
};

export function renderCodeToTokens(
  code: string,
  options: CodeRenderOptions = {}
): PrismCodePayload {
  return renderCodeToPrismTokens(code, options);
}

export async function* renderCode(
  code: string,
  options: CodeRenderOptions = {}
): AsyncGenerator<CodeRenderState> {
  yield { status: "pending" };
  yield renderTerminalState(code, options);
}

export function useCodeRenderState(code: string, options: CodeRenderOptions = {}): CodeRenderState {
  const language = options.language ?? "plain";
  const fallbackLanguage = options.fallbackLanguage ?? "plain";
  const fontSize = options.fontSize ?? 14;
  const scale = options.scale ?? 1;
  const [state, setState] = useState<CodeRenderState>({ status: "pending" });

  useEffect(() => {
    let active = true;

    async function run() {
      for await (const nextState of renderCode(code, {
        language,
        fallbackLanguage,
        fontSize,
        scale
      })) {
        if (!active) {
          return;
        }
        setState(nextState);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [code, language, fallbackLanguage, fontSize, scale]);

  return state;
}

export function CodeBlock({
  code,
  language = "plain",
  fallbackLanguage = "plain",
  fontSize = 14,
  scale = 1,
  className,
  style,
  theme = defaultCodeTokenTheme,
  ariaLabel
}: CodeBlockProps) {
  const state = useCodeRenderState(code, { language, fallbackLanguage, fontSize, scale });
  const label = ariaLabel ?? `${language} code block`;
  const resolvedStyle = codeBlockStyle(style, fontSize, scale);

  const content = useMemo(() => {
    if (state.status === "succeeded") {
      return renderTokenSpans(state.rendered.tokens, theme);
    }
    if (state.status === "failed") {
      return state.fallback.text;
    }
    return null;
  }, [state, theme]);

  return (
    <pre className={className} style={resolvedStyle} role="region" aria-label={label}>
      <code>{content}</code>
    </pre>
  );
}

function renderTerminalState(code: string, options: CodeRenderOptions): CodeRenderState {
  if (isInvalidPositiveNumber(options.fontSize) || isInvalidPositiveNumber(options.scale)) {
    return {
      status: "failed",
      fallback: {
        text: code,
        reason: "invalid-input"
      }
    };
  }

  const payload = renderCodeToTokens(code, options);
  if (!payload.ok) {
    return {
      status: "failed",
      fallback: {
        text: payload.code || code,
        reason: payload.error === "Prism is not loaded." ? "bridge-unavailable" : "tokenize-failed",
        error: payload.error ?? undefined
      }
    };
  }

  return {
    status: "succeeded",
    rendered: {
      code: payload.code,
      language: payload.language,
      grammarFound: payload.grammarFound,
      tokens: payload.tokens
    }
  };
}

function renderTokenSpans(tokens: PrismTokenRun[], theme: CodeTokenTheme): React.ReactNode {
  return tokens.map((token, index) => (
    <span
      className={tokenClassName(token)}
      style={{ color: colorForToken(token, theme) }}
      key={`${index}:${token.text}`}
    >
      {token.text}
    </span>
  ));
}

function tokenClassName(token: PrismTokenRun): string {
  return ["token", ...token.types.map(cssIdentifier)].join(" ");
}

function cssIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function colorForToken(token: PrismTokenRun, theme: CodeTokenTheme): string {
  for (let index = token.types.length - 1; index >= 0; index -= 1) {
    const color = theme[token.types[index]];
    if (color) {
      return color;
    }
  }
  return theme.plain ?? defaultCodeTokenTheme.plain;
}

function codeBlockStyle(
  style: React.CSSProperties | undefined,
  fontSize: number,
  scale: number
): React.CSSProperties {
  const safeFontSize =
    Number.isFinite(fontSize) && fontSize > 0 && Number.isFinite(scale) && scale > 0
      ? `${fontSize * scale}px`
      : undefined;

  return {
    margin: 0,
    overflowX: "auto",
    padding: "12px",
    borderRadius: 8,
    background: "#1e1e1e",
    color: defaultCodeTokenTheme.plain,
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: safeFontSize,
    lineHeight: 1.55,
    whiteSpace: "pre",
    ...style
  };
}

function isInvalidPositiveNumber(value: number | undefined): boolean {
  return value !== undefined && (!Number.isFinite(value) || value <= 0);
}
