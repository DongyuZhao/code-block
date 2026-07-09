import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const highlighter = vi.hoisted(() => vi.fn());

vi.mock("../src/code-highlighter.js", () => ({
    highlightCode: highlighter,
    loadHighlighter: vi.fn()
}));

import {
    CodeBlock,
    renderCode,
    standard,
    useCodeRenderState,
    type CodeRenderState,
    type HighlightOptions
} from "../src/index.js";

beforeEach(() => {
    highlighter.mockReset();
});

it("returns pending immediately for source changes and ignores stale ABA completions", async () => {
    const first = deferred<HighlightResult>();
    const second = deferred<HighlightResult>();
    const third = deferred<HighlightResult>();
    highlighter
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockReturnValueOnce(third.promise);
    const observed: CodeRenderState[] = [];
    const onRender = (state: CodeRenderState) => observed.push(state);
    const view = render(<RenderStateProbe code="A" language="plain" onRender={onRender} />);
    await waitFor(() => expect(highlighter).toHaveBeenCalledTimes(1));
    await act(async () => first.resolve(result("A", "plain")));
    await waitFor(() =>
        expect(screen.getByTestId("render-state")).toHaveTextContent("succeeded:A")
    );

    observed.length = 0;
    view.rerender(<RenderStateProbe code="B" language="plain" onRender={onRender} />);
    expect(observed[0]?.status).toBe("pending");
    await waitFor(() => expect(highlighter).toHaveBeenCalledTimes(2));

    observed.length = 0;
    view.rerender(<RenderStateProbe code="A" language="plain" onRender={onRender} />);
    expect(observed[0]?.status).toBe("pending");
    await waitFor(() => expect(highlighter).toHaveBeenCalledTimes(3));

    await act(async () => second.resolve(result("B", "plain")));
    expect(screen.getByTestId("render-state")).toHaveTextContent("pending");
    await act(async () => third.resolve(result("A", "plain")));
    await waitFor(() =>
        expect(screen.getByTestId("render-state")).toHaveTextContent("succeeded:A")
    );
});

it("returns pending immediately when the language changes for the same source", async () => {
    const javascript = deferred<HighlightResult>();
    const plain = deferred<HighlightResult>();
    highlighter.mockReturnValueOnce(javascript.promise).mockReturnValueOnce(plain.promise);
    const observed: CodeRenderState[] = [];
    const onRender = (state: CodeRenderState) => observed.push(state);
    const view = render(
        <RenderStateProbe code="const value = 1;" language="javascript" onRender={onRender} />
    );
    await waitFor(() => expect(highlighter).toHaveBeenCalledTimes(1));
    await act(async () => javascript.resolve(result("const value = 1;", "javascript")));
    await waitFor(() =>
        expect(screen.getByTestId("render-state")).toHaveTextContent("succeeded:const value = 1;")
    );

    observed.length = 0;
    view.rerender(
        <RenderStateProbe code="const value = 1;" language="plain" onRender={onRender} />
    );
    expect(observed[0]?.status).toBe("pending");
    await waitFor(() => expect(highlighter).toHaveBeenCalledTimes(2));
    expect(highlighter).toHaveBeenLastCalledWith("const value = 1;", {
        language: "plain",
        fallbackLanguage: "plain"
    });

    await act(async () => plain.resolve(result("const value = 1;", "plain")));
    await waitFor(() =>
        expect(screen.getByTestId("render-state")).toHaveTextContent("succeeded:const value = 1;")
    );
});

it("does not restart highlighting when presentation inputs change", async () => {
    highlighter.mockResolvedValue(result("x", "plain"));
    const view = render(<CodeBlock code="x" style={{ fontSize: 14 }} actions={{ show: false }} />);
    await waitFor(() => expect(highlighter).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("region")).toHaveTextContent("x"));

    view.rerender(
        <CodeBlock
            code="x"
            mode="dark"
            theme={{
                light: { ...standard.light, base: "#fafafa" },
                dark: { ...standard.dark, base: "#101010" }
            }}
            style={{ fontSize: 20 }}
            label={false}
            lines={{ show: true, start: 5 }}
            actions={{ show: false }}
        />
    );

    expect(highlighter).toHaveBeenCalledTimes(1);
    expect(highlighter).toHaveBeenLastCalledWith("x", {
        language: "plain",
        fallbackLanguage: "plain"
    });
});

it("ignores presentation-shaped extras and sends only highlighting inputs", async () => {
    highlighter.mockResolvedValue(result("exact source", "plain"));
    const options = {
        language: "plain",
        fallbackLanguage: "plain",
        fontSize: 0,
        scale: 0
    } as HighlightOptions & { fontSize: number; scale: number };
    const states: CodeRenderState[] = [];

    for await (const state of renderCode("exact source", options)) {
        states.push(state);
    }

    expect(states.at(-1)).toEqual({
        status: "succeeded",
        rendered: {
            code: "exact source",
            language: "plain",
            tokens: [{ text: "exact source", scope: "" }]
        }
    });
    expect(highlighter).toHaveBeenCalledWith("exact source", {
        language: "plain",
        fallbackLanguage: "plain"
    });
});

it("keeps exact source and optional diagnostics in one failed state", async () => {
    highlighter.mockRejectedValue(new Error("offline"));
    const states: CodeRenderState[] = [];

    for await (const state of renderCode("exact source")) {
        states.push(state);
    }

    expect(states).toEqual([
        { status: "pending" },
        { status: "failed", fallback: { text: "exact source", error: "offline" } }
    ]);
});

it("propagates cancellation without emitting a failed state", async () => {
    const cancellation = new DOMException("cancelled", "AbortError");
    highlighter.mockRejectedValue(cancellation);
    const states: CodeRenderState[] = [];

    await expect(async () => {
        for await (const state of renderCode("exact source")) {
            states.push(state);
        }
    }).rejects.toBe(cancellation);
    expect(states).toEqual([{ status: "pending" }]);
});

it("keeps hook cancellation as pending control flow", async () => {
    const cancellation = new DOMException("cancelled", "AbortError");
    highlighter.mockRejectedValue(cancellation);

    render(<RenderStateProbe code="exact source" language="plain" onRender={() => undefined} />);

    await waitFor(() => expect(highlighter).toHaveBeenCalledOnce());
    await act(async () => Promise.resolve());
    expect(screen.getByTestId("render-state")).toHaveTextContent("pending");
});

type RenderStateProbeProps = HighlightOptions & {
    code: string;
    onRender: (state: CodeRenderState) => void;
};

function RenderStateProbe({ code, onRender, ...options }: RenderStateProbeProps) {
    const state = useCodeRenderState(code, options);
    onRender(state);
    const text =
        state.status === "succeeded"
            ? `succeeded:${state.rendered.tokens.map((token) => token.text).join("")}`
            : state.status;
    return <output data-testid="render-state">{text}</output>;
}

type HighlightResult = {
    language: string;
    tokens: { text: string; scope: string }[];
};

function result(code: string, language: string): HighlightResult {
    return { language, tokens: [{ text: code, scope: "" }] };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((next) => {
        resolve = next;
    });
    return { promise, resolve };
}
