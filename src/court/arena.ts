// The number of spots in the game's `game/arena/arenaSpots.ts` (void-casino-games), which are listed
// in the order they are handed out: keep the two equal. The server only ever hands out an index; the
// game knows where each one is on the sand.
export const SPOT_COUNT = 50;

/**
 * Seconds a spot stays empty once its duel is over: the game draws everybody else's duels a moment
 * behind and takes 0.9 s to sink its two through their portals, and a duel started on the spot in
 * that time would come up under them.
 */
export const SPOT_REST = 2;

/** The lowest spot nobody holds, or -1 when every one of them is taken. */
export function firstFreeSpot(taken: ReadonlySet<number>, count: number = SPOT_COUNT): number {
  for (let spot = 0; spot < count; spot++) if (!taken.has(spot)) return spot;
  return -1;
}
