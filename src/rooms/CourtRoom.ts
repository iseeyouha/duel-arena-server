import { Room, Client, CloseCode, definePlugins, ServerError, type AuthContext } from "colyseus";
import { IdleKickPlugin } from "colyseus/plugins/idle-kick";
import { StateView } from "@colyseus/schema";

import { SPAWN } from "../court/lobbyMap.js";
import { LOOKS } from "../court/looks.js";
import { findPath, nextTo, pathNextTo, randomFree } from "../court/navGrid.js";
import type { Point } from "../court/point.js";
import { TAUNTS } from "../court/taunts.js";
import { RUN_TILES, stepRoute, WALK_TILES } from "../court/walkPath.js";
import { TICK } from "../duel/config.js";
import { NO_RULES } from "../duel/rules.js";
import { Balances } from "../duels/Balances.js";
import { Challenges, type Request, type Terms } from "../duels/Challenges.js";
import { DuelTable, type TableDuel } from "../duels/DuelTable.js";
import { CourtState } from "./schema/CourtState.js";
import { Person } from "./schema/Person.js";
import { syncDuels } from "./syncDuels.js";

/** Milliseconds between steps of the court; the same as the default patch rate. */
const STEP_MS = 50;
/** The longest step taken after a stall, in seconds: shorter than a tick, so nobody takes a run of ticks at once. */
const MAX_STEP = 0.25;
/** Each `walkTo` runs A*, so a client gets this many orders a second (gestures included) and the rest are dropped. */
const ORDERS_PER_SECOND = 10;
/** Where the two come back to the court once a duel is over: in front of the statue, two tiles apart, as in the game. */
const BACK_FROM_ARENA = {
  self: { x: -1, z: 1, heading: 0.3 },
  rival: { x: 1, z: 1, heading: -Math.PI / 2 },
};
/**
 * Everybody's demo money, by auth user id: one for the whole server, so it is theirs in every court
 * and outlives any one room.
 */
const BALANCES = new Balances();
/** How far around the spawn point people come in, and how far apart they try to stand. */
const SPAWN_SPREAD = 1.5;
const SPAWN_GAP = 0.7;

const isPoint = (message: unknown): message is Point =>
  typeof message === "object" && message !== null &&
  Number.isFinite((message as Point).x) && Number.isFinite((message as Point).z);

// What a challenge brings, if it is well formed: the four rules as booleans and a whole stake.
function termsOf(message: unknown): Terms | null {
  const { rules, stake } = (message ?? {}) as { rules?: Record<string, unknown>; stake?: unknown };
  if (typeof rules !== "object" || rules === null || !Number.isInteger(stake) || (stake as number) < 0) { return null; }
  const ids = Object.keys(NO_RULES) as (keyof typeof NO_RULES)[];
  if (!ids.every((id) => typeof rules[id] === "boolean")) { return null; }
  return { rules: Object.fromEntries(ids.map((id) => [id, rules[id]])) as Terms["rules"], stake: stake as number };
}

/**
 * The court in front of the arena gate, where people walk about. Clients only ask to go somewhere;
 * the server plans the route with the game's own pathfinder and walks everybody along theirs, tile
 * by tile on the game's tick: one a tick walking, two running.
 */
export class CourtRoom extends Room<{ state: CourtState }> {
  maxClients = 100;
  state = new CourtState();

  /**
   * Disconnects clients that have sent nothing for 260 s; the SDK's pings count. As a leave: under
   * its default code it is a drop, and `onDrop` would hold the seat — the body standing in the court
   * — for a reconnection the kicked client never tries. The close says `idle`, so the game can tell
   * it from leaving.
   */
  plugins = definePlugins({
    idle: new IdleKickPlugin({ timeoutMs: 260_000, closeCode: CloseCode.CONSENTED, reason: "idle" }),
  });

  /** Server-only: the tiles each person still has to walk, nearest first. */
  private routes = new Map<string, Point[]>();
  /** Server-only: seconds into the current walking tick. */
  private walkClock = 0;
  /** Server-only: when each client's recent `walkTo`s were accepted. */
  private orders = new Map<string, number[]>();
  private joined = 0;
  /** Server-only: each session's auth user id, which their balance is kept by. */
  private users = new Map<string, string>();
  balances = BALANCES;
  /** Every offer and duel in the court. */
  table = new DuelTable(this.balances);
  /** Server-only: requests waiting for an answer, and challengers walking up to who they challenged. */
  private challenges = new Challenges();
  private approaches = new Map<string, { target: string; terms: Terms }>();
  /** Every roll of every duel. Swappable so a test can fight a known duel. */
  random: () => number = Math.random;

