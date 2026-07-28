import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CardCode, OfcBoard } from "@ofcpoker/game-engine";
import { Brand } from "../Brand";
import { TutorialBoard } from "./TutorialBoard";
import {
  TUTORIAL_DRAW_CARDS,
  TUTORIAL_FANTASYLAND,
  TUTORIAL_INITIAL_CARDS,
  TUTORIAL_INITIAL_PLACEMENT,
  TUTORIAL_MIDWAY_BOARD,
  TUTORIAL_OPPONENT_BOARD,
  TUTORIAL_OPPONENT_EVALUATION,
  TUTORIAL_PAIR_SCORE,
  TUTORIAL_PLAYER_BOARD,
  TUTORIAL_PLAYER_EVALUATION,
  type TutorialBoardSnapshot,
  type TutorialRow,
} from "./tutorial-example";

const EMPTY_BOARD: TutorialBoardSnapshot = Object.freeze({
  front: Object.freeze([]),
  middle: Object.freeze([]),
  back: Object.freeze([]),
});

interface TutorialStep {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: ReactNode;
  readonly board: TutorialBoardSnapshot;
  readonly pendingCards?: readonly CardCode[];
  readonly pendingLabel?: string;
  readonly highlightedRows?: readonly TutorialRow[];
  readonly callout?: ReactNode;
  readonly opponentBoard?: OfcBoard;
  readonly visual?: "royalties" | "complete";
}

