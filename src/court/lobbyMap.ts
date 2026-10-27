// A copy of the game's `src/games/duel-arena/game/lobby/lobbyMap.ts` (void-casino-games), changed only in
// its import paths: the server walks the court by the same map and rules the game draws. Keep the
// two in step.
// The lobby: a walled stone courtyard in front of the arena gate, laid out once in metres. The
// scene builds every wall, pillar and prop from these numbers and the pathfinder blocks out the
// same ones, so what you can walk round and what you can see are never two different maps.
//
// The multiplayer server walks its court with its own copy of this file, `navGrid.ts`,
// `walkPath.ts` and `point.ts` (in `duel-arena-server/src/court/`): change the court here and
// change it there, or people walk through a prop on one side and round it on the other.
//
// The courtyard is centred on the origin with its floor at y = 0; north is -z, which is where the
// gate to the arenas is, and the camera starts out looking north from the south side.

export type Circle = { x: number; z: number; r: number }
// Axis-aligned: everything in a courtyard built on a grid lines up with its walls.
export type Box = { x: number; z: number; w: number; d: number }

// The inside faces of the walls. Nothing walks outside them.
export const COURT = { minX: -12.6, maxX: 12.6, minZ: -10.6, maxZ: 10.6 }
export const WALL_THICKNESS = 0.9
export const WALL_HEIGHT = 2.4

// The arena gate in the middle of the north wall, and the half-width of its opening.
export const GATE = { x: 0, z: COURT.minZ, half: 2.2 }

// Where you come in: a tile, as everywhere a body stands is.
export const SPAWN = { x: 0, z: 3 }

// Round towers at the four corners. Mostly outside the court; the inner quarter is in the way.
export const TOWERS: Circle[] = [
  { x: COURT.minX, z: COURT.minZ, r: 1.7 },
  { x: COURT.maxX, z: COURT.minZ, r: 1.7 },
  { x: COURT.minX, z: COURT.maxZ, r: 1.7 },
  { x: COURT.maxX, z: COURT.maxZ, r: 1.7 },
]

// The colonnade either side of the gate.
export const PILLARS: Circle[] = [-6.6, -3.6, 3.6, 6.6].map((x) => ({ x, z: COURT.minZ + 1.25, r: 0.42 }))

// The statue of a champion in the middle of the court, on a stepped plinth, and the braziers
// burning in front of it.
export const STATUE: Circle = { x: 0, z: -2.4, r: 1.35 }
export const BRAZIERS: Circle[] = [
  { x: -2.4, z: -0.6, r: 0.36 },
  { x: 2.4, z: -0.6, r: 0.36 },
]

// The scoreboard, against the north wall west of the gate: the last duels fought, as they finish.
export const SCOREBOARD: Box = { x: -9.6, z: COURT.minZ + 0.45, w: 3.6, d: 0.5 }

// The infirmary on the east side: two lean-to awnings against the wall over two beds, where duels
// used to send you. `AWNING` is the ground their cloth covers; their legs stand well under it, at the
// beds' ends and between the two.
export const AWNING = { x: 11.4, z: 1.2, w: 2.4, d: 6.2 }
export const BEDS: Box[] = [
  { x: 11.7, z: -0.6, w: 1.1, d: 2.1 },
  { x: 11.7, z: 2.9, w: 1.1, d: 2.1 },
]
export const AWNING_POSTS: Circle[] = [
  { x: 11.6, z: AWNING.z - 2.98, r: 0.14 },
  { x: 11.6, z: AWNING.z, r: 0.26 },
  { x: 11.6, z: AWNING.z + 2.98, r: 0.14 },
]

// Stock against the west wall: crates and barrels a trader left.
export const CRATES: Box[] = [
  { x: -11.8, z: 1.4, w: 1, d: 1 },
  { x: -11.8, z: 2.5, w: 1, d: 1 },
  { x: -10.8, z: 1.6, w: 0.8, d: 0.8 },
]
export const BARRELS: Circle[] = [
  { x: -11.9, z: 4.1, r: 0.4 },
  { x: -11.1, z: 4.6, r: 0.4 },
  { x: -11.9, z: -1.2, r: 0.4 },
]

// Palms in the four quarters of the court, and benches along the south wall.
export const PALMS: Circle[] = [
  { x: -9.6, z: 6.0, r: 0.32 },
  { x: 8.9, z: 6.4, r: 0.32 },
  { x: -7.2, z: -5.6, r: 0.32 },
  { x: 7.6, z: -5.2, r: 0.32 },
]
export const BENCHES: Box[] = [
  { x: -4.6, z: COURT.maxZ - 0.5, w: 2.4, d: 0.6 },
  { x: 4.6, z: COURT.maxZ - 0.5, w: 2.4, d: 0.6 },
]

// Clay jars standing in twos and threes against the walls.
export const JARS: Circle[] = [
  { x: -12.05, z: -6.6, r: 0.3 },
  { x: -11.55, z: -7.2, r: 0.26 },
  { x: -12.05, z: -7.7, r: 0.3 },
  { x: 12.05, z: 6.4, r: 0.3 },
  { x: 11.5, z: 7.0, r: 0.26 },
  { x: -5.1, z: COURT.minZ + 0.4, r: 0.28 },
  { x: 5.1, z: COURT.minZ + 0.4, r: 0.28 },
  { x: -1.6, z: COURT.maxZ - 0.4, r: 0.3 },
  { x: 1.6, z: COURT.maxZ - 0.4, r: 0.3 },
]

// The market: five stalls with their backs to the walls, sized to the stalls drawn on them, and the
// way each one's counter faces into the court (as the sconces' turns do: towards (sin, cos)).
export const STALLS: Box[] = [
  { x: -8.4, z: COURT.maxZ - 1.3, w: 4.71, d: 2.58 },
  { x: 8.4, z: COURT.maxZ - 1.26, w: 4.77, d: 2.5 },
  { x: COURT.maxX - 1.38, z: -4.6, w: 2.73, d: 4.25 },
  { x: COURT.minX + 1.85, z: -3.95, w: 3.68, d: 4.53 },
  { x: 8.96, z: COURT.minZ + 1.745, w: 3.19, d: 3.47 },
]
export const STALL_FACING = [Math.PI, Math.PI, -Math.PI / 2, Math.PI / 2, 0]

// Lamp posts on the open floor: either side of the way in, and either side of the colonnade.
export const LAMP_POSTS: Circle[] = [
  { x: -5.2, z: 3.0, r: 0.25 },
  { x: 5.2, z: 3.0, r: 0.25 },
  { x: -5.2, z: -7.4, r: 0.25 },
  { x: 5.2, z: -7.4, r: 0.25 },
]

// The ring of mosaic the statue stands in the middle of.
export const MOSAIC_RADIUS = 3.6

// Everything the pathfinder has to go round.
export const BLOCKING_CIRCLES: Circle[] = [
  ...TOWERS,
  ...PILLARS,
  STATUE,
  ...BRAZIERS,
  ...AWNING_POSTS,
  ...BARRELS,
  ...PALMS,
  ...JARS,
  ...LAMP_POSTS,
]
export const BLOCKING_BOXES: Box[] = [SCOREBOARD, ...BEDS, ...CRATES, ...BENCHES, ...STALLS]
