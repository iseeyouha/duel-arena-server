# Welcome to Colyseus!

This project was created with [⚔️ `create-colyseus-app`](https://github.com/colyseus/create-colyseus-app/).

[Documentation](https://docs.colyseus.io/)

## :crossed_swords: Usage

```
npm start
```

Then open http://localhost:2567 for the playground, or /monitor for the monitor.

## Structure

- `src/index.ts`: entry point — leave it alone if you plan to deploy to Colyseus Cloud
- `src/app.config.ts`: server configuration — rooms, HTTP routes, express middleware
- `src/rooms/MyRoom.ts`: your room handler
- `src/rooms/schema/MyRoomState.ts`: the state synchronized to every client in the room
- `test/MyRoom.test.ts`: boots the real server and connects a real client
- `loadtest/example.ts`: scriptable client for `npm run loadtest`
- `ecosystem.config.cjs`: pm2 configuration, used when deploying to Colyseus Cloud

## Scripts

- `npm start`: run the server in watch mode (`tsx watch src/index.ts`)
- `npm test`: run the mocha test suite
- `npm run build`: compile to `build/`
- `npm run loadtest`: connect N simulated clients with [`@colyseus/loadtest`](https://github.com/colyseus/colyseus-loadtest/)

## What's included

### Server tick

`MyRoom` runs a game loop via `setTimestep()`, which fires on a wall-clock
interval and hands you the *measured* delta in milliseconds. Clients send
movement intent (`-1..1` per axis); the server integrates it and owns every
position.

`setTimestep` is the simple loop. If you later add client-side prediction, switch
to `setFixedTimestep()` — it advances a constant `dt` through an accumulator, and
only a constant `dt` replays deterministically on the client.

- https://docs.colyseus.io/room#game-loop

### filterBy

`.filterBy(["mode"])` on the room definition splits matchmaking by the `mode` join option, so
players asking for different modes never land in the same room.

- https://docs.colyseus.io/matchmaker

### Reconnection

`MyRoom.onDrop()` holds a dropped client's seat for 30 seconds via
`allowReconnection()`. The SDK retries automatically with exponential backoff;
`onReconnect()` fires if it gets back in time, `onLeave()` if it does not.

- https://docs.colyseus.io/room/reconnection

### Idle kick

`IdleKickPlugin` disconnects clients that have not sent a message in 60 seconds.
Any inbound frame — including the SDK's keepalive pings — counts as activity, so
raise `timeoutMs` rather than expecting it to detect an idle-but-connected tab.

- https://docs.colyseus.io/room/plugins

### Room authentication

`MyRoom.onAuth()` runs at matchmaking time, before a seat is consumed and before
`onJoin()`. Throw to reject the join; whatever you return becomes `client.auth`.

The static form is used here because it does not need a room instance. Replace
the placeholder verification with whatever issues your tokens — a call to your
API, or `JWT.verify()` from `@colyseus/auth` if this server issued them.

- https://docs.colyseus.io/auth/room
