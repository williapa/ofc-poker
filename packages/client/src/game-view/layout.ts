import type { PlayerId } from "@ofcpoker/game-engine";
import { GAME_VIEW_TOKENS } from "./design-system";
import type { ResponsiveLayoutMode } from "./responsive-layout-invariants";

export interface SeatLayout {
  readonly playerId: PlayerId;
  readonly seat: number;
  readonly relativeSeat: number;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly isLocal: boolean;
}

export interface GameCameraLayout {
  readonly position: readonly [number, number, number];
  readonly zoom: number;
  readonly near: number;
  readonly far: number;
}

export interface CardSectionBounds {
  readonly relativeSeat: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface GameSceneBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const POSITIONS: Readonly<
  Record<number, readonly (readonly [number, number, number])[]>
> = Object.freeze({
  2: [
    [0, 0, 3.6],
    [0, 0, -3.6],
  ],
  3: [
    [0, 0, 3.7],
    [-6.5, 0, -1],
    [6.5, 0, -1],
  ],
  4: [
    [0, 0, 4.8],
    [-6.6, 0, 0],
    [0, 0, -4.8],
    [6.6, 0, 0],
  ],
});

const POSITION_SCALE: Record<ResponsiveLayoutMode, readonly [number, number]> =
  Object.freeze({
    desktop: [1, 1],
    "mobile-portrait": [1, 0.94],
    "mobile-landscape": [1, 0.9],
  });

const ROW_STEP = GAME_VIEW_TOKENS.card.width + GAME_VIEW_TOKENS.card.gap;
const SLOT_EXTRA = 0.045;
const ROW_EDGE_Z = 1.76;
const CARD_SECTION_HALF_WIDTH =
  2 * ROW_STEP + (GAME_VIEW_TOKENS.card.width + SLOT_EXTRA) / 2;
const CARD_SECTION_HALF_DEPTH =
  ROW_EDGE_Z + (GAME_VIEW_TOKENS.card.height + SLOT_EXTRA) / 2;
const MAX_PENDING_CARD_COUNT = 13;
const MAX_PENDING_HALF_WIDTH =
  ((MAX_PENDING_CARD_COUNT - 1) / 2) * ROW_STEP +
  GAME_VIEW_TOKENS.card.width / 2;
const LOCAL_HAND_OFFSET_Z = ROW_EDGE_Z + GAME_VIEW_TOKENS.card.height + 0.16;
const CAMERA_FIT_MARGIN = 1.04;

/** Rotates every table so the viewer is always the stable bottom seat. */
export function createSeatLayout(
  players: readonly { readonly id: PlayerId; readonly seat: number }[],
  viewerId: PlayerId,
  mode: ResponsiveLayoutMode = "desktop",
): readonly SeatLayout[] {
  if (players.length < 2 || players.length > 4) {
    throw new RangeError("The game view supports two to four seats");
  }
  const viewer = players.find(({ id }) => id === viewerId);
  if (viewer === undefined) throw new RangeError("Viewer must occupy a seat");
  const positions = POSITIONS[players.length];
  if (positions === undefined) throw new RangeError("Unsupported seat count");
  const [scaleX, scaleZ] = POSITION_SCALE[mode];

  return players.map((player) => {
    const relativeSeat =
      (player.seat - viewer.seat + players.length) % players.length;
    const placement = positions[relativeSeat];
    if (placement === undefined) throw new RangeError("Invalid player seat");
    return Object.freeze({
      playerId: player.id,
      seat: player.seat,
      relativeSeat,
      position: [
        placement[0] * scaleX,
        placement[1],
        placement[2] * scaleZ,
      ] as const,
      rotationY: 0,
      isLocal: player.id === viewerId,
    });
  });
}

export function createCameraLayout(
  mode: ResponsiveLayoutMode,
): GameCameraLayout {
  const cameraByMode: Record<
    ResponsiveLayoutMode,
    Pick<GameCameraLayout, "position" | "zoom">
  > = {
    desktop: {
      position: [0, 11, 8.5],
      zoom: 58,
    },
    "mobile-portrait": {
      position: [0, 16.7, 15],
      zoom: 19,
    },
    "mobile-landscape": {
      position: [0, 14.8, 12.2],
      zoom: 21,
    },
  };
  const camera = cameraByMode[mode];
  return Object.freeze({
    position: camera.position,
    zoom: camera.zoom,
    near: 0.1,
    far: 100,
  });
}

export function createPlayerCardSectionBounds(
  playerCount: 2 | 3 | 4,
  mode: ResponsiveLayoutMode,
): readonly CardSectionBounds[] {
  const positions = POSITIONS[playerCount];
  if (positions === undefined) throw new RangeError("Unsupported seat count");
  const [scaleX, scaleZ] = POSITION_SCALE[mode];

  return Object.freeze(
    positions.map((position, relativeSeat) =>
      Object.freeze({
        relativeSeat,
        minX: position[0] * scaleX - CARD_SECTION_HALF_WIDTH,
        maxX: position[0] * scaleX + CARD_SECTION_HALF_WIDTH,
        minZ: position[2] * scaleZ - CARD_SECTION_HALF_DEPTH,
        maxZ: position[2] * scaleZ + CARD_SECTION_HALF_DEPTH,
      }),
    ),
  );
}

export function createGameSceneBounds(
  playerCount: 2 | 3 | 4,
  mode: ResponsiveLayoutMode,
): GameSceneBounds {
  const sections = createPlayerCardSectionBounds(playerCount, mode);
  const localSection = sections.find(({ relativeSeat }) => relativeSeat === 0);
  if (localSection === undefined) throw new RangeError("Missing local seat");
  const localHandCenterZ =
    (localSection.minZ + localSection.maxZ) / 2 + LOCAL_HAND_OFFSET_Z;

  return Object.freeze({
    minX: Math.min(
      ...sections.map(({ minX }) => minX),
      -MAX_PENDING_HALF_WIDTH,
    ),
    maxX: Math.max(...sections.map(({ maxX }) => maxX), MAX_PENDING_HALF_WIDTH),
    minY: 0,
    maxY: 0.23,
    minZ: Math.min(...sections.map(({ minZ }) => minZ)),
    maxZ: Math.max(
      ...sections.map(({ maxZ }) => maxZ),
      localHandCenterZ + GAME_VIEW_TOKENS.card.height / 2,
    ),
  });
}

function normalize(
  vector: readonly [number, number, number],
): readonly [number, number, number] {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
}

function dot(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

export function createFittedCameraZoom(
  mode: ResponsiveLayoutMode,
  playerCount: 2 | 3 | 4,
  viewport: Readonly<{ readonly width: number; readonly height: number }>,
): number {
  const camera = createCameraLayout(mode);
  if (viewport.width <= 0 || viewport.height <= 0) return camera.zoom;

  const bounds = createGameSceneBounds(playerCount, mode);
  const forward = normalize([
    -camera.position[0],
    -camera.position[1],
    -camera.position[2],
  ]);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  let horizontalHalfExtent = 0;
  let verticalHalfExtent = 0;

  for (const x of [bounds.minX, bounds.maxX]) {
    for (const y of [bounds.minY, bounds.maxY]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        const point = [x, y, z] as const;
        horizontalHalfExtent = Math.max(
          horizontalHalfExtent,
          Math.abs(dot(point, right)),
        );
        verticalHalfExtent = Math.max(
          verticalHalfExtent,
          Math.abs(dot(point, up)),
        );
      }
    }
  }

  return Math.min(
    camera.zoom,
    viewport.width / (2 * horizontalHalfExtent * CAMERA_FIT_MARGIN),
    viewport.height / (2 * verticalHalfExtent * CAMERA_FIT_MARGIN),
  );
}
