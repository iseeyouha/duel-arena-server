import assert from "assert";
import { CloseCode } from "colyseus";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import type { CourtRoom } from "../src/rooms/CourtRoom.js";
import { testServer } from "./testServer.js";
import { STATUE } from "../src/court/lobbyMap.js";
import { walkable } from "../src/court/navGrid.js";

type Spot = { x: number; z: number };

const distance = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);
// Tiles apart, a diagonal tile one like any other.
const tiles = (a: Spot, b: Spot) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

// Steps the room's loop until `done` holds, failing after `maxSteps` (50 ms each).
async function until(room: CourtRoom, done: () => boolean, maxSteps = 200) {
  for (let step = 0; step < maxSteps; step++) {
    if (done()) return;
    await room.waitForNextTimestep();
  }
  assert.fail("never happened");
}

describe("the court", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await testServer());

  beforeEach(async () => {
    await colyseus.cleanup();
    // cleanup() signs the SDK out, so the token is set per test, not once.
    colyseus.sdk.auth.token = "test-user";
  });

  it("puts everybody who joins in it, each with a name and a look of their own", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const first = await colyseus.connectTo(room);
    const second = await colyseus.connectTo(room);

    const a = room.state.people.get(first.sessionId);
    const b = room.state.people.get(second.sessionId);
    assert.ok(a && b, "both are in the court");
    assert.notStrictEqual(a.name, b.name);
    assert.notStrictEqual(a.look, b.look);
    assert.ok(walkable(a.x, a.z) && walkable(b.x, b.z), "both stand somewhere a body can");
    assert.ok(distance(a, b) > 0.01, "nobody starts inside somebody else");
  });

  it("sends away somebody who has sent nothing for too long, and tells their client it was that", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const idler = await colyseus.connectTo(room);
    const stayer = await colyseus.connectTo(room);
    const left = new Promise<[number, string | undefined]>((resolve) => idler.onLeave((code, reason) => resolve([code, reason])));

    // As if the last thing it sent was longer ago than the court waits, and the court has looked.
    (room.clients.getById(idler.sessionId) as unknown as { _lastMessageTime: number })._lastMessageTime = -Infinity;
    (room.plugins.idle as unknown as { scan: () => void }).scan();

    // A leave, not a drop: no seat held for a reconnection its client won't try, and the body goes
    // at once.
    assert.deepStrictEqual(await left, [CloseCode.CONSENTED, "idle"]);
    await until(room, () => !room.state.people.has(idler.sessionId), 20);
    assert.ok(room.state.people.has(stayer.sessionId), "only the idle one goes");
  });

  it("walks you where you asked, and the others see you get there", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const walker = await colyseus.connectTo(room);
    const watcher = await colyseus.connectTo(room);
    const goal = { x: 3, z: 6 };

    walker.send("walkTo", goal);
    const person = room.state.people.get(walker.sessionId);
    await until(room, () => distance(person, goal) < 0.01);

    // The step that arrives and the patch that carries it need not line up: give it a few patches.
    for (let patch = 0; patch < 5; patch++) {
      if (distance(watcher.state.people.get(walker.sessionId), goal) < 0.01) { return; }
      await watcher.waitForNextPatch();
    }
    assert.fail("the other client never saw them arrive");
  });

  it("walks round the statue, never through it", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const walker = await colyseus.connectTo(room);
    const person = room.state.people.get(walker.sessionId);
    // A tile behind it.
    const goal = { x: STATUE.x, z: -6 };

    walker.send("walkTo", goal);
    await until(room, () => {
      assert.ok(distance(person, STATUE) >= STATUE.r, `inside the statue at ${person.x}, ${person.z}`);
      return distance(person, goal) < 0.01;
    });
  });

  it("ignores a walkTo that isn't two numbers", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const walker = await colyseus.connectTo(room);
    const person = room.state.people.get(walker.sessionId);
    const start = { x: person.x, z: person.z };

    walker.send("walkTo", { x: "3", z: 6 });
    walker.send("walkTo", { x: 3 });
    walker.send("walkTo", { x: Infinity, z: 6 });
    walker.send("walkTo", null);
    await room.waitForMessage("walkTo");
    for (let step = 0; step < 6; step++) await room.waitForNextTimestep();

    assert.deepStrictEqual({ x: person.x, z: person.z }, start);
  });

  it("runs two tiles a tick where a walk goes one", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const runner = await colyseus.connectTo(room);
    const stroller = await colyseus.connectTo(room);
    stroller.send("run", { on: false });
    await room.waitForMessage("run");

    const fast = room.state.people.get(runner.sessionId);
    const slow = room.state.people.get(stroller.sessionId);
    assert.strictEqual(fast.running, true, "running starts on");
    assert.strictEqual(slow.running, false);

    runner.send("walkTo", { x: -8, z: 6 });
    stroller.send("walkTo", { x: 8, z: 6 });
    await room.waitForMessage("walkTo");
    await room.waitForMessage("walkTo");

    // Every move either of them makes in three ticks or so, in tiles.
    const ran: number[] = [];
    const walked: number[] = [];
    let fastAt = { x: fast.x, z: fast.z };
    let slowAt = { x: slow.x, z: slow.z };
    for (let step = 0; step < 30; step++) {
      await room.waitForNextTimestep();
      if (tiles(fast, fastAt) > 0) { ran.push(tiles(fast, fastAt)); }
      if (tiles(slow, slowAt) > 0) { walked.push(tiles(slow, slowAt)); }
      fastAt = { x: fast.x, z: fast.z };
      slowAt = { x: slow.x, z: slow.z };
    }
    assert.ok(walked.length >= 2 && walked.every((move) => move === 1), `walked ${walked}`);
    assert.ok(ran.length >= 2 && ran.every((move) => move === 2), `ran ${ran}`);
    assert.ok(Number.isInteger(fast.x) && Number.isInteger(fast.z), "a body stands on a tile");
  });

  it("drops the clicks past ten a second", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const walker = await colyseus.connectTo(room);
    const person = room.state.people.get(walker.sessionId);
    const goals = Array.from({ length: 15 }, (_, i) => ({ x: -7 + i, z: 5 }));

    for (const goal of goals) walker.send("walkTo", goal);
    await until(room, () => distance(person, goals[9]) < 0.01 || distance(person, goals[14]) < 0.01);
    for (let step = 0; step < 4; step++) await room.waitForNextTimestep();

    assert.ok(distance(person, goals[9]) < 0.01, `ended at ${person.x}, ${person.z}`);
  });

  it("stops you to make a gesture, and the others see it", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const taunter = await colyseus.connectTo(room);
    const watcher = await colyseus.connectTo(room);
    const person = room.state.people.get(taunter.sessionId);

    taunter.send("walkTo", { x: -8, z: 6 });
    await room.waitForMessage("walkTo");
    for (let step = 0; step < 4; step++) await room.waitForNextTimestep();
    taunter.send("emote", { id: "laugh" });
    await room.waitForMessage("emote");
    const stopped = { x: person.x, z: person.z };
    for (let step = 0; step < 6; step++) await room.waitForNextTimestep();

    assert.deepStrictEqual({ x: person.x, z: person.z }, stopped, "stood still to make it");
    assert.strictEqual(person.emote, "laugh");
    for (let patch = 0; patch < 5; patch++) {
      if (watcher.state.people.get(taunter.sessionId).emote === "laugh") { return; }
      await watcher.waitForNextPatch();
    }
    assert.fail("the other client never saw the gesture");
  });

  it("counts the same gesture made twice as two", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const taunter = await colyseus.connectTo(room);
    const person = room.state.people.get(taunter.sessionId);

    taunter.send("emote", { id: "clap" });
    await room.waitForMessage("emote");
    taunter.send("emote", { id: "clap" });
    await room.waitForMessage("emote");

    assert.strictEqual(person.emote, "clap");
    assert.strictEqual(person.emoteCount, 2);
  });

  it("ends a gesture with the next step", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const taunter = await colyseus.connectTo(room);
    const person = room.state.people.get(taunter.sessionId);

    taunter.send("emote", { id: "dance" });
    await room.waitForMessage("emote");
    taunter.send("walkTo", { x: 3, z: 6 });
    await room.waitForMessage("walkTo");

    assert.strictEqual(person.emote, "");
  });

  it("ignores a gesture that isn't on the wheel", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const taunter = await colyseus.connectTo(room);
    const person = room.state.people.get(taunter.sessionId);

    // `dab` is a winner's celebration, made in the ring, not a taunt.
    taunter.send("emote", { id: "dab" });
    taunter.send("emote", { id: "nope" });
    taunter.send("emote", { id: 3 });
    taunter.send("emote", null);
    await room.waitForMessage("emote");
    for (let step = 0; step < 4; step++) await room.waitForNextTimestep();

    assert.strictEqual(person.emote, "");
    assert.strictEqual(person.emoteCount, 0);
  });

  it("tells you your balance when you ask", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const client = await colyseus.connectTo(room);
    const told = new Promise((resolve) => client.onMessage("balance", resolve));
    client.send("balance");
    assert.deepStrictEqual(await told, { cents: 100_000 });
  });

  it("takes you out of the court when you leave", async () => {
    const room = await colyseus.createRoom<CourtRoom>("court", {});
    const leaving = await colyseus.connectTo(room);
    await colyseus.connectTo(room);
    assert.strictEqual(room.state.people.size, 2);

    await leaving.leave();
    await until(room, () => room.state.people.size === 1);
  });
});
