import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function deploymentBase(value: string | undefined): string {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  // GitHub repository pages are served from /<repository>/. Local builds use /.
  base: deploymentBase(process.env.VITE_BASE_PATH),
  plugins: [
    react(),
    ...(process.env.VITE_E2E === "true" ? [e2eTransport()] : []),
  ],
  build: {
    // Three.js and the lazy Playroom adapter are intentionally separate large
    // boundaries. Keep a regression budget just above their current output.
    chunkSizeWarningLimit: 1100,
  },
});

function e2eTransport(): Plugin {
  type Player = { id: string; displayName: string };
  type Session = { id: string; player: Player; room: Room; events: unknown[] };
  type Room = { code: string; maxPlayers: number; sessions: Session[] };
  const rooms = new Map<string, Room>();
  const sessions = new Map<string, Session>();
  let sequence = 0;
  const body = async (request: import("node:http").IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<
      string,
      unknown
    >;
  };
  return {
    name: "ofcpoker-e2e-transport",
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://local");
        const marker = "/__e2e/";
        const offset = url.pathname.indexOf(marker);
        if (offset < 0) return next();
        const operation = url.pathname.slice(offset + marker.length);
        response.setHeader("content-type", "application/json");
        try {
          if (operation === "connect") {
            const input = await body(request);
            const requested =
              typeof input.roomCode === "string" ? input.roomCode : undefined;
            let room = requested ? rooms.get(requested) : undefined;
            if (requested && !room) throw new Error("ROOM_NOT_FOUND");
            if (!room) {
              room = {
                code: `E2E-${++sequence}`,
                maxPlayers: Number(input.maxPlayers),
                sessions: [],
              };
              rooms.set(room.code, room);
            }
            if (room.sessions.length >= room.maxPlayers)
              throw new Error("ROOM_LIMIT_EXCEEDED");
            const player = {
              id: `player-${++sequence}`,
              displayName: String(input.displayName),
            };
            const session: Session = {
              id: `session-${sequence}`,
              player,
              room,
              events: [],
            };
            for (const member of room.sessions)
              member.events.push({ type: "join", player });
            room.sessions.push(session);
            sessions.set(session.id, session);
            response.end(
              JSON.stringify({
                sessionId: session.id,
                roomCode: room.code,
                self: player,
                host: room.sessions[0] === session,
                participants: room.sessions.map(({ player }) => player),
              }),
            );
            return;
          }
          if (operation === "poll") {
            const session = sessions.get(
              url.searchParams.get("sessionId") ?? "",
            );
            if (!session) throw new Error("SESSION_MISSING");
            const events = session.events.splice(0);
            response.end(JSON.stringify({ events }));
            return;
          }
          const input = await body(request);
          const session = sessions.get(String(input.sessionId));
          if (!session) throw new Error("SESSION_MISSING");
          if (operation === "send") {
            const targets =
              input.target === "host"
                ? session.room.sessions.slice(0, 1)
                : session.room.sessions;
            for (const target of targets)
              target.events.push({
                type: "message",
                message: { payload: input.payload, sender: session.player },
              });
          } else if (operation === "leave") {
            session.room.sessions = session.room.sessions.filter(
              ({ id }) => id !== session.id,
            );
            sessions.delete(session.id);
            for (const member of session.room.sessions)
              member.events.push({ type: "quit", player: session.player });
            if (session.room.sessions.length === 0)
              rooms.delete(session.room.code);
          }
          response.end(JSON.stringify({ ok: true }));
        } catch (error) {
          response.statusCode = 400;
          response.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}
