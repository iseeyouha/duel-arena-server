// The game's own tests for this module, run against the server's copy.
import assert from 'node:assert/strict'
import { TICK } from '../src/duel/config.js'
import { RUN_SPEED, RUN_TILES, stepRoute, TURN_RATE, walkAlong, WALK_SPEED, WALK_TILES } from '../src/court/walkPath.js'

function body(path: { x: number; z: number }[], heading = 0) {
  return { x: 0, z: 0, heading, path: [...path] }
}

it('a walk covers speed times time and stops short of a far waypoint', () => {
  const walker = body([{ x: 0, z: 10 }])
  const covered = walkAlong(walker, 2, 0.5)
  assert.equal(covered, 1)
  assert.equal(walker.x, 0)
  assert.equal(walker.z, 1)
  assert.equal(walker.path.length, 1)
})

it('what is left after a waypoint carries on round the corner', () => {
  const walker = body([{ x: 0, z: 1 }, { x: 5, z: 1 }])
  const covered = walkAlong(walker, 3, 1)
  assert.equal(covered, 3)
  assert.equal(walker.path.length, 1)
  assert.ok(Math.abs(walker.x - 2) < 1e-9)
  assert.equal(walker.z, 1)
})

it('the walk ends on the last waypoint and covers only the way there', () => {
  const walker = body([{ x: 0, z: 1.5 }])
  const covered = walkAlong(walker, 3.5, 1)
  assert.equal(covered, 1.5)
  assert.deepEqual({ x: walker.x, z: walker.z }, { x: 0, z: 1.5 })
  assert.equal(walker.path.length, 0)
})

it('a body turns towards its leg no faster than the turn rate', () => {
  const walker = body([{ x: 10, z: 0 }], 0)
  walkAlong(walker, 1, 0.05)
  assert.ok(Math.abs(walker.heading - TURN_RATE * 0.05) < 1e-9)
})

it('standing with nowhere to go covers nothing', () => {
  const walker = body([])
  assert.equal(walkAlong(walker, 3.5, 1), 0)
  assert.deepEqual({ x: walker.x, z: walker.z }, { x: 0, z: 0 })
})

it('a tick walks one tile and runs two, as the game does', () => {
  assert.equal(WALK_TILES, 1)
  assert.equal(RUN_TILES, 2)
  assert.ok(Math.abs(WALK_SPEED * TICK - 1) < 1e-9)
  assert.ok(Math.abs(RUN_SPEED - 2 * WALK_SPEED) < 1e-9)
})

it('a tick takes its steps off the front of the route and stands the body on the last', () => {
  const body = { tile: { x: 0, z: 0 }, route: [{ x: 1, z: 0 }, { x: 2, z: 1 }, { x: 3, z: 1 }] }
  assert.deepEqual(stepRoute(body, RUN_TILES), [{ x: 1, z: 0 }, { x: 2, z: 1 }])
  assert.deepEqual(body.tile, { x: 2, z: 1 })
  assert.deepEqual(stepRoute(body, RUN_TILES), [{ x: 3, z: 1 }])
  assert.deepEqual(body.tile, { x: 3, z: 1 })
  assert.deepEqual(stepRoute(body, WALK_TILES), [])
  assert.deepEqual(body.tile, { x: 3, z: 1 })
})
