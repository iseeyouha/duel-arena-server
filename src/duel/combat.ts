// A copy of the game's `src/games/duel-arena/game/combat.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { ARMOUR_DEFENCE, LEVEL, SPEC_BOOST } from './config.js'
import { weaponFor, type DuelRules } from './rules.js'
import type { Hit } from './types.js'
import { WEAPONS, type Weapon } from './weapons.js'

// The melee formula, as the game runs it. An attack is two rolls: the attacker's accuracy against
// the defender's defence decides whether it lands, and a landed attack does anything from 0 to the
// max hit, all equally likely. Both fighters are 99s with the same weapon on the same style, so the
// only things that move these numbers are what that weapon is and whether armour is worn. A special
// multiplies both the accuracy roll and the max hit, rounding down, the way the game does.

// The invisible +8 every effective level gets.
const BASE = 8

export function maxHit(weapon: Weapon = 'whip', boost = 1) {
  return Math.floor(Math.floor(0.5 + ((LEVEL + BASE) * (WEAPONS[weapon].strength + 64)) / 640) * boost)
}

// The max hit of the duel being fought: what a blow is measured against when it is shown.
export function maxHitFor(rules: DuelRules) {
  return maxHit(weaponFor(rules))
}

// The most one stab of the special can do.
export function specialMaxHit() {
  return maxHit('dagger', SPEC_BOOST)
}

// What a blow is measured against when it is shown: the duel's max hit, or both stabs' for a special.
export function blowTop(hit: Hit, rules: DuelRules) {
  return hit.stabs ? 2 * specialMaxHit() : maxHitFor(rules)
}

export function attackRoll(weapon: Weapon = 'whip', boost = 1) {
  return Math.floor((LEVEL + BASE) * (WEAPONS[weapon].attack + 64) * boost)
}

export function defenceRoll(armour: number = ARMOUR_DEFENCE) {
  return (LEVEL + BASE) * (armour + 64)
}

// The chance an attack lands. Each side rolls 0..its roll; the attack lands if its roll is higher.
export function hitChance(attack: number, defence: number) {
  if (attack > defence) return 1 - (defence + 2) / (2 * (attack + 1))
  return attack / (2 * (defence + 1))
}

// One attack: how much it takes off. A miss and a landed 0 look the same on the splat, as they do
// in the game.
//
// **Client-side placeholder:** with real money, and with people instead of bots, every roll in a
// duel has to come from a server that commits to the fight before it starts, or it can be read
// straight out of the page.
export function rollAttack(armour: number, weapon: Weapon, random: () => number = Math.random, boost = 1) {
  const lands = random() < hitChance(attackRoll(weapon, boost), defenceRoll(armour))
  if (!lands) return 0
  return Math.floor(random() * (maxHit(weapon, boost) + 1))
}
