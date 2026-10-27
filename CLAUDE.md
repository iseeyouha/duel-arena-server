# duel-arena-server

The multiplayer server for Duel Arena: a Colyseus 0.18 server (TypeScript, Node 22+) that runs the
court, and later the duels, for people instead of bots. The game itself — the court and the arena in
3D, the HUD, the sound — is the client, in the sibling repo at
`../void-casino-games/src/games/duel-arena/`. Read its `CLAUDE.md` for what the game is and the
rules it keeps. This server exists because of the last of those rules: with real money and real
people, the rolls, the ticks and the accepts cannot live in the browser.

## Status

- **Walking the court together works.** People join the `court` room, walk wherever they click,
  switch between walking and running, make the taunt wheel's gestures, and everybody sees
  everybody. The game's side is `?game=duel-arena`, its default (`&mode=demo` is the bots, without this
  server; see the game's `CLAUDE.md`, "Multiplayer
  server").
- **Duels between people work.** A challenge walks you up to the other person and reaches them as
  a request (the game shows a toast); accepted, the offer opens for both and is shared; the second
  accept takes both stakes and the duel is the game's own, ticked and rolled here; it is paid on the
  tick that ends it and both come back to the court in front of the statue. The money is demo money,
  held here.
- **Every duel has a spot, and everybody sees every duel.** The game is one world: the court and a
  coliseum through its north gate, where each started duel is fought on a spot of its own (the first
  free of the game's fifty) and anybody on the gallery watches. Every duel's state goes to the whole
  room — its looks and names on it, so a fighter who has left is still drawn — but its money only to
  its two duellists.
- **A hundred people a court.** Load-tested with `pnpm loadtest`: a hundred clients duelling — some
  forty duels fought at once, the rest agreeing their next, every one of the fifty spots in turn — at
  about 3% of a core.
- Not yet: chat, the Platform's auth, balance and randomness, rejoining a duel after a reload, a
  rematch.
- Scaffolded with `create-colyseus-app` 0.18.1:

  ```sh
  pnpm create colyseus-app@latest duel-arena-server --ts --preset custom --layout server --netcode tick --matchmaking filterby,reconnection,idle-kick --auth onauth --database none --yes
  ```

- A git repository of its own (`main`), beside the game's; nothing here is pushed or deployed by the
  game's work.

## Layout

- `src/index.ts` — entry point, `listen(app)` from `@colyseus/tools`. Leave it alone: it is what
  Colyseus Cloud expects.
- `src/app.config.ts` — the rooms (`court: defineRoom(CourtRoom)`), HTTP routes and express
  middleware; outside production, the playground at `/` and the monitor at `/monitor`. It also boots
  `@colyseus/database` (Postgres at `DATABASE_URL`) and `@colyseus/admin`'s routes, added after the
  scaffold; what they are for is not written down yet.
- `src/court/` — the court as the server walks it, **its own copy of the game's**: `lobbyMap.ts`
  (walls, props and what blocks, the coliseum's gallery and passage, the sand nobody walks on),
  `navGrid.ts` (the tile grid and the pathfinder: one-metre tiles,
  eight ways round, diagonally first), `walkPath.ts` (a tile a tick walking, two running, and the
  drawing the server never uses) and `point.ts`, each the game's file of the same name with only its
  import paths changed (`walkPath` takes `TICK` from `src/duel/config.ts`); `looks.ts`, the roster ids
  a person's look is picked from; `taunts.ts`, the ids of the game's taunt wheel; and `arena.ts`,
  `SPOT_COUNT` (50, the length of the game's `ARENA_SPOTS`) and `firstFreeSpot`. Nothing here
  references the game repo.
- `src/duel/` — the duel, **its own copy of the game's**: `combat`, `combatTick`, `rules`, `weapons`,
  `settlement`, `squareUp`, `startDuel`, `stepDuel`, `bot`, `types`, `config` (the game's whole
  `config.ts`, rendering tunables included: it has no imports) and `payout` (the game's
  `src/money/payout.ts`), each changed only in its import paths, like the court's.
- `src/duels/` — the server's own: `Balances` (the demo money, by auth user id), `Challenges`
  (requests waiting for an answer), `DuelTable` (every offer and duel: the seats with their looks, the
  accepts, the spot handed out on the second, the stakes taken after it, the game's `stepDuel`, the
  pay-out) and `newDuel` (a not-yet-started game `Duel`; the game's `createDuel` reads its roster of
  bots).
- `src/rooms/CourtRoom.ts` — the court: joining, walking, running, gestures, challenges and walking
  up to them, the offer and the fight's messages, a 50 ms step that steps every duel and, every
  0.6 s of it, a walking tick that moves everybody a tile or two, leaving. Each client gets a
  `StateView` as it joins. `src/rooms/syncDuels.ts` writes the table into the state at the end of each
  step, and puts each duel in its two duellists' views as it opens (and takes it out as it goes).
  `src/rooms/schema/` — `CourtState` (people by session id, duels by id), `Person` (name, look,
  position, heading, running, the gesture being made with its count, the duel they are at and
  whether it has taken them to the arena), `DuelState` (an offer or a duel as every client draws it:
  the two seats, their names and looks, its spot, the rules, the accepts, the ticks and blows, the
  last exchange; its `stake`, `paidSelf` and `paidRival` are `.view()` fields, sent only to clients
  whose view holds the duel) and `DuelFighterState`, one schema per file.
- `test/` — `@colyseus/testing`: boots the real server and connects real clients.
- `loadtest/court.ts` — a hundred clients duelling (`pnpm loadtest`): each walks about now and then,
  pairs by its number (an even one challenges the next, the odd one says yes), accepts whatever offer
  it sits at, eats when low and asks again a few seconds after each duel; one logs the room by phase
  once a minute. In a terminal it runs under `@colyseus/loadtest`'s screen; piped, it joins the clients
  itself, since that screen never starts them without one.
- `ecosystem.config.cjs` — pm2, for Colyseus Cloud.
- `pnpm-workspace.yaml` — install settings pnpm 12 needs (see the pitfalls).

## Commands

- `pnpm install`
- `pnpm start` — watch mode on port 2567 (`PORT` overrides it). Playground at
  http://localhost:2567, monitor at http://localhost:2567/monitor.
- `pnpm test` — mocha over `test/**.test.ts`.
- `pnpm loadtest` — against `pnpm start`: a hundred clients duelling (above).
- `pnpm exec tsc -p . --noEmit` — type check, tests included.
- `pnpm build` — compiles to `build/`; `node build/index.js` runs it, with the same environment
  variables (`.env.development` / `.env.production`).

## Decisions taken

- **A server tick, no client prediction** (`setTimestep`). The game runs on OSRS ticks
  (`TICK = 0.6` s in the client's `game/config.ts`) and a click already waits up to a tick, so
  prediction has nothing to hide; and with money the client must never simulate an outcome. The
  court steps every 50 ms; walking is a tick of its own every 0.6 s on an accumulator, tile by tile
  as in the game (the client draws the steps between ticks), and each duel is one `combatTick`
  every 0.6 s on its own.
- **Clients send intent.** `walkTo { x, z }` (anything but two finite numbers is ignored; `findPath`
  ends a click inside an obstacle or outside the court at the nearest free point), `run { on }`,
  `emote { id }`, and for duels `challenge { id, rules, stake }`, `answer { from, yes }`,
  `setRule { id, on }`, `setStake { cents }`, `accept { revision }`, `decline`, `eat`,
  `spec { on, ask }`, plus `balance` (asked for) and `refill`. Each `walkTo` runs A*, so a client gets ten orders a second,
  gestures and duel messages included, and the rest are dropped — Colyseus's own
  `maxMessagesPerSecond` would disconnect a fast clicker instead. Somebody at an offer or a duel
  can't walk or challenge. Out go `challenged { from }` and `requestEnded { from }` to the
  challenged, `requested { to }`, `busy { id }` and `yourself { id }` (they challenged another
  session of their own) to the challenger, `declined { by }` to the
  challenger of a request turned down and to both sides of an offer declined — whoever declined
  too: only the server knows whether a decline beat the other side's accept, so the client says
  "You decline the duel" when it is told, not when it asks — and `balance { cents }` to its owner;
  everything else is in the state.
- **The duel lives in the court room**, not a room of its own: two people never change rooms, so
  their names, looks, balances and reconnection stay where they are, and "disappearing into the
  arena" is `Person.away`, which the clients read. The court's step steps every duel.
- **A spot before the stakes.** On the second accept the table hands the duel the first free spot (an
  index into the game's `ARENA_SPOTS`, -1 until then) and only then takes the stakes; a spot is free
  again `SPOT_REST` (2 s) after its duel is gone, while the game sinks its two through their portals,
  so the next pair never comes up under them. With every spot taken nothing is staked, both accepts are taken back
  and both seats are told `arenaFull {}` — the game says "The arena is full. Try again in a moment."
  The game draws each duel on its spot from `DuelState.spot`, the challenger on the spot's west mark.
- **Spectating is the state.** Every duel in the room is in every client's patches — the game draws
  them all on their spots in the coliseum for whoever watches from the gallery — with the seats'
  looks and names on the duel itself, so a fighter who has left mid-duel is still drawn. Only the
  money is private: `stake` and the payouts are `.view()` fields, and each client's `StateView`
  holds just the duels it sits at.
- **A challenge is walked, then asked.** The challenger is walked to a tile beside the other person's
  (one sharing a side with it, the route planned again every tick while they move); only then, on
  the tick after arriving, is the request put to them, for 20 s. Two people challenging each other
  would each step onto the tile beside the other every tick and never arrive, so whoever asked
  second waits where they are for the first (tested). A floor click on the way
  calls it off; a new challenge replaces the old request. Challenging somebody whose request to you
  is waiting answers it. The offer opens on the challenger's rules and stake (the game's offer
  picker, which holds the last offer's; the game has no rematch in the multiplayer court yet), both
  stop where they are, and every other request to or from either of them goes,
  each other side told (the challenged lose the toast, a challenger hears "busy"). Every change to
  the offer bumps its `revision`, and an accept names the revision it was made on: one sent on
  terms that changed in flight is refused.
- **The special's asks are numbered.** The client draws the duel 100 ms behind the server, so a
  second press of the special inside that window would read the old state and ask for the same
  thing twice. `spec { on, ask }` carries the client's count of its asks this duel; the table keeps
  each side's newest (`TableDuel.specAsks`, sent as `DuelFighterState.specAsk`) whether or not the
  ask was taken — one over the order limit included, or the client would wait on it for good — and
  the client shows what it asked for until the state it draws has answered its last ask.
- **The money is the server's, and private.** One `Balances` for the whole process keeps demo cents
  by auth user id (today the per-tab token, so a reload in the same tab keeps it), in memory: a
  person's money is the same in every court and outlives any room. The stakes are taken all or
  none, what each person owes added up first, and nobody can duel another session of their own —
  told so with `yourself`, not ignored. (The game gives a duplicated tab a token of its own, but
  with the Platform's auth every tab of an account will be the same user.) A client asks for its balance
  once it is listening — sent on joining, it could arrive before the handler — and again after a
  reconnect, and every tab of the user is told on every change a duel makes. Nobody else is ever told it, so the offer never caps the stake by the other side's
  balance: a stake you can't cover just can't be accepted by you.
- **Gestures are the game's rules for one.** `emote` takes only an id from the taunt wheel (the
  winner's celebrations belong to the ring), stops the person where they stand and sets `emote` on
  them, bumping `emoteCount` so the same gesture made again reads as a new one; their next accepted
  `walkTo` empties it. The server never ends a gesture on its own — it would need every clip's
  length — so `emote` stays set while they stand; the client ends it at its clip's end, and a tab
  that arrives takes the count it finds as already seen instead of replaying it.
- **Joining:** `Player N` counted per room, a look going round the roster by join order (the client
  maps it to a model with `lookOf`), a free spot near the court's `SPAWN` clear of anybody standing
  there, running on. `maxClients` is 100.
- **No `filterBy` until there is something to split courts by** (region, stake tier, currency). No
  lobby room either: a player lands in a court and finds people there.
- **Reconnection holds the seat, and a duel will never wait for it.** A dropped connection keeps its
  seat for 30 s and the person finishes the walk they were on. There is no forfeit, so a drop or a
  leave never ends a duel: the server keeps ticking, the absent fighter keeps attacking on their
  timer but neither eats nor arms a special, and the result is paid into their balance. The court
  turns `autoDispose` off while anything is on the table, so a duel both fighters left is still
  fought and paid, and closes itself once empty. A drop or a leave during an offer declines it
  (nothing was staked). The game leaves on `pagehide`, so a
  closed tab goes at once instead of standing in the court for the window.
- **The idle kick never touches money on the table.** `IdleKickPlugin` (260 s) clears the court of
  dead connections — any inbound frame counts, the SDK's pings included. A kick is a leave, and a
  leave can't cost anybody money: an offer, however accepted, has staked nothing yet and is only
  declined, and a duel is fought to the end and paid without them. It closes with
  `CloseCode.CONSENTED` and the reason `idle` (tested): under the plugin's default code (1000) the
  framework calls it a drop, and `onDrop` held the seat — the body standing in everybody's court —
  for 30 s, for a reconnection the kicked client never tries. The reason is how the game tells a
  kick from its own leave and shows why it is out; joining again is a new session for the same
  user, so the same balance.
- **Auth is the Platform's** (`onauth`, not the `@colyseus/auth` module's own accounts). Accounts,
  sessions, wagers and money belong to VOID Platform and Finance (see
  `../void-casino-games/docs/runtime-v2.md`). `onAuth` will verify the Platform's token, and what
  it returns becomes `client.auth`. Today it takes any token as the user id — a placeholder; the
  game sends one made per tab.
- **One game, one server.** The Platform gives every game its own runtime, credentials and sessions.
  Another multiplayer game gets its own server unless there is a real reason to share this one.
- **Decoupled from the game** (the user's call): a project of its own that references nothing in
  the game repo, built and deployed on its own. What both sides must agree on is a contract kept by
  hand — the court's map and walking (`src/court/`), the look and taunt ids, and the messages and
  schema the game's `game/net/` speaks.

## Rules (the game's, enforced here — don't break)

- **Clients send intent, never results.** Never a position, a hit, hitpoints or an outcome.
  Validate every message against the sender's own state (their duel, their phase, their balance).
- **The combat is the game's, unchanged.** It is the client's `combat.ts` and `combatTick.ts`: one
  tick, meals first, then the attack timers, then both attacks with the damage applied together.
  Both sides are equal; a rule binds both fighters; nothing anywhere reads a win chance.
- **The money rules hold.** Equal stakes; the stake is taken on the last accept, not the first; the
  duel is settled and paid on the tick that ends it; the winner gets the pot less the house cut, a
  draw returns each stake; integer cents, and `payout()` floors.
- **Synced state is public to the room.** Nothing that decides a future roll (a seed, a pre-rolled
  hit) goes into a schema. Every roll in the game takes its `random` as a parameter, so the server
  passes its own. What only the server needs (paths, click times) stays outside the schema.

## Open decisions and next steps

1. **The Platform:** the token in `onAuth`, the balance and the stakes reserved and settled through
   Finance instead of `Balances`, and where the rolls' randomness comes from instead of
   `Math.random` (the integrated games take outcomes through an `outcomeProvider`).
2. **Every duel's state goes to everybody**, by design now (spectating), at a hundred people and
   fifty duels; the money is already filtered by the views. A bigger court would filter by distance
   (who is near enough to see a duel) the same way.

## Known pitfalls

- **The court is kept in step by hand.** The game draws the court from its `lobbyMap.ts` and plans
  your marker with its `navGrid.ts`; this server walks people with its copies. Change a wall, a
  prop, a speed or the pathfinder in one and not the other, and people walk through something on
  one side and round it on the other. Each copy starts with a header naming its original, and
  differs from it only in import paths (`.js` here, `.ts` there), so
  `diff <(tail -n +4 src/court/navGrid.ts) ../void-casino-games/src/games/duel-arena/game/lobby/navGrid.ts`
  shows nothing but those lines. `test/navGrid.test.ts` and `test/walkPath.test.ts` are the game's
  tests for them, run here.
- **The duel is kept in step by hand too.** `src/duel/` is the game's duel, copied; change the
  combat, the rules, the money or the timings there and here together, or the server pays a fight
  the game drew differently. The same `diff <(tail -n +4 src/duel/<name>.ts)
  ../void-casino-games/src/games/duel-arena/game/<name>.ts` shows only import lines, and the game's
  `combat`, `combatTick`, `stepDuel` and `settlement` tests run here against the copies.
- **The arena's spots are named by index on both sides.** `SPOT_COUNT` here is the length of the
  game's `ARENA_SPOTS` (`game/arena/arenaSpots.ts`), which lists them nearest the middle first; change
  the game's spots and change the count here, or a duel is handed a spot the game doesn't have.
- **The config is the game's whole file.** `src/duel/config.ts` is the game's `config.ts` after the
  three-line header, visual tunables included (the detail and people tunables too):
  `diff <(tail -n +4 src/duel/config.ts) ../void-casino-games/src/games/duel-arena/game/config.ts`
  shows nothing.
- **A load test killed mid-way holds its seats.** Every client of a run stopped without leaving is a
  dropped connection, its seat held for the 30 s reconnection window; a run started inside that window
  lands partly in a second court.
- **The tests share one server.** `test/testServer.ts` boots it once for every file: a second
  `boot()` after a `shutdown()` in the same process fails to matchmake. Give each client its own
  `sdk.auth.token` when balances matter — the token is the user, and the user owns the balance.
- **A look or taunt id has to exist in the game.** `looks.ts` lists the game's roster ids; an id the
  client doesn't know is drawn in its first look. `taunts.ts` lists its wheel's (`TAUNTS` in
  `emotes.ts`); a gesture the client doesn't know is not made, and one missing here is refused.
- **Production needs `JWT_SECRET`** (the admin routes and `@colyseus/database` sign with it) — the
  server refuses to start without it — and `DATABASE_URL`, or the database falls back to a local
  SQLite file.
- **The room tests need the database too.** `.env.development` points `DATABASE_URL` at a local
  Postgres; without one up, every room test fails in its "before all" hook with `ECONNREFUSED
  127.0.0.1:5432`. `DATABASE_URL= pnpm test` runs them on the SQLite fallback (an empty variable
  isn't overridden by the env file).
- **pnpm 12 refuses the template's install as generated.** `colyseus` lists
  `@colyseus/uwebsockets-transport` as a peer, auto-installing peers pulls it in, and it fetches
  uWebSockets.js from GitHub, which `blockExoticSubdeps` rejects. `pnpm-workspace.yaml` removes it
  with an override (the server uses the default ws transport) and allows esbuild's build script,
  which `tsx` needs. A failed install leaves `node_modules` with only `.pnpm` in it, and
  `pnpm test` then says `mocha: not found`.
- **A step and the patch that carries it need not line up.** A test that waits for one patch after
  the server reached something can read the patch before; wait a few patches for what it expects.
