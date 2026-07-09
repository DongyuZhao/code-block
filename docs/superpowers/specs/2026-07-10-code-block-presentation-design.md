# Adaptive Code Block Presentation Design

Date: 2026-07-10

## Goal

Add the same presentation behavior to the React, SwiftUI, and Compose code-block bindings while keeping each binding idiomatic to its platform. The shared C/tree-sitter core remains responsible only for lossless tokenization and language resolution.

The feature adds:

- automatic, light, and dark display modes;
- user themes with separate light and dark palettes;
- a visible language label that defaults to the resolved language and can be replaced or hidden;
- an icon-only clip action that writes plain and rich code to the clipboard;
- a native share action where the platform supports one;
- extension actions collected in a trailing menu;
- optional line numbers with a configurable start value.

## Principles

1. Unify behavior, not binding syntax. React uses React and Web conventions, SwiftUI uses environment values and Swift value types, and Compose uses Compose state, slots, and Android services.
2. Keep presentation concerns out of the tokenizer ABI.
3. Preserve the original source as the authority for plain text, sharing, selection, and reconstruction.
4. Prefer one-word public names where clarity permits. New presentation concepts use `mode`, `theme`, `label`, `lines`, and `actions`. Visible chrome uses icons instead of English status text.
5. Avoid the letters `y`, `k`, `g`, and `j` in new names when a clear alternative exists. Platform terms, language data, and the required `light`/`dark` mode names are not rewritten.

## Shared Behavioral Contract

The bindings expose platform-native forms of this conceptual model:

```text
CodeBlock
  code
  language
  fallbackLanguage
  mode
  theme
  label
  lines
  actions

Theme
  light: Palette
  dark: Palette

Palette
  base
  text
  muted
  border
  tokens

Lines
  show
  start

Actions
  show
  extensions

Action
  id
  label
  icon
  run
```

Defaults are:

```text
mode: automatic
theme: standard
label: automatic
lines: { show: false, start: 1 }
actions: { show: true, extensions: [] }
```

Lower-level highlighting accepts only `HighlightOptions { language,
fallbackLanguage }`. Presentation sizing is native to each view surface:
React uses the root `style`, SwiftUI keeps `fontSize: CGFloat`, and Compose
uses `TextStyle`.

## Architecture

The shared C core and its `{ language, tokens: [{ text, scope }] }` contract do not change. Each binding adds three presentation units around its existing renderer:

1. A theme resolver selects the light or dark palette from `mode` and the platform environment.
2. A line counter derives logical gutter labels from the original source without changing the token stream or code rendering.
3. Native action adapters implement clipboard, sharing, and extension invocation.

These units are independently testable. UI surfaces consume their results but do not own tokenization, clipboard serialization, or line parsing.

## Theme and Mode

`mode` has three values: `automatic`, `light`, and `dark`.

- React resolves `automatic` from `prefers-color-scheme` and observes changes.
- SwiftUI resolves it from `EnvironmentValues.colorScheme`.
- Compose resolves it from the current system dark-theme state.

`theme` always contains a light and a dark palette. A palette contains the surface color (`base`), normal chrome and fallback text (`text`), secondary chrome and line-number text (`muted`), separators (`border`), and scope colors (`tokens`). Missing exact scope colors use the existing dotted-parent fallback, then the palette text color.

The built-in standard theme supplies complete light and dark variants. User themes also supply both variants; there is no single-palette compatibility form because this package has not been distributed and the adaptive model is the intended public API.

The active palette also drives rich clipboard colors, so pasted code matches the code block at the time the clip action is invoked.

## Header, Label, and Actions

The code block has a header above the code surface:

- the language label is leading;
- the built-in clip and share actions are trailing;
- a trailing extension-menu action follows them when extensions exist.

The label defaults to the canonical language returned by the highlighter. While rendering is pending, or if rendering fails before a resolved language is available, it uses the requested language. Consumers can supply custom text or hide the label.

`actions.show = false` hides the complete action region, including extensions. When actions are shown:

