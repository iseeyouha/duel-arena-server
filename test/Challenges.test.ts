import assert from "assert";
import { NO_RULES } from "../src/duel/rules.js";
import { Challenges } from "../src/duels/Challenges.js";

const terms = { rules: NO_RULES, stake: 1_000 };

describe("the challenges", () => {
  it("replaces your earlier request with a new one", () => {
    const challenges = new Challenges();
    assert.strictEqual(challenges.request("a", "b", terms, 0), undefined);
    assert.strictEqual(challenges.request("a", "c", terms, 0)?.to, "b");
    assert.strictEqual(challenges.find("a", "b"), undefined);
    assert.ok(challenges.find("a", "c"));
  });

  it("lets a request run for 20 seconds", () => {
    const challenges = new Challenges();
    challenges.request("a", "b", terms, 0);
    assert.deepStrictEqual(challenges.expire(19_999), []);
    assert.deepStrictEqual(challenges.expire(20_000).map((request) => request.to), ["b"]);
    assert.strictEqual(challenges.find("a", "b"), undefined);
  });

  it("drops every request to and from somebody, and says which", () => {
    const challenges = new Challenges();
    challenges.request("a", "b", terms, 0);
    challenges.request("c", "a", terms, 0);
    challenges.request("d", "e", terms, 0);
    const dropped = challenges.dropAll("a").map((request) => `${request.from}>${request.to}`).sort();
    assert.deepStrictEqual(dropped, ["a>b", "c>a"]);
    assert.ok(challenges.find("d", "e"));
  });

  it("hands over a request only once", () => {
    const challenges = new Challenges();
    challenges.request("a", "b", terms, 0);
    assert.ok(challenges.take("a", "b"));
    assert.strictEqual(challenges.take("a", "b"), undefined);
  });
});
