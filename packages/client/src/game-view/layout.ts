import type { PlayerId } from "@ofcpoker/game-engine";
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

const POSITIONS: Readonly<
  Record<number, readonly (readonly [number, number, number])[]>
> = Object.freeze({
  2: [
    [0, 0, 3.6],
    [0, 0, -3.6],
  ],
  3: [
    [0, 0, 3.7],
    [-5.8, 0, -1],
    [5.8, 0, -1],
  ],
  4: [
    [0, 0, 4.8],
    [-6.3, 0, 0],
    [0, 0, -4.8],
    [6.3, 0, 0],
  ],
});

const POSITION_SCALE: Record<ResponsiveLayoutMode, readonly [number, number]> =
  Object.freeze({
    desktop: [1, 1],
    "mobile-portrait": [0.9, 0.94],
    "mobile-landscape": [0.9, 0.9],
  });

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
