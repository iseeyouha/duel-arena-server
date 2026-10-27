// A copy of the game's `src/games/duel-arena/game/lobby/walkPath.ts` (void-casino-games), changed only in
// its import paths: the server walks the court by the same map and rules the game draws. Keep the
// two in step.
import { TICK } from '../duel/config.js'
import { TILE } from './navGrid.js'
import type { Point } from './point.js'

// How a body gets along its route: on the game's ticks, a tile a tick walking and two running, and
// drawn between the tiles in the meantime.

// Tiles a tick, walking and running, and what that comes to in metres a second along a straight line
// of tiles: a diagonal step is longer, and drawn that much faster, as it is in the game. And how fast a
// body turns to face where it is going.
export const WALK_TILES = 1
export const RUN_TILES = 2
export const WALK_SPEED = (WALK_TILES * TILE) / TICK
export const RUN_SPEED = (RUN_TILES * TILE) / TICK
export const TURN_RATE = 9

export type Mover = Point & {
  heading: number
  // Waypoints still to reach, nearest first.
  path: Point[]
}

// One tick of a body on its route: `tiles` steps off the front of it, or what is left of it. Returns
// the tiles stepped onto, in order; the last is the tile the body now stands on.
export function stepRoute(body: { tile: Point; route: Point[] }, tiles: number): Point[] {
  const stepped = body.route.splice(0, tiles)
  if (stepped.length > 0) body.tile = stepped[stepped.length - 1]
  return stepped
}

export function turnTowards(body: { heading: number }, heading: number, dt: number) {
  let delta = heading - body.heading
  delta = Math.atan2(Math.sin(delta), Math.cos(delta))
  const step = TURN_RATE * dt
  body.heading += Math.abs(delta) <= step ? delta : Math.sign(delta) * step
}

// One frame of a body drawn along its waypoints at `speed`. Returns the distance covered, which is
// what a stride is advanced by: a stride counted in seconds skates the feet whenever the speed changes.
export function walkAlong(body: Mover, speed: number, dt: number) {
  let budget = speed * dt
  let covered = 0
  while (budget > 0 && body.path.length > 0) {
    const next = body.path[0]
    const dx = next.x - body.x
    const dz = next.z - body.z
    const distance = Math.hypot(dx, dz)
    if (distance > 1e-4) turnTowards(body, Math.atan2(dx, dz), dt)
    if (distance <= budget) {
      body.x = next.x
      body.z = next.z
      body.path.shift()
      budget -= distance
      covered += distance
    } else {
      body.x += (dx / distance) * budget
      body.z += (dz / distance) * budget
      covered += budget
      budget = 0
    }
  }
  return covered
}
