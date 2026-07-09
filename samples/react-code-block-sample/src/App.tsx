import { useMemo, useState } from "react";
import { CodeBlock, renderCodeToTokens } from "react-code-block";

const snippets = [
  {
    language: "typescript",
    title: "TypeScript",
    code: `type TokenRun = {
  text: string;
  types: string[];
};

export function describe(run: TokenRun) {
  return run.types.join(".") + ": " + run.text;
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
        options = CodeRenderOptions(language = "kotlin")
    )
}`
  }
];

export function App() {
  const [selectedLanguage, setSelectedLanguage] = useState(snippets[0].language);
  const selected = snippets.find((snippet) => snippet.language === selectedLanguage) ?? snippets[0];
  const tokenPayload = useMemo(
    () => renderCodeToTokens(selected.code, { language: selected.language }),
    [selected]
  );

  return (
    <main className="sample-shell">
      <section className="intro">
        <h1>Native Code Blocks</h1>
        <p>
          React renders the same Prism token stream that SwiftUI and Compose consume. Pick a
          language and inspect the flattened token runs below.
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
        <CodeBlock code={selected.code} language={selected.language} className="code-surface" />
        <aside className="token-panel" aria-label="Token stream">
          <h2>Token Stream</h2>
          <dl>
            <div>
              <dt>language</dt>
              <dd>{tokenPayload.language}</dd>
            </div>
            <div>
              <dt>grammar</dt>
              <dd>{tokenPayload.grammarFound ? "found" : "plain fallback"}</dd>
            </div>
          </dl>
          <ol>
            {tokenPayload.tokens.slice(0, 12).map((token, index) => (
              <li key={`${index}:${token.text}`}>
                <span>{token.types.join(".")}</span>
                <code>{JSON.stringify(token.text)}</code>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  );
}
