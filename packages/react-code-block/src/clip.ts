import type { CodeToken } from "./code-highlighter.js";
import { tokenColor, type Palette } from "./theme.js";

export type Clip = { plain: string; rich: string };

type ClipboardPort = {
    write?: (data: ClipboardItems) => Promise<void>;
    writeText?: (text: string) => Promise<void>;
};

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function html(code: string, tokens: CodeToken[], palette: Palette): Clip {
    const exact = tokens.map((token) => token.text).join("") === code;
    const runs: CodeToken[] = exact ? tokens : [{ text: code, scope: "" }];
    const body = runs
        .map(
            (token) =>
                `<span style="color:${escapeHtml(tokenColor(token.scope, palette))}">${escapeHtml(token.text)}</span>`
        )
        .join("");

    return {
        plain: code,
        rich: `<pre style="margin:0;background:${escapeHtml(palette.base)};color:${escapeHtml(palette.text)};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre">${body}</pre>`
    };
}

function browserClipboard(): ClipboardPort | undefined {
    return typeof navigator === "undefined" ? undefined : navigator.clipboard;
}

export async function write(
    payload: Clip,
    port: ClipboardPort | undefined = browserClipboard()
): Promise<"rich" | "plain"> {
    if (!port) {
        throw new Error("Clipboard API is unavailable");
    }

    if (typeof port.write === "function" && typeof ClipboardItem !== "undefined") {
        try {
            await port.write([
                new ClipboardItem({
                    "text/plain": new Blob([payload.plain], { type: "text/plain" }),
                    "text/html": new Blob([payload.rich], { type: "text/html" })
                })
            ]);
            return "rich";
        } catch {
            // Fall through to the required plain-text compatibility path.
        }
    }

    if (typeof port.writeText !== "function") {
        throw new Error("Clipboard API is unavailable");
    }
    await port.writeText(payload.plain);
    return "plain";
}
