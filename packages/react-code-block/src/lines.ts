export function marks(code: string, start = 1): number[] {
    let count = 1;
    for (let index = 0; index < code.length; index += 1) {
        if (code[index] === "\r") {
            if (code[index + 1] === "\n") index += 1;
            count += 1;
        } else if (code[index] === "\n") {
            count += 1;
        }
    }
    const requested = Number.isFinite(start) && start >= 1 ? Math.floor(start) : 1;
    const first = Math.min(requested, Number.MAX_SAFE_INTEGER - (count - 1));
    return Array.from({ length: count }, (_, index) => first + index);
}
