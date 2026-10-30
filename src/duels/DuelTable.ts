import { firstFreeSpot, SPOT_COUNT, SPOT_REST } from "../court/arena.js";
import { TAUNTS } from "../court/taunts.js";
import { MIN_BET, SPEC_COST } from "../duel/config.js";
import { NO_RULES, specAllowed, type DuelRuleId, type DuelRules } from "../duel/rules.js";
import { settlement } from "../duel/settlement.js";
import { startDuel } from "../duel/startDuel.js";
import { stepDuel } from "../duel/stepDuel.js";
import type { Duel, Side } from "../duel/types.js";
import type { Balances } from "./Balances.js";
import { newDuel } from "./newDuel.js";

/**
 * Somebody at a duel: their session id, their auth user id (whose balance it is), their name and the
 * look they wear — kept on the duel, so it is still drawn after they have left the room.
 */
export type Seat = { id: string; user: string; name: string; look: string };

export type TableDuel = {
  id: string;
  /** `self` is whoever challenged. */
  seats: Record<Side, Seat>;
  rules: DuelRules;
  stake: number;
  /** Where in the arena it is fought: an index into the game's spots, -1 until it starts. */
  spot: number;
  accepted: Record<Side, boolean>;
  /** Accepts taken back by a change, so the offer can say why one just went. */
  resets: number;
  /** Goes up with every change, so an accept sent on terms that have changed since is refused. */
  revision: number;
  /** The game's own duel: in its `offer` phase until the second accept starts it. */
  duel: Duel;
  /** What each side was paid when it ended, stake included. */
  paid: Record<Side, number>;
  /** The gesture each side last made in the ring, and how many they have made. */
  gestures: Record<Side, { id: string; count: number }>;
  /**
   * The newest special ask each side's client has numbered, answered whether or not it was taken:
   * the client shows what it asked for until the state it draws has answered its last ask.
   */
  specAsks: Record<Side, number>;
};

export type TableNews =
  | { type: "started"; duel: TableDuel }
  /** Agreed, but every spot in the arena is taken: nothing was staked, and both accepts went back. */
  | { type: "full"; duel: TableDuel }
  | { type: "settled"; duel: TableDuel }
  /** The arena's pause is over and the duel is off the table. */
  | { type: "ended"; duel: TableDuel };

const SIDES: Side[] = ["self", "rival"];

const isStake = (cents: unknown): cents is number =>
  Number.isInteger(cents) && (cents as number) >= 0 && (cents as number) <= Number.MAX_SAFE_INTEGER;

/**
 * Every offer being agreed and every duel being fought in the court. The rules are the game's: an
 * offer changed takes both accepts back, the stake is taken on the second accept and not the first,
 * the duel is the game's own `stepDuel`, and it is paid on the tick that ends it.
 */
export class DuelTable {
  readonly duels = new Map<string, TableDuel>();
  private opened = 0;
  /** Spots whose duel is over, and the seconds each has still to stay empty (`SPOT_REST`). */
  private resting = new Map<number, number>();

  /** `spots` is how many duels the arena holds at once. */
  constructor(private balances: Balances, private spots: number = SPOT_COUNT) {}

  open(self: Seat, rival: Seat, rules: DuelRules, stake: number): TableDuel {
    this.opened += 1;
    const duel: TableDuel = {
      id: `duel-${this.opened}`,
      seats: { self, rival },
      rules: { ...rules },
      stake,
      spot: -1,
      accepted: { self: false, rival: false },
      resets: 0,
      revision: 0,
      duel: newDuel(rival.id, false),
      paid: { self: 0, rival: 0 },
      gestures: { self: { id: "", count: 0 }, rival: { id: "", count: 0 } },
      specAsks: { self: 0, rival: 0 },
    };
    this.duels.set(duel.id, duel);
    return duel;
  }

  /**
   * Whether a side's balance covers the stake as it stands. The other side is told this much and no
   * more, so a stake one of them can't match isn't just an offer that never starts.
   */
  covers(duel: TableDuel, side: Side) {
    return this.balances.of(duel.seats[side].user) >= duel.stake;
  }

  seatOf(sessionId: string): { duel: TableDuel; side: Side } | null {
    for (const duel of this.duels.values()) {
      for (const side of SIDES) if (duel.seats[side].id === sessionId) return { duel, side };
    }
    return null;
  }

  setRule(sessionId: string, rule: DuelRuleId, on: boolean) {
    const seat = this.agreeing(sessionId);
    if (!seat || !Object.hasOwn(NO_RULES, rule) || typeof on !== "boolean" || seat.duel.rules[rule] === on) { return false; }
    seat.duel.rules = { ...seat.duel.rules, [rule]: on };
    this.changed(seat.duel);
    return true;
  }

  setStake(sessionId: string, cents: unknown) {
    const seat = this.agreeing(sessionId);
    if (!seat || !isStake(cents) || seat.duel.stake === cents) { return false; }
    seat.duel.stake = cents;
    this.changed(seat.duel);
    return true;
  }

