# code-block

Multi-platform tree-sitter based code block rendering packages.

## Packages

- `packages/shared/code-block-core`: shared C tokenizer, vendored grammars, fixtures, and token-stream goldens.
- `packages/react-code-block`: React npm package that renders tree-sitter token streams with DOM spans.
- `Package.swift` + `packages/swift-code-block`: Swift Package with a SwiftUI renderer backed by the C core.
- `packages/compose-code-block`: Android Compose AAR backed by the C core through JNI.

The C core tokenizes source code once behind a small C ABI. React consumes a generated Emscripten
module, SwiftPM compiles the C sources directly, and Android builds the same sources through the NDK.
Each platform renders the returned token stream with native UI primitives.

Supported language names are `bash`, `c`, `css`, `go`, `html`, `java`,
`javascript`, `jsx`, `json`, `kotlin`, `markdown`, `python`, `ruby`, `rust`,
`swift`, `tsx`, and `typescript`. Common aliases such as `sh`, `shell`, `h`,
`markup`, `md`, `py`, `rb`, `rs`, `js`, and `ts` are normalized by the shared
core.

## Shared Core

The token contract is:

```ts
type CodeTokens = {
    language: string;
    tokens: { text: string; scope: string }[];
};
```

Regenerate embedded tree-sitter queries after changing vendored `highlights.scm` files:

```sh
pnpm run build:queries
```

Build the local C CLI and regenerate shared token-stream goldens:

```sh
pnpm run build:code-block-core
pnpm run gen:goldens
```

Build and publish the single-file React wasm module:

```sh
pnpm run build:wasm
```

The wasm build requires Emscripten on the maintainer machine; consumers receive the generated module
through the React package.

## Usage

React:

After publishing the scoped package to npm:

```sh
npm install @dongyuzhao/react-code-block react
```

```tsx
import { useRef } from "react";
import {
    CodeBlock,
    standard,
    type Actions,
    type CodeBlockProps,
    type Theme
} from "@dongyuzhao/react-code-block";

const theme: Theme = {
    light: {
        ...standard.light,
        base: "#fffdf8",
        tokens: { ...standard.light.tokens, keyword: "#b42318" }
    },
    dark: {
        ...standard.dark,
        base: "#171a22",
        tokens: { ...standard.dark.tokens, keyword: "#ff8f82" }
    }
};

const label: CodeBlockProps["label"] = undefined; // or "TypeScript" / false
const actions: Actions = {
    extensions: [
        {
            id: "inspect",
            label: "Inspect",
            run: () => console.info("Inspect")
        }
    ]
};

export function Example() {
    const root = useRef<HTMLElement>(null);
    return (
        <CodeBlock
            ref={root}
            code="const answer = 42;"
            language="typescript"
            mode="automatic"
            theme={theme}
            label={label}
            lines={{ show: true, start: 1 }}
            actions={actions}
            aria-label="TypeScript example"
            style={{ fontSize: 14 }}
        />
    );
}
```

`highlightCode`, `renderCode`, and `useCodeRenderState` accept only
`HighlightOptions { language, fallbackLanguage }`. Presentation props such as
`style`, `mode`, and `theme` do not restart highlighting. The shared `standard`
theme is deeply frozen at runtime; customize it by creating spread copies as
shown above.

SwiftUI:

Add `https://github.com/DongyuZhao/code-block.git` as the Swift Package URL,
then depend on the `swift-code-block` product.

```swift
import SwiftCodeBlock
import SwiftUI

private let theme: CodeBlock.Theme = {
    var light = CodeBlock.Theme.standard.light
    light.base = Color(red: 1.00, green: 0.99, blue: 0.97)
    light.tokens["keyword"] = Color(red: 0.71, green: 0.14, blue: 0.09)

    var dark = CodeBlock.Theme.standard.dark
    dark.base = Color(red: 0.09, green: 0.10, blue: 0.13)
    dark.tokens["keyword"] = Color(red: 1.00, green: 0.56, blue: 0.51)
    return CodeBlock.Theme(light: light, dark: dark)
}()

private let label: CodeBlock.Label = .automatic // or .text("Swift") / .hidden

struct Example: View {
    var body: some View {
        CodeBlock(
            "let answer = 42",
            language: "swift",
            mode: .automatic,
            theme: theme,
            label: label,
            lines: .init(show: true, start: 1),
            actions: .init(
                extensions: [
                    .init(id: "inspect", label: "Inspect") {
                        print("Inspect")
                    }
                ]
            )
        )
    }
}
```

The lower-level Swift highlighter and renderer accept `HighlightOptions` with
only `language` and `fallbackLanguage`. `fontSize` remains a view-only
`CodeBlock` parameter and follows Dynamic Type without changing render-request
identity.

Android Compose:

Publish the release to a Maven repository, or publish it locally while developing:

```sh
./gradlew :packages:compose-code-block:publishReleasePublicationToMavenLocal
```

Then add the repository and package coordinate to the consumer:

```kotlin
repositories {
    mavenLocal() // Replace with the release repository in production.
}

dependencies {
    implementation("io.github.dongyuzhao:compose-code-block:0.1.0")
}
```

