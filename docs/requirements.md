# Requirements

When the requirements are met the project is done.

1. [x] client browser application (static app available via url)
2. [x] create a lobby via shareable link
3. [x] user configures default game settings via form before creating lobby
4. [x] lobby hosts a game of Open Face Chinese (OFC) Poker (see "./reference/open-face-chinese-poker-rules-engine-spec.md");
5. [x] 2 to 4 players supported in any lobby
6. [x] "AI lobby" option which can be used as a local-play option that does NOT engage the multiplayer service
7. [x] internally configurable AI players (so you can customize AI player strength & style easily)
8. [x] rules stay fixed for a lobby (to reconfigure game, create a new lobby)
9. [x] game view is a minimal, 3D UI of the card game
10. [x] unit tests for all features
11. [x] end to end tests with playwright for features
12. [x] support a local version of data-provider for testing & development that does not spend service quotas.
13. [x] app deploys via github actions as a github repository page

## Release audit evidence (updated 2026-07-17)

| Requirement | Status and verification evidence                                                                                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1          | **Complete.** A static version of the browser application with multiplayer disabled was deployed publicly through GitHub Pages before the multiplayer-enabled release was staged.                                                                                                                                                           |
| R2          | **Complete.** Create/join/invite and repository-safe `?lobby=` links have component, provider-contract, and browser coverage. A two-player real Playroom create/join/basic-gameplay smoke test passed manually on 2026-07-13.                                                                                                               |
| R3          | **Complete.** The accessible pre-lobby form validates display name, mode, and two-to-four seat count before provider creation; component and browser tests cover defaults and errors. Standard OFC rules are shown as fixed rather than misleadingly configurable.                                                                          |
| R4          | **Complete.** Deterministic engine tests cover the standard 52-card lifecycle, evaluation, legality, fouls, 1–6 scoring, every royalty, Fantasyland, showdown, multi-hand totals, and dealer rotation; runner/view integration covers playable presentation.                                                                                |
| R5          | **Complete.** Generated engine games, provider capacity contracts, AI simulations, runner tests, and view-layout tests cover two, three, and four players. Real-service evidence is limited to two players and is not presented as broader proof.                                                                                           |
| R6          | **Complete.** Provider-factory tests prove Local AI does not dynamically load Playroom, construct WebSockets, or call `fetch`; it uses only `LocalDataProvider`.                                                                                                                                                                            |
| R7          | **Complete.** AI presets and injected strategy parameters, random sources, and delays have deterministic decision and simulation coverage.                                                                                                                                                                                                  |
| R8          | **Complete.** Providers deep-copy settings, expose no settings-update operation, and retain the same configuration across hands; form and join views present settings read-only.                                                                                                                                                            |
| R9          | **Complete for the desktop release target.** The React Three Fiber table, two-to-four-seat layout, keyboard-equivalent DOM surface, reduced-motion behavior, and WebGL fallback have component/layout coverage and desktop visual review. Mobile remains a documented follow-up.                                                            |
| R10         | **Complete.** All four workspaces enforce unit/integration suites and package-specific V8 coverage thresholds through the root coverage command.                                                                                                                                                                                            |
| R11         | **Complete.** Production-build Playwright journeys cover validation, complete deterministic Local AI play through the next hand, isolated multi-context multiplayer through showdown, fixed settings, two-to-four-seat capacity/full rooms, invalid and missing links, host-refresh policy, and WebGL fallback without contacting Playroom. |
| R12         | **Complete.** The in-memory provider passes the reusable provider contract and has no browser, network, credential, or Playroom dependency.                                                                                                                                                                                                 |
| R13         | **Complete.** The GitHub Actions Pages workflow successfully deployed the earlier static, multiplayer-disabled release as a GitHub repository page. The multiplayer-enabled release is a subsequent configuration update, not a prerequisite for this deployment requirement.                                                               |

Detailed test locations and OFC rule mappings are maintained in
[`docs/test-traceability.md`](./test-traceability.md). A checked item above means
its acceptance evidence exists; workflow configuration alone is not treated as
proof of a public deployment.
