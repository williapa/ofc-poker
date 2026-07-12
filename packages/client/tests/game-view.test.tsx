import { fireEvent, render, screen, within } from "@testing-library/react";
import type { LobbyMetadata } from "@ofcpoker/data-provider";
import type {
  CardCode,
  OfcHandAction,
  OfcPlayerVisibleState,
} from "@ofcpoker/game-engine";
import { describe, expect, test, vi } from "vitest";
import type { GameViewModel, GameViewPlayer } from "../src/contracts/game-view";
import { GameTableView } from "../src/game-view/GameTableView";
import { createCameraLayout, createSeatLayout } from "../src/game-view/layout";

function players(count: 2 | 3 | 4): readonly GameViewPlayer[] {
  return Array.from({ length: count }, (_, seat) => ({
    id: `player-${seat}`,
    displayName: seat === 0 ? "Ada" : `Player ${seat + 1}`,
    seat,
    connection: "connected" as const,
    score: seat * -2,
    inFantasyland: seat === 1,
    isAi: seat > 0,
  }));
}

function lobby(count: 2 | 3 | 4): LobbyMetadata {
  const seated = players(count);
  return {
    id: "lobby-1",
    hostId: "player-0",
    status: "active",
    settings: {
      schemaVersion: 1,
      seatCount: count,
      mode: "local-ai",
      rules: {
        variant: "standard-ofc",
        fantasyland: true,
        tiedRowPoints: 0,
      },
    },
    participants: seated.map(({ id, displayName }) => ({
      id,
      displayName,
      connection: "connected",
    })),
  };
}

function visibleState(count: 2 | 3 | 4): OfcPlayerVisibleState {
  return {
    schemaVersion: 1,
    gameId: "game-1",
    revision: 3,
    phase: "placing",
    configuration: {
      schemaVersion: 1,
      ruleset: "standard-ofc",
      seatCount: count,
      fantasyland: true,
      tiedRowPoints: 0,
    },
    dealerSeat: 1,
    activePlayerId: "player-0",
    viewerId: "player-0",
    players: players(count).map((player, index) => ({
      id: player.id,
      displayName: player.displayName,
      seat: player.seat,
      connected: true,
      score: player.score,
      board:
        index === 0
          ? {
              front: ["Qh" as CardCode],
              middle: ["2c" as CardCode],
              back: [],
            }
          : { front: [], middle: [], back: [] },
      placedCardCount: index === 0 ? 2 : 0,
    })),
    privateData: { pendingCards: ["As"] },
  };
}

function placeAction(row: "front" | "middle" | "back"): OfcHandAction {
  return {
    schemaVersion: 1,
    actionId: `place-${row}`,
    expectedRevision: 3,
    playerId: "player-0",
    type: "ofc.place-card",
    payload: { placement: { card: "As", row } },
  };
}

function model(
  count: 2 | 3 | 4,
  overrides: Partial<GameViewModel> = {},
): GameViewModel {
  return {
    lobby: lobby(count),
    viewerId: "player-0",
    connection: "connected",
    phase: "placing",
    handNumber: 2,
    dealerSeat: 1,
    activePlayerId: "player-0",
    isLocalTurn: true,
    canStartNextHand: false,
    players: players(count),
    state: visibleState(count),
    legalActions: [placeAction("front"), placeAction("back")],
    ...overrides,
  };
}

describe("seat and camera layout", () => {
  test.each([2, 3, 4] as const)(
    "lays out %i seats with the viewer stable at the bottom",
    (count) => {
      const layout = createSeatLayout(players(count), "player-0");
      expect(layout).toHaveLength(count);
      expect(layout.find(({ isLocal }) => isLocal)).toMatchObject({
        relativeSeat: 0,
        position: [0, 0, expect.any(Number)],
        rotationY: 0,
      });
      expect(new Set(layout.map(({ relativeSeat }) => relativeSeat)).size).toBe(
        count,
      );
    },
  );

  test("uses a wider compact camera framing for mobile", () => {
    const desktop = createCameraLayout(false);
    const mobile = createCameraLayout(true);
    expect(mobile.zoom).toBeLessThan(desktop.zoom);
    expect(mobile.position[1]).toBeGreaterThan(desktop.position[1]);
  });
});