  messages = {
    walkTo: (client: Client, message: unknown) => {
      const person = this.state.people.get(client.sessionId);
      if (!person || !isPoint(message) || this.table.seatOf(client.sessionId) || !this.takeOrder(client.sessionId)) { return; }
      this.routes.set(client.sessionId, findPath(person, message));
      // A step ends a gesture, and calls off a challenge still walking up.
      person.emote = "";
      this.approaches.delete(client.sessionId);
    },

    // Walks you up to them; the request is put to them when you get there. If they have already
    // challenged you, that is an answer, and the offer opens on their terms.
    challenge: (client: Client, message: { id: string; rules: Terms["rules"]; stake: number }) => {
      const me = client.sessionId;
      const person = this.state.people.get(me);
      const id = (message as { id?: unknown } | null)?.id;
      const terms = termsOf(message);
      if (!person || typeof id !== "string" || id === me || !terms || !this.takeOrder(me)) { return; }
      if (!this.state.people.has(id) || this.table.seatOf(me)) { return; }
      // Nobody duels themselves, from another tab either; told, or the click just does nothing.
      if (this.users.get(id) === this.users.get(me)) {
        client.send("yourself", { id });
        return;
      }
      if (this.table.seatOf(id)) {
        client.send("busy", { id });
        return;
      }
      const waiting = this.challenges.find(id, me);
      if (waiting) {
        this.openOffer(waiting);
        return;
      }
      person.emote = "";
      this.approaches.set(me, { target: id, terms });
    },

    answer: (client: Client, message: { from: string; yes: boolean }) => {
      const { from, yes } = (message ?? {}) as { from?: unknown; yes?: unknown };
      if (typeof from !== "string" || typeof yes !== "boolean") { return; }
      const request = this.challenges.take(from, client.sessionId);
      if (!request) { return; }
      if (!yes) { this.sendTo(from, "declined", { by: client.sessionId }); return; }
      if (this.table.seatOf(from) || this.table.seatOf(client.sessionId)) {
        client.send("busy", { id: from });
        return;
      }
      this.openOffer(request);
    },

    // As in the game, you stop where you are to make a gesture. At a duel it is the ring's, made on
    // your side of it.
    emote: (client: Client, message: unknown) => {
      const person = this.state.people.get(client.sessionId);
      const id = (message as { id?: unknown } | null)?.id;
      if (!person || typeof id !== "string" || !this.takeOrder(client.sessionId)) { return; }
      if (this.table.seatOf(client.sessionId)) {
        this.table.gesture(client.sessionId, id);
        return;
      }
      if (!TAUNTS.includes(id)) { return; }
      this.routes.set(client.sessionId, []);
      person.emote = id;
      person.emoteCount += 1;
    },

    setRule: (client: Client, message: { id: string; on: boolean }) => {
      const { id, on } = (message ?? {}) as { id?: unknown; on?: unknown };
      if (typeof id !== "string" || typeof on !== "boolean" || !this.takeOrder(client.sessionId)) { return; }
      this.table.setRule(client.sessionId, id as keyof typeof NO_RULES, on);
    },

    setStake: (client: Client, message: { cents: number }) => {
      if (!this.takeOrder(client.sessionId)) { return; }
      this.table.setStake(client.sessionId, (message as { cents?: unknown } | null)?.cents);
    },

    accept: (client: Client, message: { revision: number }) => {
      if (!this.takeOrder(client.sessionId)) { return; }
      const news = this.table.accept(client.sessionId, this.random, (message as { revision?: unknown } | null)?.revision);
      if (news?.type === "started") { this.started(news.duel); }
      if (news?.type === "full") { for (const seat of Object.values(news.duel.seats)) this.sendTo(seat.id, "arenaFull", {}); }
    },

    // Told to whoever declines as well: until it is, the client can't know it wasn't too late.
    decline: (client: Client) => {
      if (!this.takeOrder(client.sessionId)) { return; }
      if (this.declineOffer(client.sessionId)) { client.send("declined", { by: client.sessionId }); }
    },

    eat: (client: Client) => {
      if (!this.takeOrder(client.sessionId)) { return; }
      this.table.eat(client.sessionId);
    },

    // An ask sent too fast is refused but still answered, or the client would wait on it for good.
    spec: (client: Client, message: { on: boolean; ask: number }) => {
      const { on, ask } = (message ?? {}) as { on?: unknown; ask?: unknown };
      this.table.spec(client.sessionId, this.takeOrder(client.sessionId) ? on : undefined, ask);
    },

    // Asked for once the client is listening, rather than sent on joining, when it could arrive first.
    balance: (client: Client) => this.tellBalance(client),

    refill: (client: Client) => {
      if (this.balances.refill(client.auth.userId)) { this.tellBalance(client); }
    },

    run: (client: Client, message: unknown) => {
      const person = this.state.people.get(client.sessionId);
      const on = (message as { on?: unknown } | null)?.on;
      if (!person || typeof on !== "boolean") { return; }
      person.running = on;
    },
  };

