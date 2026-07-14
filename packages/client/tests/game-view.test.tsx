import { fireEvent, render, screen, within } from "@testing-library/react";
import type { LobbyMetadata } from "@ofcpoker/data-provider";
import {
  resolveOfcRound,
  type CardCode,
  type OfcRoundResult,
  type OfcHandAction,
  type OfcPlayerVisibleState,
} from "@ofcpoker/game-engine";
import { describe, expect, test, vi } from "vitest";
import type { GameViewModel, GameViewPlayer } from "../src/contracts/game-view";
import { GameTableView } from "../src/game-view/GameTableView";
import {
  cardFaceLabels,
  GAME_VIEW_TOKENS,
} from "../src/game-view/design-system";
import { createCameraLayout, createSeatLayout } from "../src/game-view/layout";
import {
  RESPONSIVE_LAYOUT_INVARIANTS,
  RESPONSIVE_VIEWPORTS,
  type ResponsiveLayoutMode,
} from "../src/game-view/responsive-layout-invariants";
import { expectNoCriticalAccessibilityViolations } from "./setup";

function players(count: 2 | 3 | 4): readonly GameViewPlayer[] {
  return Array.from({ length: count }, (_, seat) => ({
    id: `player-${seat}`,
    displayName: seat === 0 ? "Ada" : `Player ${seat + 1}`,
    seat,
    connection: "connected" as const,
    score: seat * -2,
    inFantasyland: seat === 1,
    isAi: seat > 0,
    isThinking: false,
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

function resolvedTwoPlayerRound(): OfcRoundResult {
  return resolveOfcRound([
    {
      playerId: "player-0",
      board: {
        front: ["Qc", "Qd", "2c"],
        middle: ["2h", "3h", "4h", "5h", "6h"],
        back: ["Ts", "Js", "Qs", "Ks", "As"],
      },
      wasInFantasyland: false,
    },
    {
      playerId: "player-1",
      board: {
        front: ["Kc", "Kd", "3c"],
        middle: ["4c", "5c", "6c", "7c", "8c"],
        back: ["Th", "Jh", "Qh", "Kh", "Ah"],
      },
      wasInFantasyland: false,
    },
  ]);
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

function mockMediaQueries(matchingQueries: readonly string[]) {
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: matchingQueries.includes(query),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
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
      expect(layout.every(({ rotationY }) => rotationY === 0)).toBe(true);
    },
  );

  test("compresses mobile side seats so card sections stay inside the mobile frame", () => {
    const desktop = createSeatLayout(players(4), "player-0");
    const portrait = createSeatLayout(
      players(4),
      "player-0",
      "mobile-portrait",
    );
    const landscape = createSeatLayout(
      players(4),
      "player-0",
      "mobile-landscape",
    );

    expect(portrait[1]?.position[0]).toBeGreaterThan(
      desktop[1]?.position[0] ?? 0,
    );
    expect(portrait[3]?.position[0]).toBeLessThan(desktop[3]?.position[0] ?? 0);
    expect(Math.abs(portrait[2]?.position[2] ?? 0)).toBeLessThan(
      Math.abs(desktop[2]?.position[2] ?? 0),
    );
    expect(Math.abs(landscape[2]?.position[2] ?? 0)).toBeLessThan(
      Math.abs(portrait[2]?.position[2] ?? 0),
    );
    expect(
      Math.abs(
        (portrait[0]?.position[2] ?? 0) - (portrait[2]?.position[2] ?? 0),
      ),
    ).toBeGreaterThan(8);
    expect(
      Math.abs(
        (landscape[0]?.position[2] ?? 0) - (landscape[2]?.position[2] ?? 0),
      ),
    ).toBeGreaterThan(8);
  });

  test.each([
    ["desktop", [0, 11, 8.5], 58],
    ["mobile-portrait", [0, 16.7, 15], 19],
    ["mobile-landscape", [0, 14.8, 12.2], 21],
  ] as const)(
    "uses stable %s camera framing",
    (mode, expectedPosition, expectedZoom) => {
      const camera = createCameraLayout(mode);
      expect(camera.position).toEqual(expectedPosition);
      expect(camera.zoom).toBe(expectedZoom);
      expect(camera.near).toBe(0.1);
      expect(camera.far).toBe(100);
      expect(Object.isFrozen(camera)).toBe(true);
    },
  );

  test("keeps mobile cameras wider than desktop and portrait wider than landscape", () => {
    const desktop = createCameraLayout("desktop");
    const portrait = createCameraLayout("mobile-portrait");
    const landscape = createCameraLayout("mobile-landscape");
    expect(portrait.zoom).toBeLessThan(desktop.zoom);
    expect(landscape.zoom).toBeLessThan(desktop.zoom);
    expect(portrait.zoom).toBeLessThan(landscape.zoom);
    expect(portrait.position[1]).toBeGreaterThan(desktop.position[1]);
    expect(landscape.position[1]).toBeGreaterThan(desktop.position[1]);
  });

  test("uses cards substantially larger than the first readability pass", () => {
    const previousArea = 0.92 * 1.3;
    expect(
      GAME_VIEW_TOKENS.card.width * GAME_VIEW_TOKENS.card.height,
    ).toBeGreaterThanOrEqual(previousArea * 1.5);
  });

  test("defines responsive viewport and geometry invariants", () => {
    expect(RESPONSIVE_VIEWPORTS.map(({ mode }) => mode)).toEqual([
      "desktop",
      "mobile-portrait",
      "mobile-landscape",
    ]);
    expect(
      RESPONSIVE_VIEWPORTS.every(
        ({ width, height }) => width > 0 && height > 0,
      ),
    ).toBe(true);
    expect(RESPONSIVE_LAYOUT_INVARIANTS.rootTestId).toBe("game-view");
    expect(RESPONSIVE_LAYOUT_INVARIANTS.scrollContainerSelector).toBe(
      RESPONSIVE_LAYOUT_INVARIANTS.resultsSelector,
    );
    expect(
      RESPONSIVE_LAYOUT_INVARIANTS.minimumHitTargetPx,
    ).toBeGreaterThanOrEqual(44);
    expect(new Set(RESPONSIVE_VIEWPORTS.map(({ mode }) => mode)).size).toBe(
      RESPONSIVE_VIEWPORTS.length,
    );
    expect(
      RESPONSIVE_VIEWPORTS.find(({ mode }) => mode === "mobile-portrait")
        ?.height,
    ).toBeGreaterThan(
      RESPONSIVE_VIEWPORTS.find(({ mode }) => mode === "mobile-portrait")
        ?.width ?? 0,
    );
    expect(
      RESPONSIVE_VIEWPORTS.find(({ mode }) => mode === "mobile-landscape")
        ?.width,
    ).toBeGreaterThan(
      RESPONSIVE_VIEWPORTS.find(({ mode }) => mode === "mobile-landscape")
        ?.height ?? 0,
    );
  });
});

test("defines one rank and one central suit label per card face", () => {
  expect(cardFaceLabels("Th")).toEqual(["10", "♥"]);
  expect(cardFaceLabels("Th").filter((label) => label === "♥")).toHaveLength(1);
  expect(GAME_VIEW_TOKENS.cardFace.rankFontPx).toBeGreaterThanOrEqual(140);
  expect(GAME_VIEW_TOKENS.cardFace.suitFontPx).toBeGreaterThanOrEqual(196);
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

    expect(
      screen.getAllByLabelText(/Front row, \d committed.*capacity 3/),
    ).toHaveLength(count);
    expect(
      screen.getAllByLabelText(/Middle row, \d committed.*capacity 5/),
    ).toHaveLength(count);
    expect(
      screen.getAllByLabelText(/Back row, \d committed.*capacity 5/),
    ).toHaveLength(count);
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

test("stages and confirms an initial five without moving committed cards", () => {
  const pending = ["As", "Kh", "Qd", "Jc", "Ts"] as CardCode[];
  const placements = [
    { card: pending[0]!, row: "front" as const },
    { card: pending[1]!, row: "front" as const },
    { card: pending[2]!, row: "middle" as const },
    { card: pending[3]!, row: "back" as const },
    { card: pending[4]!, row: "back" as const },
  ];
  const initialAction: OfcHandAction = {
    schemaVersion: 1,
    actionId: "initial-five",
    expectedRevision: 3,
    playerId: "player-0",
    type: "ofc.place-initial-cards",
    payload: { placements },
  };
  const state = visibleState(2);
  const onAction = vi.fn();
  render(
    <GameTableView
      model={model(2, {
        state: {
          ...state,
          players: state.players.map((player) =>
            player.id === "player-0"
              ? {
                  ...player,
                  board: { front: [], middle: [], back: [] },
                  placedCardCount: 0,
                }
              : player,
          ),
          privateData: { pendingCards: pending },
        },
        legalActions: [initialAction],
      })}
      onAction={onAction}
      webglSupported={false}
    />,
  );

  for (const placement of placements) {
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(cardLabel(placement.card), "i"),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `Place in ${placement.row[0]!.toUpperCase()}${placement.row.slice(1)}`,
      }),
    );
    expect(
      within(screen.getByRole("group", { name: "Cards to place" })).queryByRole(
        "button",
        { name: new RegExp(cardLabel(placement.card), "i") },
      ),
    ).not.toBeInTheDocument();
  }
  expect(onAction).not.toHaveBeenCalled();
  expect(screen.getAllByText(/Staged:/)).toHaveLength(3);
  const stagedAce = screen.getByRole("button", {
    name: new RegExp(cardLabel(pending[0]!), "i"),
  });
  fireEvent.click(stagedAce);
  expect(stagedAce).toHaveAttribute("aria-pressed", "true");
  const confirm = screen.getByRole("button", { name: "Confirm initial five" });
  expect(confirm.closest("header")).not.toBeNull();
  expect(confirm).toHaveClass("game-attention-action");
  fireEvent.click(confirm);
  expect(onAction).toHaveBeenCalledWith(initialAction);
});

test("removes the table footer while preserving accessible hand controls", () => {
  render(
    <GameTableView
      model={model(2)}
      onAction={() => undefined}
      webglSupported={false}
    />,
  );

  expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("group", { name: "Card controls" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Cards to place" })).toHaveClass(
    "game-accessible-hand",
  );
});

function cardLabel(card: CardCode): string {
  const labels: Record<CardCode, string> = {
    As: "ace of spades",
    Kh: "king of hearts",
    Qd: "queen of diamonds",
    Jc: "jack of clubs",
    Ts: "ten of spades",
  } as Record<CardCode, string>;
  return labels[card] ?? card;
}

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
  ).toHaveClass("game-accessible-board");
  expect(screen.getByRole("group", { name: "Cards to place" })).toHaveClass(
    "game-accessible-hand",
  );
});

