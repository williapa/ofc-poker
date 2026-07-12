# PlayroomKit for a Browser Multiplayer Card Game

## Overview

PlayroomKit is the fastest of the compared services for building a casual browser-based multiplayer card game.
It provides game-focused rooms, synchronized shared state, real-time RPCs, presence, room codes, links, and QR joining.
You do not need to provision or manage a dedicated WebSocket server.

## Core Use Cases

Private lobbies are built in: create a room and invite players with its shareable link or room code.
Player moves can be sent through RPCs or synchronized state and broadcast to every connected client.
A host-authoritative model can validate moves, update state, and publish the result to other players.
Because the host is still a browser client, this is weaker against cheating than a true server-authoritative backend.

## Persistence and Statistics

Normal room state is temporary and disappears after all players leave.
Persistent room storage is described as a Pro feature and is not the strongest foundation for long-term analytics.
Store matches, wins, losses, average scores, durations, and other statistics in Supabase or another database.
Build daily top-5 or top-10 leaderboards from those stored match-result records.

## Authentication and Limits

Authentication is not required for basic rooms; players can join using a nickname or lightweight profile.
Use external or anonymous authentication for durable identities, protected invitations, or cross-device statistics.
The free PlayroomKit tier is best for prototypes and is limited to 10 unique users per day.
The Lite tier starts at about $10 per month and includes 10,000 monthly active users before overage charges.

## Recommendation — Use PlayroomKit for live gameplay, paired with Supabase for auth, history, statistics, and leaderboards.
