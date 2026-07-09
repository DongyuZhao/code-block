import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: "unit",
                    environment: "jsdom",
                    globals: true,
                    setupFiles: ["./test/setup.ts"],
                    include: ["test/**/*.test.{ts,tsx}"],
                    exclude: ["test/**/*.browser.test.{ts,tsx}"]
                }
            },
            {
                extends: true,
                test: {
                    name: "browser",
                    include: ["test/**/*.browser.test.{ts,tsx}"],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        viewport: { width: 800, height: 600 },
                        instances: [{ browser: "chromium" }]
                    }
                }
            }
        ]
    }
});
