// The game's own tests for this module, run against the server's copy.
import assert from 'node:assert/strict'
import { botLoadout, botTick } from '../src/duel/bot.js'
import { COUNTDOWN, HITPOINTS, TICK } from '../src/duel/config.js'
import { newDuel } from '../src/duels/newDuel.js'
import { NO_RULES, type DuelRules } from '../src/duel/rules.js'
import { startDuel } from '../src/duel/startDuel.js'
import { stepDuel } from '../src/duel/stepDuel.js'
import type { Duel } from '../src/duel/types.js'

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STAKE = 1_000

// Fights a duel to the end through the real loop. With `mirror`, the player's side is played by the
// same bot logic the opponent uses — two equal fighters.
function fightOut(rules: DuelRules, random: () => number, mirror = true) {
  const duel = newDuel('rival', true)
  startDuel(duel, rules, STAKE, random)
  if (mirror) Object.assign(duel.self, botLoadout(rules, duel.self.spec, random))
  let steps = 0
  while (duel.phase === 'countdown' || duel.phase === 'fighting') {
    assert.ok(steps++ < 20_000, 'the duel never settled')
    if (mirror) botTick(duel.self, rules, random)
    stepDuel(duel, TICK, random)
  }
  return duel
}

it('nothing is traded until the countdown is out', () => {
  const duel = newDuel('rival', true)
  startDuel(duel, NO_RULES, STAKE)
  const random = mulberry32(1)
  for (let elapsed = 0; elapsed < COUNTDOWN - 0.5; elapsed += 0.5) {
    assert.equal(stepDuel(duel, 0.5, random), null)
    assert.equal(duel.phase, 'countdown')
  }
  assert.equal(stepDuel(duel, 0.5, random), 'fight')
  assert.equal(duel.lastExchange, null)
  assert.equal(duel.self.hp + duel.rival.hp, 2 * HITPOINTS)
})

it('a frame the browser sat on still only runs one tick', () => {
  const duel = newDuel('rival', true)
  startDuel(duel, NO_RULES, STAKE)
  const random = mulberry32(2)
  stepDuel(duel, COUNTDOWN, random)
  stepDuel(duel, 100, random)
  assert.ok(duel.self.attacks <= 1 && duel.rival.attacks <= 1)
})

it('a duel settles, says how, and hands the arena back to the lobby', () => {
  const random = mulberry32(3)
  for (let run = 0; run < 200; run++) {
    const duel = fightOut(NO_RULES, random)
    assert.equal(duel.phase, 'settled')
    assert.equal(duel.drawn, duel.self.hp <= 0 && duel.rival.hp <= 0)
    assert.equal(duel.won, duel.rival.hp <= 0 && duel.self.hp > 0)
    let steps = 0
    while (duel.phase === 'settled') {
      stepDuel(duel, 0.5, random)
      assert.ok(steps++ < 100)
    }
    assert.equal(duel.phase, 'lobby')
  }
})

// The bots are people for now, and they have to fight like an equal one: no peeking at the stake,
// no hidden edge. Two of them against each other is a coin.
function balance(rules: DuelRules, seed: number) {
  const random = mulberry32(seed)
  let won = 0
  let lost = 0
  let drawn = 0
  const runs = 6_000
  for (let run = 0; run < runs; run++) {
    const duel: Duel = fightOut(rules, random)
    if (duel.drawn) drawn++
    else if (duel.won) won++
    else lost++
  }
  return { won: won / runs, lost: lost / runs, drawn: drawn / runs }
}

it('a bot is an even match for a player who fights like one', () => {
  const fights: [DuelRules, number][] = [
    [NO_RULES, 10],
    [{ noFood: true, noArmour: true, noWeapons: false, noSpec: false }, 11],
    [{ ...NO_RULES, noWeapons: true }, 12],
    [{ ...NO_RULES, noSpec: true }, 13],
  ]
  for (const [rules, seed] of fights) {
    const { won, lost, drawn } = balance(rules, seed)
    assert.ok(Math.abs(won - lost) < 0.035, `${JSON.stringify(rules)}: won ${won}, lost ${lost}`)
    assert.ok(drawn < 0.15, `drawn ${drawn}`)
  }
})

it('nobody eats under "No food", and a bot does eat when it may', () => {
  const random = mulberry32(21)
  const starved = fightOut({ ...NO_RULES, noFood: true }, random)
  assert.equal(starved.rival.food, 0)
  let ate = 0
  for (let run = 0; run < 50; run++) if (fightOut(NO_RULES, random).rival.food < 2) ate++
  assert.ok(ate > 25)
})

it('a bot spends its special, and never under "No specials"', () => {
  const random = mulberry32(31)
  let specced = 0
  for (let run = 0; run < 40; run++) if (fightOut(NO_RULES, random).rival.spec < 100) specced++
  assert.ok(specced > 30)
  for (let run = 0; run < 20; run++) assert.equal(fightOut({ ...NO_RULES, noSpec: true }, random).rival.spec, 100)
})

it('a duel against a person leaves the rival eating and specials to them', () => {
  const random = mulberry32(7)
  const duel = newDuel('rival', true)
  duel.botRival = false
  startDuel(duel, NO_RULES, STAKE, random)
  assert.equal(duel.rival.specQueued, false)
  assert.equal(duel.rival.eatBelow, 0)
  duel.rival.hp = 5
  const food = duel.rival.food
  stepDuel(duel, COUNTDOWN, random)
  for (let i = 0; i < 20; i++) stepDuel(duel, TICK, random)
  assert.equal(duel.rival.food, food)
  assert.ok(duel.rival.attacks > 0, 'still attacks on its timer')
  assert.ok(!duel.rival.specLast)
})

it('the fight counts its ticks, and a new duel starts from none', () => {
  const random = mulberry32(3)
  const duel = newDuel('rival', true)
  startDuel(duel, NO_RULES, STAKE, random)
  stepDuel(duel, COUNTDOWN, random)
  for (let i = 0; i < 5; i++) stepDuel(duel, TICK, random)
  assert.equal(duel.ticks, 5)
  startDuel(duel, NO_RULES, STAKE, random)
  assert.equal(duel.ticks, 0)
})
