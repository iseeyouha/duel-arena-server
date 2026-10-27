// A copy of the game's `src/games/duel-arena/game/lobby/navGrid.ts` (void-casino-games), changed only in
// its import paths: the server walks the court by the same map and rules the game draws. Keep the
// two in step.
import { BLOCKING_BOXES, BLOCKING_CIRCLES, WALK_BOUNDS, onFloor } from './lobbyMap.js'
import type { Point } from './point.js'

// The court — and the passage and the coliseum's gallery beyond its gate — is walked the way the
// game walks: tile by tile. The floor is a grid of one-metre tiles
// with their middles on whole metres, one of them on the origin. A body stands in the middle of a
// tile and steps to any of the eight round it, a diagonal step being one step like any other, so a
// walk is a run of single steps. The way somewhere is searched breadth first over the tiles, and of
// the shortest ways it takes the one that goes diagonally first and straight after, as the game's do.
export const TILE = 1
// A tile is free when a body standing in the middle of it touches nothing: everything is inflated by
// a body's half-width.
const BODY = 0.34

const MIN_COL = Math.ceil((WALK_BOUNDS.minX + BODY) / TILE)
const MAX_COL = Math.floor((WALK_BOUNDS.maxX - BODY) / TILE)
const MIN_ROW = Math.ceil((WALK_BOUNDS.minZ + BODY) / TILE)
const MAX_ROW = Math.floor((WALK_BOUNDS.maxZ - BODY) / TILE)
const COLS = MAX_COL - MIN_COL + 1
const ROWS = MAX_ROW - MIN_ROW + 1

// The eight steps, the four straight ones first.
const DIRECTIONS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const

function blockedAt(x: number, z: number) {
  if (!onFloor(x, z, BODY)) return true
  for (const c of BLOCKING_CIRCLES) {
    const r = c.r + BODY
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < r * r) return true
  }
  for (const b of BLOCKING_BOXES) {
    if (Math.abs(x - b.x) < b.w / 2 + BODY && Math.abs(z - b.z) < b.d / 2 + BODY) return true
  }
  return false
}

function inGrid(col: number, row: number) {
  return col >= MIN_COL && col <= MAX_COL && row >= MIN_ROW && row <= MAX_ROW
}

function indexOf(col: number, row: number) {
  return (row - MIN_ROW) * COLS + (col - MIN_COL)
}

function colOf(index: number) {
  return (index % COLS) + MIN_COL
}

function rowOf(index: number) {
  return Math.floor(index / COLS) + MIN_ROW
}

function tileOf(index: number): Point {
  return { x: colOf(index) * TILE, z: rowOf(index) * TILE }
}

// The tile under a point, or the edge tile nearest it when it is off the grid.
function indexAt(point: Point) {
  const col = Math.min(MAX_COL, Math.max(MIN_COL, Math.round(point.x / TILE)))
  const row = Math.min(MAX_ROW, Math.max(MIN_ROW, Math.round(point.z / TILE)))
  return indexOf(col, row)
}

const free = (() => {
  const grid = new Uint8Array(COLS * ROWS)
  for (let index = 0; index < grid.length; index++) grid[index] = blockedAt(colOf(index) * TILE, rowOf(index) * TILE) ? 0 : 1
  return grid
})()

// A straight step onto a free tile, with nothing standing on the line between the two.
function straight(col: number, row: number, dc: number, dr: number) {
  const c = col + dc
  const r = row + dr
  return inGrid(c, r) && free[indexOf(c, r)] === 1 && !blockedAt((col + dc / 2) * TILE, (row + dr / 2) * TILE)
}

// Each tile's steps out of it, one bit per direction. No cutting a corner: a diagonal step is allowed
// only where both straight steps round it are.
const moves = (() => {
  const grid = new Uint8Array(COLS * ROWS)
  for (let index = 0; index < grid.length; index++) {
    const col = colOf(index)
    const row = rowOf(index)
    DIRECTIONS.forEach(([dc, dr], d) => {
      const allowed =
        dc === 0 || dr === 0
          ? straight(col, row, dc, dr)
          : straight(col, row, dc, 0) && straight(col, row, 0, dr) && straight(col + dc, row, 0, dr) && straight(col, row + dr, dc, 0)
      if (allowed) grid[index] |= 1 << d
    })
  }
  return grid
})()

function stepIndex(from: number, d: number) {
  return (moves[from] & (1 << d)) === 0 ? -1 : indexOf(colOf(from) + DIRECTIONS[d][0], rowOf(from) + DIRECTIONS[d][1])
}

function steps(from: number, to: number) {
  for (let d = 0; d < DIRECTIONS.length; d++) if (stepIndex(from, d) === to) return true
  return false
}

// Reused between searches: the grid is a few hundred tiles and a path is asked for on every click and
// every tick of a follow.
const queue = new Int32Array(COLS * ROWS)
const fromStart = new Int16Array(COLS * ROWS)
const toEnd = new Int16Array(COLS * ROWS)

// How many steps every tile is from `from`, -1 where it can't be reached.
function spread(from: number, out: Int16Array) {
  out.fill(-1)
  out[from] = 0
  queue[0] = from
  let head = 0
  let tail = 1
  while (head < tail) {
    const here = queue[head]
    head += 1
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const next = stepIndex(here, d)
      if (next === -1 || out[next] !== -1) continue
      out[next] = out[here] + 1
      queue[tail] = next
      tail += 1
    }
  }
}