- `clip` is always offered;
- `share` is offered only when the runtime exposes a native share facility;
- `extensions` are never placed directly in the header;
- a menu appears after the built-in actions only when `extensions` is non-empty.

An extension uses a platform-native representation of the conceptual `Action` fields. Its `label` is required for menu text and accessibility. Its icon and callback use native types: React nodes and functions, SwiftUI images and closures, or Compose icon slots and lambdas. Stable identity is required.

An extension icon is optional; the menu remains usable from its required label. When the label is hidden and no built-in or extension action can be shown, the entire header is omitted rather than rendering an empty row.

No per-built-in visibility flags are added in this release. This keeps `Actions` limited to `show` and `extensions` until a real use case requires more controls.

## Clip Action

The clip action writes two representations in one operation whenever the platform permits it:

1. Plain text that is exactly equivalent to the original `code` string, including its line endings and trailing whitespace.
2. A rich representation with syntax colors, a monospaced font, whitespace, and line breaks preserved.

The rich form is HTML on Web and Android. Apple platforms write the native rich formats supported by their pasteboards, including RTF or attributed data where appropriate. Every platform also writes plain text so code editors receive clean source.

The rich payload is generated from escaped token text and the currently resolved palette. Source text is never treated as markup. The payload excludes the header, language label, actions, and line-number gutter.

On successful clipping, the icon changes temporarily to a success glyph and an accessibility announcement is emitted. No visible `Copy` or `Copied` text is shown. If rich clipboard access is unavailable but plain text succeeds, the operation counts as successful. Complete failure keeps the normal icon and emits an accessible failure state without replacing the code block.

## Share Action

Sharing uses the original code as plain text and excludes the language label and line numbers.

- React uses the Web Share API only when it is available for the current runtime.
- SwiftUI uses the native share surface available on the package's supported iOS and macOS versions.
- Compose launches the Android system chooser with a text share intent.

When a native share facility is unavailable, the share action is omitted; it is not replaced with a custom dialog. User cancellation is not treated as an error.

## Line Numbers

`lines.show` defaults to `false`. `lines.start` defaults to `1`; values below `1` resolve to `1` rather than failing tokenization.

Line numbers count logical source lines, not wrapped visual rows. The line counter recognizes LF, CRLF, and CR separators directly in the original source. A line separator adds a new logical line, so an empty source has one logical line and a source with a trailing separator has a final empty logical line. Highlighted tokens continue to render as the existing lossless stream; they are not split at line boundaries.

The gutter is rendered separately from code content. It is not selectable and does not enter copied or shared text. Individual gutter numbers are hidden from the accessibility tree to avoid repetitive reading; the code-block region communicates that line numbers are visible.

## Rendering and State Flow

1. The renderer yields only pending, succeeded, or failed state. A failure
   preserves the exact source and may include a diagnostic string; it has no
   public reason enum.
2. The theme resolver chooses the active palette independently of highlighting.
3. On success, the header switches from the requested language to the resolved language unless a custom or hidden label was supplied.
4. If line numbers are enabled, the line counter creates gutter labels from the original source while successful tokens or fallback text continue through the existing code renderer.
5. The surface renders the header, optional gutter, and selectable code content with coordinated scrolling.
6. Clip and share actions always read the original source. Clip additionally reads successful tokens and the current palette to construct the rich representation; when tokens are unavailable, it creates a rich plain-color representation.

Horizontal scrolling keeps gutter and code rows aligned. The header remains outside the code selection and scroll content.

## Accessibility

- The code block remains a named region.
- React forwards native section attributes, combines a consumer
  `aria-describedby` value with its internal line description, and exposes the
  root section ref.
- A visible automatic language label is not announced twice through a duplicate region label.
- Icon-only built-in actions have accurate platform-appropriate accessible names and state announcements.
- The extension menu exposes each required action label.
- Decorative icons and individual gutter numbers are hidden from assistive technology.
- Keyboard, focus, and activation behavior use the native button and menu primitives on each platform.
- Color palettes must provide readable text, muted text, and borders in both modes; tests cover representative contrast-sensitive states, though automated WCAG certification is outside this change.

## Failure Handling

