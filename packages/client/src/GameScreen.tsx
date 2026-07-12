import { useEffect, useMemo, useRef, useState } from "react";
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
import type { GameRunner, OfcLobbyConnection } from "./contracts/game-runner";
import { createOfcGameRunner } from "./game-runner";
import { GameTableView } from "./game-view";
import { createLocalAiSeats } from "./local-ai";

export interface GameScreenProps {
  readonly connection: OfcLobbyConnection;
  readonly onLeave: () => void;
  readonly onReconnect?: () => void;
  readonly inviteUrl?: string;
}

function aiSeatsFor(connection: OfcLobbyConnection) {
  if (connection.lobby.settings.mode !== "local-ai") return [];
  return createLocalAiSeats({
    lobbyId: connection.lobby.id,
    seatCount: connection.lobby.settings.seatCount,
  });
}

export function GameScreen({
  connection,
  onLeave,
  onReconnect,
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
      disposeMode:
        connection.lobby.settings.mode === "multiplayer"
          ? "disconnect"
          : "leave",
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
        <section className="join-card">
          <p role={startError ? "alert" : "status"}>
            {startError ?? "Taking your seat…"}
          </p>
          {startError ? (
            <button className="primary-button" type="button" onClick={onLeave}>
              Return home
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <GameTableView
      model={model}
      onAction={bridge.emit}
      onStartNextHand={() => void runner?.startNextHand()}
      onLeave={() => {
        void (async () => {
          try {
            await runner?.dispose();
            await connection.leave();
          } finally {
            onLeave();
          }
        })();
      }}
      {...(onReconnect ? { onReconnect } : {})}
      {...(inviteUrl ? { inviteUrl } : {})}
    />
  );
}
