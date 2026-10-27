// A copy of the game's `src/games/duel-arena/game/settlement.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { payout } from './payout.js'
import { HOUSE_CUT } from './config.js'

// What a duel pays. Both sides put up the same stake; the winner takes the pot less the house's
// cut, a draw hands each side its own stake back, and a loss pays nothing.
export const WIN_MULTIPLIER = Math.round(2 * (1 - HOUSE_CUT) * 100) / 100

export type Result = 'won' | 'lost' | 'drawn'

export function settlement(stake: number, result: Result) {
  if (result === 'won') return payout(stake, WIN_MULTIPLIER)
  if (result === 'drawn') return stake
  return 0
}
