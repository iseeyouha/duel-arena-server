// A copy of the game's `src/games/duel-arena/game/weapons.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import {
  BOX_X,
  DAGGER_ATTACK,
  DAGGER_SPEED,
  DAGGER_STRENGTH,
  FIGHTER_X,
  FIST_ATTACK,
  FIST_SPEED,
  FIST_STRENGTH,
  WHIP_ATTACK,
  WHIP_SPEED,
  WHIP_STRENGTH,
} from './config.js'

// What the two of them fight with: the whip, or — with "No weapons" — their fists. Both always have
// the same one. Each has its bonuses, its speed in ticks, and how far from the middle of the ring a
// fighter holding it stands: a whip reaches across the pit, a fist only across a step. The dagger is
// only ever out for a special, which is fought from where the whip stands.
export type Weapon = 'whip' | 'fists' | 'dagger'

type WeaponStats = { attack: number; strength: number; speed: number; standOff: number }

export const WEAPONS: Record<Weapon, WeaponStats> = {
  whip: { attack: WHIP_ATTACK, strength: WHIP_STRENGTH, speed: WHIP_SPEED, standOff: FIGHTER_X },
  fists: { attack: FIST_ATTACK, strength: FIST_STRENGTH, speed: FIST_SPEED, standOff: BOX_X },
  dagger: { attack: DAGGER_ATTACK, strength: DAGGER_STRENGTH, speed: DAGGER_SPEED, standOff: FIGHTER_X },
}
