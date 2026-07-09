import Foundation

struct CodeSnippetFixture: Decodable {
    let id: String
    let language: String
    let fontSize: Double
    let code: String
}

enum CodeSnippetFixtures {
    static func all(file: StaticString = #filePath) throws -> [CodeSnippetFixture] {
        let url = fixturesDirectory(file: file).appendingPathComponent("code-snippets.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([CodeSnippetFixture].self, from: data)
    }

    static func fixturesDirectory(file: StaticString) -> URL {
        var url = URL(fileURLWithPath: "\(file)")
        while url.pathComponents.count > 1 {
            url.deleteLastPathComponent()
            let candidate = url.appendingPathComponent(
                "packages/shared/code-block-core/fixtures")
            if FileManager.default.fileExists(
                atPath: candidate.appendingPathComponent("code-snippets.json").path
            ) {
                return candidate
            }
        }
        fatalError("Could not locate packages/shared/code-block-core/fixtures from \(file)")
    }
}
