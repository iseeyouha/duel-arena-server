// A copy of the game's `src/games/duel-arena/game/startDuel.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { SETTLED_PAUSE } from './config.js'
import type { DuelRules } from './rules.js'
import { squareUp } from './squareUp.js'
import type { Duel } from './types.js'

// Both fighters walk out under the rules that were agreed, with the stake already taken.
export function startDuel(duel: Duel, rules: DuelRules, stake: number, random: () => number = Math.random) {
  const { self, rival } = squareUp(rules, random, duel.botRival)
  duel.phase = 'countdown'
  duel.phaseTime = 0
  duel.self = self
  duel.rival = rival
  duel.stake = stake
  duel.rules = { ...rules }
  duel.tickClock = 0
  duel.ticks = 0
  duel.pause = SETTLED_PAUSE
  duel.lastExchange = null
  duel.blows = 0
  duel.won = false
  duel.drawn = false
}
