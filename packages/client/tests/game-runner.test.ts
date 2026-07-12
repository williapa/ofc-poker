import { LocalDataProvider, type LobbySettings } from "@ofcpoker/data-provider";
import { createAiConfiguration, type AiPlayer } from "@ofcpoker/ai-player";
import {
  createStandardDeck,
  serializeCard,
  type CardCode,
  type OfcHandAction,
  type OfcHandEvent,
  type OfcPlayerVisibleState,
} from "@ofcpoker/game-engine";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  GameView,
  GameViewModel,
  ViewActionListener,
} from "../src/contracts/game-view";
import type {
  GameRunner,
  OfcLobbyConnection,
  OfcRunnerSnapshot,
} from "../src/contracts/game-runner";
import {
  createGameRunnerLifecycle,
  createOfcGameRunner,
} from "../src/game-runner";

const settings: LobbySettings = {
  schemaVersion: 1,
  seatCount: 2,
  mode: "multiplayer",
  rules: { variant: "standard-ofc", fantasyland: true, tiedRowPoints: 0 },
};

const localSettings: LobbySettings = {
  ...settings,
  mode: "local-ai",
};

class FakeView implements GameView {
  public readonly models: GameViewModel[] = [];
  public disposed = false;
  #listener: ViewActionListener | undefined;

  public get latest(): GameViewModel {
    const model = this.models.at(-1);
    if (!model) throw new Error("View has not rendered");
    return model;
  }

  public render(model: Readonly<GameViewModel>): void {
    this.models.push(model);
  }

