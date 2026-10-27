// A copy of the game's `src/games/duel-arena/game/combatTick.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { EAT_DELAY, FOOD_HEAL, HITPOINTS, SPEC_BOOST, SPEC_COST, SPEC_FULL, SPEC_REGEN, SPEC_REGEN_TICKS } from './config.js'
import { rollAttack } from './combat.js'
import { armourFor, specAllowed, weaponFor } from './rules.js'
import { WEAPONS } from './weapons.js'
import type { Duel, Exchange, Fighter, Hit, Side } from './types.js'

const SIDES: Side[] = ['self', 'rival']

// One game tick of the fight. Meals first, then the attack timers count down and whoever is due
// attacks — with the special, if it is armed and there is the bar for it; the damage from both is
// applied together, so two fighters who attack on the same tick both land — and can both go down
// on it. This is the only place hitpoints move.
export function combatTick(duel: Duel, random: () => number = Math.random): Exchange {
  for (const side of SIDES) {
    eatIfAsked(duel[side])
    refillSpec(duel[side])
  }

  const hits: Exchange = { self: null, rival: null }
  const weapon = weaponFor(duel.rules)
  const armour = armourFor(duel.rules)
  const specials = specAllowed(duel.rules)
  // Rolled in a fixed order, the player's attack first, so a seeded duel is always the same duel.
  for (const side of SIDES) {
    const fighter = duel[side]
    fighter.attackTimer -= 1
    if (fighter.attackTimer > 0) continue
    const other = side === 'self' ? 'rival' : 'self'
    const special = specials && fighter.specQueued && fighter.spec >= SPEC_COST
    hits[other] = special ? puncture(armour, random) : { damage: rollAttack(armour, weapon, random) }
    fighter.attackTimer = WEAPONS[special ? 'dagger' : weapon].speed
    fighter.sinceAttack = 0
    fighter.attacks += 1
    fighter.specLast = special
    // Armed or not, this attack has been made: an armed special with no bar for it is let go.
    fighter.specQueued = false
    if (special) fighter.spec -= SPEC_COST
  }
  for (const side of SIDES) {
    const hit = hits[side]
    if (hit) duel[side].hp = Math.max(0, duel[side].hp - hit.damage)
  }
  return hits
}

// The dagger's special: two stabs in the one attack, each rolled on its own.
function puncture(armour: number, random: () => number): Hit {
  const first = rollAttack(armour, 'dagger', random, SPEC_BOOST)
  const second = rollAttack(armour, 'dagger', random, SPEC_BOOST)
  return { damage: first + second, stabs: [first, second] }
}

function refillSpec(fighter: Fighter) {
  fighter.specRegen -= 1
  if (fighter.specRegen > 0) return
  fighter.specRegen = SPEC_REGEN_TICKS
  fighter.spec = Math.min(SPEC_FULL, fighter.spec + SPEC_REGEN)
}

function eatIfAsked(fighter: Fighter) {
  if (!fighter.eatQueued) return
  if (fighter.food <= 0) {
    fighter.eatQueued = false
    return
  }
  // Attacking this very tick: the swing is already in the air, so the bite waits for the next one.
  if (fighter.attackTimer <= 1) return
  fighter.eatQueued = false
  fighter.food -= 1
  fighter.hp = Math.min(HITPOINTS, fighter.hp + FOOD_HEAL)
  fighter.attackTimer += EAT_DELAY
}