test("contains table overlays inside the bounded game stage", () => {
  render(
    <GameTableView
      model={model(2)}
      onAction={() => undefined}
      webglSupported={false}
    />,
  );

  const root = screen.getByTestId(RESPONSIVE_LAYOUT_INVARIANTS.rootTestId);
  const stage = root.querySelector(".game-stage");
  expect(stage).not.toBeNull();
  expect(
    root.querySelector(RESPONSIVE_LAYOUT_INVARIANTS.headerSelector),
  ).not.toBeNull();
  expect(
    root.querySelector(RESPONSIVE_LAYOUT_INVARIANTS.headerSelector)
      ?.parentElement,
  ).toBe(root);
  expect(root.querySelector(".game-canvas-region")?.parentElement).toBe(stage);
  expect(
    root.querySelector(RESPONSIVE_LAYOUT_INVARIANTS.resultsSelector),
  ).not.toBeInTheDocument();
});

const RESPONSIVE_MODE_CASES: readonly [
  ResponsiveLayoutMode,
  readonly string[],
][] = [
  ["desktop", []],
  ["mobile-portrait", ["(max-width: 700px) and (orientation: portrait)"]],
  ["mobile-landscape", ["(max-height: 700px) and (orientation: landscape)"]],
  [
    "mobile-landscape",
    [
      "(max-width: 700px) and (orientation: portrait)",
      "(max-height: 700px) and (orientation: landscape)",
    ],
  ],
];