  public onAction(listener: ViewActionListener): () => void {
    this.#listener = listener;
    return () => {
      if (this.#listener === listener) this.#listener = undefined;
    };
  }

  public emit(action: OfcHandAction): void {
    this.#listener?.(action);
  }

  public dispose(): void {
    this.disposed = true;
    this.#listener = undefined;
  }
}

type Provider = LocalDataProvider<
  OfcHandAction,
  OfcRunnerSnapshot,
  OfcHandEvent
>;

const providers: Provider[] = [];

afterEach(async () => {
  for (const provider of providers.splice(0)) await provider.dispose();
});

function provider(): Provider {
  let sequence = 0;
  const result = new LocalDataProvider<
    OfcHandAction,
    OfcRunnerSnapshot,
    OfcHandEvent
  >({ idFactory: (kind) => `${kind}-${++sequence}` });
  providers.push(result);
  return result;
}

function withDuplicateAndDelayedUpdates(
  connection: OfcLobbyConnection,
): OfcLobbyConnection {
  return {
    get lobby() {
      return connection.lobby;
    },
    get participant() {
      return connection.participant;
    },
    get role() {
      return connection.role;
    },
    get reconnectToken() {
      return connection.reconnectToken;
    },
    submitAction: (request) => connection.submitAction(request),
    publishActionResult: (result) => connection.publishActionResult(result),
    publishAuthoritative: (update) => connection.publishAuthoritative(update),
    activateLobby: () => connection.activateLobby(),
    subscribe(listener) {
      let delayed:
        | Parameters<Parameters<OfcLobbyConnection["subscribe"]>[0]>[0]
        | undefined;
      return connection.subscribe((message) => {
        listener(message);
        if (message.type !== "authoritative-update") return;
        if (delayed) listener(delayed);
        listener(message);
        delayed = message;
      });
    },
    disconnect: () => connection.disconnect(),
    leave: () => connection.leave(),
    dispose: () => connection.dispose(),
  };
}

const aliceBoard = {
  front: "Qc Qd 2c",
  middle: "2h 3h 4h 5h 6h",
  back: "Ts Js Qs Ks As",
} as const;
const bobBoard = {
  front: "Kc Kd 3c",
  middle: "4c 5c 6c 7c 8c",
  back: "Th Jh Qh Kh Ah",
} as const;

function cards(value: string): CardCode[] {
  return value.split(" ") as CardCode[];
}

function targetRows(board: typeof aliceBoard | typeof bobBoard) {
  return new Map<CardCode, "front" | "middle" | "back">([
    ...cards(board.front).map((card) => [card, "front"] as const),
    ...cards(board.middle).map((card) => [card, "middle"] as const),
    ...cards(board.back).map((card) => [card, "back"] as const),
  ]);
}

const targetByName = new Map([
  ["Alice", targetRows(aliceBoard)],
  ["Bob", targetRows(bobBoard)],
]);

function qualifyingDeck(): readonly CardCode[] {
  const alice = [
    ...cards(aliceBoard.front),
    ...cards(aliceBoard.middle),
    ...cards(aliceBoard.back),
  ];
  const bob = [
    ...cards(bobBoard.front),
    ...cards(bobBoard.middle),
    ...cards(bobBoard.back),
  ];
  // Dealer seat zero means Bob is dealt before Alice in every round.
  const dealt = bob.flatMap((card, index) => [card, alice[index] as CardCode]);
  const used = new Set(dealt);
  const remainder = createStandardDeck()
    .map(serializeCard)
    .filter((card) => !used.has(card));
  return [...dealt, ...remainder];
}

function desiredAction(model: GameViewModel): OfcHandAction {
  const name = model.players.find(
    ({ id }) => id === model.viewerId,
  )?.displayName;
  const rows = name ? targetByName.get(name) : undefined;
  if (!rows) throw new Error("Missing target board");
  const action = model.legalActions.find((candidate) => {
    const placements =
      candidate.type === "ofc.place-initial-cards"
        ? candidate.payload.placements
        : [candidate.payload.placement];
    return placements.every(({ card, row }) => rows.get(card) === row);
  });
  if (!action) throw new Error("No desired legal action");
  return action;
}

async function waitForRevision(
  view: FakeView,
  revision: number,
): Promise<void> {
  await vi.waitFor(() => expect(view.latest.state?.revision).toBe(revision));
}

describe("OFC game runner", () => {
  test("creates one runner per active lobby and disposes it on switch", async () => {
    const lifecycle = createGameRunnerLifecycle();
    const runner = (): GameRunner => ({
      start: vi.fn(async () => undefined),
      startNextHand: vi.fn(async () => false),
      dispose: vi.fn(async () => undefined),
    });
    const first = runner();
    const second = runner();
    const createFirst = vi.fn(() => first);

    const [firstResult, duplicateResult] = await Promise.all([
      lifecycle.activate("one", createFirst),
      lifecycle.activate("one", createFirst),
    ]);
    expect(firstResult).toBe(first);
    expect(duplicateResult).toBe(first);
    expect(createFirst).toHaveBeenCalledTimes(1);
    expect(first.start).toHaveBeenCalledTimes(1);

    await expect(lifecycle.activate("two", () => second)).resolves.toBe(second);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.start).toHaveBeenCalledTimes(1);
    await lifecycle.dispose();
    await lifecycle.dispose();
    expect(second.dispose).toHaveBeenCalledTimes(1);
  });

  test("waits for configured occupancy and lets only the host establish authority", async () => {
    const transport = provider();
    const hostConnection = (await transport.createLobby(settings, {
      displayName: "Alice",
    })) as OfcLobbyConnection;
    const hostView = new FakeView();
    const hostDeck = vi.fn(qualifyingDeck);
    const hostRunner = createOfcGameRunner({
      connection: hostConnection,
      view: hostView,
      deckForHand: hostDeck,
    });
    await hostRunner.start();
    await hostRunner.start();

    expect(hostView.latest.phase).toBe("waiting");
    expect(hostDeck).not.toHaveBeenCalled();

    const peerConnection = (await transport.joinLobby(hostConnection.lobby.id, {
      displayName: "Bob",
    })) as OfcLobbyConnection;
    const peerView = new FakeView();
    const peerDeck = vi.fn(() => {
      throw new Error("A peer must never deal");
    });
    const peerRunner = createOfcGameRunner({
      connection: peerConnection,
      view: peerView,
      deckForHand: peerDeck,
    });
    await peerRunner.start();

    await vi.waitFor(() => expect(hostView.latest.phase).toBe("placing"));
    await vi.waitFor(() => expect(peerView.latest.phase).toBe("placing"));
    expect(hostDeck).toHaveBeenCalledTimes(1);
    expect(peerDeck).not.toHaveBeenCalled();
    expect(hostConnection.lobby.status).toBe("active");

    await peerRunner.dispose();
    await hostRunner.dispose();
    await hostRunner.dispose();
  });

  test("runs a complete host-authoritative match and preserves totals, dealer, and Fantasyland", async () => {
    const transport = provider();
    const hostConnection = (await transport.createLobby(settings, {
      displayName: "Alice",
    })) as OfcLobbyConnection;
    const hostView = new FakeView();
    const hostRunner = createOfcGameRunner({
      connection: hostConnection,
      view: hostView,
      deckForHand: qualifyingDeck,
      initialDealerSeat: 0,
    });
    await hostRunner.start();
    const peerConnection = (await transport.joinLobby(hostConnection.lobby.id, {
      displayName: "Bob",
    })) as OfcLobbyConnection;
    const peerView = new FakeView();
    const peerRunner = createOfcGameRunner({
      connection: withDuplicateAndDelayedUpdates(peerConnection),
      view: peerView,
      deckForHand: () => {
        throw new Error("peer dealt cards");
      },
    });
    await peerRunner.start();
    await vi.waitFor(() => expect(peerView.latest.state?.revision).toBe(0));

    const views = new Map([
      [hostConnection.participant.id, hostView],
      [peerConnection.participant.id, peerView],
    ]);
    for (let revision = 0; revision < 18; revision += 1) {
      const reference = hostView.latest;
      const active = reference.activePlayerId;
      if (!active) throw new Error("Expected active player");
      const activeView = views.get(active);
      if (!activeView) throw new Error("Missing active view");
      activeView.emit(desiredAction(activeView.latest));
      await waitForRevision(hostView, revision + 1);
      await waitForRevision(peerView, revision + 1);
    }

    expect(hostView.latest.phase).toBe("complete");
    expect(peerView.latest.phase).toBe("complete");
    expect(hostView.latest.handNumber).toBe(1);
    expect(hostView.latest.canStartNextHand).toBe(true);
    expect(peerView.latest.canStartNextHand).toBe(false);
    expect(
      hostView.latest.players.map(({ inFantasyland }) => inFantasyland),
    ).toEqual([true, true]);
    const totals = hostView.latest.players.map(({ score }) => score);
    expect(totals.reduce((sum, score) => sum + score, 0)).toBe(0);

    await expect(hostRunner.startNextHand()).resolves.toBe(true);
    await vi.waitFor(() => expect(peerView.latest.handNumber).toBe(2));
    expect(peerView.latest.phase).toBe("placing");
    expect(peerView.latest.dealerSeat).toBe(1);
    expect(peerView.latest.players.map(({ score }) => score)).toEqual(totals);
    expect(
      peerView.latest.players.map(({ inFantasyland }) => inFantasyland),
    ).toEqual([true, true]);
    expect(hostView.latest.state?.privateData.pendingCards).toHaveLength(13);
    expect(hostView.latest.legalActions.length).toBeGreaterThan(0);

    hostView.emit(hostView.latest.legalActions[0] as OfcHandAction);
    await waitForRevision(peerView, 1);
    const hiddenHost = peerView.latest.state?.players.find(
      ({ id }) => id === hostConnection.participant.id,
    );
    expect(hiddenHost?.placedCardCount).toBe(13);
    expect(hiddenHost?.board).toEqual({ front: [], middle: [], back: [] });

    peerView.emit(peerView.latest.legalActions[0] as OfcHandAction);
    await waitForRevision(hostView, 2);
    expect(hostView.latest.phase).toBe("complete");
    expect(hostView.latest.showdown?.pairs).toHaveLength(1);
    expect(hostView.latest.showdown?.players[0]?.board.front).toHaveLength(3);

    await peerRunner.dispose();
    await hostRunner.dispose();
  });

  test("deduplicates submissions and restores one snapshot after a reconnect remount", async () => {
    const transport = provider();
    const hostConnection = (await transport.createLobby(settings, {
      displayName: "Alice",
    })) as OfcLobbyConnection;
    const hostView = new FakeView();
    const hostRunner = createOfcGameRunner({
      connection: hostConnection,
      view: hostView,
      deckForHand: qualifyingDeck,
    });
    await hostRunner.start();
    const peerConnection = (await transport.joinLobby(hostConnection.lobby.id, {
      displayName: "Bob",
    })) as OfcLobbyConnection;
    const reconnectToken = peerConnection.reconnectToken;
    const peerView = new FakeView();
    const peerRunner = createOfcGameRunner({
      connection: peerConnection,
      view: peerView,
      deckForHand: qualifyingDeck,
      disposeMode: "disconnect",
    });
    await peerRunner.start();
    await vi.waitFor(() =>
      expect(peerView.latest.legalActions.length).toBeGreaterThan(0),
    );

    const action = desiredAction(peerView.latest);
    const spoofed = { ...action, playerId: hostConnection.participant.id };
    peerView.emit(spoofed);
    peerView.emit(spoofed);
    await waitForRevision(hostView, 1);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(hostView.latest.state?.revision).toBe(1);

    await peerRunner.dispose();
    expect(peerView.disposed).toBe(true);
    const remountedConnection = (await transport.reconnectLobby(
      hostConnection.lobby.id,
      reconnectToken,
    )) as OfcLobbyConnection;
    const remountedView = new FakeView();
    const remountedRunner = createOfcGameRunner({
      connection: remountedConnection,
      view: remountedView,
      deckForHand: () => {
        throw new Error("peer dealt on reconnect");
      },
    });
    await remountedRunner.start();
    await waitForRevision(remountedView, 1);
    expect(remountedView.latest.connection).toBe("connected");
    expect(
      remountedView.models.filter(({ state }) => state?.revision === 1),
    ).toHaveLength(1);

    await remountedRunner.dispose();
    await hostRunner.dispose();
  });

  test("routes AI decisions through host validation and cancels pending AI work on cleanup", async () => {
    const transport = provider();
    const connection = (await transport.createLobby(localSettings, {
      displayName: "Alice",
    })) as OfcLobbyConnection;
    const view = new FakeView();
    let releaseSecondDecision: (() => void) | undefined;
    const decide = vi.fn<
      AiPlayer<OfcHandAction, OfcPlayerVisibleState>["decide"]
    >(async ({ legalActions }) => {
      if (decide.mock.calls.length > 1) {
        await new Promise<void>((resolve) => {
          releaseSecondDecision = resolve;
        });
      }
      return { action: legalActions[0] as OfcHandAction };
    });
    const runner = createOfcGameRunner({
      connection,
      view,
      deckForHand: qualifyingDeck,
      aiSeats: [
        {
          player: { id: "ai-one", decide },
          displayName: "Bot",
          configuration: createAiConfiguration("easy"),
        },
      ],
    });
    await runner.start();

    // AI sits left of the human dealer and therefore acts through authority first.
    await waitForRevision(view, 1);
    expect(decide).toHaveBeenCalledTimes(1);
    expect(view.latest.activePlayerId).toBe(connection.participant.id);
    view.emit(view.latest.legalActions[0] as OfcHandAction);
    await vi.waitFor(() => expect(decide).toHaveBeenCalledTimes(2));

    const revisionAtDispose = view.latest.state?.revision;
    const renderCountAtDispose = view.models.length;
    await runner.dispose();
    releaseSecondDecision?.();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(view.disposed).toBe(true);
    expect(view.models).toHaveLength(renderCountAtDispose);
    expect(view.latest.state?.revision).toBe(revisionAtDispose);
  });
});
