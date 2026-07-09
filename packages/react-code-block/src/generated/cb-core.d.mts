// Type shim for the Emscripten-generated glue (cb-core.mjs), which is a
// prebuilt artifact produced from packages/shared/code-block-core by
// scripts/build-code-block-wasm (Emscripten). Only the members used by the
// highlighter are declared here.

export interface CbCoreModule {
    cwrap(
        name: string,
        returnType: "number" | "string" | null,
        argTypes: Array<"number" | "string">
    ): (...args: Array<string | number>) => number & string & void;
    UTF8ToString(ptr: number): string;
}

declare const createCbCore: (moduleArg?: Record<string, unknown>) => Promise<CbCoreModule>;
export default createCbCore;