function distanceSq(a: Point, b: Point) {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2
}

// The shortest way from one tile to another as the tiles stepped onto, the start left out. Of the
// steps that keep it shortest, each is the one that ends nearest the end: diagonally first while
// that closes on it, straight after.
function route(from: number, end: number): Point[] {
  const path: Point[] = []
  if (from === end) return path
  spread(end, toEnd)
  const goal = tileOf(end)
  let here = from
  while (here !== end) {
    let best = -1
    let bestDistance = Infinity
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const next = stepIndex(here, d)
      if (next === -1 || toEnd[next] === -1) continue
      const distance = distanceSq(tileOf(next), goal)
      if (best === -1 || toEnd[next] < toEnd[best] || (toEnd[next] === toEnd[best] && distance < bestDistance)) {
        best = next
        bestDistance = distance
      }
    }
    if (best === -1) break
    path.push(tileOf(best))
    here = best
  }
  return path
}

// The tile under a point, if it is one a body can stand on.
export function walkable(x: number, z: number) {
  const col = Math.round(x / TILE)
  const row = Math.round(z / TILE)
  return inGrid(col, row) && free[indexOf(col, row)] === 1
}

// The free tile nearest a point: where a body put down there stands.
export function nearestFree(x: number, z: number): Point {
  let best = -1
  let bestDistance = Infinity
  for (let index = 0; index < free.length; index++) {
    if (free[index] === 0) continue
    const distance = distanceSq(tileOf(index), { x, z })
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  }
  return tileOf(best)
}

// Whether a body can step straight from one tile to the other in one step. Off the grid is nowhere to
// step to.
export function canStep(from: Point, to: Point) {
  return walkable(to.x, to.z) && steps(indexAt(from), indexAt(to))
}

// Standing beside somebody: on one of the four tiles that share a side with theirs, with nothing
// between the two. A diagonal tile is not beside them, as in the game.
export function nextTo(a: Point, b: Point) {
  const from = indexAt(a)
  const to = indexAt(b)
  return Math.abs(colOf(from) - colOf(to)) + Math.abs(rowOf(from) - rowOf(to)) === 1 && steps(from, to)
}

// The way from where a body stands to a point, as the tiles it steps onto, nearest first. Empty when
// it is already there. A point that can't be stood on, or reached, walks it to the tile nearest the
// point that can — a click on a pillar walks you up to the pillar, which is what it means.
export function findPath(start: Point, goal: Point): Point[] {
  const from = indexAt(start)
  spread(from, fromStart)
  let end = from
  let endDistance = Infinity
  for (let index = 0; index < fromStart.length; index++) {
    if (fromStart[index] === -1) continue
    const distance = distanceSq(tileOf(index), goal)
    if (distance < endDistance || (distance === endDistance && fromStart[index] < fromStart[end])) {
      end = index
      endDistance = distance
    }
  }
  return route(from, end)
}

// The way to stand beside somebody (`nextTo`), on whichever of those tiles is fewest steps away.
// When none can be reached, as near them as the court allows.
export function pathNextTo(start: Point, target: Point): Point[] {
  const from = indexAt(start)
  const goal = indexAt(target)
  spread(from, fromStart)
  let end = -1
  for (let d = 0; d < 4; d++) {
    const col = colOf(goal) + DIRECTIONS[d][0]
    const row = rowOf(goal) + DIRECTIONS[d][1]
    if (!inGrid(col, row)) continue
    const side = indexOf(col, row)
    if (fromStart[side] === -1 || !steps(side, goal)) continue
    if (end === -1 || fromStart[side] < fromStart[end]) end = side
  }
  return end === -1 ? findPath(start, target) : route(from, end)
}

// The tiles a body went through between two tiles in one tick: the one step, or a run's two — the
// tile between them the one nearest where it ended, so a run, like a path, goes diagonally first.
// What no step or two of steps join is a jump, given as the tile it landed on.
export function between(from: Point, to: Point): Point[] {
  const a = indexAt(from)
  const b = indexAt(to)
  if (a === b) return []
  if (steps(a, b)) return [tileOf(b)]
  const end = tileOf(b)
  let mid = -1
  let midDistance = Infinity
  for (let d = 0; d < DIRECTIONS.length; d++) {
    const next = stepIndex(a, d)
    if (next === -1 || !steps(next, b)) continue
    const distance = distanceSq(tileOf(next), end)
    if (distance < midDistance) {
      mid = next
      midDistance = distance
    }
  }
  return mid === -1 ? [end] : [tileOf(mid), end]
}

// Somewhere a wandering duellist could go next, near where they are.
export function randomFree(near: Point, radius: number, random: () => number): Point | null {
  for (let tries = 0; tries < 24; tries++) {
    const angle = random() * Math.PI * 2
    const distance = radius * (0.35 + random() * 0.65)
    const x = near.x + Math.sin(angle) * distance
    const z = near.z + Math.cos(angle) * distance
    if (walkable(x, z)) return tileOf(indexAt({ x, z }))
  }
  return null
}
