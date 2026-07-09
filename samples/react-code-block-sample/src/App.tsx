import { useEffect, useState } from "react";
import {
    CodeBlock,
    highlightCode,
    standard,
    type Actions,
    type CodeTokens,
    type Theme
} from "@dongyuzhao/react-code-block";

const theme: Theme = {
    light: {
        ...standard.light,
        base: "#fffdf8",
        text: "#252019",
        muted: "#786b5d",
        border: "#e4d9cb",
        tokens: {
            ...standard.light.tokens,
            keyword: "#b42318",
            string: "#096b5a"
        }
    },
    dark: {
        ...standard.dark,
        base: "#171a22",
        text: "#f5f1e8",
        muted: "#aeb7c6",
        border: "#353b48",
        tokens: {
            ...standard.dark.tokens,
            keyword: "#ff8f82",
            string: "#70d6b8"
        }
    }
};

const actions: Actions = {
    extensions: [
        {
            id: "inspect",
            label: "Inspect",
            run: () => {
                document.getElementById("token-stream")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }
    ]
};

const snippets = [
    {
        language: "typescript",
        title: "TypeScript",
        code: `type TokenRun = {
  text: string;
  scope: string;
};

export function describe(run: TokenRun) {
  return run.scope + ": " + run.text;
}`
    },
    {
        language: "swift",
        title: "Swift",
        code: `import SwiftCodeBlock
import SwiftUI

struct PreviewPane: View {
    var body: some View {
        CodeBlock("let answer = 42", language: "swift")
    }
}`
    },
    {
        language: "kotlin",
        title: "Kotlin",
        code: `@Composable
fun PreviewPane() {
    CodeBlock(
        code = "val answer = 42",
        language = "kotlin"
    )
}`
    }
];

export function App() {
    const [selectedLanguage, setSelectedLanguage] = useState(snippets[0].language);
    const selected =
        snippets.find((snippet) => snippet.language === selectedLanguage) ?? snippets[0];
    const [tokens, setTokens] = useState<CodeTokens | null>(null);

    useEffect(() => {
        let active = true;
        setTokens(null);
        void highlightCode(selected.code, { language: selected.language }).then((result) => {
            if (active) {
                setTokens(result);
            }
        });
        return () => {
            active = false;
        };
    }, [selected]);

    return (
        <main className="sample-shell">
            <section className="intro">
                <h1>Native Code Blocks</h1>
                <p>
                    React renders the same tree-sitter token stream that SwiftUI and Compose
                    consume. Pick a language and inspect the flattened token runs below.
                </p>
            </section>

            <section className="toolbar" aria-label="Language picker">
                {snippets.map((snippet) => (
                    <button
                        className={snippet.language === selected.language ? "active" : ""}
                        key={snippet.language}
                        onClick={() => setSelectedLanguage(snippet.language)}
                        type="button"
                    >
                        {snippet.title}
                    </button>
                ))}
            </section>

            <section className="demo-grid">
                <CodeBlock
                    code={selected.code}
                    language={selected.language}
                    mode="automatic"
                    theme={theme}
                    lines={{ show: true, start: 1 }}
                    actions={actions}
                    className="code-surface"
                />
                <aside id="token-stream" className="token-panel" aria-label="Token stream">
                    <h2>Token Stream</h2>
                    <dl>
                        <div>
                            <dt>language</dt>
                            <dd>{tokens ? tokens.language : "…"}</dd>
                        </div>
                        <div>
                            <dt>tokens</dt>
                            <dd>{tokens ? tokens.tokens.length : "…"}</dd>
                        </div>
                    </dl>
                    <ol>
                        {(tokens?.tokens ?? []).slice(0, 12).map((token, index) => (
                            <li key={`${index}:${token.text}`}>
                                <span>{token.scope || "plain"}</span>
                                <code>{JSON.stringify(token.text)}</code>
                            </li>
                        ))}
                    </ol>
                </aside>
            </section>
        </main>
    );
}
