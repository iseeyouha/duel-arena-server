// A copy of the game's `src/money/payout.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
// Floored so the house never pays a fraction of a cent more than stake × multiplier.
export function payout(cents: number, multiplier: number) {
  return Math.floor((cents * Math.round(multiplier * 100)) / 100)
}
