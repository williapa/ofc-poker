# Data provider

`@ofcpoker/data-provider` is the rules-neutral lobby and message boundary. It
transports opaque JSON actions, validation results, snapshots, and events; it
does not import or interpret the OFC engine.

## Contract

The provider assigns trusted participant IDs. Callers supply only a display
name. Lobby creation makes a deep immutable copy of settings, and there is no
settings-update operation. A connection can submit action requests, while only
the host connection can publish validation results, authoritative updates, or
activate a lobby.

Subscriptions immediately receive current lobby metadata and the latest
authoritative update, when one exists. Delivery is idempotent by action request
ID and authoritative event ID. Unsubscribing, connection disposal, and provider
disposal are safe to repeat.

Disconnect reserves a peer's seat and reconnect token. A reconnect restores
the same trusted identity and replays current metadata and state. Permanent
leave releases a peer seat. Host disconnect, leave, or disposal closes the
lobby; there is no host migration. Activation is one-way and rejects new joins,
while reserved participants may still reconnect.

## Local provider

`LocalDataProvider` keeps all state in one process and has no browser, network,
Playroom, or credential dependency. One instance represents the shared local
transport for two to four simulated clients.

```ts
import { LocalDataProvider } from "@ofcpoker/data-provider";

const provider = new LocalDataProvider({
  idFactory: (kind) => `test-${kind}-${nextId()}`,
  latencyMs: 5,
});

const host = await provider.createLobby(settings, { displayName: "Host" });
const peer = await provider.joinLobby(host.lobby.id, { displayName: "Peer" });
```

Tests can inject deterministic IDs, fixed or per-operation latency, and a
`beforeOperation` hook that records or rejects operations. The reusable adapter
contract is defined in `tests/contract.ts`; future adapters should instantiate
the same suite with their provider factory.
