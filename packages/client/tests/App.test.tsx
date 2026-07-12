import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { App } from "../src/App";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="table-canvas" />,
}));

test("renders an accessible application shell", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: "Build your board." }),
  ).toBeVisible();
  expect(
    screen.getByRole("region", {
      name: "Three-dimensional table preview",
    }),
  ).toContainElement(screen.getByTestId("table-canvas"));
});
