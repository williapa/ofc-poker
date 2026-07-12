import {
  Component,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  parseCard,
  type CardCode,
  type OfcBoard,
  type OfcHandAction,
  type PlaceInitialCardsAction,
  type PlacementRow,
} from "@ofcpoker/game-engine";
import type { GameViewModel } from "../contracts/game-view";
import { GAME_VIEW_TOKENS, ROW_DEFINITIONS } from "./design-system";
import { GameTableScene, type SceneSeat } from "./GameTableScene";
import { createCameraLayout, createSeatLayout } from "./layout";
import { useMediaQuery } from "./use-media-query";
import { supportsWebGL } from "./webgl";

const EMPTY_BOARD: OfcBoard = Object.freeze({
  front: Object.freeze([]),
  middle: Object.freeze([]),
  back: Object.freeze([]),
});

const SUIT_NAME = Object.freeze({
  c: "clubs",
  d: "diamonds",
  h: "hearts",
  s: "spades",
});
const RANK_NAME = Object.freeze({
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  T: "ten",
  J: "jack",
  Q: "queen",
  K: "king",
  A: "ace",
});

export interface GameTableViewProps {
  readonly model: Readonly<GameViewModel>;
  readonly onAction: (action: OfcHandAction) => void;
  readonly onStartNextHand?: () => void;
  readonly onLeave?: () => void;
  /** Deterministic override for tests and known constrained embeds. */
  readonly webglSupported?: boolean;
}

interface WebGLErrorBoundaryProps {
  readonly children: ReactNode;
}

interface WebGLErrorBoundaryState {
  readonly failed: boolean;
}

class WebGLErrorBoundary extends Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  override state: WebGLErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): WebGLErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Preserve a useful diagnostic without replacing the accessible fallback.
    console.error("3D game view failed", error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? <WebGLFallback /> : this.props.children;
  }
}

function WebGLFallback() {
  return (
    <div className="game-webgl-fallback" role="status">
      <strong>3D table unavailable</strong>
      <span>
        Your browser could not start WebGL. Game status, cards, and controls
        remain available below.
      </span>
    </div>
  );
}

function cardName(code: CardCode): string {
  const card = parseCard(code);
  return `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}`;
}

function phaseStatus(model: Readonly<GameViewModel>): string {
  if (model.error) return model.error;
  if (model.connection === "reconnecting") return "Reconnecting to table";
  if (model.phase === "waiting") return "Waiting for players";
  if (model.phase === "complete") return "Hand complete";
  if (model.phase === "closed") return "Table closed";
  return model.isLocalTurn ? "Your turn" : "Waiting for another player";
}

function actionAllowsAssignments(
  action: OfcHandAction,
  assignments: Readonly<Partial<Record<CardCode, PlacementRow>>>,
): boolean {
  if (action.type !== "ofc.place-initial-cards") return false;
  const initialAction = action as PlaceInitialCardsAction;
  return Object.entries(assignments).every(([card, row]) =>
    initialAction.payload.placements.some(
      (placement) => placement.card === card && placement.row === row,
    ),
  );
}

function legalRowsForCard(
  legalActions: readonly OfcHandAction[],
  assignments: Readonly<Partial<Record<CardCode, PlacementRow>>>,
  card: CardCode | undefined,
): readonly PlacementRow[] {
  if (card === undefined) return [];
  const constraints = { ...assignments };
  delete constraints[card];
  const rows = new Set<PlacementRow>();
  for (const action of legalActions) {
    if (
      action.type === "ofc.place-card" &&
      action.payload.placement.card === card
    ) {
      rows.add(action.payload.placement.row);
    } else if (
      actionAllowsAssignments(action, constraints) &&
      (action as PlaceInitialCardsAction).payload.placements.some(
        (placement) => placement.card === card,
      )
    ) {
      for (const placement of (action as PlaceInitialCardsAction).payload
        .placements) {
        if (placement.card === card) rows.add(placement.row);
      }
    }
  }
  return ROW_DEFINITIONS.map(({ row }) => row).filter((row) => rows.has(row));
}

function boardForPlayer(
  model: Readonly<GameViewModel>,
  playerId: string,
): OfcBoard {
  return (
    model.state?.players.find(({ id }) => id === playerId)?.board ?? EMPTY_BOARD
  );
}

