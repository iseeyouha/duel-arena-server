// A copy of the game's `src/games/duel-arena/game/lobby/point.ts` (void-casino-games), changed only in
// its import paths: the server walks the court by the same map and rules the game draws. Keep the
// two in step.
// A spot on the courtyard floor, in metres (y = 0). Its own module so the pathfinder needs nothing
// of the walkers'.
export type Point = { x: number; z: number }
