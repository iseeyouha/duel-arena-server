import { MIN_BET, STARTING_BALANCE } from "../duel/config.js";

// Everybody's demo money, in integer cents, by auth user id — so a reload in the same tab keeps it,
// and a fighter who left mid-duel is still paid. Kept in memory: a restart starts everybody over.
// Private: only its owner is ever told it. With real money this is the Platform's, not ours.
export class Balances {
  private cents = new Map<string, number>();

  of(user: string) {
    return this.cents.get(user) ?? STARTING_BALANCE;
  }

  /** Takes a stake out, or refuses one the balance can't cover and changes nothing. */
  take(user: string, cents: number) {
    const balance = this.of(user);
    if (cents > balance) { return false; }
    this.cents.set(user, balance - cents);
    return true;
  }

  pay(user: string, cents: number) {
    this.cents.set(user, this.of(user) + cents);
  }

  /** The game's demo top-up: only once there isn't enough left to stake. */
  refill(user: string) {
    if (this.of(user) >= MIN_BET) { return false; }
    this.cents.set(user, STARTING_BALANCE);
    return true;
  }
}
