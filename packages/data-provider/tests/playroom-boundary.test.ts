import { beforeEach, expect, test, vi } from "vitest";

interface MockPlayer {
  readonly id: string;
  getProfile(): { readonly name: string };
  leaveRoom(): Promise<void>;
}

type RpcHandler = (payload: unknown, sender: MockPlayer) => Promise<unknown>;

const sdk = vi.hoisted(() => {
  const player = {
    id: "sdk-player-1",
    getProfile: () => ({ name: "Alice" }),
    leaveRoom: vi.fn(async () => undefined),
  };
  const state: { handler: RpcHandler | undefined } = { handler: undefined };
  return {
    player,
    state,
    call: vi.fn(async () => true),
    register: vi.fn((_name: string, handler: RpcHandler) => {
      state.handler = handler;
      return vi.fn();
    }),
    insertCoin: vi.fn(async () => undefined),
  };
});

vi.mock("playroomkit", () => ({
  RPC: {
    Mode: { ALL: 0, OTHERS: 1, HOST: 2 },
    call: sdk.call,
    register: sdk.register,
  },
  getParticipants: () => ({ [sdk.player.id]: sdk.player }),
  getRoomCode: () => "ROOM-1",
  insertCoin: sdk.insertCoin,
  isHost: () => true,
  myPlayer: () => sdk.player,
  onDisconnect: () => vi.fn(),
  onPlayerJoin: () => vi.fn(),
}));

import { PlayroomKitBoundary } from "../src/playroom/playroom-boundary";

beforeEach(() => {
  vi.clearAllMocks();
  sdk.state.handler = undefined;
});

test("acknowledges inbound SDK RPCs so the sender's call can resolve", async () => {
  const session = await new PlayroomKitBoundary().connect({
    gameId: "public-game-id",
    displayName: "Alice",
    maxPlayers: 2,
    reconnectGracePeriodMs: 60_000,
  });
  const received: unknown[] = [];
  session.onMessage((message) => received.push(message));

  const response = await sdk.state.handler?.({ kind: "hello" }, sdk.player);

  expect(response).toBe(true);
  expect(received).toEqual([
    {
      payload: { kind: "hello" },
      sender: { id: "sdk-player-1", displayName: "Alice" },
    },
  ]);
});
