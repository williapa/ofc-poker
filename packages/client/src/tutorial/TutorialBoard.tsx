import { parseCard, type CardCode } from "@ofcpoker/game-engine";
import type { TutorialBoardSnapshot, TutorialRow } from "./tutorial-example";

const ROWS = [
  { id: "front", name: "Front", capacity: 3, note: "Weakest" },
  { id: "middle", name: "Middle", capacity: 5, note: "Stronger" },
  { id: "back", name: "Back", capacity: 5, note: "Strongest" },
] as const;

const SUIT_LABEL = {
  c: "clubs",
  d: "diamonds",
  h: "hearts",
  s: "spades",
} as const;

const SUIT_SYMBOL = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
} as const;

const RANK_LABEL = {
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
} as const;

function CardFace({ code }: { readonly code: CardCode }) {
  const card = parseCard(code);
  const red = card.suit === "d" || card.suit === "h";
  return (
    <span
      className="tutorial-card"
      data-color={red ? "red" : "black"}
      aria-label={`${RANK_LABEL[card.rank]} of ${SUIT_LABEL[card.suit]}`}
    >
      <strong>{card.rank}</strong>
      <span aria-hidden="true">{SUIT_SYMBOL[card.suit]}</span>
    </span>
  );
}

export interface TutorialBoardProps {
  readonly label: string;
  readonly board: TutorialBoardSnapshot;
  readonly pendingCards?: readonly CardCode[];
  readonly pendingLabel?: string;
  readonly highlightedRows?: readonly TutorialRow[];
  readonly compact?: boolean;
}

export function TutorialBoard({
  label,
  board,
  pendingCards = [],
  pendingLabel = "Cards to place",
  highlightedRows = [],
  compact = false,
}: TutorialBoardProps) {
  return (
    <section
      className={`tutorial-board${compact ? " tutorial-board-compact" : ""}`}
      aria-label={label}
    >
      <div className="tutorial-felt">
        {ROWS.map(({ id, name, capacity, note }) => {
          const cards = board[id];
          return (
            <div
              className="tutorial-row"
              data-highlighted={highlightedRows.includes(id)}
              key={id}
            >
              <div className="tutorial-row-label">
                <strong>{name}</strong>
                <span>
                  {cards.length} / {capacity} · {note}
                </span>
              </div>
              <div
                className="tutorial-card-row"
                role="group"
                aria-label={`${name} row, ${cards.length} of ${capacity} cards`}
              >
                {cards.map((card) => (
                  <CardFace code={card} key={card} />
                ))}
                {Array.from({ length: capacity - cards.length }, (_, index) => (
                  <span
                    className="tutorial-card-slot"
                    aria-hidden="true"
                    key={`slot-${index}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {pendingCards.length > 0 ? (
        <div className="tutorial-pending">
          <span>{pendingLabel}</span>
          <div
            aria-label={`${pendingCards.length} ${pendingLabel.toLowerCase()}`}
          >
            {pendingCards.map((card) => (
              <CardFace code={card} key={card} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