```kotlin
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import io.github.dongyuzhao.composecodeblock.Action
import io.github.dongyuzhao.composecodeblock.Actions
import io.github.dongyuzhao.composecodeblock.CodeBlock
import io.github.dongyuzhao.composecodeblock.Label
import io.github.dongyuzhao.composecodeblock.Lines
import io.github.dongyuzhao.composecodeblock.Mode
import io.github.dongyuzhao.composecodeblock.Theme

private val theme = Theme(
    light = Theme.standard.light.copy(
        base = Color(0xFFFFFDF8),
        tokens = Theme.standard.light.tokens + ("keyword" to Color(0xFFB42318))
    ),
    dark = Theme.standard.dark.copy(
        base = Color(0xFF171A22),
        tokens = Theme.standard.dark.tokens + ("keyword" to Color(0xFFFF8F82))
    )
)

private val label: Label = Label.Automatic // or Label.Text("Kotlin") / Label.Hidden

@Composable
fun Example() {
    CodeBlock(
        code = "val answer = 42",
        language = "kotlin",
        mode = Mode.Automatic,
        theme = theme,
        style = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp),
        label = label,
        lines = Lines(show = true, start = 1),
        actions = Actions(
            extensions = listOf(
                Action(
                    id = "inspect",
                    label = "Inspect",
                    run = { println("Inspect") }
                )
            )
        )
    )
}
```

The lower-level Compose highlighter and renderer use `HighlightOptions` with
only `language` and `fallbackLanguage`. The composable flattens those two
values and uses one native `TextStyle` for highlighted, fallback, and gutter
text.

### Presentation defaults

| Concept   | Default               | React                            | SwiftUI      | Compose           |
| --------- | --------------------- | -------------------------------- | ------------ | ----------------- |
| `mode`    | automatic             | `"automatic"`                    | `.automatic` | `Mode.Automatic`  |
| `theme`   | standard light + dark | `standard`                       | `.standard`  | `Theme.standard`  |
| `label`   | resolved language     | `undefined`                      | `.automatic` | `Label.Automatic` |
| `lines`   | hidden, start 1       | `{ show: false, start: 1 }`      | `.init()`    | `Lines()`         |
| `actions` | shown, no extensions  | `{ show: true, extensions: [] }` | `.init()`    | `Actions()`       |

Automatic labels show the requested language while highlighting is pending or failed, then the
canonical resolved language after highlighting succeeds.

### Presentation behavior

| Area             | Contract                                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode             | Automatic follows the platform color scheme; forced light or dark ignores it. React server rendering starts in light mode.                                                                                                                                                    |
| Theme            | Every theme is adaptive and contains complete light and dark palettes. Token lookup tries the exact scope, dotted parent scopes, `plain`, then palette text.                                                                                                                  |
| Label and header | Automatic, custom, and hidden are `undefined` / string / `false` in React, `.automatic` / `.text(...)` / `.hidden` in SwiftUI, and `Label.Automatic` / `Label.Text(...)` / `Label.Hidden` in Compose. No empty header is rendered when both its label and actions are hidden. |
| Actions          | Header order is label, clip, capability-gated share, then a trailing extension menu. The menu appears only for a nonempty extension list; hiding actions also hides clip, share, and extensions.                                                                              |
| Clip             | Clip writes exact plain source plus rich data in one operation when supported. It excludes the label, actions, and gutter; rich failure falls back to plain where the platform permits.                                                                                       |
| Share            | Share sends exact plain source without chrome or line numbers. It appears only when Web Share, SwiftUI's supported native share surface, or a resolvable Android `ACTION_SEND` target is available.                                                                           |
| Lines            | Line marks are derived from the raw source, recognizing LF, CRLF, and CR. Empty source has one line, a trailing separator adds a final line, starts below 1 render as 1, and the separate gutter is neither selectable nor shared.                                            |
| Failure          | Render state is pending, succeeded, or failed. Failure preserves the exact source plus an optional diagnostic; cancellation emits no failure, and presentation settings never change tokenization or the shared ABI.                                                          |

## Tests

```sh
pnpm run test:shared
pnpm run test:react
pnpm run test:swift
pnpm run test:android
```

Shared token-stream goldens live under
`packages/shared/code-block-core/test/golden/token-stream` and are generated from
`packages/shared/code-block-core/fixtures/code-snippets.json`.

```sh
pnpm run test:shared:update
pnpm run gen:compose-goldens
```

Pixel snapshots cover each native renderer:

```sh
pnpm run snapshot:react:visual
pnpm run snapshot:swift:visual
pnpm run snapshot:android:visual
```

Record updated baselines with:

```sh
pnpm run snapshot:react:visual:record
pnpm run snapshot:swift:visual:record
pnpm run snapshot:android:visual:record
```

## Sample Apps

- React: `samples/react-code-block-sample`
    - `pnpm run sample:react:dev`
    - `pnpm run sample:react:build`
- Swift: `samples/swift-code-block-sample`
    - `pnpm run sample:swift:generate`
    - `pnpm run sample:swift:build`
- Android: open the repository root in Android Studio and run `samples:compose-code-block-sample`
    - `pnpm run sample:android:build`
