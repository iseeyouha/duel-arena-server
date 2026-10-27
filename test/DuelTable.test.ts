import assert from "assert";
import { COUNTDOWN, TICK } from "../src/duel/config.js";
import { NO_RULES } from "../src/duel/rules.js";
import { settlement } from "../src/duel/settlement.js";
import { Balances } from "../src/duels/Balances.js";
import { DuelTable, type TableNews } from "../src/duels/DuelTable.js";
import { SPOT_REST } from "../src/court/arena.js";

const seat = (n: number) => ({ id: `s${n}`, user: `u${n}`, name: `Player ${n}`, look: "soldier-red" });

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function setUp(stake = 1_000) {
  const balances = new Balances();
  const table = new DuelTable(balances);
  const duel = table.open(seat(1), seat(2), NO_RULES, stake);
  return { balances, table, duel };
}

function start(table: DuelTable) {
  const [duel] = [...table.duels.values()];
  table.accept("s1", Math.random, duel.revision);
  return table.accept("s2", Math.random, duel.revision);
}

// Steps 50 ms at a time until the duel is over and gone, gathering the news.
function run(table: DuelTable, random: () => number) {
  const news: TableNews[] = [];
  for (let step = 0; step < 20_000; step++) {
    news.push(...table.step(0.05, random));
    if (news.some((item) => item.type === "ended")) return news;
  }
  assert.fail("the duel never ended");
}

