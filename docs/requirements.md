# Requirements

When the requirements are met the project is done.

1. [ ] client browser application (static app available via url)
2. [x] create a lobby via shareable link
3. [x] user configures default game settings via form before creating lobby
4. [x] lobby hosts a game of Open Face Chinese (OFC) Poker (see "./reference/open-face-chinese-poker-rules-engine-spec.md");
5. [x] 2 to 4 players supported in any lobby
6. [x] "AI lobby" option which can be used as a local-play option that does NOT engage the multiplayer service
7. [x] internally configurable AI players (so you can customize AI player strength & style easily)
8. [x] rules stay fixed for a lobby (to reconfigure game, create a new lobby)
9. [x] game view is a minimal, 3D UI of the card game
10. [x] unit tests for all features
11. [ ] end to end tests with playwright for features
12. [x] support a local version of data-provider for testing & development that does not spend service quotas.
13. [ ] app deploys via github actions as a github repository page

## Release audit evidence (2026-07-13)

| Requirement | Status and verification evidence                                                                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1          | **Open.** Vite produces and Playwright serves the static production app locally, but no public deployment URL has been demonstrated.                                                                                                                                             |
| R2          | **Complete.** Create/join/invite and repository-safe `?lobby=` links have component, provider-contract, and browser coverage. A two-player real Playroom create/join/basic-gameplay smoke test passed manually on 2026-07-13.                                                    |
| R3          | **Complete.** The accessible pre-lobby form validates display name, mode, and two-to-four seat count before provider creation; component and browser tests cover defaults and errors. Standard OFC rules are shown as fixed rather than misleadingly configurable.               |
| R4          | **Complete.** Deterministic engine tests cover the standard 52-card lifecycle, evaluation, legality, fouls, 1–6 scoring, every royalty, Fantasyland, showdown, multi-hand totals, and dealer rotation; runner/view integration covers playable presentation.                     |
| R5          | **Complete.** Generated engine games, provider capacity contracts, AI simulations, runner tests, and view-layout tests cover two, three, and four players. Real-service evidence is limited to two players and is not presented as broader proof.                                |
| R6          | **Complete.** Provider-factory tests prove Local AI does not dynamically load Playroom, construct WebSockets, or call `fetch`; it uses only `LocalDataProvider`.                                                                                                                 |
| R7          | **Complete.** AI presets and injected strategy parameters, random sources, and delays have deterministic decision and simulation coverage.                                                                                                                                       |
| R8          | **Complete.** Providers deep-copy settings, expose no settings-update operation, and retain the same configuration across hands; form and join views present settings read-only.                                                                                                 |
| R9          | **Complete for the desktop release target.** The React Three Fiber table, two-to-four-seat layout, keyboard-equivalent DOM surface, reduced-motion behavior, and WebGL fallback have component/layout coverage and desktop visual review. Mobile remains a documented follow-up. |
| R10         | **Complete.** All four workspaces enforce unit/integration suites and package-specific V8 coverage thresholds through the root coverage command.                                                                                                                                 |
| R11         | **Open.** Playwright covers production loading, repository-base routing, form validation, malformed joins, and local placement, but does not yet automate every complete player journey.                                                                                         |
| R12         | **Complete.** The in-memory provider passes the reusable provider contract and has no browser, network, credential, or Playroom dependency.                                                                                                                                      |
| R13         | **Open.** The Pages workflow validates, builds, uploads, and deploys with least-privilege jobs, but a successful public deployment has not been observed. Configure Pages for GitHub Actions and push `main`.                                                                    |

Detailed test locations and OFC rule mappings are maintained in
[`docs/test-traceability.md`](./test-traceability.md). A checked item above means
its acceptance evidence exists; workflow configuration alone is not treated as
proof of a public deployment.
