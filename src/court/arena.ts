// The number of spots in the game's `game/arena/arenaSpots.ts` (void-casino-games), which are listed
// in the order they are handed out: keep the two equal. The server only ever hands out an index; the
// game knows where each one is on the sand.
export const SPOT_COUNT = 50;

/** The lowest spot nobody holds, or -1 when every one of them is taken. */
export function firstFreeSpot(taken: ReadonlySet<number>, count: number = SPOT_COUNT): number {
  for (let spot = 0; spot < count; spot++) if (!taken.has(spot)) return spot;
  return -1;
}
