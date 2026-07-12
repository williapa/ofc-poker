# PlayroomKit

PlayroomKit is a library / service for building multiplayer games. I have selected it for this project because

- its limitation for free tier (10 daily users) is acceptable for this project.
- i want an approach that doesn't require authentication.
- creating a private lobby to join via link is my desired approach for this game.

While playroom's free tier support aligns well with my project requirements, support is subject to change and often does.

## Installed SDK contract

The data-provider workspace pins `playroomkit` compatible with version 0.0.97.
Its shipped TypeScript declarations were verified during Prompt 8. The adapter
uses `insertCoin` with a public `gameId`, `roomCode`, `skipLobby`, room capacity,
and reconnect grace period; `myPlayer().id` for provider-trusted transport
identity; `getRoomCode` for shareable lobby IDs; cleanup-returning
`RPC.register`, `onPlayerJoin`, and `onDisconnect`; and `PlayerState.onQuit` and
`leaveRoom` for lifecycle cleanup.

RPC callbacks include the sending `PlayerState`. The adapter derives action
sender/seat identity from that argument and never trusts identity fields in the
RPC payload. Automatic Playroom host transfer is not used because this project
closes a lobby when its original authoritative host leaves.

The Playroom project/game ID is public client configuration, not a secret.
Private account credentials must never be stored in the client or repository.
