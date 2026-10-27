import assert from "assert";
import { Balances } from "../src/duels/Balances.js";

describe("the balances", () => {
  it("starts everybody at the game's starting balance", () => assert.strictEqual(new Balances().of("u"), 100_000));

  it("takes a stake it can cover and refuses one it can't", () => {
    const balances = new Balances();
    assert.strictEqual(balances.take("u", 40_000), true);
    assert.strictEqual(balances.take("u", 70_000), false);
    assert.strictEqual(balances.of("u"), 60_000);
  });

  it("pays into a balance", () => {
    const balances = new Balances();
    balances.pay("u", 1_940);
    assert.strictEqual(balances.of("u"), 101_940);
  });

  it("tops up only a balance below the minimum stake", () => {
    const balances = new Balances();
    assert.strictEqual(balances.refill("u"), false);
    balances.take("u", 99_995);
    assert.strictEqual(balances.refill("u"), true);
    assert.strictEqual(balances.of("u"), 100_000);
  });
});