  /** `revision` is the offer as the accepter saw it: an accept on terms changed since is refused. */
  accept(sessionId: string, random: () => number, revision: unknown): TableNews | null {
    const seat = this.agreeing(sessionId);
    if (!seat) { return null; }
    const { duel, side } = seat;
    if (revision !== duel.revision) { return null; }
    if (duel.stake < MIN_BET || this.balances.of(duel.seats[side].user) < duel.stake) { return null; }
    duel.accepted[side] = true;
    if (!duel.accepted.self || !duel.accepted.rival) { return null; }
    // A spot first, the stakes after: a duel with nowhere to be fought takes nobody's money.
    const spot = firstFreeSpot(this.takenSpots(), this.spots);
    if (spot === -1) {
      duel.accepted = { self: false, rival: false };
      return { type: "full", duel };
    }
    if (!this.takeStakes(duel)) {
      // Agreed, but not covered: taken back, so it can be changed and agreed again.
      duel.accepted = { self: false, rival: false };
      return null;
    }
    duel.spot = spot;
    startDuel(duel.duel, duel.rules, duel.stake, random);
    return { type: "started", duel };
  }

  decline(sessionId: string) {
    const seat = this.agreeing(sessionId);
    if (!seat) { return null; }
    this.duels.delete(seat.duel.id);
    return seat.duel;
  }

  /** The game's `eatNow`: a bite asked for, made on the next tick it can be. */
  eat(sessionId: string) {
    const seat = this.seatOf(sessionId);
    if (!seat) { return false; }
    const { duel } = seat.duel;
    const fighter = duel[seat.side];
    if (duel.phase !== "fighting" || fighter.food <= 0 || fighter.eatQueued) { return false; }
    fighter.eatQueued = true;
    return true;
  }

  /**
   * The game's `toggleSpec`, as the state wanted: armed for the next attack, or stood down. `ask` is
   * answered even when `on` is refused, or isn't a choice at all.
   */
  spec(sessionId: string, on: unknown, ask?: unknown) {
    const seat = this.seatOf(sessionId);
    if (!seat) { return false; }
    if (Number.isSafeInteger(ask) && (ask as number) > seat.duel.specAsks[seat.side]) seat.duel.specAsks[seat.side] = ask as number;
    if (typeof on !== "boolean") { return false; }
    const { duel } = seat.duel;
    const fighter = duel[seat.side];
    if ((duel.phase !== "countdown" && duel.phase !== "fighting") || !specAllowed(duel.rules)) { return false; }
    if (fighter.specQueued === on || (on && fighter.spec < SPEC_COST)) { return false; }
    fighter.specQueued = on;
    return true;
  }

  /** A taunt in the ring: during the count, or from whoever is left standing once it is over. */
  gesture(sessionId: string, id: string) {
    const seat = this.seatOf(sessionId);
    if (!seat || typeof id !== "string" || !TAUNTS.includes(id)) { return false; }
    const { duel } = seat.duel;
    const standing = duel.phase === "settled" && duel[seat.side].hp > 0;
    if (duel.phase !== "countdown" && !standing) { return false; }
    const gesture = seat.duel.gestures[seat.side];
    seat.duel.gestures[seat.side] = { id, count: gesture.count + 1 };
    return true;
  }

  step(dt: number, random: () => number): TableNews[] {
    const news: TableNews[] = [];
    for (const [spot, left] of this.resting) {
      if (left <= dt) this.resting.delete(spot);
      else this.resting.set(spot, left - dt);
    }
    for (const duel of [...this.duels.values()]) {
      if (duel.duel.phase === "offer") { continue; }
      const event = stepDuel(duel.duel, dt, random);
      if (event === "won" || event === "lost" || event === "drawn") {
        this.pay(duel, event);
        news.push({ type: "settled", duel });
      } else if (event === "ready") {
        this.duels.delete(duel.id);
        if (duel.spot >= 0) this.resting.set(duel.spot, SPOT_REST);
        news.push({ type: "ended", duel });
      }
    }
    return news;
  }

  private takenSpots() {
    const taken = new Set([...this.duels.values()].map((duel) => duel.spot).filter((spot) => spot >= 0));
    for (const spot of this.resting.keys()) taken.add(spot);
    return taken;
  }

  private agreeing(sessionId: string) {
    const seat = this.seatOf(sessionId);
    return seat && seat.duel.duel.phase === "offer" ? seat : null;
  }

  // Every stake or none. What each person owes is added up first — one person can't be made to
  // cover a stake twice by sitting on both sides — and anything taken is given back if the rest
  // can't be.
  private takeStakes(duel: TableDuel) {
    const owed = new Map<string, number>();
    for (const side of SIDES) owed.set(duel.seats[side].user, (owed.get(duel.seats[side].user) ?? 0) + duel.stake);
    if ([...owed].some(([user, cents]) => this.balances.of(user) < cents)) { return false; }
    const taken: string[] = [];
    for (const side of SIDES) {
      if (!this.balances.take(duel.seats[side].user, duel.stake)) {
        for (const user of taken) this.balances.pay(user, duel.stake);
        return false;
      }
      taken.push(duel.seats[side].user);
    }
    return true;
  }

  private changed(duel: TableDuel) {
    duel.revision += 1;
    if (!duel.accepted.self && !duel.accepted.rival) { return; }
    duel.accepted = { self: false, rival: false };
    duel.resets += 1;
  }

  // `won` and `lost` are the challenger's; a draw hands each their own stake back.
  private pay(duel: TableDuel, result: "won" | "lost" | "drawn") {
    if (result === "drawn") {
      duel.paid = { self: duel.stake, rival: duel.stake };
    } else {
      const prize = settlement(duel.stake, "won");
      duel.paid = result === "won" ? { self: prize, rival: 0 } : { self: 0, rival: prize };
    }
    for (const side of SIDES) if (duel.paid[side] > 0) this.balances.pay(duel.seats[side].user, duel.paid[side]);
  }
}