interface ViewSeatPlayer {
  readonly id: string;
  readonly seat: number;
  readonly displayName: string;
}

function createViewSeatPlayers(
  model: Readonly<GameViewModel>,
): readonly ViewSeatPlayer[] {
  return Array.from({ length: model.lobby.settings.seatCount }, (_, seat) => {
    const player = model.players.find((candidate) => candidate.seat === seat);
    return (
      player ?? { id: `open-seat-${seat}`, seat, displayName: "Open seat" }
    );
  });
}

function createSceneSeats(
  model: Readonly<GameViewModel>,
  viewPlayers: readonly ViewSeatPlayer[],
): readonly SceneSeat[] {
  const layouts = createSeatLayout(viewPlayers, model.viewerId);
  return layouts.map((layout) => ({
    id: layout.playerId,
    layout,
    board: boardForPlayer(model, layout.playerId),
    faceDown:
      model.phase === "placing" &&
      layout.playerId !== model.viewerId &&
      (model.players.find(({ id }) => id === layout.playerId)?.inFantasyland ??
        false),
  }));
}

export function GameTableView({
  model,
  onAction,
  onStartNextHand,
  onLeave,
  webglSupported,
}: GameTableViewProps) {
  const compact = useMediaQuery("(max-width: 700px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const pendingCards = model.state?.privateData.pendingCards ?? [];
  const pendingKey = pendingCards.join(",");
  const interactionKey = `${model.state?.revision ?? "waiting"}:${pendingKey}`;
  const [interaction, setInteraction] = useState<{
    readonly key: string;
    readonly selectedCard?: CardCode;
    readonly assignments: Partial<Record<CardCode, PlacementRow>>;
  }>({ key: interactionKey, assignments: {} });
  const selectedCard =
    interaction.key === interactionKey ? interaction.selectedCard : undefined;
  const assignments =
    interaction.key === interactionKey ? interaction.assignments : {};

  const viewPlayers = useMemo(() => createViewSeatPlayers(model), [model]);
  const seats = useMemo(
    () => createSceneSeats(model, viewPlayers),
    [model, viewPlayers],
  );
  const validRows = legalRowsForCard(
    model.isLocalTurn ? model.legalActions : [],
    assignments,
    selectedCard,
  );
  const camera = createCameraLayout(compact);
  const canRenderWebGL = webglSupported ?? supportsWebGL();

  function selectCard(card: CardCode) {
    if (!model.isLocalTurn) return;
    setInteraction((current) => {
      const currentCard =
        current.key === interactionKey ? current.selectedCard : undefined;
      const nextCard = currentCard === card ? undefined : card;
      return {
        key: interactionKey,
        assignments: current.key === interactionKey ? current.assignments : {},
        ...(nextCard === undefined ? {} : { selectedCard: nextCard }),
      };
    });
  }

  function selectRow(row: PlacementRow) {
    if (selectedCard === undefined || !validRows.includes(row)) return;
    const singleAction = model.legalActions.find(
      (action) =>
        action.type === "ofc.place-card" &&
        action.payload.placement.card === selectedCard &&
        action.payload.placement.row === row,
    );
    if (singleAction !== undefined) {
      onAction(singleAction);
      setInteraction({ key: interactionKey, assignments: {} });
      return;
    }

    const nextAssignments = { ...assignments, [selectedCard]: row };
    setInteraction({ key: interactionKey, assignments: nextAssignments });
    if (Object.keys(nextAssignments).length === pendingCards.length) {
      const initialAction = model.legalActions.find(
        (action) =>
          action.type === "ofc.place-initial-cards" &&
          actionAllowsAssignments(action, nextAssignments) &&
          (action as PlaceInitialCardsAction).payload.placements.length ===
            pendingCards.length,
      );
      if (initialAction !== undefined) onAction(initialAction);
    }
  }

  return (
    <main
      className="game-view"
      style={
        {
          "--game-motion-duration": `${
            reducedMotion
              ? GAME_VIEW_TOKENS.motion.reducedDurationMs
              : GAME_VIEW_TOKENS.motion.durationMs
          }ms`,
        } as React.CSSProperties
      }
    >
      <header className="game-hud game-hud-top">
        <div>
          <p className="step">Hand {model.handNumber}</p>
          <h1>Open Face Chinese Poker</h1>
        </div>
        <p className="game-status" role="status" aria-live="polite">
          {phaseStatus(model)}
        </p>
        {onLeave ? (
          <button className="game-text-button" type="button" onClick={onLeave}>
            Leave table
          </button>
        ) : null}
      </header>

      <section className="game-canvas-region" aria-label="3D card table">
        {canRenderWebGL ? (
          <WebGLErrorBoundary>
            <Canvas
              orthographic
              shadows
              dpr={[1, 1.5]}
              camera={{
                position: [...camera.position],
                zoom: camera.zoom,
                near: camera.near,
                far: camera.far,
              }}
              fallback={<WebGLFallback />}
              gl={{ antialias: true, powerPreference: "high-performance" }}
            >
              <GameTableScene
                seats={seats}
                pendingCards={pendingCards}
                selectedCard={selectedCard}
                validRows={validRows}
                reducedMotion={reducedMotion}
                onSelectCard={selectCard}
                onSelectRow={selectRow}
              />
            </Canvas>
          </WebGLErrorBoundary>
        ) : (
          <WebGLFallback />
        )}
      </section>

      <aside className="game-scoreboard" aria-label="Scores">
        <ol>
          {model.players.map((player) => (
            <li key={player.id} data-local={player.id === model.viewerId}>
              <span>
                {player.displayName}
                {player.id === model.viewerId ? " (you)" : ""}
                {player.isAi ? " · AI" : ""}
              </span>
              <strong>{player.score} points</strong>
              {player.connection === "disconnected" ? (
                <small>Disconnected</small>
              ) : null}
              {player.inFantasyland ? <small>Fantasyland</small> : null}
            </li>
          ))}
        </ol>
      </aside>

      <section className="game-dom-board" aria-label="Accessible game board">
        {viewPlayers.map((player) => {
          const board = boardForPlayer(model, player.id);
          const faceDown =
            model.phase === "placing" &&
            player.id !== model.viewerId &&
            (model.players.find(({ id }) => id === player.id)?.inFantasyland ??
              false);
          return (
            <section key={player.id} aria-labelledby={`player-${player.seat}`}>
              <h2 id={`player-${player.seat}`}>{player.displayName}</h2>
              <div className="game-row-list">
                {ROW_DEFINITIONS.map(({ row, label, capacity }) => {
                  const cards = board[row];
                  const isValid = validRows.includes(row);
                  return (
                    <div
                      className="game-dom-row"
                      key={row}
                      aria-label={`${label} row, ${cards.length} of ${capacity} cards`}
                    >
                      <span>
                        <strong>{label}</strong> {cards.length}/{capacity}
                      </span>
                      <span className="game-card-names">
                        {cards.length > 0
                          ? faceDown
                            ? `${cards.length} face-down card${cards.length === 1 ? "" : "s"}`
                            : cards.map(cardName).join(", ")
                          : "Empty"}
                      </span>
                      {player.id === model.viewerId && selectedCard ? (
                        <button
                          type="button"
                          disabled={!isValid}
                          onClick={() => selectRow(row)}
                        >
                          {isValid
                            ? `Place in ${label}`
                            : `${label} unavailable`}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>

      <footer className="game-controls" aria-label="Card controls">
        <div className="pending-cards" role="group" aria-label="Cards to place">
          {pendingCards.length === 0 ? (
            <p>No cards waiting to be placed.</p>
          ) : (
            pendingCards.map((card) => {
              const assignedRow = assignments[card];
              return (
                <button
                  key={card}
                  type="button"
                  aria-pressed={selectedCard === card}
                  disabled={!model.isLocalTurn}
                  onClick={() => selectCard(card)}
                >
                  <span aria-hidden="true">{card.toUpperCase()}</span>
                  <span>{cardName(card)}</span>
                  {selectedCard === card ? <small>Selected</small> : null}
                  {assignedRow ? (
                    <small>Assigned to {assignedRow}</small>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        {model.error ? (
          <p className="game-error" role="alert">
            {model.error}
          </p>
        ) : null}
        {model.canStartNextHand && onStartNextHand ? (
          <button
            className="primary-button"
            type="button"
            onClick={onStartNextHand}
          >
            Start next hand <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </footer>
    </main>
  );
}
