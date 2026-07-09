// Highlight entry for the React renderer. Wraps the tree-sitter C core compiled
// to WebAssembly (generated/cb-core.mjs). The core owns language normalization,
// aliases, fallback, and the plain-text degradation, so this layer only marshals
// strings across the wasm boundary and parses the JSON it returns.

import createCbCore, { type CbCoreModule } from "./generated/cb-core.mjs";

export type CodeToken = {
    text: string;
    /** tree-sitter capture name (e.g. "variable.parameter"); "" for plain runs. */
    scope: string;
};

export type CodeTokens = {
    /** Language actually used to parse; "plain" when nothing matched. */
    language: string;
    tokens: CodeToken[];
};

export type HighlightOptions = {
    readonly language?: string;
    readonly fallbackLanguage?: string;
};

type BoundCore = {
    tokenize(code: string, language: string, fallbackLanguage: string): CodeTokens;
};

let corePromise: Promise<BoundCore> | null = null;

function bindCore(module: CbCoreModule): BoundCore {
    const tokenizeJson = module.cwrap("cb_tokenize_json", "number", ["string", "string", "string"]);
    const stringFree = module.cwrap("cb_string_free", null, ["number"]);

    return {
        tokenize(code, language, fallbackLanguage) {
            const ptr = tokenizeJson(code, language, fallbackLanguage);
            if (!ptr) {
                throw new Error("Highlighter returned no token payload.");
            }
            try {
                return normalizeTokens(JSON.parse(module.UTF8ToString(ptr)), code);
            } finally {
                stringFree(ptr);
            }
        }
    };
}

/**
 * Loads (once) and returns the wasm-backed core. Initialization is asynchronous;
 * the promise is cached so repeat calls resolve immediately.
 */
function loadHighlighter(): Promise<BoundCore> {
    if (!corePromise) {
        corePromise = createCbCore().then(bindCore);
    }
    return corePromise!;
}

/** Tokenizes `code` into a flat run of `{ text, scope }` spans. */
export async function highlightCode(
    code: string,
    options: HighlightOptions = {}
): Promise<CodeTokens> {
    const core = await loadHighlighter();
    return core.tokenize(safeString(code), options.language ?? "", options.fallbackLanguage ?? "");
}

function normalizeTokens(value: unknown, code: string): CodeTokens {
    if (typeof value !== "object" || value === null) {
        throw new Error("Highlighter returned an invalid token payload.");
    }

    const candidate = value as Partial<CodeTokens>;
    if (
        typeof candidate.language !== "string" ||
        candidate.language.length === 0 ||
        !Array.isArray(candidate.tokens)
    ) {
        throw new Error("Highlighter returned an invalid token payload.");
    }

    const tokens: CodeToken[] = [];
    for (const raw of candidate.tokens) {
        if (typeof raw !== "object" || raw === null) {
            throw new Error("Highlighter returned an invalid token payload.");
        }
        const token = raw as Partial<CodeToken>;
        if (
            typeof token.text !== "string" ||
            token.text.length === 0 ||
            typeof token.scope !== "string"
        ) {
            throw new Error("Highlighter returned an invalid token payload.");
        }
        tokens.push({ text: token.text, scope: token.scope });
    }

    if (tokens.map((token) => token.text).join("") !== code) {
        throw new Error("Highlighter returned a source-mismatched token payload.");
    }
    return { language: candidate.language, tokens };
}

function safeString(value: unknown): string {
    return String(value == null ? "" : value);
}
