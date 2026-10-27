// A copy of the game's `src/games/duel-arena/game/rules.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { ARMOUR_DEFENCE, FOOD_COUNT } from './config.js'
import type { Side } from './types.js'
import { WEAPONS, type Weapon } from './weapons.js'

// The duel options, agreed before the stake is taken. Every one of them binds both fighters, the way
// the duel screen always worked: a rule changes what kind of fight it is, never who it favours.
export type DuelRuleId = 'noFood' | 'noArmour' | 'noWeapons' | 'noSpec'
export type DuelRules = Record<DuelRuleId, boolean>

export type DuelRule = {
  id: DuelRuleId
  label: string
  note: string
}

export const DUEL_RULES: DuelRule[] = [
  { id: 'noFood', label: 'No food', note: 'Nobody eats. First to 0 HP loses.' },
  { id: 'noArmour', label: 'No armour', note: 'Every blow lands more often.' },
  { id: 'noWeapons', label: 'No weapons', note: 'Boxing: fists only, max hit 11.' },
  { id: 'noSpec', label: 'No specials', note: 'Whips only, no dagger.' },
]

export const NO_RULES: DuelRules = { noFood: false, noArmour: false, noWeapons: false, noSpec: false }
// What a new offer starts with: whips only, nothing to eat and nothing worn, the fight people asked
// each other for. Either side can untick any of them.
export const DEFAULT_RULES: DuelRules = { noFood: true, noArmour: true, noWeapons: false, noSpec: true }

// What each of them walks in with under these rules.
export function foodFor(rules: DuelRules) {
  return rules.noFood ? 0 : FOOD_COUNT
}

export function armourFor(rules: DuelRules) {
  return rules.noArmour ? 0 : ARMOUR_DEFENCE
}

// What both of them fight with: "No weapons" makes it a boxing match.
export function weaponFor(rules: DuelRules): Weapon {
  return rules.noWeapons ? 'fists' : 'whip'
}

// Whether either of them can use the special: not under "No specials", and not boxing — there is no
// dagger to draw.
export function specAllowed(rules: DuelRules) {
  return !rules.noSpec && !rules.noWeapons
}

// Where a fighter stands under these rules: either side of the middle, as far apart as the weapon
// wants them.
export function homeX(side: Side, rules: DuelRules) {
  return (side === 'self' ? -1 : 1) * WEAPONS[weaponFor(rules)].standOff
}
