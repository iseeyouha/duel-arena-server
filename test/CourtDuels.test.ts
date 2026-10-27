import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import { DuelTable } from "../src/duels/DuelTable.js";
import type { CourtRoom } from "../src/rooms/CourtRoom.js";
import { testServer } from "./testServer.js";

type Spot = { x: number; z: number };
type Inbox = { onMessage: (type: string, handler: (message: unknown) => void) => unknown };
type Walker = { sessionId: string; send: (type: "walkTo", message: Spot) => void };

const NONE = { noFood: false, noArmour: false, noWeapons: false, noSpec: false };
const distance = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);

// Steps the room's loop until `done` holds, failing after `maxSteps` (50 ms each).
async function until(room: CourtRoom, done: () => boolean, maxSteps = 200) {
  for (let step = 0; step < maxSteps; step++) {
    if (done()) return;
    await room.waitForNextTimestep();
  }
  assert.fail("never happened");
}

async function steps(room: CourtRoom, count: number) {
  for (let step = 0; step < count; step++) await room.waitForNextTimestep();
}

// Everything a client is sent of one type, as it arrives.
function inbox(client: Inbox, type: string) {
  const got: unknown[] = [];
  client.onMessage(type, (message) => got.push(message));
  return got;
}

// A roll that lands, then a damage roll near the top: every attack hits hard.
function alternate(a: number, b: number) {
  let next = a;
  return () => {
    const value = next;
    next = next === a ? b : a;
    return value;
  };
}

