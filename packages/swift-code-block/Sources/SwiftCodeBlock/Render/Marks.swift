enum Marks {
    static func make(code: String, start: Int) -> [Int] {
        let bytes = code.utf8
        var count = 1
        var index = bytes.startIndex

        while index != bytes.endIndex {
            switch bytes[index] {
            case 0x0d:
                let next = bytes.index(after: index)
                if next != bytes.endIndex, bytes[next] == 0x0a {
                    index = next
                }
                count += 1
            case 0x0a:
                count += 1
            default:
                break
            }
            index = bytes.index(after: index)
        }

        let highestFirst = Int.max - (count - 1)
        let first = min(max(start, 1), highestFirst)
        return (0..<count).map { first + $0 }
    }
}
