// A copy of the game's `src/games/duel-arena/game/stepDuel.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
import { botTick } from './bot.js'
import { combatTick } from './combatTick.js'
import { COUNTDOWN, DEATH_PAUSE, DRAW_PAUSE, EXECUTION, FINISH_PAUSE, TICK } from './config.js'
import type { Duel, DuelEvent } from './types.js'

// Advances the duel. At most one game tick a step, however long the step was: a frame the browser
// sat on is not a licence to fight half the duel in the dark.
export function stepDuel(duel: Duel, dt: number, random: () => number = Math.random): DuelEvent | null {
  duel.phaseTime += dt
  // Kept running once the duel is over, so the last swing still comes all the way through.
  duel.self.sinceAttack += dt
  duel.rival.sinceAttack += dt

  switch (duel.phase) {
    // Neither waits on a clock: one waits on a challenge, the other on both sides accepting.
    case 'lobby':
    case 'offer':
      return null

    case 'countdown': {
      if (duel.phaseTime < COUNTDOWN) return null
      duel.phase = 'fighting'
      duel.phaseTime = 0
      duel.tickClock = 0
      return 'fight'
    }

    case 'fighting': {
      duel.tickClock += dt
      if (duel.tickClock < TICK) return null
      duel.tickClock = Math.min(duel.tickClock - TICK, TICK * 0.5)
      duel.ticks += 1

      if (duel.botRival) botTick(duel.rival, duel.rules, random)
      const hits = combatTick(duel, random)
      if (!hits.self && !hits.rival) return null
      duel.lastExchange = hits
      duel.blows += 1

      const selfDown = duel.self.hp <= 0
      const rivalDown = duel.rival.hp <= 0
      if (selfDown || rivalDown) {
        duel.drawn = selfDown && rivalDown
        duel.won = rivalDown && !selfDown
        duel.phase = 'settled'
        duel.phaseTime = 0
        // Somebody died: the arena holds on the body, or for the execution if there is one. Both
        // did: it holds on the two of them.
        duel.pause = duel.drawn ? DRAW_PAUSE : EXECUTION ? FINISH_PAUSE : DEATH_PAUSE
        return duel.drawn ? 'drawn' : duel.won ? 'won' : 'lost'
      }
      return 'hit'
    }

    case 'settled': {
      if (duel.phaseTime < duel.pause) return null
      // Back out to the lobby, not to the options screen: the duel that was agreed is over, and
      // the next one starts by picking somebody to have it with.
      duel.phase = 'lobby'
      duel.phaseTime = 0
      duel.stake = 0
      duel.lastExchange = null
      return 'ready'
    }
  }
}
