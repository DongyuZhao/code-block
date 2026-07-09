import Prism from "prismjs";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-go.js";
import "prismjs/components/prism-java.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-kotlin.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-ruby.js";
import "prismjs/components/prism-rust.js";
import "prismjs/components/prism-swift.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-tsx.js";
import {
  parseCodeTokensJson,
  tokenizeCodeJson,
  type PrismCodeOptions,
  type PrismCodePayload,
  type PrismTokenRun
} from "./prism-code-core.js";

export {
  parseCodeTokensJson,
  tokenizeCodeJson,
  type PrismCodeOptions,
  type PrismCodePayload,
  type PrismTokenRun
} from "./prism-code-core.js";

export function renderCodeToPrismTokens(
  code: string,
  options: PrismCodeOptions = {}
): PrismCodePayload {
  return parseCodeTokensJson(tokenizeCodeJson(Prism, code, options));
}
