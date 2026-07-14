# OFC Poker

OFC Poker is a static browser implementation of standard Open-Face Chinese
Poker. Two to four players build a three-card front hand, a five-card middle
hand, and a five-card back hand in the open. The game includes standard 1–6
scoring, royalties, fouls, Fantasyland, multi-hand scores, and dealer rotation.

The app has two table modes:

- **Local AI** creates a game in the current browser with one to three
  configurable computer opponents. It uses the in-memory data provider and
  never initializes Playroom.
- **Multiplayer** creates a Playroom room for two to four people. The host copies
  the displayed invite URL; guests open it, enter a display name, and join. A
  table's player count and rules cannot change after creation.

## Play

From the home page, enter a display name, select Local AI or Multiplayer, choose
two to four players, and select **Create table**. Local AI begins immediately.
For Multiplayer, share the `?lobby=<room-code>` invite URL and keep the host tab
open until every seat joins. A guest can also open an invite URL directly and
select **Join lobby** after entering a name.

Place the initial five cards into any non-full rows, then confirm them. Place
each of the remaining eight cards as it arrives. Committed cards cannot move.
The finished board must satisfy `back >= middle >= front`; otherwise it fouls.
At showdown, review row results, royalties, hand delta, and cumulative score.
The host starts the next hand. The complete rules and the few explicit engine
policy choices are in
[docs/reference/open-face-chinese-poker-rules-engine-spec.md](docs/reference/open-face-chinese-poker-rules-engine-spec.md).

## Prerequisites and development

- Node.js 24.18.0 (pinned by `.nvmrc`)
- npm 11
- Chromium installed through Playwright for browser tests

```sh
nvm install
nvm use
npm ci
npm run dev
```

Vite prints the local URL. Local AI needs no credentials. To enable Multiplayer,
provide the public Playroom project/game ID when starting the app:

```sh
VITE_PLAYROOM_GAME_ID=your-public-game-id npm run dev
```

The game ID identifies a public client project and is not an account secret.
Never put Playroom account credentials or reconnect tokens in the repository or
in a `VITE_*` variable. Without the game ID, the app explains that Multiplayer
is unavailable while Local AI continues to work.

## Test and build

Run the release gates from the repository root:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
```

The tests use deterministic decks, IDs, seeded random sources, fake clocks, the
in-memory provider, and a fake Playroom boundary. Automated verification does
not contact Playroom or spend service quota. Coverage thresholds and the
requirement-to-test map are documented in
[docs/test-traceability.md](docs/test-traceability.md); command details and
troubleshooting are in [docs/workflows.md](docs/workflows.md).

The production build is written to `packages/client/dist`. To reproduce a
repository-page build and browser run locally:

```sh
VITE_BASE_PATH=ofcpoker npm run build
VITE_BASE_PATH=ofcpoker npm run test:e2e
```

## Architecture

This npm workspace keeps four concerns behind explicit TypeScript interfaces:

- `@ofcpoker/game-engine` — pure deterministic lifecycle, evaluation, scoring,
  Fantasyland, replay, and persistence;
- `@ofcpoker/ai-player` — configurable decisions based only on player-visible
  engine state and legal actions;
- `@ofcpoker/data-provider` — rules-neutral local and Playroom transports; and
- `@ofcpoker/client` — React composition root, host-authoritative runner, forms,
  routing, and the React Three Fiber view.

The engine, AI, and provider do not depend on React, browser APIs, or Three.js.
The browser host is authoritative, which is appropriate for a casual game but
is not server-grade anti-cheat. Read [docs/architecture/code.md](docs/architecture/code.md)
and [docs/architecture/system.md](docs/architecture/system.md) before changing
package boundaries or lifecycle policy.

The 3D table has a semantic DOM counterpart for cards, rows, status, scores, and
controls. Keyboard interaction follows the same action path as pointer input;
reduced-motion preferences disable attention animation; and an unsupported or
failed WebGL renderer leaves the DOM game surface usable.

## Deployment

GitHub Actions validates and deploys `packages/client/dist` through
`.github/workflows/pages.yml`. In the repository settings, choose **GitHub
Actions** as the Pages source, enable Actions, and protect `main` with the
`Quality / verify` check. A push to `main` then publishes:

```text
https://<owner>.github.io/<repository>/
```

Set `VITE_PLAYROOM_GAME_ID` in the build environment only when the published app
should offer Multiplayer. Deployment details and asset-path troubleshooting are
in [docs/architecture/deployment.md](docs/architecture/deployment.md) and
[docs/workflows.md](docs/workflows.md).

## Release status

The 2026-07-13 real-service smoke test successfully created a two-player
Playroom lobby, joined it by invite link, and exercised basic gameplay. This is
manual evidence, not a claim about untested three- or four-player, reconnect,
host-departure, or mobile service behavior. The automated two-, three-, and
four-player suites use local/fake transports and consume no Playroom quota.

Known limitations:

- The public GitHub Pages URL has not yet been demonstrated. Configure Pages for
  GitHub Actions, push `main`, and record the successful workflow URL before
  closing requirements R1 and R13.
- Browser E2E covers the production home, routing, validation, and local
  placement path. Complete cross-browser journeys remain open under R11 even
  though the domain and component layers have deterministic coverage.
- Desktop is the release target. Mobile layouts retain access to essential
  semantic controls but still need a dedicated visual/interaction polish pass.
- Playroom's selected free tier was documented as allowing 10 daily users.
  Confirm current dashboard terms before a real-service test; automated tests
  intentionally make no Playroom requests.
- A peer can reconnect within Playroom's grace period using a browser-local
  capability. Host refresh/departure closes the lobby; there is no host
  migration or durable match storage.

The evidence-based requirement status is in [docs/requirements.md](docs/requirements.md).
