import { SETTLED_PAUSE } from "../duel/config.js";
import { NO_RULES } from "../duel/rules.js";
import { squareUp } from "../duel/squareUp.js";
import type { Duel } from "../duel/types.js";

// A duel not started yet, while the two agree it: the game's own `Duel`, which `startDuel` takes
// from here once both accept. The game makes its one with `createDuel`, from its roster of bots;
// the server has no roster, only the person opposite.
export function newDuel(opponent: string, botRival: boolean): Duel {
  const { self, rival } = squareUp(NO_RULES, Math.random, botRival);
  return {
    phase: "offer",
    phaseTime: 0,
    opponent,
    botRival,
    self,
    rival,
    stake: 0,
    rules: { ...NO_RULES },
    tickClock: 0,
    ticks: 0,
    pause: SETTLED_PAUSE,
    lastExchange: null,
    blows: 0,
    won: false,
    drawn: false,
  };
}
