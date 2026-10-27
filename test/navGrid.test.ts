// The game's own tests for this module, run against the server's copy.
import assert from 'node:assert/strict'
import { STATUE } from '../src/court/lobbyMap.js'
import { between, canStep, findPath, nearestFree, nextTo, pathNextTo, TILE, walkable } from '../src/court/navGrid.js'
import type { Point } from '../src/court/point.js'

function walk(start: Point, path: Point[]) {
  let here = nearestFree(start.x, start.z)
  for (const tile of path) {
    assert.ok(canStep(here, tile), `step ${JSON.stringify(here)} -> ${JSON.stringify(tile)} is not one step`)
    here = tile
  }
  return here
}

it('a walk is a run of single steps from tile to tile', () => {
  const path = findPath({ x: -3, z: 6 }, { x: 3, z: 4 })
  assert.equal(path.length, 6)
  walk({ x: -3, z: 6 }, path)
  for (const tile of path) assert.ok(Number.isInteger(tile.x / TILE) && Number.isInteger(tile.z / TILE))
})

it('open ground is walked diagonally first and straight after', () => {
  assert.deepEqual(findPath({ x: 0, z: 0 }, { x: 5, z: 2 }), [
    { x: 1, z: 1 },
    { x: 2, z: 2 },
    { x: 3, z: 2 },
    { x: 4, z: 2 },
    { x: 5, z: 2 },
  ])
})

it('a click anywhere on a tile walks to that tile', () => {
  const path = findPath({ x: 0, z: 3 }, { x: 2.3, z: 5.4 })
  assert.deepEqual(path[path.length - 1], { x: 2, z: 5 })
})

it('standing on the tile clicked goes nowhere', () => {
  assert.deepEqual(findPath({ x: 0, z: 3 }, { x: 0.2, z: 2.9 }), [])
})

it('the statue is walked round, never through', () => {
  const start = { x: 0, z: 1 }
  const goal = { x: 0, z: -6 }
  const end = walk(start, findPath(start, goal))
  assert.deepEqual(end, goal)
})

it('a click inside something walks up to it', () => {
  const start = { x: 0, z: 6 }
  const end = walk(start, findPath(start, { x: STATUE.x, z: STATUE.z }))
  assert.ok(walkable(end.x, end.z))
  assert.ok(Math.hypot(end.x - STATUE.x, end.z - STATUE.z) < STATUE.r + 1.2)
})

it('no step cuts a corner: a diagonal needs both straight tiles round it free', () => {
  for (let x = -12; x <= 12; x++) {
    for (let z = -10; z <= 10; z++) {
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!canStep({ x, z }, { x: x + dx, z: z + dz })) continue
        assert.ok(walkable(x + dx, z) && walkable(x, z + dz), `${x},${z} by ${dx},${dz}`)
      }
    }
  }
})

it('going up to somebody ends on a tile beside theirs, never a diagonal one', () => {
  const target = { x: 4, z: 6 }
  const end = walk({ x: -2, z: 2 }, pathNextTo({ x: -2, z: 2 }, target))
  assert.ok(nextTo(end, target))
  assert.equal(Math.abs(end.x - target.x) + Math.abs(end.z - target.z), TILE)
  assert.ok(!nextTo({ x: 3, z: 5 }, target))
})

it('already beside them is already there', () => {
  assert.deepEqual(pathNextTo({ x: 3, z: 6 }, { x: 4, z: 6 }), [])
})

it("a tick's run of two is drawn through the tile between, diagonally first", () => {
  assert.deepEqual(between({ x: 0, z: 3 }, { x: 1, z: 3 }), [{ x: 1, z: 3 }])
  assert.deepEqual(between({ x: 0, z: 3 }, { x: 2, z: 3 }), [{ x: 1, z: 3 }, { x: 2, z: 3 }])
  assert.deepEqual(between({ x: 0, z: 3 }, { x: 2, z: 4 }), [{ x: 1, z: 4 }, { x: 2, z: 4 }])
})

it('the free tile nearest a spot inside something is one a body can stand on', () => {
  const tile = nearestFree(STATUE.x, STATUE.z)
  assert.ok(walkable(tile.x, tile.z))
})