const STEPS: readonly TutorialStep[] = [
  {
    id: "three-hands",
    eyebrow: "The objective",
    title: "Build three poker hands.",
    body: (
      <p>
        Place thirteen cards into a three-card front, five-card middle, and
        five-card back. The back must be strongest and the front weakest.
      </p>
    ),
    board: EMPTY_BOARD,
    highlightedRows: ["front", "middle", "back"],
  },
  {
    id: "first-five",
    eyebrow: "The initial deal",
    title: "Start with five cards.",
    body: (
      <p>
        All five arrive together. You can spread them across any non-full rows
        before you confirm the placement.
      </p>
    ),
    board: EMPTY_BOARD,
    pendingCards: TUTORIAL_INITIAL_CARDS,
  },
  {
    id: "confirm",
    eyebrow: "Commit the choice",
    title: "Place them, then lock them in.",
    body: (
      <p>
        We keep the queens together in front, start aces in the middle, and
        leave room for a straight in back. Confirmed cards cannot move.
      </p>
    ),
    board: TUTORIAL_INITIAL_PLACEMENT,
    highlightedRows: ["front", "middle", "back"],
    callout: (
      <p className="tutorial-lock-note">
        <span aria-hidden="true">◆</span> Five cards committed
      </p>
    ),
  },
  {
    id: "single-cards",
    eyebrow: "The remaining deal",
    title: "Place eight more, one at a time.",
    body: (
      <p>
        Each new card must immediately enter a row. Four draws have built two
        pair in the middle and extended the back toward a straight.
      </p>
    ),
    board: TUTORIAL_MIDWAY_BOARD,
    pendingCards: TUTORIAL_DRAW_CARDS.slice(4),
    pendingLabel: "Upcoming draws",
    highlightedRows: ["middle", "back"],
    callout: <p className="tutorial-sequence">A♦ → K♣ → 7♣ → K♦</p>,
  },
  {
    id: "legal-board",
    eyebrow: "The finished board",
    title: "Keep the rows in order.",
    body: (
      <p>
        A straight beats two pair, and two pair beats one pair. This completed
        board is legal because back ≥ middle ≥ front.
      </p>
    ),
    board: TUTORIAL_PLAYER_BOARD,
    highlightedRows: ["front", "middle", "back"],
    callout: (
      <div className="tutorial-result-line">
        <span>Front: pair of queens</span>
        <span>Middle: two pair, aces and kings</span>
        <span>Back: nine-high straight</span>
      </div>
    ),
  },
  {
    id: "fouls",
    eyebrow: "Protect the board",
    title: "A stronger row above a weaker one fouls.",
    body: (
      <p>
        For example, putting a flush in the middle with only a straight behind
        it would break the required order. A fouled board loses six points
        against a legal opponent and earns no royalties.
      </p>
    ),
    board: TUTORIAL_PLAYER_BOARD,
    highlightedRows: ["middle", "back"],
    callout: (
      <p className="tutorial-warning">
        Check the full board before chasing a tempting row.
      </p>
    ),
  },
  {
    id: "showdown",
    eyebrow: "The showdown",
    title: "Compare matching rows.",
    body: (
      <p>
        This hand wins front, middle, and back. Three row points plus a
        three-point scoop makes six; nine royalties against eight adds one more,
        for a final result of +7.
      </p>
    ),
    board: TUTORIAL_PLAYER_BOARD,
    opponentBoard: TUTORIAL_OPPONENT_BOARD,
    callout: (
      <dl className="tutorial-score">
        <div>
          <dt>Rows</dt>
          <dd>+3</dd>
        </div>
        <div>
          <dt>Scoop</dt>
          <dd>+3</dd>
        </div>
        <div>
          <dt>Net royalties</dt>
          <dd>+1</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>+7</dd>
        </div>
      </dl>
    ),
  },
  {
    id: "fantasyland",
    eyebrow: "The reward",
    title: "Queens or better in front earn Fantasyland.",
    body: (
      <p>
        A legal board with a pair of queens, kings, aces, or any three of a kind
        in front earns Fantasyland. The next hand deals all thirteen cards at
        once to arrange face down.
      </p>
    ),
    board: TUTORIAL_PLAYER_BOARD,
    highlightedRows: ["front"],
    callout: (
      <div className="tutorial-stay-note">
        <strong>To stay in Fantasyland, make a legal board with:</strong>
        <ul>
          <li>Three of a kind in front, or</li>
          <li>A full house or better in middle, or</li>
          <li>Four of a kind or better in back.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "royalties",
    eyebrow: "Bonus points",
    title: "Know your royalties.",
    body: (
      <p>
        Strong rows earn bonus points whenever the completed board is legal.
        Royalties are added across all three rows and compared against each
        opponent’s total.
      </p>
    ),
    board: EMPTY_BOARD,
    callout: (
      <p className="tutorial-royalty-note">
        Hands not listed in the tables earn no royalty in that row.
      </p>
    ),
    visual: "royalties",
  },
  {
    id: "complete",
    eyebrow: "Tutorial complete",
    title: "Congratulations!",
    body: <p>You finished the tutorial. You’re ready to start playing!</p>,
    board: EMPTY_BOARD,
    visual: "complete",
  },
] as const;

const FRONT_PAIR_ROYALTIES = [
  ["66", 1],
  ["77", 2],
  ["88", 3],
  ["99", 4],
  ["TT", 5],
  ["JJ", 6],
  ["QQ", 7],
  ["KK", 8],
  ["AA", 9],
] as const;

const FRONT_TRIPS_ROYALTIES = [
  ["222", 10],
  ["333", 11],
  ["444", 12],
  ["555", 13],
  ["666", 14],
  ["777", 15],
  ["888", 16],
  ["999", 17],
  ["TTT", 18],
  ["JJJ", 19],
  ["QQQ", 20],
  ["KKK", 21],
  ["AAA", 22],
] as const;

const MIDDLE_ROYALTIES = [
  ["Three of a kind", 2],
  ["Straight", 4],
  ["Flush", 8],
  ["Full house", 12],
  ["Four of a kind", 20],
  ["Straight flush", 30],
  ["Royal flush", 50],
] as const;

const BACK_ROYALTIES = [
  ["Straight", 2],
  ["Flush", 4],
  ["Full house", 6],
  ["Four of a kind", 10],
  ["Straight flush", 15],
  ["Royal flush", 25],
] as const;

function FrontRoyaltyTable() {
  return (
    <table className="tutorial-royalty-table tutorial-front-royalties">
      <caption>Front hand</caption>
      <thead>
        <tr>
          <th scope="col">Pair</th>
          <th scope="col">Points</th>
          <th scope="col">Trips</th>
          <th scope="col">Points</th>
        </tr>
      </thead>
      <tbody>
        {FRONT_TRIPS_ROYALTIES.map(([trips, tripsPoints], index) => {
          const pair = FRONT_PAIR_ROYALTIES[index];
          return (
            <tr key={trips}>
              <th scope="row">{pair?.[0] ?? "—"}</th>
              <td>{pair?.[1] ?? "—"}</td>
              <th scope="row">{trips}</th>
              <td>{tripsPoints}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RoyaltyTable({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly (readonly [string, number])[];
}) {
  return (
    <table className="tutorial-royalty-table">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Hand</th>
          <th scope="col">Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([hand, points]) => (
          <tr key={hand}>
            <th scope="row">{hand}</th>
            <td>{points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RoyaltyTables() {
  return (
    <section className="tutorial-royalty-tables" aria-label="Royalty points">
      <FrontRoyaltyTable />
      <RoyaltyTable title="Middle hand" rows={MIDDLE_ROYALTIES} />
      <RoyaltyTable title="Back hand" rows={BACK_ROYALTIES} />
    </section>
  );
}

function assertTutorialExample(): void {
  if (
    TUTORIAL_PLAYER_EVALUATION.fouled ||
    TUTORIAL_OPPONENT_EVALUATION.fouled ||
    TUTORIAL_PLAYER_EVALUATION.royalties.total !== 9 ||
    TUTORIAL_OPPONENT_EVALUATION.royalties.total !== 8 ||
    TUTORIAL_PAIR_SCORE.totalDelta !== 7 ||
    !TUTORIAL_FANTASYLAND.qualifiesForNextHand
  ) {
    throw new Error("The tutorial hand no longer matches its instructions");
  }
}

assertTutorialExample();

export interface TutorialScreenProps {
  readonly homeUrl: string;
  readonly onHome: () => void;
}

export function TutorialScreen({ homeUrl, onHome }: TutorialScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = STEPS[stepIndex] ?? STEPS[0]!;
  const lastStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    for (const container of [
      stageRef.current,
      copyRef.current,
      visualRef.current,
    ]) {
      if (container) container.scrollTop = 0;
    }
    headingRef.current?.focus();
  }, [stepIndex]);

  function showStep(nextIndex: number) {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, nextIndex)));
  }

  useEffect(() => {
    function navigateWithArrows(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStepIndex((current) => Math.min(STEPS.length - 1, current + 1));
      }
    }
    window.addEventListener("keydown", navigateWithArrows);
    return () => window.removeEventListener("keydown", navigateWithArrows);
  }, []);

  return (
    <main className="tutorial-shell" data-step={step.id}>
      <header className="tutorial-header">
        <Brand />
        <a
          className="tutorial-exit"
          href={homeUrl}
          onClick={(event) => {
            event.preventDefault();
            onHome();
          }}
        >
          Exit tutorial
        </a>
      </header>

      <div className="tutorial-stage" ref={stageRef}>
        <section
          className="tutorial-copy"
          aria-labelledby="tutorial-title"
          ref={copyRef}
        >
          <p className="eyebrow">{step.eyebrow}</p>
          <h1 id="tutorial-title" tabIndex={-1} ref={headingRef}>
            {step.title}
          </h1>
          {step.body}
          {step.callout}
        </section>

        <div className="tutorial-visual" ref={visualRef}>
          {step.visual === "royalties" ? (
            <RoyaltyTables />
          ) : step.visual === "complete" ? (
            <section
              className="tutorial-complete-panel"
              aria-label="Tutorial completion actions"
            >
              <span className="tutorial-complete-mark" aria-hidden="true">
                ✦
              </span>
              <p>Ready for your first hand?</p>
              <a
                className="tutorial-complete-button tutorial-complete-start"
                href={homeUrl}
                onClick={(event) => {
                  event.preventDefault();
                  onHome();
                }}
              >
                Start playing <span aria-hidden="true">→</span>
              </a>
              <button
                className="tutorial-complete-button tutorial-complete-redo"
                type="button"
                onClick={() => showStep(0)}
              >
                Redo tutorial <span aria-hidden="true">↺</span>
              </button>
            </section>
          ) : step.opponentBoard ? (
            <div className="tutorial-showdown-grid">
              <div>
                <p>You</p>
                <TutorialBoard
                  label="Your completed example board"
                  board={step.board}
                  compact
                />
              </div>
              <div>
                <p>Opponent</p>
                <TutorialBoard
                  label="Opponent completed example board"
                  board={step.opponentBoard}
                  compact
                />
              </div>
            </div>
          ) : (
            <TutorialBoard
              label="Example Open-Face Chinese Poker board"
              board={step.board}
              {...(step.pendingCards
                ? { pendingCards: step.pendingCards }
                : {})}
              {...(step.pendingLabel
                ? { pendingLabel: step.pendingLabel }
                : {})}
              {...(step.highlightedRows
                ? { highlightedRows: step.highlightedRows }
                : {})}
            />
          )}
        </div>
      </div>

      <footer className="tutorial-navigation">
        <button
          className="tutorial-nav-button tutorial-back"
          type="button"
          disabled={stepIndex === 0}
          onClick={() => showStep(stepIndex - 1)}
        >
          <span aria-hidden="true">←</span> Back
        </button>

        <nav className="tutorial-progress" aria-label="Tutorial progress">
          <p aria-live="polite">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <ol>
            {STEPS.map((candidate, index) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  aria-label={`Go to step ${index + 1}: ${candidate.title}`}
                  aria-current={index === stepIndex ? "step" : undefined}
                  onClick={() => showStep(index)}
                >
                  <span aria-hidden="true">{index + 1}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {lastStep ? (
          <span className="tutorial-navigation-spacer" aria-hidden="true" />
        ) : (
          <button
            className="tutorial-nav-button tutorial-next"
            type="button"
            onClick={() => showStep(stepIndex + 1)}
          >
            Next <span aria-hidden="true">→</span>
          </button>
        )}
      </footer>
    </main>
  );
}
