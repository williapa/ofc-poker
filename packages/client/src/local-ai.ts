import {
  createAiConfiguration,
  createAiPlayer,
  createSeededRandom,
  type AiConfiguration,
  type AiDifficulty,
} from "@ofcpoker/ai-player";
import type { RunnerAiSeat } from "./contracts/game-runner";

type LocalAiProfileId = "steady" | "bold" | "careful";

interface LocalAiProfile {
  readonly displayName: string;
  readonly difficulty: AiDifficulty;
  readonly overrides: Partial<AiConfiguration>;
}

/**
 * The single tuning registry for production local opponents. Strategies,
 * difficulty, presentation pacing, and names can be changed here without
 * touching the engine, runner, or view.
 */
export const LOCAL_AI_PROFILE_REGISTRY: Readonly<
  Record<LocalAiProfileId, Readonly<LocalAiProfile>>
> = Object.freeze({
  steady: Object.freeze({
    displayName: "Mina",
    difficulty: "medium",
    overrides: Object.freeze({ thinkDelayMs: 850 }),
  }),
  bold: Object.freeze({
    displayName: "Theo",
    difficulty: "medium",
    overrides: Object.freeze({ riskTolerance: 0.65, thinkDelayMs: 950 }),
  }),
  careful: Object.freeze({
    displayName: "Iris",
    difficulty: "hard",
    overrides: Object.freeze({ royaltyPreference: 0.65, thinkDelayMs: 1050 }),
  }),
});

const LOCAL_AI_SEAT_PROFILES: readonly LocalAiProfileId[] = Object.freeze([
  "steady",
  "bold",
  "careful",
]);

function seedFor(value: string): number {
  let seed = 2166136261;
  for (const character of value) {
    seed ^= character.codePointAt(0) ?? 0;
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

interface CancellableDelay {
  readonly wait: (milliseconds: number) => Promise<void>;
  readonly dispose: () => void;
}

function createCancellableDelay(): CancellableDelay {
  const pending = new Map<ReturnType<typeof setTimeout>, () => void>();
  let disposed = false;
  return {
    wait(milliseconds) {
      if (disposed || milliseconds === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(timer);
          resolve();
        }, milliseconds);
        pending.set(timer, resolve);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [timer, resolve] of pending) {
        clearTimeout(timer);
        resolve();
      }
      pending.clear();
    },
  };
}

export interface CreateLocalAiSeatsOptions {
  readonly lobbyId: string;
  readonly seatCount: 2 | 3 | 4;
  /** Test seam: production uses a cancellable timer owned by each AI seat. */
  readonly delayFactory?: () => CancellableDelay;
}

export function createLocalAiSeats(
  options: CreateLocalAiSeatsOptions,
): readonly RunnerAiSeat[] {
  return LOCAL_AI_SEAT_PROFILES.slice(0, options.seatCount - 1).map(
    (profileId, index) => {
      const profile = LOCAL_AI_PROFILE_REGISTRY[profileId];
      const id = `ai-${options.lobbyId}-${index + 1}`;
      const delay = options.delayFactory?.() ?? createCancellableDelay();
      return Object.freeze({
        player: createAiPlayer({
          id,
          dependencies: {
            random: createSeededRandom(seedFor(id)),
            delay: delay.wait,
          },
        }),
        displayName: profile.displayName,
        configuration: createAiConfiguration(
          profile.difficulty,
          profile.overrides,
        ),
        dispose: delay.dispose,
      });
    },
  );
}
