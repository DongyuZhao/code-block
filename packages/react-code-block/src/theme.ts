type TokenColors = Readonly<Record<string, string>>;
export type Mode = "automatic" | "light" | "dark";

export type Palette = {
    readonly base: string;
    readonly text: string;
    readonly muted: string;
    readonly border: string;
    readonly tokens: TokenColors;
};

export type Theme = { readonly light: Palette; readonly dark: Palette };
export type Lines = { readonly show?: boolean; readonly start?: number };

const lightTokens: TokenColors = Object.freeze({
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
});

const darkTokens: TokenColors = Object.freeze({
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
});

export const standard: Theme = Object.freeze({
    light: Object.freeze({
        base: "#ffffff",
        text: "#24292f",
        muted: "#6e7781",
        border: "#d0d7de",
        tokens: lightTokens
    }),
    dark: Object.freeze({
        base: "#1e1e1e",
        text: "#d4d4d4",
        muted: "#9d9d9d",
        border: "#3a3a3a",
        tokens: darkTokens
    })
});

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