  onCreate() {
    this.setTimestep((deltaTime) => this.update(Math.min(deltaTime / 1000, MAX_STEP)), STEP_MS);
  }

  onJoin(client: Client) {
    this.users.set(client.sessionId, client.auth.userId);
    // What only this client may be sent — the money of a duel it sits at — is added to its view.
    // Colyseus carries the view over a reconnection.
    client.view = new StateView();
    const look = LOOKS[this.joined % LOOKS.length];
    this.joined += 1;
    const spot = this.freeSpot();
    this.state.people.set(client.sessionId, new Person({
      name: `Player ${this.joined}`,
      look,
      x: spot.x,
      z: spot.z,
      heading: Math.PI,
    }));
    this.routes.set(client.sessionId, []);
  }

  // An offer is declined by whoever leaves it. A duel is not: it is fought to the end without them,
  // and paid into their balance all the same.
  onLeave(client: Client, code: CloseCode) {
    this.forgetChallenges(client.sessionId);
    this.declineOffer(client.sessionId);
    this.state.people.delete(client.sessionId);
    this.routes.delete(client.sessionId);
    this.orders.delete(client.sessionId);
  }

  /**
   * Called on any disconnection the client did not ask for. The seat is held so the SDK can retry
   * into the same session; meanwhile the person finishes the walk they were on.
   */
  // Back after a drop: whatever the balance did meanwhile was told to nobody.
  onReconnect(client: Client) {
    this.tellBalance(client);
  }

  onDrop(client: Client, code: CloseCode) {
    // Requests are not state: a dropped connection loses its own, and nobody waits on it. Nor does
    // an offer: nothing has been staked yet.
    this.forgetChallenges(client.sessionId);
    this.declineOffer(client.sessionId);
    // Not awaited: the framework routes the outcome to onReconnect() or onLeave(). The catch is for
    // the rejection when the room is already disposing.
    this.allowReconnection(client, 30).catch(() => {});
  }

  /** @param dt seconds since the previous step. */
  update(dt: number) {
    this.walkClock += dt;
    while (this.walkClock >= TICK) {
      this.walkClock -= TICK;
      this.walkTick();
    }
    for (const request of this.challenges.expire(Date.now())) this.sendTo(request.to, "requestEnded", { from: request.from });
    for (const news of this.table.step(dt, this.random)) {
      if (news.type === "settled") { this.tellBalances(news.duel); }
      if (news.type === "ended") { this.backFromArena(news.duel); }
    }
    // A duel is fought to its end and paid even when both fighters have gone: the court stays open
    // for it, and closes itself once it is empty and nothing is left on the table.
    this.autoDispose = this.table.duels.size === 0;
    syncDuels(this.state, this.table, (id) => this.clients.getById(id)?.view);
  }

  /** One game tick of the court: the challengers on their way first, then everybody's steps. */
  private walkTick() {
    this.walkUp();
    for (const [id, person] of this.state.people) {
      const route = this.routes.get(id);
      if (!route || route.length === 0) { continue; }
      // `stepRoute` moves a plain body; the schema is only written with where it ended up, facing
      // the way its last step went.
      const body = { tile: { x: person.x, z: person.z }, route };
      const stepped = stepRoute(body, person.running ? RUN_TILES : WALK_TILES);
      const from = stepped.length > 1 ? stepped[stepped.length - 2] : { x: person.x, z: person.z };
      person.heading = Math.atan2(body.tile.x - from.x, body.tile.z - from.z);
      person.x = body.tile.x;
      person.z = body.tile.z;
    }
  }

  // Every challenger still on the way: stopped beside who they challenged, facing them, and the
  // request delivered; or, since that person may have moved, the way to them planned again, every
  // tick, as a follow is in the game. Two walking up to each other would step onto the same tile
  // every tick for good, so whoever asked second waits for the other to arrive.
  private walkUp() {
    const walking = new Set<string>();
    for (const [id, approach] of this.approaches) {
      const me = this.state.people.get(id);
      const target = this.state.people.get(approach.target);
      if (!me || !target) {
        this.approaches.delete(id);
        this.routes.set(id, []);
        continue;
      }
      if (this.table.seatOf(approach.target)) {
        this.approaches.delete(id);
        this.routes.set(id, []);
        this.sendTo(id, "busy", { id: approach.target });
        continue;
      }
      if (nextTo(me, target)) {
        this.approaches.delete(id);
        this.routes.set(id, []);
        me.heading = Math.atan2(target.x - me.x, target.z - me.z);
        this.deliver(id, approach.target, approach.terms);
        continue;
      }
      if (walking.has(approach.target) && this.approaches.get(approach.target)?.target === id) {
        this.routes.set(id, []);
        continue;
      }
      walking.add(id);
      this.routes.set(id, pathNextTo(me, target));
    }
  }

