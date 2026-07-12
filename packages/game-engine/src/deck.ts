import {
  RANKS,
  SUITS,
  createCard,
  serializeCard,
  type Card,
  type CardCode,
} from "./cards";

export type RandomSource = () => number;

const STANDARD_CARD_CODES: readonly CardCode[] = Object.freeze(
  SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}` as CardCode)),
);

function validateDeck(cards: readonly Card[]): void {
  if (cards.length !== STANDARD_CARD_CODES.length) {
    throw new RangeError(
      `A deck must contain 52 cards; received ${cards.length}`,
    );
  }

  const codes = new Set(cards.map(serializeCard));
  if (codes.size !== STANDARD_CARD_CODES.length) {
    throw new RangeError("A deck must contain each standard card exactly once");
  }
}

/** Creates the canonical suit-major, rank-ascending deck, or validates a supplied order. */
export function createStandardDeck(order?: readonly Card[]): readonly Card[] {
  const cards =
    order === undefined
      ? STANDARD_CARD_CODES.map((code) => {
          const rank = code[0] as Parameters<typeof createCard>[0];
          const suit = code[1] as Parameters<typeof createCard>[1];
          return createCard(rank, suit);
        })
      : [...order];

  validateDeck(cards);
  return Object.freeze(cards);
}

/** Returns a shuffled copy using Fisher-Yates and an explicit source of [0, 1) values. */
export function shuffleDeck(
  random: RandomSource,
  deck: readonly Card[] = createStandardDeck(),
): readonly Card[] {
  validateDeck(deck);
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError(
        `Random source must return a finite value in [0, 1); received ${value}`,
      );
    }

    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex] as Card,
      shuffled[index] as Card,
    ];
  }

  return Object.freeze(shuffled);
}
