import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import axe from "axe-core";
import { afterAll, afterEach, vi } from "vitest";

const originalWarn = console.warn;
const warn = vi
  .spyOn(console, "warn")
  .mockImplementation((...args: unknown[]) => {
    // Vitest evaluates Three's source and package entry as separate modules in
    // JSDOM. Vite deduplicates them in the browser build; keep other warnings.
    if (args[0] === "WARNING: Multiple instances of Three.js being imported.")
      return;
    originalWarn(...args);
  });

afterAll(() => warn.mockRestore());

export async function expectNoCriticalAccessibilityViolations(
  container: Element,
): Promise<void> {
  const result = await axe.run(container, {
    resultTypes: ["violations"],
    rules: {
      // JSDOM cannot calculate rendered foreground/background contrast.
      "color-contrast": { enabled: false },
    },
  });
  const violations = result.violations.filter(
    ({ impact }) => impact === "critical" || impact === "serious",
  );
  if (violations.length > 0) {
    throw new Error(
      violations
        .map(
          ({ id, help, nodes }) =>
            `${id}: ${help}\n${nodes.map(({ target }) => `  ${target.join(" ")}`).join("\n")}`,
        )
        .join("\n"),
    );
  }
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => null,
});

afterEach(cleanup);