  private deliver(from: string, to: string, terms: Terms) {
    const waiting = this.challenges.find(to, from);
    if (waiting) {
      this.openOffer(waiting);
      return;
    }
    const replaced = this.challenges.request(from, to, terms, Date.now());
    if (replaced) { this.sendTo(replaced.to, "requestEnded", { from }); }
    this.sendTo(to, "challenged", { from });
    this.sendTo(from, "requested", { to });
  }

  // The offer, on the challenger's terms. Both stop where they are, and every other request to or
  // from either of them goes, each other side told.
  private openOffer(request: Request) {
    // Still waiting when it was answered by a challenge back: its toast goes too.
    if (this.challenges.take(request.from, request.to)) { this.sendTo(request.to, "requestEnded", { from: request.from }); }
    const seat = (id: string) => ({
      id,
      user: this.users.get(id) ?? id,
      name: this.state.people.get(id)?.name ?? "",
      look: this.state.people.get(id)?.look ?? "",
    });
    this.table.open(seat(request.from), seat(request.to), request.terms.rules, request.terms.stake);
    for (const id of [request.from, request.to]) {
      this.routes.set(id, []);
      this.approaches.delete(id);
      const person = this.state.people.get(id);
      if (person) { person.emote = ""; }
      for (const dropped of this.challenges.dropAll(id)) this.tellDropped(dropped, id);
    }
  }

  // The stakes are taken: both stop where they are and are told what they have left.
  private started(duel: TableDuel) {
    for (const seat of Object.values(duel.seats)) this.routes.set(seat.id, []);
    this.tellBalances(duel);
  }

  private backFromArena(duel: TableDuel) {
    for (const side of ["self", "rival"] as const) {
      const person = this.state.people.get(duel.seats[side].id);
      if (!person) { continue; }
      const spot = BACK_FROM_ARENA[side];
      person.x = spot.x;
      person.z = spot.z;
      person.heading = spot.heading;
      person.emote = "";
      this.routes.set(duel.seats[side].id, []);
    }
  }

  private declineOffer(id: string) {
    const declined = this.table.decline(id);
    if (!declined) { return false; }
    const other = declined.seats.self.id === id ? declined.seats.rival.id : declined.seats.self.id;
    this.sendTo(other, "declined", { by: id });
    return true;
  }

  // To every tab of each of them, not only the one at the duel: a reload is a new session.
  private tellBalances(duel: TableDuel) {
    const users = new Set(Object.values(duel.seats).map((seat) => seat.user));
    for (const client of this.clients) {
      if (users.has(client.auth?.userId)) { this.tellBalance(client); }
    }
  }

  private forgetChallenges(id: string) {
    this.approaches.delete(id);
    for (const dropped of this.challenges.dropAll(id)) this.tellDropped(dropped, id);
  }

  // A request that went because of `gone`: whoever was challenged loses the toast, and a challenger
  // whose target went hears they are busy.
  private tellDropped(request: Request, gone: string) {
    this.sendTo(request.to, "requestEnded", { from: request.from });
    if (request.to === gone) { this.sendTo(request.from, "busy", { id: gone }); }
  }

  private sendTo(sessionId: string, type: string, message: unknown) {
    this.clients.getById(sessionId)?.send(type, message);
  }

  private tellBalance(client: Client) {
    client.send("balance", { cents: this.balances.of(client.auth.userId) });
  }

  private takeOrder(id: string) {
    const now = Date.now();
    const recent = (this.orders.get(id) ?? []).filter((at) => now - at < 1000);
    const allowed = recent.length < ORDERS_PER_SECOND;
    if (allowed) { recent.push(now); }
    this.orders.set(id, recent);
    return allowed;
  }

  /** Somewhere free near the spawn point, clear of everybody already standing there if it can be. */
  private freeSpot(): Point {
    let best: Point = SPAWN;
    for (let tries = 0; tries < 12; tries++) {
      const spot = randomFree(SPAWN, SPAWN_SPREAD, Math.random);
      if (!spot) { continue; }
      best = spot;
      const clear = [...this.state.people.values()].every((other) => Math.hypot(other.x - spot.x, other.z - spot.z) >= SPAWN_GAP);
      if (clear) { break; }
    }
    return best;
  }

  /**
   * Runs at matchmaking time, before a seat is taken. Throwing rejects the join; the return value
   * becomes `client.auth`.
   */
  static async onAuth(token: string, options: any, context: AuthContext) {
    if (!token) {
      throw new ServerError(401, "missing auth token");
    }

    // TODO: verify the VOID Platform's token. Until then any token is taken as the user id.
    return { userId: token };
  }
}
