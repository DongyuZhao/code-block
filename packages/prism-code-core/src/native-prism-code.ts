import type { PrismCodeOptions, PrismRuntime } from "./prism-code-core";

declare const PrismCodeCore: typeof import("./prism-code-core");

type NativePrismGlobal = {
  Prism?: PrismRuntime;
  CodeBlockPrism?: {
    tokenizeJSON(code: string, options?: PrismCodeOptions): string;
  };
};

export function installPrismCodeBridge(globalObject: NativePrismGlobal): void {
  globalObject.CodeBlockPrism = {
    tokenizeJSON(code: string, options?: PrismCodeOptions): string {
      return PrismCodeCore.tokenizeCodeJson(globalObject.Prism, code, options);
    }
  };
}
