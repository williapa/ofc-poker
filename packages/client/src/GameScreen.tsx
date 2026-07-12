import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAiConfiguration,
  createAiPlayer,
  createSeededRandom,
} from "@ofcpoker/ai-player";
import {
  createStandardDeck,
  serializeCard,
  shuffleDeck,
} from "@ofcpoker/game-engine";
import type {
  GameView,
  GameViewModel,
  ViewActionListener,
} from "./contracts/game-view";
import type {
  GameRunner,
  OfcLobbyConnection,
  RunnerAiSeat,
} from "./contracts/game-runner";
import { createOfcGameRunner } from "./game-runner";
import { GameTableView } from "./game-view";

export interface GameScreenProps {
  readonly connection: OfcLobbyConnection;
  readonly onLeave: () => void;
  readonly inviteUrl?: string;
}

function seedFor(value: string): number {
  let seed = 2166136261;
  for (const character of value) {
    seed ^= character.codePointAt(0) ?? 0;
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function aiSeatsFor(connection: OfcLobbyConnection): readonly RunnerAiSeat[] {
  if (connection.lobby.settings.mode !== "local-ai") return [];
  return Array.from(
    { length: connection.lobby.settings.seatCount - 1 },
    (_, index) => {
      const id = `ai-${connection.lobby.id}-${index + 1}`;
      return {
        player: createAiPlayer({
          id,
          dependencies: { random: createSeededRandom(seedFor(id)) },
        }),
        displayName: `Bot ${index + 1}`,
        configuration: createAiConfiguration("medium"),
      };
    },
  );
}

export function GameScreen({
  connection,
  onLeave,
  inviteUrl,
}: GameScreenProps) {
  const [model, setModel] = useState<Readonly<GameViewModel>>();
  const [runner, setRunner] = useState<GameRunner>();
  const [startError, setStartError] = useState<string>();
  const listenerRef = useRef<ViewActionListener>();
  const bridge = useMemo(() => {
    const view: GameView = {
      render: setModel,
      onAction(nextListener) {
        listenerRef.current = nextListener;
        return () => {
          if (listenerRef.current === nextListener)
            listenerRef.current = undefined;
        };
      },
      dispose() {
        listenerRef.current = undefined;
      },
    };
    return {
      view,
      emit: (action: Parameters<ViewActionListener>[0]) =>
        listenerRef.current?.(action),
    };
  }, []);

  useEffect(() => {
    let active = true;
    const gameRunner = createOfcGameRunner({
      connection,
      view: bridge.view,
      aiSeats: aiSeatsFor(connection),
      deckForHand: () =>
        shuffleDeck(Math.random, createStandardDeck()).map(serializeCard),
    });
    void gameRunner.start().then(
      () => {
        if (active) setRunner(gameRunner);
      },
      (error: unknown) => {
        if (active)
          setStartError(
            error instanceof Error ? error.message : "The game could not start",
          );
      },
    );
    return () => {
      active = false;
      void gameRunner.dispose();
    };
  }, [bridge, connection]);

  if (!model) {
    return (
      <main className="centered-shell">
        <p role={startError ? "alert" : "status"}>
          {startError ?? "Taking your seat…"}
        </p>
      </main>
    );
  }

  return (
    <GameTableView
      model={model}
      onAction={bridge.emit}
      onStartNextHand={() => void runner?.startNextHand()}
      onLeave={onLeave}
      {...(inviteUrl ? { inviteUrl } : {})}
    />
  );
}
