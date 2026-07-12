export const RANKS = Object.freeze([
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
] as const);

export const SUITS = Object.freeze(["c", "d", "h", "s"] as const);

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type CardCode = `${Rank}${Suit}`;

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
  readonly code: CardCode;
}

const rankValues: Readonly<Record<Rank, number>> = Object.freeze({
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
});

const cardsByCode = new Map<CardCode, Card>();

for (const suit of SUITS) {
  for (const rank of RANKS) {
    const code: CardCode = `${rank}${suit}`;
    cardsByCode.set(code, Object.freeze({ rank, suit, code }));
  }
}

export function createCard(rank: Rank, suit: Suit): Card {
  const code = `${rank}${suit}` as CardCode;
  const card = cardsByCode.get(code);

  if (card === undefined) {
    throw new RangeError(`Invalid card rank or suit: ${code}`);
  }

  return card;
}

export function parseCard(value: string): Card {
  const card = cardsByCode.get(value as CardCode);

  if (card === undefined) {
    throw new RangeError(`Invalid card code: ${value}`);
  }

  return card;
}

export function serializeCard(card: Card): CardCode {
  const canonical = createCard(card.rank, card.suit);

  if (canonical.code !== card.code) {
    throw new RangeError(
      `Card code does not match its rank and suit: ${card.code}`,
    );
  }

  return canonical.code;
}

export function rankValue(rank: Rank): number {
  return rankValues[rank];
}
