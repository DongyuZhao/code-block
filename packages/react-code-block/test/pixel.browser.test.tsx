import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { ReactNode } from "react";

import codeSnippets from "../../shared/code-block-core/fixtures/code-snippets.json";
import { CodeBlock } from "../src/index.js";

for (const snippet of codeSnippets) {
    test(`pixel: ${snippet.id}`, async () => {
        const screen = await render(
            <div
                data-testid="pixel-target"
                style={{
                    boxSizing: "border-box",
                    width: 552,
                    height: 184,
                    padding: 16,
                    overflow: "hidden",
                    background: "#ffffff"
                }}
            >
                <CodeBlock
                    code={snippet.code}
                    language={snippet.language}
                    mode="dark"
                    label={false}
                    actions={{ show: false }}
                    style={{
                        boxSizing: "border-box",
                        width: "100%",
                        height: "100%",
                        overflow: "hidden",
                        fontSize: snippet.fontSize
                    }}
                />
            </div>
        );

        const target = screen.getByTestId("pixel-target");
        await expect.poll(() => target.element().querySelector(".token")).not.toBeNull();

        const targetRect = target.element().getBoundingClientRect();
        expect({ width: targetRect.width, height: targetRect.height }).toEqual({
            width: 552,
            height: 184
        });

        const codeBlock = target.element().querySelector("pre");
        expect(codeBlock).not.toBeNull();
        expect(codeBlock!.scrollWidth).toBeLessThanOrEqual(codeBlock!.clientWidth);
        expect(codeBlock!.scrollHeight).toBeLessThanOrEqual(codeBlock!.clientHeight);

        await expect.element(target).toMatchScreenshot(snippet.id, {
            comparatorName: "pixelmatch",
            comparatorOptions: { allowedMismatchedPixelRatio: 0.002 }
        });
    });
}

const presentationCode = `const greeting = "Hello, surface";
console.log(greeting);`;

const presentationCases = [
    { name: "presentation-forced-light", mode: "light" as const },
    { name: "presentation-forced-dark", mode: "dark" as const }
];

for (const presentation of presentationCases) {
    test(`pixel: ${presentation.name}`, async () => {
        const screen = await renderPresentation(
            <CodeBlock
                code={presentationCode}
                language="javascript"
                mode={presentation.mode}
                style={presentationSurfaceStyle}
            />
        );

        await expect
            .element(screen.getByTestId("pixel-target"))
            .toMatchScreenshot(presentation.name, screenshotOptions);
    });
}

test("pixel: presentation-lines", async () => {
    const screen = await renderPresentation(
        <CodeBlock
            code={presentationCode}
            language="javascript"
            mode="dark"
            lines={{ show: true, start: 8 }}
            style={presentationSurfaceStyle}
        />
    );

    await expect.poll(() => screen.getByTestId("code-lines").element().textContent).toBe("8\n9");
    await expect
        .element(screen.getByTestId("pixel-target"))
        .toMatchScreenshot("presentation-lines", screenshotOptions);
});

test("pixel: presentation-extension-menu", async () => {
    const screen = await renderPresentation(
        <CodeBlock
            code={presentationCode}
            language="javascript"
            mode="light"
            actions={{
                extensions: [
                    {
                        id: "open",
                        label: "Open in editor",
                        run: () => undefined
                    }
                ]
            }}
            style={presentationSurfaceStyle}
        />
    );
    const more = screen.getByRole("button", { name: "More actions" });

    await more.click();
    await expect.poll(() => more.element().getAttribute("aria-expanded")).toBe("true");
    await expect
        .element(screen.getByTestId("pixel-target"))
        .toMatchScreenshot("presentation-extension-menu", screenshotOptions);
});

test("layout: a long extension menu escapes the code surface", async () => {
    const extensions = Array.from({ length: 8 }, (_, index) => ({
        id: `action-${index + 1}`,
        label: `Action ${index + 1}`,
        run: () => undefined
    }));
    const screen = await render(
        <div
            style={{
                boxSizing: "border-box",
                width: 360,
                height: 420,
                padding: 16,
                background: "#ffffff"
            }}
        >
            <CodeBlock
                code="short"
                language="plain"
                label={false}
                mode="light"
                actions={{ extensions }}
                style={{ boxSizing: "border-box", width: "100%", height: 88 }}
            />
        </div>
    );
    const region = screen.getByRole("region");
    const more = screen.getByRole("button", { name: "More actions" });

    await more.click();
    const last = screen.getByRole("menuitem", { name: "Action 8" });
    await expect.poll(() => last.element().getBoundingClientRect().height).toBeGreaterThan(0);
    const regionRect = region.element().getBoundingClientRect();
    const lastRect = last.element().getBoundingClientRect();
    expect(lastRect.bottom).toBeGreaterThan(regionRect.bottom);

    const hit = document.elementFromPoint(
        lastRect.left + lastRect.width / 2,
        lastRect.top + lastRect.height / 2
    );
    expect(hit === last.element() || last.element().contains(hit)).toBe(true);
});

