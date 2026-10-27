// A copy of the game's `src/games/duel-arena/game/types.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import type { DuelRules } from './rules.js'

// A duel starts in the lobby: nobody is in the ring until one of the people walking round it has
// been challenged. Then come the three screens both sides have to accept — the rules, the stake,
// and a last look at both — and only then the arena.
export type Phase = 'lobby' | 'offer' | 'countdown' | 'fighting' | 'settled'

// What the fight reports to the loop. One per step at most.
export type DuelEvent = 'fight' | 'hit' | 'won' | 'lost' | 'drawn' | 'ready'

export type Side = 'self' | 'rival'

export type Fighter = {
  hp: number
  // Sharks still in the bag.
  food: number
  // Ticks until this fighter's next attack lands: 1 is the next tick. A whip resets it to four, and
  // eating pushes it back.
  attackTimer: number
  // Seconds since this fighter's last attack landed, and how many it has made, so the scene can
  // tell a new one from the one it already played without React.
  sinceAttack: number
  attacks: number
  // Asked to eat. Done on the next tick that is not the one it attacks on, so a bite never cuts a
  // swing off halfway.
  eatQueued: boolean
  // A bot's own point to eat at, chosen for each duel. Unused for the player.
  eatBelow: number
  // The special bar, 0 to 100, and the ticks until it fills back a step.
  spec: number
  specRegen: number
  // The next attack is the special: armed by the player's button, or by a bot ahead of time.
  specQueued: boolean
  // The last attack was the special, so the body plays the stabs rather than the lash.
  specLast: boolean
  // A bot decides about each attack once, straight after the one before: the attack it last
  // decided about. Unused for the player.
  specPlanned: number
}

// What one side wore on a tick, or null if nobody attacked it. Zero is a miss. A special is two
// stabs, each rolled on its own; `damage` is always the whole of it.
export type Hit = { damage: number; stabs?: readonly [number, number] }

// A tick's attacks, keyed by who wore them. Both whips run on four ticks from the same "FIGHT!",
// so both sides are usually hit on the same tick — until somebody eats and drops out of step.
export type Exchange = Record<Side, Hit | null>

export type Duel = {
  phase: Phase
  phaseTime: number
  // Which of the lobby's duellists was challenged. It decides who is stood opposite and nothing
  // else: every one of them is a maxed fighter with a whip.
  opponent: string
  // The rival is one of the lobby's bots, which eats and arms its special on its own (`bot.ts`).
  // False for a person, who only does what they ask for.
  botRival: boolean
  self: Fighter
  rival: Fighter
  stake: number
  rules: DuelRules
  // Seconds into the current game tick, and how many ticks the fight has had since "FIGHT!".
  tickClock: number
  ticks: number
  // How long the arena holds once it is over: long enough for an execution, or the short pause a
  // duel the player walked out of gets.
  pause: number
  // The last tick anybody attacked on, for the scene to play. Cleared when a duel starts.
  lastExchange: Exchange | null
  // Ticks anybody attacked on, so a mesh can tell a new one from the one it already played.
  blows: number
  won: boolean
  // Both went down on the same tick: each side's stake goes back.
  drawn: boolean
}
