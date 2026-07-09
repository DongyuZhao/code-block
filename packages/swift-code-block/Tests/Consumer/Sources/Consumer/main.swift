import SwiftCodeBlock
import SwiftUI

let options = HighlightOptions(language: "swift")
precondition(options.language == "swift")

let view = CodeBlock(
    "let answer = 42",
    language: "swift",
    mode: .automatic,
    label: .automatic,
    lines: .init(show: true, start: 8),
    actions: .init(extensions: [.init(id: "open", label: "Open", run: {})])
)
_ = view
