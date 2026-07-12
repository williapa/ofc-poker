import type { PlayerId } from "@ofcpoker/game-engine";

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
  Record<number, readonly (readonly [number, number, number, number])[]>
> = Object.freeze({
  2: [
    [0, 0, 3.55, 0],
    [0, 0, -3.55, Math.PI],
  ],
  3: [
    [0, 0, 3.75, 0],
    [-5.15, 0, -0.9, Math.PI / 2],
    [5.15, 0, -0.9, -Math.PI / 2],
  ],
  4: [
    [0, 0, 3.75, 0],
    [-5.15, 0, 0, Math.PI / 2],
    [0, 0, -3.75, Math.PI],
    [5.15, 0, 0, -Math.PI / 2],
  ],
});

/** Rotates every table so the viewer is always the stable bottom seat. */
export function createSeatLayout(
  players: readonly { readonly id: PlayerId; readonly seat: number }[],
  viewerId: PlayerId,
): readonly SeatLayout[] {
  if (players.length < 2 || players.length > 4) {
    throw new RangeError("The game view supports two to four seats");
  }
  const viewer = players.find(({ id }) => id === viewerId);
  if (viewer === undefined) throw new RangeError("Viewer must occupy a seat");
  const positions = POSITIONS[players.length];
  if (positions === undefined) throw new RangeError("Unsupported seat count");

  return players.map((player) => {
    const relativeSeat =
      (player.seat - viewer.seat + players.length) % players.length;
    const placement = positions[relativeSeat];
    if (placement === undefined) throw new RangeError("Invalid player seat");
    return Object.freeze({
      playerId: player.id,
      seat: player.seat,
      relativeSeat,
      position: [placement[0], placement[1], placement[2]] as const,
      rotationY: placement[3],
      isLocal: player.id === viewerId,
    });
  });
}

export function createCameraLayout(compact: boolean): GameCameraLayout {
  return Object.freeze({
    position: [0, compact ? 12.5 : 11, compact ? 10.5 : 8.5] as const,
    zoom: compact ? 43 : 58,
    near: 0.1,
    far: 100,
  });
}