test("layout: hidden label keeps the action group trailing", async () => {
    const screen = await render(
        <div style={{ width: 360, padding: 16 }}>
            <CodeBlock
                code="short"
                language="plain"
                label={false}
                mode="light"
                style={{ boxSizing: "border-box", width: "100%", height: 120 }}
            />
        </div>
    );
    const head = screen.getByTestId("code-head").element();
    const actionGroup = screen.getByRole("button", { name: "Copy code" }).element().parentElement;
    expect(actionGroup).not.toBeNull();

    const headRect = head.getBoundingClientRect();
    const actionRect = actionGroup!.getBoundingClientRect();
    expect(actionRect.left).toBeGreaterThan(headRect.left + headRect.width / 2);
    expect(headRect.right - actionRect.right).toBeCloseTo(8, 1);
});

test("layout: hidden label keeps the action group at the RTL trailing edge", async () => {
    const screen = await render(
        <div dir="rtl" style={{ width: 360, padding: 16 }}>
            <CodeBlock
                code="short"
                language="plain"
                label={false}
                mode="light"
                style={{ boxSizing: "border-box", width: "100%", height: 120 }}
            />
        </div>
    );
    const head = screen.getByTestId("code-head").element();
    const actionGroup = screen.getByRole("button", { name: "Copy code" }).element().parentElement;
    expect(actionGroup).not.toBeNull();

    const headRect = head.getBoundingClientRect();
    const actionRect = actionGroup!.getBoundingClientRect();
    expect(actionRect.right).toBeLessThan(headRect.left + headRect.width / 2);
    expect(actionRect.left - headRect.left).toBeCloseTo(8, 1);
});

test("interaction: an outside click closes the extension menu", async () => {
    const screen = await render(
        <div>
            <CodeBlock
                code="short"
                actions={{
                    extensions: [{ id: "open", label: "Open", run: () => undefined }]
                }}
            />
            <button type="button">Outside</button>
        </div>
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    await trigger.click();
    const item = screen.getByRole("menuitem", { name: "Open" });
    await expect.poll(() => document.activeElement === item.element()).toBe(true);

    const outside = screen.getByRole("button", { name: "Outside" });
    await outside.click();

    await expect.poll(() => trigger.element().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(outside.element());
});

test("interaction: Tab closes the extension menu and advances focus", async () => {
    const screen = await render(
        <div>
            <CodeBlock
                code="short"
                actions={{
                    extensions: [{ id: "open", label: "Open", run: () => undefined }]
                }}
            />
            <button type="button">After menu</button>
        </div>
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    await trigger.click();
    const item = screen.getByRole("menuitem", { name: "Open" });
    await expect.poll(() => document.activeElement === item.element()).toBe(true);

    await userEvent.keyboard("{Tab}");

    await expect.poll(() => trigger.element().getAttribute("aria-expanded")).toBe("false");
    const after = screen.getByRole("button", { name: "After menu" });
    await expect.poll(() => document.activeElement === after.element()).toBe(true);
});

const presentationSurfaceStyle = {
    boxSizing: "border-box",
    width: "100%",
    height: "100%"
} as const;

const screenshotOptions = {
    comparatorName: "pixelmatch" as const,
    comparatorOptions: { allowedMismatchedPixelRatio: 0.002 }
};

async function renderPresentation(codeBlock: ReactNode) {
    const screen = await render(
        <div
            data-testid="pixel-target"
            style={{
                boxSizing: "border-box",
                width: 552,
                height: 220,
                padding: 16,
                overflow: "hidden",
                background: "#ffffff"
            }}
        >
            {codeBlock}
        </div>
    );

    const target = screen.getByTestId("pixel-target");
    await expect.poll(() => target.element().querySelector(".token")).not.toBeNull();
    expect(target.element().getBoundingClientRect().toJSON()).toMatchObject({
        width: 552,
        height: 220
    });

    return screen;
}
