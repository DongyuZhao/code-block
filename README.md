# code-block

Multi-platform Prism-based code block rendering packages.

## Packages

- `packages/prism-code-core`: private shared Prism tokenization core and native JS bundle.
- `packages/react-code-block`: React npm package that renders Prism token streams with DOM spans.
- `packages/swift-code-block`: Swift Package with a JSCore Prism bridge and SwiftUI renderer.
- `packages/compose-code-block`: Android Compose AAR with an Android WebView JS runtime and native Compose renderer.

Prism is used only to tokenize source code. Each platform renders the returned token stream with
native UI primitives.

## Shared Prism Bridge

`packages/prism-code-core` owns the token contract:

```ts
type PrismCodePayload = {
  ok: boolean;
  code: string;
  language: string;
  requestedLanguage: string;
  grammarFound: boolean;
  tokens: { text: string; types: string[] }[];
  error: string | null;
};
```

Run this after changing shared Prism code:

```sh
pnpm run sync:prism
```

The sync command regenerates `packages/prism-code-core/generated/prism-code.js` and copies it to:

- `packages/swift-code-block/Sources/SwiftCodeBlock/Resources/Prism`
- `packages/compose-code-block/src/main/assets/code-block`
- `packages/react-code-block/src/generated`

## Usage

React:

```tsx
import { CodeBlock } from "react-code-block";

<CodeBlock code="const answer = 42;" language="javascript" />;
```

SwiftUI:

```swift
import SwiftCodeBlock

CodeBlock("let answer = 42", language: "swift")
```

Android Compose:

```kotlin
import io.github.dongyuzhao.composecodeblock.CodeBlock
import io.github.dongyuzhao.composecodeblock.CodeRenderOptions

CodeBlock(
    code = "val answer = 42",
    options = CodeRenderOptions(language = "kotlin")
)
```

## Tests

```sh
pnpm run test:shared
pnpm run test:react
pnpm run test:swift
pnpm run test:android
```

## Sample Apps

- React: `samples/react-code-block-sample`
  - `pnpm run sample:react:dev`
  - `pnpm run sample:react:build`
- Swift: `samples/swift-code-block-sample`
  - `pnpm run sample:swift:generate`
  - `pnpm run sample:swift:build`
- Android: `samples/compose-code-block-sample`
  - `pnpm run sample:android:build`