- Highlight failure keeps the original source visible and leaves clip/share available.
- Presentation is not renderer input: style, font size, Dynamic Type, mode,
  theme, label, lines, and actions cannot restart tokenization or produce a
  failed render state.
- Invalid display configuration is contained: a nonpositive line start becomes `1`; absent extensions produce no menu.
- Caller or task cancellation closes or propagates through the platform
  primitive without emitting failure.
- Clipboard serialization escapes source content and cannot inject markup.
- Clipboard permission or capability errors fall back from rich to plain text where possible.
- Share capability is detected before rendering the action. Runtime cancellation is ignored; unexpected launch errors are surfaced only through platform-appropriate diagnostics or callbacks and do not replace the code block.
- An extension failure is owned by the extension callback and does not alter renderer state.

## API Baseline

The package has not been distributed, so source, binary, and API compatibility with earlier repository revisions is not a goal. Public API review prioritizes a small, correct, ergonomic surface and each platform's conventions. Compatibility-only aliases, overloads, union inputs, and positional parameters should be removed rather than carried into the first release.

The first-release public surfaces are intentionally platform-native:

- React accepts safe native section props and a root ref; it omits `children`
  and `dangerouslySetInnerHTML`, and has no dedicated `fontSize`, `scale`, or
  camel-cased ARIA props. The package exposes only its root entry point and its
  shared standard theme is deeply frozen at runtime.
- SwiftUI orders its view inputs as code, languages, `fontSize`, `mode`,
  `theme`, `label`, `lines`, and `actions`.
- Compose flattens the two language values into `CodeBlock`, orders `mode`
  before `theme`, accepts `TextStyle`, and exposes `Theme.standard` using
  Kotlin property casing.
- Every platform has one adaptive theme shape and one lower-level
  `HighlightOptions` name. Fixed theme constructors, token-map unions,
  compatibility aliases, and presentation fields in highlight requests are
  absent.

The stable constraints for this work are behavioral and architectural:

- the C ABI, WASM payload, JNI contract, grammars, queries, and token serialization do not change;
- tokenization remains lossless and the original source remains authoritative;
- all user themes contain complete light and dark palettes;
- existing dependency and platform floors remain unchanged;
- Compose gains native selection support as part of the new surface;
- the automatic theme, header, language label, and built-in actions intentionally define the new default visual output.

Existing visual tests will pin a mode explicitly where they are intended to test legacy token rendering. New representative snapshots cover adaptive mode, header actions, extension menu, and line numbers without multiplying every language fixture by every presentation state.

## Testing

Each binding receives unit or contract coverage for:

- automatic, forced light, and forced dark palette resolution;
- custom light and dark palettes and dotted token-scope fallback;
- automatic, custom, and hidden labels, including aliases and fallback language;
- `Lines` defaults, start clamping, empty source, trailing separators, LF/CRLF/CR handling, and multi-digit gutters;
- exact plain clipboard text and escaped rich text;
- clip success, rich-to-plain fallback, and complete failure;
- share availability and exact source payload;
- action visibility, stable built-in order, extension-menu appearance, and extension invocation;
- accessibility exclusion of gutters and decorative icons;
- pending and failed-render surfaces;
- presentation-only changes that retain the current highlight request;
- exact failure source/diagnostics and cancellation without a failed state;
- first-release API compile contracts and the absence of compatibility names.

Each platform adds a small number of representative visual snapshots for light, dark, line-number, and action states. Full shared token goldens remain unchanged. Sample apps demonstrate automatic mode, a custom adaptive theme, line numbers, clipping, sharing, and one extension action.

The final verification runs the shared, React, Swift, and Android test suites; representative pixel suites; and all three sample builds.

## Out of Scope

- Changes to tree-sitter grammars, queries, aliases, or token serialization.
- A custom cross-platform share dialog.
- Editing, code folding, soft-wrap controls, highlighted lines, or per-line actions.
- User-defined replacement of the built-in clip and share implementations.
- Per-built-in action visibility flags.
- Rich-text format identity across platforms; each binding writes the richest native format it can plus exact plain text.
