import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CodeBlock, renderCodeToTokens } from "../src/index.js";

describe("renderCodeToTokens", () => {
  it("returns Prism token runs for JavaScript", () => {
    const payload = renderCodeToTokens("const answer = 42;", { language: "javascript" });

    expect(payload.ok).toBe(true);
    expect(payload.language).toBe("javascript");
    expect(payload.tokens).toContainEqual({ text: "const", types: ["keyword"] });
    expect(payload.tokens).toContainEqual({ text: "42", types: ["number"] });
  });

  it("falls back to plain text for unknown languages", () => {
    const payload = renderCodeToTokens("hello", { language: "unknown-language" });

    expect(payload.ok).toBe(true);
    expect(payload.language).toBe("plain");
    expect(payload.grammarFound).toBe(false);
    expect(payload.tokens).toEqual([{ text: "hello", types: ["plain"] }]);
  });
});

describe("<CodeBlock>", () => {
  it("renders highlighted native DOM spans without HTML injection", async () => {
    const { container } = render(<CodeBlock code="const answer = 42;" language="javascript" />);

    const block = await screen.findByRole("region", {
      name: "javascript code block"
    });

    await waitFor(() => {
      expect(container.querySelector(".token.keyword")).not.toBeNull();
    });
    expect(block.querySelector("code")).not.toBeNull();
    expect(container.innerHTML).not.toContain("dangerouslySetInnerHTML");
    expect(container.textContent).toBe("const answer = 42;");
  });
});
