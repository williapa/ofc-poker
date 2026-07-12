import type { PlacementRow } from "@ofcpoker/game-engine";

export const GAME_VIEW_TOKENS = Object.freeze({
  color: {
    felt: "#123f32",
    feltEdge: "#09251e",
    brass: "#d7ad5b",
    card: "#f7f2e8",
    cardBack: "#173e5b",
    cardBackAccent: "#d7ad5b",
    ink: "#151a18",
    redSuit: "#a92d2d",
    valid: "#77d7a5",
    selected: "#f2c96d",
    unavailable: "#637a72",
  },
  typography: {
    ui: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    card: 'Georgia, "Times New Roman", serif',
  },
  card: { width: 0.64, height: 0.9, depth: 0.035, gap: 0.08 },
  motion: {
    durationMs: 160,
    selectedLift: 0.12,
    reducedDurationMs: 0,
  },
});

export const ROW_DEFINITIONS: readonly {
  readonly row: PlacementRow;
  readonly label: string;
  readonly capacity: 3 | 5;
}[] = Object.freeze([
  { row: "front", label: "Front", capacity: 3 },
  { row: "middle", label: "Middle", capacity: 5 },
  { row: "back", label: "Back", capacity: 5 },
]);
