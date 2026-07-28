import {
  determineFantasyland,
  evaluateOfcBoard,
  scoreOfcPair,
  type CardCode,
  type OfcBoard,
} from "@ofcpoker/game-engine";

export type TutorialRow = keyof OfcBoard;

export interface TutorialBoardSnapshot {
  readonly front: readonly CardCode[];
  readonly middle: readonly CardCode[];
  readonly back: readonly CardCode[];
}

export const TUTORIAL_INITIAL_CARDS = Object.freeze([
  "Qs",
  "Qd",
  "Ac",
  "5s",
  "6h",
] as const satisfies readonly CardCode[]);

export const TUTORIAL_DRAW_CARDS = Object.freeze([
  "Ad",
  "Kc",
  "7c",
  "Kd",
  "8d",
  "3h",
  "9s",
  "2c",
] as const satisfies readonly CardCode[]);

export const TUTORIAL_INITIAL_PLACEMENT: TutorialBoardSnapshot = Object.freeze({
  front: Object.freeze(["Qs", "Qd"] as const),
  middle: Object.freeze(["Ac"] as const),
  back: Object.freeze(["5s", "6h"] as const),
});

export const TUTORIAL_MIDWAY_BOARD: TutorialBoardSnapshot = Object.freeze({
  front: TUTORIAL_INITIAL_PLACEMENT.front,
  middle: Object.freeze(["Ac", "Ad", "Kc", "Kd"] as const),
  back: Object.freeze(["5s", "6h", "7c"] as const),
});

export const TUTORIAL_PLAYER_BOARD: OfcBoard = Object.freeze({
  front: Object.freeze(["Qs", "Qd", "2c"] as const),
  middle: Object.freeze(["Ac", "Ad", "Kc", "Kd", "3h"] as const),
  back: Object.freeze(["5s", "6h", "7c", "8d", "9s"] as const),
});

export const TUTORIAL_OPPONENT_BOARD: OfcBoard = Object.freeze({
  front: Object.freeze(["Js", "Jd", "4c"] as const),
  middle: Object.freeze(["Ks", "Kh", "Tc", "Td", "5c"] as const),
  back: Object.freeze(["4s", "5d", "6c", "7h", "8s"] as const),
});

export const TUTORIAL_PLAYER_EVALUATION = evaluateOfcBoard(
  TUTORIAL_PLAYER_BOARD,
);
export const TUTORIAL_OPPONENT_EVALUATION = evaluateOfcBoard(
  TUTORIAL_OPPONENT_BOARD,
);
export const TUTORIAL_PAIR_SCORE = scoreOfcPair(
  "you",
  TUTORIAL_PLAYER_EVALUATION,
  "opponent",
  TUTORIAL_OPPONENT_EVALUATION,
);
export const TUTORIAL_FANTASYLAND = determineFantasyland(
  TUTORIAL_PLAYER_EVALUATION,
  false,
);