describe("the duel table", () => {
  it("takes both accepts back on any change, and counts a reset only when one stood", () => {
    const { table, duel } = setUp();
    assert.strictEqual(table.setRule("s1", "noFood", true), true);
    assert.strictEqual(duel.resets, 0);
    assert.strictEqual(table.accept("s1", Math.random, duel.revision), null);
    assert.strictEqual(duel.accepted.self, true);
    assert.strictEqual(table.setStake("s2", 2_000), true);
    assert.deepStrictEqual(duel.accepted, { self: false, rival: false });
    assert.strictEqual(duel.resets, 1);
    assert.strictEqual(duel.rules.noFood, true);
    assert.strictEqual(duel.stake, 2_000);
    assert.strictEqual(table.setStake("s1", 2_000), false, "the same stake again changes nothing");
  });

  it("ignores a stake that isn't a whole number of cents from 0 up", () => {
    const { table, duel } = setUp();
    for (const bad of [1.5, -1, NaN, "10", 1e20]) assert.strictEqual(table.setStake("s1", bad), false, String(bad));
    assert.strictEqual(duel.stake, 1_000);
  });

  it("refuses an accept under the minimum stake or over your balance", () => {
    const { table, duel, balances } = setUp(5);
    table.accept("s1", Math.random, duel.revision);
    assert.strictEqual(duel.accepted.self, false);
    table.setStake("s1", 200_000);
    table.accept("s1", Math.random, duel.revision);
    assert.strictEqual(duel.accepted.self, false);
    assert.strictEqual(balances.of("u1"), 100_000);
  });

  it("takes both stakes on the second accept and starts the duel", () => {
    const { table, duel, balances } = setUp();
    assert.strictEqual(table.accept("s1", Math.random, duel.revision), null);
    const news = table.accept("s2", Math.random, duel.revision);
    assert.strictEqual(news?.type, "started");
    assert.strictEqual(balances.of("u1"), 99_000);
    assert.strictEqual(balances.of("u2"), 99_000);
    assert.strictEqual(duel.duel.phase, "countdown");
  });

  it("never takes a stake twice, and ignores the offer's actions once the duel is on", () => {
    const { table, duel, balances } = setUp();
    start(table);
    assert.strictEqual(table.accept("s1", Math.random, duel.revision), null);
    assert.strictEqual(table.setRule("s1", "noFood", true), false);
    assert.strictEqual(table.setStake("s2", 5_000), false);
    assert.strictEqual(table.decline("s1"), null);
    assert.strictEqual(balances.of("u1"), 99_000);
    assert.strictEqual(balances.of("u2"), 99_000);
    assert.strictEqual(table.duels.size, 1);
  });

  it("ignores eating and the special outside the fight", () => {
    const { table, duel } = setUp();
    assert.strictEqual(table.eat("s1"), false);
    assert.strictEqual(table.spec("s1", true), false);
    start(table);
    table.step(COUNTDOWN, Math.random);
    assert.strictEqual(duel.duel.phase, "fighting");
    assert.strictEqual(table.eat("s1"), true);
    assert.strictEqual(duel.duel.self.eatQueued, true);
    assert.strictEqual(table.spec("s2", true), true);
    assert.strictEqual(duel.duel.rival.specQueued, true);
  });

  it("fights to the end and pays the winner the pot less the cut", () => {
    const { table, duel, balances } = setUp();
    start(table);
    const news = run(table, mulberry32(11));
    assert.strictEqual(news.filter((item) => item.type === "settled").length, 1);
    assert.strictEqual(table.duels.size, 0);
    const won = 100_000 - 1_000 + settlement(1_000, "won");
    if (duel.duel.drawn) {
      assert.deepStrictEqual([balances.of("u1"), balances.of("u2")], [100_000, 100_000]);
    } else {
      const [winner, loser] = duel.duel.won ? ["u1", "u2"] : ["u2", "u1"];
      assert.strictEqual(balances.of(winner), won);
      assert.strictEqual(balances.of(loser), 99_000);
    }
  });

  it("gives each their stake back on a draw", () => {
    const { table, duel, balances } = setUp();
    start(table);
    table.step(COUNTDOWN, Math.random);
    for (const fighter of [duel.duel.self, duel.duel.rival]) {
      fighter.hp = 1;
      fighter.attackTimer = 1;
    }
    const news = table.step(TICK, alternate(0.01, 0.99));
    assert.strictEqual(news[0]?.type, "settled");
    assert.strictEqual(duel.duel.drawn, true);
    assert.deepStrictEqual([balances.of("u1"), balances.of("u2")], [100_000, 100_000]);
  });

  it("answers every special ask a side makes, taken or not, keeping the newest", () => {
    const { table, duel } = setUp();
    start(table);
    table.step(COUNTDOWN, Math.random);
    assert.strictEqual(table.spec("s1", true, 1), true);
    assert.strictEqual(table.spec("s1", true, 2), false, "already armed");
    assert.strictEqual(duel.specAsks.self, 2);
    table.spec("s1", false, 1);
    assert.strictEqual(duel.specAsks.self, 2, "an older ask doesn't wind it back");
    for (const bad of [2.5, -1, "3", NaN]) table.spec("s1", false, bad);
    assert.strictEqual(duel.specAsks.self, 2);
    assert.strictEqual(duel.specAsks.rival, 0);
  });

  it("lets a gesture be made in the ring only during the count and by the winner", () => {
    const { table, duel } = setUp();
    assert.strictEqual(table.gesture("s1", "laugh"), false);
    start(table);
    assert.strictEqual(table.gesture("s1", "laugh"), true);
    assert.deepStrictEqual(duel.gestures.self, { id: "laugh", count: 1 });
    assert.strictEqual(table.gesture("s1", "dab"), false);
    table.step(COUNTDOWN, Math.random);
    assert.strictEqual(table.gesture("s1", "laugh"), false, "not in the fight itself");
    duel.duel.rival.hp = 1;
    duel.duel.self.attackTimer = 1;
    duel.duel.rival.attackTimer = 3;
    table.step(TICK, alternate(0.01, 0.99));
    assert.strictEqual(duel.duel.phase, "settled");
    assert.strictEqual(table.gesture("s2", "laugh"), false);
    assert.strictEqual(table.gesture("s1", "clap"), true);
  });

  it("refuses an accept made on terms that have changed since", () => {
    const { table, duel } = setUp();
    const seen = duel.revision;
    table.setStake("s1", 2_000);
    table.accept("s2", Math.random, seen);
    assert.strictEqual(duel.accepted.rival, false);
    table.accept("s2", Math.random, duel.revision);
    assert.strictEqual(duel.accepted.rival, true);
  });

  it("never takes more than somebody has, even sat on both sides", () => {
    const balances = new Balances();
    const table = new DuelTable(balances);
    const duel = table.open(seat(1), { id: "s1b", user: "u1", name: "Player 1", look: "soldier-red" }, NO_RULES, 60_000);
    table.accept("s1", Math.random, duel.revision);
    assert.strictEqual(table.accept("s1b", Math.random, duel.revision), null);
    assert.strictEqual(balances.of("u1"), 100_000);
    assert.strictEqual(duel.duel.phase, "offer");
    assert.deepStrictEqual(duel.accepted, { self: false, rival: false }, "taken back, so it can be changed and agreed again");
  });

  it("declines only an offer", () => {
    const { table } = setUp();
    assert.ok(table.decline("s2"));
    assert.strictEqual(table.duels.size, 0);
    assert.strictEqual(table.decline("s2"), null);
  });

  it("hands each started duel the first free spot, and frees it once the duel is over", () => {
    const balances = new Balances();
    const table = new DuelTable(balances);
    const first = table.open(seat(1), seat(2), NO_RULES, 1_000);
    const second = table.open(seat(3), seat(4), NO_RULES, 1_000);
    assert.strictEqual(first.spot, -1);
    for (const [duel, a, b] of [[first, "s1", "s2"], [second, "s3", "s4"]] as const) {
      table.accept(a, Math.random, duel.revision);
      table.accept(b, Math.random, duel.revision);
    }
    assert.deepStrictEqual([first.spot, second.spot], [0, 1]);
    for (let step = 0; step < 20_000 && table.duels.has(first.id); step++) table.step(0.05, Math.random);
    assert.ok(!table.duels.has(first.id) || !table.duels.has(second.id), "one of them ended");
    const gone = table.duels.has(first.id) ? second : first;
    for (let rested = 0; rested <= SPOT_REST; rested += 0.05) table.step(0.05, Math.random);
    const third = table.open(seat(5), seat(6), NO_RULES, 1_000);
    table.accept("s5", Math.random, third.revision);
    table.accept("s6", Math.random, third.revision);
    assert.strictEqual(third.spot, gone.spot);
    const live = [...table.duels.values()].map((duel) => duel.spot);
    assert.strictEqual(new Set(live).size, live.length, "no two duels on one spot");
  });

  it("keeps a finished duel's spot empty while its fighters go down through their portals", () => {
    const table = new DuelTable(new Balances());
    const first = table.open(seat(1), seat(2), NO_RULES, 1_000);
    table.accept("s1", Math.random, first.revision);
    table.accept("s2", Math.random, first.revision);
    for (let step = 0; step < 20_000 && table.duels.has(first.id); step++) table.step(0.05, Math.random);
    const next = table.open(seat(3), seat(4), NO_RULES, 1_000);
    table.accept("s3", Math.random, next.revision);
    table.accept("s4", Math.random, next.revision);
    assert.notStrictEqual(next.spot, first.spot);
  });

  it("refuses the second accept when the arena is full, staking nothing", () => {
    const balances = new Balances();
    const table = new DuelTable(balances, 0);
    const duel = table.open(seat(1), seat(2), NO_RULES, 1_000);
    const before = [balances.of("u1"), balances.of("u2")];
    table.accept("s1", Math.random, duel.revision);
    const news = table.accept("s2", Math.random, duel.revision);
    assert.deepStrictEqual(news, { type: "full", duel });
    assert.deepStrictEqual(duel.accepted, { self: false, rival: false });
    assert.deepStrictEqual([balances.of("u1"), balances.of("u2")], before);
    assert.strictEqual(duel.duel.phase, "offer");
    assert.strictEqual(duel.spot, -1);
  });
});
