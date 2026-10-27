// A copy of the game's `src/games/duel-arena/game/bot.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { BOT_EAT_HIGH, BOT_EAT_LOW, BOT_SPEC_CHANCE, SPEC_COST } from './config.js'
import { specAllowed, type DuelRules } from './rules.js'
import type { Fighter } from './types.js'

// How the people in the lobby fight while they are bots: a point to eat at, picked for each duel so
// two of them don't fight like the same script, and a coin on each attack for whether it is the
// special while there is one to spend. Nothing they do reads the player's state beyond what a person
// stood opposite could see, and nothing reads the stake — a bot plays the duel, not the money.
function wantsSpec(fighter: Pick<Fighter, 'spec'>, rules: DuelRules, random: () => number) {
  return specAllowed(rules) && fighter.spec >= SPEC_COST && random() < BOT_SPEC_CHANCE
}

// The first attack goes on the first tick, so whether it is the special is decided before the duel.
export function botLoadout(rules: DuelRules, spec: number, random: () => number = Math.random) {
  const eatBelow = BOT_EAT_LOW + Math.floor(random() * (BOT_EAT_HIGH - BOT_EAT_LOW + 1))
  return { eatBelow, specQueued: wantsSpec({ spec }, rules, random) }
}

// Called every tick before the fight resolves it. The special is decided once an attack, straight
// after the one before, the way a person arms it between swings.
export function botTick(fighter: Fighter, rules: DuelRules, random: () => number = Math.random) {
  if (!fighter.eatQueued && fighter.food > 0 && fighter.hp > 0 && fighter.hp <= fighter.eatBelow) fighter.eatQueued = true
  if (fighter.specPlanned === fighter.attacks) return
  fighter.specPlanned = fighter.attacks
  if (!fighter.specQueued && fighter.hp > 0 && wantsSpec(fighter, rules, random)) fighter.specQueued = true
}
