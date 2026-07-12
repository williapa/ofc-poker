# System Architecture

## Runtime

OFC Poker is a React + Vite single-page browser application with a React Three Fiber game-view adapter. It is built to static files and hosted as a GitHub repository page. There is no application server. Multiplayer uses a Playroom adapter; local development, tests, and AI lobbies use the in-memory provider and spend no Playroom quota.

Browser host authority is suitable for a casual game but is not server-grade anti-cheat. Peers treat only the host's published snapshots/events as authoritative.

## Multiplayer authority protocol

1. Lobby creation fixes settings and capacity. The provider assigns the creator as host and supplies trusted participant IDs.
2. A peer submits a versioned action request with a unique request ID and expected authoritative revision. Player identity comes from the provider connection, never from an untrusted action payload.
3. Only the host runner converts the trusted sender into an engine action and validates it with the deterministic engine.
4. On acceptance, the host publishes the resulting snapshot/events with monotonic revision, unique event IDs, and the causing request ID. On rejection, it sends a typed rejection to the requester and publishes no state change.
5. Every client ignores an already-seen event ID, ignores an older revision, and requests/uses the latest snapshot when it detects a revision gap. Applying the same update twice is idempotent.

The provider enforces that only its current host connection may publish authoritative updates. The engine remains the source of truth for game legality; the provider is the source of truth for room membership and sender identity.

## Lifecycle policies

| Condition                                                      | Required behavior                                                                                                                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid, malformed, stale, unauthorized, or out-of-turn action | Host rejects it without mutation or authoritative event publication; requester receives an actionable error.                                                                |
| Duplicate action request                                       | Host/provider return the prior outcome or ignore it; it is never applied twice.                                                                                             |
| Duplicate or out-of-order authoritative event                  | Client deduplicates by event ID/revision; a gap causes snapshot recovery.                                                                                                   |
| Peer disconnect                                                | Seat is reserved for that participant's reconnect token. The game pauses when their action is required. Presence shows disconnected.                                        |
| Peer reconnect                                                 | Provider restores the same trusted participant/seat and immediately sends the latest lobby metadata and authoritative snapshot.                                             |
| Host disconnect or departure                                   | Lobby closes and all peers return to a terminal `host-left` state. There is no host migration because a new browser cannot prove it has the complete authoritative history. |
| Lobby reaches configured capacity                              | Additional joins fail as `lobby-full`; reconnecting reserved participants are not counted as new joins.                                                                     |
| Join after game start                                          | New participants are rejected. Spectating is out of scope. A participant with a valid reserved reconnect token may restore their seat.                                      |
| Late join while waiting and below capacity                     | Join succeeds and receives fixed settings, current seats/presence, and latest waiting snapshot.                                                                             |
| Missing or closed lobby                                        | Join/reconnect fails with a distinct error suitable for the UI.                                                                                                             |

Reconnect tokens are capabilities and must not appear in share URLs, logs, or authoritative game events. Temporary room data may disappear after every client leaves; durable match storage is out of scope.

## Static URL policy

GitHub Pages cannot rewrite arbitrary paths such as `/ofcpoker/lobby/ABC` to `index.html`. Supported navigation therefore always targets the deployed `index.html` at the repository base and stores join state in its query string:

```text
https://<owner>.github.io/<repository>/?lobby=<encoded-id>
```

Optional non-sensitive fields may use additional query parameters; reconnect tokens must not. The client parses links with `URL`/`URLSearchParams`, validates the lobby ID, and uses `history.replaceState` only within the same base URL. It does not use path-based routing.

Vite uses relative build assets (`base: "./"`), so the same output works at `/` during local preview and beneath `/<repository>/` on Pages. Creating a share link starts from `document.baseURI` or the current page URL, removes unrelated query/hash state, and sets the encoded `lobby` parameter. Direct opening and refresh therefore request the real repository-page index rather than relying on a server rewrite.