test.each(RESPONSIVE_MODE_CASES)(
  "selects %s responsive layout mode",
  (mode, matchingQueries) => {
    const matchMedia = mockMediaQueries(matchingQueries);
    try {
      render(
        <GameTableView
          model={model(2)}
          onAction={() => undefined}
          webglSupported={false}
        />,
      );
      expect(
        screen.getByTestId(RESPONSIVE_LAYOUT_INVARIANTS.rootTestId),
      ).toHaveAttribute("data-layout-mode", mode);
    } finally {
      matchMedia.mockRestore();
    }
  },
);

test("announces reconnect progress before placement resumes", () => {
  render(
    <GameTableView
      model={model(2, { connection: "reconnecting", isLocalTurn: false })}
      onAction={() => undefined}
      webglSupported={false}
    />,
  );
  expect(screen.getByText("Reconnecting to table")).toBeVisible();
});

test("offers reconnect and exit actions after a connection loss", () => {
  const onReconnect = vi.fn();
  const onLeave = vi.fn();
  render(
    <GameTableView
      model={model(2, {
        connection: "disconnected",
        isLocalTurn: false,
        error: "Connection lost.",
      })}
      onAction={() => undefined}
      onReconnect={onReconnect}
      onLeave={onLeave}
      webglSupported={false}
    />,
  );

  expect(
    screen.getByText("Your seat is reserved for a short time."),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
  fireEvent.click(screen.getByRole("button", { name: "Return home" }));
  expect(onReconnect).toHaveBeenCalledOnce();
  expect(onLeave).toHaveBeenCalledOnce();
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

test("announces disconnects and presents pairwise showdown details", () => {
  const state = visibleState(2);
  render(
    <GameTableView
      model={model(2, {
        phase: "complete",
        isLocalTurn: false,
        players: players(2).map((player) =>
          player.id === "player-1"
            ? { ...player, connection: "disconnected" }
            : player,
        ),
        state: {
          ...state,
          phase: "complete",
          privateData: { pendingCards: [] },
        },
        legalActions: [],
        showdown: resolvedTwoPlayerRound(),
        canStartNextHand: true,
      })}
      onAction={() => undefined}
      onStartNextHand={() => undefined}
      webglSupported={false}
    />,
  );

  expect(screen.getByText("Disconnected")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Showdown" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Ada vs Player 2" }),
  ).toBeVisible();
  expect(screen.getByText("Start next hand")).toBeVisible();
  expect(screen.getByText("Start next hand").closest("button")).toHaveClass(
    "game-attention-action",
  );
  expect(screen.getAllByText("Royalties").length).toBeGreaterThan(0);
  expect(
    screen.getByRole("heading", { name: "Showdown" }).closest("section")
      ?.parentElement,
  ).toHaveClass("game-stage");
  const root = screen.getByTestId(RESPONSIVE_LAYOUT_INVARIANTS.rootTestId);
  const stage = root.querySelector(".game-stage");
  const header = root.querySelector(
    RESPONSIVE_LAYOUT_INVARIANTS.headerSelector,
  );
  const results = root.querySelector(
    RESPONSIVE_LAYOUT_INVARIANTS.resultsSelector,
  );
  expect(header?.parentElement).toBe(root);
  expect(results?.parentElement).toBe(stage);
  expect(
    root.querySelector(RESPONSIVE_LAYOUT_INVARIANTS.scrollContainerSelector),
  ).toBe(results);
  expect(
    screen.getByRole("complementary", { name: "Scores" }).parentElement,
  ).toBe(stage);
  expect(
    screen.getByRole("region", { name: "Accessible game board" }).parentElement,
  ).toBe(stage);
});

test("announces AI thinking from runner state without consulting a clock", () => {
  render(
    <GameTableView
      model={model(2, {
        activePlayerId: "player-1",
        isLocalTurn: false,
        players: players(2).map((player) =>
          player.id === "player-1" ? { ...player, isThinking: true } : player,
        ),
        legalActions: [],
      })}
      onAction={() => undefined}
      webglSupported={false}
    />,
  );

  expect(screen.getByText("Player 2 is thinking…")).toBeVisible();
  expect(screen.getByText("Thinking…")).toBeVisible();
});

test.each([
  ["waiting room", { phase: "waiting", isLocalTurn: false, legalActions: [] }],
  ["active game", {}],
] as const)(
  "has no critical accessibility violations in the %s",
  async (_name, overrides) => {
    const { container } = render(
      <GameTableView
        model={model(2, overrides)}
        onAction={() => undefined}
        webglSupported={false}
      />,
    );

    await expectNoCriticalAccessibilityViolations(container);
  },
);

test("has no critical accessibility violations at showdown", async () => {
  const round = resolveOfcRound([
    {
      playerId: "player-0",
      board: {
        front: ["Qc", "Qd", "2c"],
        middle: ["2h", "3h", "4h", "5h", "6h"],
        back: ["Ts", "Js", "Qs", "Ks", "As"],
      },
      wasInFantasyland: false,
    },
    {
      playerId: "player-1",
      board: {
        front: ["Kc", "Kd", "3c"],
        middle: ["4c", "5c", "6c", "7c", "8c"],
        back: ["Th", "Jh", "Qh", "Kh", "Ah"],
      },
      wasInFantasyland: false,
    },
  ]);
  const state = visibleState(2);
  const { container } = render(
    <GameTableView
      model={model(2, {
        phase: "complete",
        isLocalTurn: false,
        state: {
          ...state,
          phase: "complete",
          privateData: { pendingCards: [] },
        },
        legalActions: [],
        showdown: round,
        canStartNextHand: true,
      })}
      onAction={() => undefined}
      onStartNextHand={() => undefined}
      webglSupported={false}
    />,
  );

  await expectNoCriticalAccessibilityViolations(container);
});
