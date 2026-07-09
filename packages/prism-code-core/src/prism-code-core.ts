export type PrismCodeOptions = {
  language?: string;
  fallbackLanguage?: string;
};

export type PrismTokenRun = {
  text: string;
  types: string[];
};

export type PrismCodePayload = {
  ok: boolean;
  code: string;
  language: string;
  requestedLanguage: string;
  grammarFound: boolean;
  tokens: PrismTokenRun[];
  error: string | null;
};

export type PrismRuntime = {
  languages: Record<string, unknown>;
  tokenize(code: string, grammar: unknown, language?: string): unknown[];
};

const plainLanguage = "plain";
const plainTypes = ["plain"];

const aliases: Record<string, string> = {
  cjs: "javascript",
  h: "c",
  js: "javascript",
  kt: "kotlin",
  kts: "kotlin",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "tsx"
};

export const languageAliases = aliases;

export function tokenizeCodeJson(
  runtime: PrismRuntime | undefined,
  code: unknown,
  options: PrismCodeOptions = {}
): string {
  return JSON.stringify(tokenizeCodeToPayload(runtime, code, options));
}

export function tokenizeCodeToPayload(
  runtime: PrismRuntime | undefined,
  code: unknown,
  options: PrismCodeOptions = {}
): PrismCodePayload {
  const source = safeString(code);
  const requestedLanguage = normalizeLanguage(options.language ?? options.fallbackLanguage);
  const fallbackLanguage = normalizeLanguage(options.fallbackLanguage);

  if (!runtime?.languages || typeof runtime.tokenize !== "function") {
    return failurePayload(source, requestedLanguage, "Prism is not loaded.");
  }

  const requestedGrammar = runtime.languages[requestedLanguage];
  const fallbackGrammar = runtime.languages[fallbackLanguage];
  const grammar = requestedGrammar ?? fallbackGrammar;
  const language = requestedGrammar
    ? requestedLanguage
    : fallbackGrammar
      ? fallbackLanguage
      : plainLanguage;
  const grammarFound = Boolean(requestedGrammar);

  if (!grammar) {
    return plainPayload(source, requestedLanguage, plainLanguage, false);
  }

  try {
    return {
      ok: true,
      code: source,
      language,
      requestedLanguage,
      grammarFound,
      tokens: flattenTokenStream(runtime.tokenize(source, grammar, language)),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      code: source,
      language,
      requestedLanguage,
      grammarFound,
      tokens: plainTokens(source),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function parseCodeTokensJson(json: string): PrismCodePayload {
  const raw = JSON.parse(json) as Partial<PrismCodePayload>;
  const code = safeString(raw.code);
  const requestedLanguage = normalizeLanguage(raw.requestedLanguage ?? raw.language);
  const language = normalizeLanguage(raw.language);
  const tokens = parseTokenRuns(raw.tokens, code);
  const error = nullableString(raw.error);

  return {
    ok: Boolean(raw.ok) && error == null,
    code,
    language,
    requestedLanguage,
    grammarFound: Boolean(raw.grammarFound),
    tokens,
    error
  };
}

export function normalizeLanguage(language: unknown): string {
  const value = safeString(language).trim().toLowerCase();
  if (!value || value === "text" || value === "txt" || value === "none") {
    return plainLanguage;
  }
  return aliases[value] ?? value;
}

export function flattenTokenStream(
  stream: unknown,
  inheritedTypes: string[] = []
): PrismTokenRun[] {
  const runs: PrismTokenRun[] = [];
  appendTokenValue(runs, stream, inheritedTypes);
  return runs.length > 0 ? runs : plainTokens("");
}

function appendTokenValue(runs: PrismTokenRun[], value: unknown, inheritedTypes: string[]): void {
  if (typeof value === "string") {
    appendRun(runs, value, inheritedTypes);
    return;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      appendTokenValue(runs, child, inheritedTypes);
    }
    return;
  }

  if (value && typeof value === "object") {
    const token = value as {
      type?: unknown;
      alias?: unknown;
      content?: unknown;
    };
    const types = tokenTypes(inheritedTypes, token.type, token.alias);
    appendTokenValue(runs, token.content, types);
    return;
  }

  appendRun(runs, safeString(value), inheritedTypes);
}

function tokenTypes(inheritedTypes: string[], type: unknown, alias: unknown): string[] {
  const values = [...inheritedTypes];
  if (typeof type === "string" && type.length > 0) {
    values.push(type);
  }
  if (typeof alias === "string" && alias.length > 0) {
    values.push(alias);
  } else if (Array.isArray(alias)) {
    for (const value of alias) {
      if (typeof value === "string" && value.length > 0) {
        values.push(value);
      }
    }
  }

  const unique = values.filter((value, index) => values.indexOf(value) === index);
  return unique.length > 0 ? unique : plainTypes;
}

function appendRun(runs: PrismTokenRun[], text: string, types: string[]): void {
  if (text.length === 0) {
    return;
  }
  const resolvedTypes = types.length > 0 ? types : plainTypes;
  const previous = runs[runs.length - 1];
  if (previous && sameTypes(previous.types, resolvedTypes)) {
    previous.text += text;
    return;
  }
  runs.push({ text, types: [...resolvedTypes] });
}

function sameTypes(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseTokenRuns(tokens: unknown, code: string): PrismTokenRun[] {
  if (!Array.isArray(tokens)) {
    return plainTokens(code);
  }

  const parsed = tokens
    .map((token) => {
      if (!token || typeof token !== "object") {
        return undefined;
      }
      const candidate = token as Partial<PrismTokenRun>;
      const text = safeString(candidate.text);
      const types = Array.isArray(candidate.types)
        ? candidate.types.filter(
            (type): type is string => typeof type === "string" && type.length > 0
          )
        : plainTypes;
      return text.length > 0 ? { text, types: types.length > 0 ? types : plainTypes } : undefined;
    })
    .filter((token): token is PrismTokenRun => Boolean(token));

  return parsed.length > 0 ? parsed : plainTokens(code);
}

function plainPayload(
  code: string,
  requestedLanguage: string,
  language: string,
  grammarFound: boolean
): PrismCodePayload {
  return {
    ok: true,
    code,
    language,
    requestedLanguage,
    grammarFound,
    tokens: plainTokens(code),
    error: null
  };
}

function failurePayload(code: string, requestedLanguage: string, error: string): PrismCodePayload {
  return {
    ok: false,
    code,
    language: plainLanguage,
    requestedLanguage,
    grammarFound: false,
    tokens: plainTokens(code),
    error
  };
}

function plainTokens(code: string): PrismTokenRun[] {
  return code.length > 0 ? [{ text: code, types: plainTypes }] : [];
}

function safeString(value: unknown): string {
  return String(value == null ? "" : value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
