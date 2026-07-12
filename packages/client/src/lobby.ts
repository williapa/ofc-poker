import type { LobbySettings } from "@ofcpoker/data-provider";

export const DISPLAY_NAME_MAX_LENGTH = 32;

export type LobbyMode = LobbySettings["mode"];
export type SeatCount = LobbySettings["seatCount"];

export interface LobbyFormValues {
  readonly displayName: string;
  readonly mode: LobbyMode;
  readonly seatCount: SeatCount;
}

export const DEFAULT_LOBBY_FORM: LobbyFormValues = {
  displayName: "",
  mode: "local-ai",
  seatCount: 2,
};

export const STANDARD_RULES = {
  variant: "standard-ofc",
  fantasyland: true,
  tiedRowPoints: 0,
} as const;

export function validateDisplayName(displayName: string): string | undefined {
  const trimmed = displayName.trim();
  if (!trimmed) return "Enter a display name.";
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Use ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function validateSeatCount(seatCount: number): string | undefined {
  return seatCount === 2 || seatCount === 3 || seatCount === 4
    ? undefined
    : "Choose between 2 and 4 players.";
}

export function createLobbySettings(
  values: Pick<LobbyFormValues, "mode" | "seatCount">,
): LobbySettings {
  const seatError = validateSeatCount(values.seatCount);
  if (seatError) throw new Error(seatError);
  return {
    schemaVersion: 1,
    mode: values.mode,
    seatCount: values.seatCount,
    rules: STANDARD_RULES,
  };
}

export type AppRoute =
  | { readonly page: "home" }
  | { readonly page: "join"; readonly lobbyId: string }
  | { readonly page: "invalid-join"; readonly message: string };

const LOBBY_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export function parseAppRoute(url: string | URL): AppRoute {
  const parsed =
    url instanceof URL ? url : new URL(url, "https://local.invalid/");
  if (!parsed.searchParams.has("lobby")) return { page: "home" };

  const lobbyIds = parsed.searchParams.getAll("lobby");
  const lobbyId = lobbyIds[0]?.trim() ?? "";
  if (lobbyIds.length !== 1 || !LOBBY_ID_PATTERN.test(lobbyId)) {
    return {
      page: "invalid-join",
      message: "This join link does not contain a valid lobby identifier.",
    };
  }
  return { page: "join", lobbyId };
}

export function createJoinUrl(baseUrl: string | URL, lobbyId: string): string {
  if (!LOBBY_ID_PATTERN.test(lobbyId)) throw new Error("Invalid lobby ID");
  const url = new URL(baseUrl);
  url.hash = "";
  url.search = "";
  url.searchParams.set("lobby", lobbyId);
  return url.toString();
}

export function createHomeUrl(baseUrl: string | URL): string {
  const url = new URL(baseUrl);
  url.hash = "";
  url.search = "";
  return url.toString();
}