describe("duels in the court", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await testServer());
  // Balances outlive rooms, so every test has users of its own.
  let run = 0;
  const user = (n: number) => `user-${run}-${n}`;
  beforeEach(async () => {
    run += 1;
    await colyseus.cleanup();
  });

  // Each client its own user, so each has a balance of its own.
  async function join(room: CourtRoom, n: number) {
    colyseus.sdk.auth.token = user(n);
    const client = await colyseus.connectTo(room);
    for (const type of ["challenged", "requestEnded", "requested", "declined", "busy", "balance", "arenaFull"]) client.onMessage(type, () => {});
    return client;
  }

  async function walkAway(room: CourtRoom, client: Walker, to: Spot = { x: 3, z: 6 }) {
    client.send("walkTo", to);
    const person = room.state.people.get(client.sessionId);
    await until(room, () => distance(person, to) < 0.01);
  }

  // A challenges B, B accepts: the offer is open.
  async function challengeAndAnswer(room: CourtRoom) {
    const a = await join(room, 1);
    const b = await join(room, 2);
    const challenged = inbox(b, "challenged");
    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => challenged.length > 0);
    b.send("answer", { from: a.sessionId, yes: true });
    await until(room, () => room.state.duels.size === 1);
    const [duelId] = [...room.state.duels.keys()];
    return { a, b, duelId };
  }

  it("walks you up to who you challenged and puts the request in front of them", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    await walkAway(room, b);
    const challenged = inbox(b, "challenged");
    const requested = inbox(a, "requested");

    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => challenged.length > 0 && requested.length > 0);

    assert.deepStrictEqual(challenged[0], { from: a.sessionId });
    assert.deepStrictEqual(requested[0], { to: b.sessionId });
    const [one, other] = [room.state.people.get(a.sessionId), room.state.people.get(b.sessionId)];
    assert.strictEqual(Math.abs(one.x - other.x) + Math.abs(one.z - other.z), 1, "stopped on a tile beside them");
  });

  it("tells the challenger when the request is declined", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    const challenged = inbox(b, "challenged");
    const declined = inbox(a, "declined");
    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => challenged.length > 0);

    b.send("answer", { from: a.sessionId, yes: false });
    await until(room, () => declined.length > 0);

    assert.deepStrictEqual(declined[0], { by: b.sessionId });
    assert.strictEqual(room.state.duels.size, 0);
  });

  it("opens the offer for both on the challenger's terms when it is accepted", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b, duelId } = await challengeAndAnswer(room);

    const duel = room.state.duels.get(duelId);
    assert.strictEqual(duel.self, a.sessionId);
    assert.strictEqual(duel.rival, b.sessionId);
    assert.strictEqual(duel.stake, 1_000);
    assert.strictEqual(duel.phase, "offer");
    for (const client of [a, b]) {
      const person = room.state.people.get(client.sessionId);
      assert.strictEqual(person.duel, duelId);
      assert.strictEqual(person.away, false);
    }
  });

  it("opens the offer at once when you challenge somebody whose request to you is waiting", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    const challenged = inbox(b, "challenged");
    const ended = inbox(b, "requestEnded");
    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => challenged.length > 0);

    b.send("challenge", { id: a.sessionId, rules: NONE, stake: 5_000 });
    await until(room, () => room.state.duels.size === 1 && ended.length > 0);
    assert.deepStrictEqual(ended[0], { from: a.sessionId }, "the toast for the request it answered goes");

    const [duel] = [...room.state.duels.values()];
    assert.strictEqual(duel.self, a.sessionId);
    assert.strictEqual(duel.stake, 1_000);
  });

  it("opens one offer when two people challenge each other at the same moment", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    await walkAway(room, b);

    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    b.send("challenge", { id: a.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => room.state.duels.size > 0);
    await steps(room, 10);

    assert.strictEqual(room.state.duels.size, 1);
  });

  it("meets two people walking up to each other, rather than stepping onto the same tile for good", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    // Eight tiles apart along one row: each tick both would plan for the tile beside the other, and
    // step onto it together.
    Object.assign(room.state.people.get(a.sessionId), { x: -4, z: 3 });
    Object.assign(room.state.people.get(b.sessionId), { x: 4, z: 3 });

    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    b.send("challenge", { id: a.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => room.state.duels.size > 0, 120);

    const [one, other] = [room.state.people.get(a.sessionId), room.state.people.get(b.sessionId)];
    assert.strictEqual(Math.abs(one.x - other.x) + Math.abs(one.z - other.z), 1, "beside each other");
  });

  it("opens nothing for a challenge to yourself, to nobody, or to somebody busy", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a } = await challengeAndAnswer(room);
    const c = await join(room, 3);
    const busy = inbox(c, "busy");

    c.send("challenge", { id: c.sessionId, rules: NONE, stake: 1_000 });
    c.send("challenge", { id: "nobody", rules: NONE, stake: 1_000 });
    c.send("challenge", { id: a.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => busy.length > 0);
    await steps(room, 6);

    assert.deepStrictEqual(busy, [{ id: a.sessionId }]);
    assert.strictEqual(room.state.duels.size, 1);
    assert.strictEqual(room.state.people.get(c.sessionId).duel, "");
  });

  it("stops walking you up when they leave", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    await walkAway(room, b, { x: 8, z: 6 });
    const walker = room.state.people.get(a.sessionId);

    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await steps(room, 2);
    await b.leave();
    await until(room, () => room.state.people.size === 1);
    await steps(room, 2);
    const stopped = { x: walker.x, z: walker.z };
    await steps(room, 4);

    assert.deepStrictEqual({ x: walker.x, z: walker.z }, stopped);
  });

  it("takes a request down when the challenger leaves", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    const challenged = inbox(b, "challenged");
    const ended = inbox(b, "requestEnded");
    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => challenged.length > 0);

    await a.leave();
    await until(room, () => ended.length > 0);

    assert.deepStrictEqual(ended[0], { from: a.sessionId });
  });

  async function startDuel(room: CourtRoom) {
    const opened = await challengeAndAnswer(room);
    const revision = room.state.duels.get(opened.duelId).revision;
    opened.a.send("accept", { revision });
    opened.b.send("accept", { revision });
    await until(room, () => room.state.duels.get(opened.duelId)?.phase === "countdown");
    return opened;
  }

  it("takes both accepts back for both when either changes the offer", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b, duelId } = await challengeAndAnswer(room);
    a.send("accept", { revision: room.state.duels.get(duelId).revision });
    await until(room, () => room.state.duels.get(duelId).selfAccepted);

    b.send("setStake", { cents: 2_000 });
    await until(room, () => [a, b].every((client) => client.state.duels.get(duelId)?.stake === 2_000));

    for (const client of [a, b]) {
      const seen = client.state.duels.get(duelId);
      assert.strictEqual(seen.selfAccepted, false);
      assert.strictEqual(seen.resets, 1);
    }
  });

  it("takes both stakes on the second accept and sends both to the arena", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b } = await startDuel(room);

    assert.strictEqual(room.balances.of(user(1)), 99_000);
    assert.strictEqual(room.balances.of(user(2)), 99_000);
    for (const client of [a, b]) assert.strictEqual(room.state.people.get(client.sessionId).away, true);
  });

  it("fights to the end, pays the winner and puts both back in front of the statue", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b, duelId } = await startDuel(room);
    await until(room, () => room.state.duels.get(duelId)?.phase === "fighting");
    const { duel } = room.table.duels.get(duelId);
    duel.self.hp = 1;
    room.random = alternate(0.01, 0.99);

    await until(room, () => room.state.duels.size === 0, 400);

    assert.strictEqual(room.balances.of(user(2)), 100_940);
    assert.strictEqual(room.balances.of(user(1)), 99_000);
    const [challenger, challenged] = [room.state.people.get(a.sessionId), room.state.people.get(b.sessionId)];
    for (const person of [challenger, challenged]) {
      assert.strictEqual(person.away, false);
      assert.strictEqual(person.duel, "");
    }
    assert.ok(distance(challenger, { x: -1, z: 1 }) < 1e-6);
    assert.ok(distance(challenged, { x: 1, z: 1 }) < 1e-6);
  });

  it("declines the offer when one of the two leaves, and tells the other", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b } = await challengeAndAnswer(room);
    const declined = inbox(a, "declined");

    await b.leave();
    await until(room, () => room.state.duels.size === 0 && declined.length > 0);

    assert.deepStrictEqual(declined[0], { by: b.sessionId });
  });

  it("tells whoever declines the offer that it is gone, as it tells the other", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b } = await challengeAndAnswer(room);
    const toA = inbox(a, "declined");
    const toB = inbox(b, "declined");

    b.send("decline");
    await until(room, () => toA.length > 0 && toB.length > 0);

    assert.deepStrictEqual(toA[0], { by: b.sessionId });
    assert.deepStrictEqual(toB[0], { by: b.sessionId });
  });

  it("says nothing of a decline that arrives after the second accept, and fights the duel", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b, duelId } = await challengeAndAnswer(room);
    const toA = inbox(a, "declined");
    const toB = inbox(b, "declined");
    const revision = room.state.duels.get(duelId).revision;
    a.send("accept", { revision });
    await until(room, () => room.state.duels.get(duelId).selfAccepted);

    b.send("accept", { revision });
    b.send("decline");
    await until(room, () => room.state.duels.get(duelId)?.phase === "countdown");
    await steps(room, 4);

    assert.strictEqual(room.state.duels.get(duelId)?.phase, "countdown");
    assert.deepStrictEqual([toA.length, toB.length], [0, 0]);
  });

  it("answers every special ask in the state, even one sent too fast to be taken", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, duelId } = await startDuel(room);

    for (let ask = 1; ask <= 12; ask++) a.send("spec", { on: ask % 2 === 1, ask });

    await until(room, () => a.state.duels.get(duelId)?.selfFighter.specAsk === 12);
  });

  it("still pays a fighter who left in the middle of the duel", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, duelId } = await startDuel(room);
    await until(room, () => room.state.duels.get(duelId)?.phase === "fighting");
    room.table.duels.get(duelId).duel.rival.hp = 1;
    room.table.duels.get(duelId).duel.rival.attackTimer = 3;
    room.random = alternate(0.01, 0.99);

    await a.leave();
    await until(room, () => room.state.duels.size === 0, 400);

    assert.strictEqual(room.balances.of(user(1)), 100_940);
    assert.strictEqual(room.balances.of(user(2)), 99_000);
  });

  it("ignores walking and challenging from somebody in an offer", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a } = await challengeAndAnswer(room);
    const c = await join(room, 3);
    const challenged = inbox(c, "challenged");
    const person = room.state.people.get(a.sessionId);
    const stood = { x: person.x, z: person.z };

    a.send("walkTo", { x: 8, z: 6 });
    a.send("challenge", { id: c.sessionId, rules: NONE, stake: 1_000 });
    await steps(room, 10);

    assert.deepStrictEqual({ x: person.x, z: person.z }, stood);
    assert.strictEqual(challenged.length, 0);
  });

  it("opens nothing between two tabs of the same person, and tells the challenger why", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 1);
    const challenged = inbox(b, "challenged");
    const yourself = inbox(a, "yourself");

    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => yourself.length > 0);
    await steps(room, 30);

    assert.deepStrictEqual(yourself[0], { id: b.sessionId });

    assert.strictEqual(challenged.length, 0);
    assert.strictEqual(room.state.duels.size, 0);
  });

  it("takes down the requests waiting on both when an offer opens", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const a = await join(room, 1);
    const b = await join(room, 2);
    const c = await join(room, 3);
    const challenged = inbox(b, "challenged");
    const ended = inbox(b, "requestEnded");
    const busy = inbox(c, "busy");
    c.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => challenged.length === 1);
    a.send("challenge", { id: b.sessionId, rules: NONE, stake: 1_000 });
    await until(room, () => challenged.length === 2);

    b.send("answer", { from: a.sessionId, yes: true });
    await until(room, () => room.state.duels.size === 1 && ended.length > 0 && busy.length > 0);

    assert.deepStrictEqual(ended, [{ from: c.sessionId }]);
    assert.deepStrictEqual(busy, [{ id: b.sessionId }]);
  });

  it("tells every tab of a user their balance when a duel pays them", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { duelId } = await startDuel(room);
    const otherTab = await join(room, 2);
    const told = inbox(otherTab, "balance");
    await until(room, () => room.state.duels.get(duelId)?.phase === "fighting");
    room.table.duels.get(duelId).duel.self.hp = 1;
    room.random = alternate(0.01, 0.99);

    await until(room, () => told.length > 0, 400);

    assert.deepStrictEqual(told.at(-1), { cents: 100_940 });
  });

  it("keeps everybody's balance from one court to the next", async () => {
    const first = await colyseus.createRoom<CourtRoom>("court", {});
    first.balances.pay(user(1), 500);
    const second = await colyseus.createRoom<CourtRoom>("court", {});
    const client = await join(second, 1);
    const told = new Promise((resolve) => client.onMessage("balance", resolve));
    client.send("balance");
    assert.deepStrictEqual(await told, { cents: 100_500 });
  });

  it("keeps an emptied court until its duel is fought and paid", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b, duelId } = await startDuel(room);
    await until(room, () => room.state.duels.get(duelId)?.phase === "fighting");
    room.table.duels.get(duelId).duel.self.hp = 1;
    room.random = alternate(0.01, 0.99);

    await a.leave();
    await b.leave();
    await until(room, () => room.table.duels.size === 0, 400);

    assert.strictEqual(room.balances.of(user(2)), 100_940);
  });

  it("puts a started duel on a spot and carries both fighters' looks", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b, duelId } = await startDuel(room);
    const duel = room.state.duels.get(duelId);
    assert.strictEqual(duel.spot, 0);
    assert.strictEqual(duel.selfLook, room.state.people.get(a.sessionId).look);
    assert.strictEqual(duel.rivalLook, room.state.people.get(b.sessionId).look);
  });

  it("still names and dresses a fighter who has left mid-duel", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, duelId } = await startDuel(room);
    const { look, name } = room.state.people.get(a.sessionId);
    const { selfLook, selfName } = room.state.duels.get(duelId);
    assert.deepStrictEqual([selfLook, selfName], [look, name]);
    await a.leave();
    await steps(room, 3);
    assert.ok(!room.state.people.has(a.sessionId));
    assert.strictEqual(room.state.duels.get(duelId).selfLook, selfLook);
    assert.strictEqual(room.state.duels.get(duelId).selfName, selfName);
  });

  it("tells both when the arena is full and stakes nothing", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    room.table = new DuelTable(room.balances, 0);
    const { a, b, duelId } = await challengeAndAnswer(room);
    const full = [inbox(a, "arenaFull"), inbox(b, "arenaFull")];
    const revision = room.state.duels.get(duelId).revision;
    a.send("accept", { revision });
    b.send("accept", { revision });
    await until(room, () => full.every((got) => got.length > 0));
    assert.strictEqual(room.state.duels.get(duelId).phase, "offer");
  });

  it("sends a duel's stake only to its two duellists", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const { a, b, duelId } = await challengeAndAnswer(room);
    const c = await join(room, 3);
    await steps(room, 4);
    assert.strictEqual(a.state.duels.get(duelId).stake, 1_000);
    assert.strictEqual(b.state.duels.get(duelId).stake, 1_000);
    assert.ok(c.state.duels.get(duelId), "everybody sees the duel");
    assert.notStrictEqual(c.state.duels.get(duelId).stake, 1_000);
    a.send("setStake", { cents: 2_500 });
    await steps(room, 4);
    assert.strictEqual(b.state.duels.get(duelId).stake, 2_500);
    assert.notStrictEqual(c.state.duels.get(duelId).stake, 2_500);
  });
});
