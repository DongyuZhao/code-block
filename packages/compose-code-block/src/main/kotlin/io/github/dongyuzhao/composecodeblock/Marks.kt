package io.github.dongyuzhao.composecodeblock

internal fun marks(code: String, start: Int): List<Int> {
    var count = 1
    var index = 0
    while (index < code.length) {
        if (code[index] == '\r') {
            if (index + 1 < code.length && code[index + 1] == '\n') {
                index++
            }
            count++
        } else if (code[index] == '\n') {
            count++
        }
        index++
    }

    val lastOffset = count - 1
    val first = start.coerceIn(1, Int.MAX_VALUE - lastOffset)
    return List(count) { first + it }
}
