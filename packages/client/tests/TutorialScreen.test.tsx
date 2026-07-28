import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TutorialScreen } from "../src/tutorial/TutorialScreen";
import { expectNoCriticalAccessibilityViolations } from "./setup";

function renderTutorial(onHome = vi.fn()) {
  const result = render(
    <TutorialScreen homeUrl="https://example.test/ofcpoker/" onHome={onHome} />,
  );
  return { ...result, onHome };
}

describe("guided tutorial screen", () => {
  test("steps forward and backward through one visible instruction at a time", () => {
    renderTutorial();

    expect(
      screen.getByRole("heading", { name: "Build three poker hands." }),
    ).toHaveFocus();
    expect(screen.getByText("Step 1 of 10")).toBeVisible();
    expect(screen.getByRole("button", { name: /Back/ })).toBeDisabled();
    expect(
      screen.queryByText("A stronger row above a weaker one fouls."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(
      screen.getByRole("heading", { name: "Start with five cards." }),
    ).toHaveFocus();
    expect(screen.getByText("Step 2 of 10")).toBeVisible();
    expect(screen.getByLabelText("queen of spades")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(
      screen.getByRole("heading", { name: "Build three poker hands." }),
    ).toHaveFocus();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 4: Place eight more, one at a time.",
      }),
    );
    expect(screen.getByText("Upcoming draws")).toBeVisible();
  });

  test("supports arrow keys and direct progress navigation", () => {
    renderTutorial();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(
      screen.getByRole("heading", { name: "Start with five cards." }),
    ).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(
      screen.getByRole("heading", { name: "Build three poker hands." }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 7: Compare matching rows.",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Compare matching rows." }),
    ).toHaveFocus();
    expect(screen.getByText("+7")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Opponent completed example board" }),
    ).toBeVisible();
  });

  test("explains Fantasyland entry and the three ways to stay", () => {
    renderTutorial();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 8: Queens or better in front earn Fantasyland.",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Queens or better in front earn Fantasyland.",
      }),
    ).toHaveFocus();
    expect(screen.getByText(/pair of queens, kings, aces/)).toBeVisible();
    expect(screen.getByText("Three of a kind in front, or")).toBeVisible();
    expect(
      screen.getByText("A full house or better in middle, or"),
    ).toBeVisible();
    expect(screen.getByText("Four of a kind or better in back.")).toBeVisible();
  });

  test("shows exact front, middle, and back royalty tables", () => {
    renderTutorial();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 9: Know your royalties.",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Know your royalties." }),
    ).toHaveFocus();
    expect(screen.getAllByRole("table")).toHaveLength(3);
    expect(screen.getByRole("table", { name: "Front hand" })).toHaveTextContent(
      "QQ7",
    );
    expect(
      screen.getByRole("table", { name: "Middle hand" }),
    ).toHaveTextContent("Royal flush50");
    expect(screen.getByRole("table", { name: "Back hand" })).toHaveTextContent(
      "Straight2",
    );
  });

  test("finishes with Start playing and Redo tutorial actions", () => {
    const { onHome } = renderTutorial();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 10: Congratulations!",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Congratulations!" }),
    ).toHaveFocus();
    expect(
      screen.getByText(
        "You finished the tutorial. You’re ready to start playing!",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Redo tutorial/ }));
    expect(
      screen.getByRole("heading", { name: "Build three poker hands." }),
    ).toHaveFocus();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 10: Congratulations!",
      }),
    );
    fireEvent.click(screen.getByRole("link", { name: /Start playing/ }));
    expect(onHome).toHaveBeenCalledOnce();
  });

  test("has no serious or critical accessibility violations on representative slides", async () => {
    const { container } = renderTutorial();
    await expectNoCriticalAccessibilityViolations(container);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 7: Compare matching rows.",
      }),
    );
    await expectNoCriticalAccessibilityViolations(container);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 8: Queens or better in front earn Fantasyland.",
      }),
    );
    await expectNoCriticalAccessibilityViolations(container);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 9: Know your royalties.",
      }),
    );
    await expectNoCriticalAccessibilityViolations(container);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to step 10: Congratulations!",
      }),
    );
    await expectNoCriticalAccessibilityViolations(container);
  });
});