test.each([2, 3, 4] as const)(
  "represents all row labels and 3 / 5 / 5 capacities for %i seats",
  (count) => {
    render(
      <GameTableView
        model={model(count)}
        onAction={() => undefined}
        webglSupported={false}
      />,
    );

    expect(screen.getAllByLabelText(/Front row, \d of 3 cards/)).toHaveLength(
      count,
    );
    expect(screen.getAllByLabelText(/Middle row, \d of 5 cards/)).toHaveLength(
      count,
    );
    expect(screen.getAllByLabelText(/Back row, \d of 5 cards/)).toHaveLength(
      count,
    );
  },
);

test("provides accessible cards, scores, status, target states, and actions", () => {
  const onAction = vi.fn();
  render(
    <GameTableView
      model={model(2)}
      onAction={onAction}
      webglSupported={false}
    />,
  );

  expect(screen.getByText("Your turn")).toBeVisible();
  const scores = screen.getByRole("complementary", { name: "Scores" });
  expect(within(scores).getByText("Ada (you)")).toBeVisible();
  expect(within(scores).getByText("0 points")).toBeVisible();
  expect(screen.getByText("queen of hearts")).toBeVisible();

  const ace = screen.getByRole("button", { name: /ace of spades/i });
  fireEvent.click(ace);
  expect(ace).toHaveAttribute("aria-pressed", "true");
  expect(within(ace).getByText("Selected")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Middle unavailable" }),
  ).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Place in Back" }));
  expect(onAction).toHaveBeenCalledWith(placeAction("back"));
});

test("keeps a useful DOM game surface when WebGL is unsupported", () => {
  render(
    <GameTableView
      model={model(2, { error: "Placement was rejected." })}
      onAction={() => undefined}
      webglSupported={false}
    />,
  );

  expect(screen.getByText("3D table unavailable")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Placement was rejected.",
  );
  expect(
    screen.getByRole("region", { name: "Accessible game board" }),
  ).toBeVisible();
  expect(screen.getByRole("group", { name: "Cards to place" })).toBeVisible();
});

test("represents an opponent Fantasyland board with consistent face-down information", () => {
  const state = visibleState(2);
  const fantasylandState: OfcPlayerVisibleState = {
    ...state,
    players: state.players.map((player) =>
      player.id === "player-1"
        ? {
            ...player,
            board: { front: ["Kh" as CardCode], middle: [], back: [] },
            placedCardCount: 1,
          }
        : player,
    ),
  };
  render(
    <GameTableView
      model={model(2, { state: fantasylandState })}
      onAction={() => undefined}
      webglSupported={false}
    />,
  );
  const opponent = screen.getByRole("heading", {
    name: "Player 2",
  }).parentElement;
  expect(opponent).not.toBeNull();
  expect(
    within(opponent as HTMLElement).getByText("1 face-down card"),
  ).toBeVisible();
  expect(screen.queryByText("king of hearts")).not.toBeInTheDocument();
});

test("fills unoccupied configured seats while a lobby is waiting", () => {
  const activeModel = model(4, {
    phase: "waiting",
    players: [players(4)[0] as GameViewPlayer],
    legalActions: [],
    isLocalTurn: false,
  });
  const { state: _state, ...waitingModel } = activeModel;
  expect(_state).toBeDefined();
  render(
    <GameTableView
      model={waitingModel}
      onAction={() => undefined}
      webglSupported={false}
    />,
  );
  expect(screen.getAllByRole("heading", { name: "Open seat" })).toHaveLength(3);
});
