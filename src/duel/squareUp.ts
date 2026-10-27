// A copy of the game's `src/games/duel-arena/game/squareUp.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { botLoadout } from './bot.js'
import { FIRST_ATTACK, HITPOINTS, SPEC_FULL, SPEC_REGEN_TICKS } from './config.js'
import { foodFor, type DuelRules } from './rules.js'
import type { Fighter } from './types.js'

// Both fighters as they walk out: full hitpoints, the food the rules allow, a full special bar, and
// both whips due on the first tick after "FIGHT!". A bot rival picks its own point to eat at, and
// whether it opens with the special.
export function squareUp(rules: DuelRules, random: () => number = Math.random, botRival = true) {
  const fresh = (): Fighter => ({
    hp: HITPOINTS,
    food: foodFor(rules),
    attackTimer: FIRST_ATTACK,
    sinceAttack: Infinity,
    attacks: 0,
    eatQueued: false,
    eatBelow: 0,
    spec: SPEC_FULL,
    specRegen: SPEC_REGEN_TICKS,
    specQueued: false,
    specLast: false,
    specPlanned: 0,
  })
  const rival = fresh()
  return {
    self: fresh(),
    rival: botRival ? { ...rival, ...botLoadout(rules, rival.spec, random) } : rival,
  }
}
