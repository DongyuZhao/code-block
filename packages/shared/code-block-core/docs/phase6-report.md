# Phase 6 Report — Final Verification and Docs Polish

Phase 6 closed the migration with broad verification, visual snapshot checks, sample builds, and final documentation cleanup.

## Verification

The shell still did not have `pnpm` or `corepack`, so `pnpm test:all` could not be run literally. The underlying commands were run directly instead.

Commands run on 2026-07-09:

```sh
node --test packages/prism-code-core/test/*.test.mjs
make -C packages/shared/code-block-core test
./node_modules/.bin/vitest run --project unit
./node_modules/.bin/vitest run --project browser
swift test --package-path .
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:testDebugUnitTest
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :packages:compose-code-block:verifyRoborazziDebug
xcodebuild -project samples/swift-code-block-sample/SwiftCodeBlockSample.xcodeproj -scheme SwiftCodeBlockSample-iOS -destination 'generic/platform=iOS Simulator' build
GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :samples:compose-code-block-sample:assembleDebug
(cd packages/react-code-block && ./node_modules/.bin/tsc -p tsconfig.json)
(cd packages/react-code-block && node scripts/copy-wasm-assets.mjs)
(cd samples/react-code-block-sample && ./node_modules/.bin/vite build)
```

All commands passed. `swift test` includes the Swift visual snapshot test. React browser tests verify the pixel snapshots. Android Roborazzi verified the Compose screenshots.

## Notes

- React browser tests required sandbox escalation because Vitest browser mode binds a localhost server port.
- Android Gradle and Roborazzi tasks required sandbox escalation because Gradle needs local file-lock sockets.
- The React sample build emitted Vite's expected large-chunk warning because the wasm module is intentionally shipped as a single-file ES module.
- The React sample build was run from `samples/react-code-block-sample`; before that, the React package was compiled with `tsc` and `scripts/copy-wasm-assets.mjs` copied generated wasm glue into `dist`.

## Documentation Cleanup

- The migration plan status now reflects Phase 6 completion.
- The active implementation reference in the plan points to `packages/shared/code-block-core/src/code_block_core.c` instead of the deleted Prism TypeScript source.
- README and samples already describe tree-sitter token streams and the `{ text, scope }` API.

## Remaining Optional Follow-Up

`packages/prism-code-core` is now package metadata for `@code-block/fixtures`, but the directory name remains for path stability. A future mechanical rename to `packages/code-block-fixtures` would remove the last live path-level Prism name.
