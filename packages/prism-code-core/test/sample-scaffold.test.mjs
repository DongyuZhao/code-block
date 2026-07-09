import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("../../..", import.meta.url).pathname;

function read(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("repository exposes React, Swift, and Android sample app scripts", () => {
  const rootPackage = JSON.parse(read("package.json"));

  assert.equal(
    rootPackage.scripts["sample:react:dev"],
    "pnpm --dir samples/react-code-block-sample run dev"
  );
  assert.equal(
    rootPackage.scripts["sample:react:build"],
    "pnpm --dir samples/react-code-block-sample run build"
  );
  assert.equal(
    rootPackage.scripts["sample:swift:generate"],
    "xcodegen generate --spec samples/swift-code-block-sample/project.yml --project samples/swift-code-block-sample"
  );
  assert.equal(
    rootPackage.scripts["sample:swift:build"],
    "xcodebuild -project samples/swift-code-block-sample/SwiftCodeBlockSample.xcodeproj -scheme SwiftCodeBlockSample-iOS -destination 'generic/platform=iOS Simulator' build"
  );
  assert.equal(
    rootPackage.scripts["sample:android:build"],
    'GRADLE_USER_HOME=.gradle-home JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew -p samples/compose-code-block-sample :app:assembleDebug'
  );
});

test("sample apps are wired to local platform packages", () => {
  assert.ok(existsSync(join(repoRoot, "samples/react-code-block-sample/src/App.tsx")));
  assert.ok(
    existsSync(
      join(repoRoot, "samples/swift-code-block-sample/Sources/SwiftCodeBlockSample/SampleApp.swift")
    )
  );
  assert.ok(
    existsSync(
      join(
        repoRoot,
        "samples/swift-code-block-sample/SwiftCodeBlockSample.xcodeproj/project.pbxproj"
      )
    )
  );
  assert.ok(
    existsSync(
      join(
        repoRoot,
        "samples/compose-code-block-sample/app/src/main/kotlin/io/github/dongyuzhao/composecodeblocksample/MainActivity.kt"
      )
    )
  );

  assert.match(
    read("samples/react-code-block-sample/package.json"),
    /"react-code-block": "file:\.\.\/\.\.\/packages\/react-code-block"/
  );
  assert.match(
    read("samples/swift-code-block-sample/project.yml"),
    /swift-code-block:\n\s+path: \.\.\/\.\.\/packages\/swift-code-block/
  );
  assert.match(
    read("samples/swift-code-block-sample/SwiftCodeBlockSample.xcodeproj/project.pbxproj"),
    /XCLocalSwiftPackageReference "\.\.\/\.\.\/packages\/swift-code-block"/
  );
  assert.match(
    read("samples/compose-code-block-sample/settings.gradle.kts"),
    /project\(":compose-code-block"\)\.projectDir = file\("\.\.\/\.\.\/packages\/compose-code-block"\)/
  );
});
