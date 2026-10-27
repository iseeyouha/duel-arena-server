// The game's own tests for this module, run against the server's copy.
import assert from 'node:assert/strict'
import { DAGGER_SPEED, EAT_DELAY, FOOD_HEAL, HITPOINTS, SPEC_COST, SPEC_FULL, SPEC_REGEN, SPEC_REGEN_TICKS, WHIP_SPEED } from '../src/duel/config.js'
import { specialMaxHit } from '../src/duel/combat.js'
import { combatTick } from '../src/duel/combatTick.js'
import { newDuel } from '../src/duels/newDuel.js'
import { startDuel } from '../src/duel/startDuel.js'
import { NO_RULES } from '../src/duel/rules.js'

// Every roll lands (a low accuracy draw) and hits for the top of the range (a high damage draw).
function landing() {
  let i = 0
  return () => (i++ % 2 === 0 ? 0.001 : 0.99)
}

function fighting() {
  const duel = newDuel('rival', true)
  startDuel(duel, NO_RULES, 1_000, () => 0.5)
  duel.phase = 'fighting'
  return duel
}

it('both whips go on the first tick, together, and come round every four', () => {
  const duel = fighting()
  const first = combatTick(duel, landing())
  assert.ok(first.self && first.rival, 'both attacked')
  for (let tick = 1; tick < WHIP_SPEED; tick++) {
    const quiet = combatTick(duel, landing())
    assert.deepEqual(quiet, { self: null, rival: null })
  }
  const next = combatTick(duel, landing())
  assert.ok(next.self && next.rival)
})

it('damage on the same tick lands on both, and can put both down', () => {
  const duel = fighting()
  duel.self.hp = 1
  duel.rival.hp = 1
  combatTick(duel, landing())
  assert.equal(duel.self.hp, 0)
  assert.equal(duel.rival.hp, 0)
})

it('a shark heals 20, never past full, and costs three ticks of attacking', () => {
  const duel = fighting()
  combatTick(duel, () => 0.001)
  duel.self.hp = 50
  duel.self.eatQueued = true
  const timer = duel.self.attackTimer
  combatTick(duel, () => 0.001)
  assert.equal(duel.self.hp, 50 + FOOD_HEAL)
  assert.equal(duel.self.food, 1)
  assert.equal(duel.self.attackTimer, timer + EAT_DELAY - 1)

  duel.self.hp = HITPOINTS - 5
  duel.self.eatQueued = true
  combatTick(duel, () => 0.001)
  assert.equal(duel.self.hp, HITPOINTS)
})

it('eating drops a fighter out of step with the other one', () => {
  const duel = fighting()
  combatTick(duel, () => 0.001)
  duel.self.eatQueued = true
  let together = 0
  let apart = 0
  for (let tick = 0; tick < 16; tick++) {
    const hits = combatTick(duel, () => 0.001)
    if (hits.self && hits.rival) together++
    else if (hits.self || hits.rival) apart++
  }
  assert.equal(together, 0)
  assert.ok(apart > 0)
})

it('a bite waits for the swing already in the air', () => {
  const duel = fighting()
  // Attacking on this very tick.
  duel.self.attackTimer = 1
  duel.self.eatQueued = true
  const hits = combatTick(duel, () => 0.001)
  assert.ok(hits.rival, 'the swing still went')
  assert.equal(duel.self.food, 2)
  assert.equal(duel.self.eatQueued, true)
})

it('an armed special is two stabs on the next attack, and costs a quarter of the bar', () => {
  const duel = fighting()
  duel.self.specQueued = true
  const hits = combatTick(duel, landing())
  const top = specialMaxHit()
  assert.deepEqual(hits.rival?.stabs, [top, top])
  assert.equal(hits.rival?.damage, 2 * top)
  assert.equal(hits.self?.stabs, undefined)
  assert.equal(duel.rival.hp, HITPOINTS - 2 * top)
  assert.equal(duel.self.spec, SPEC_FULL - SPEC_COST)
  assert.equal(duel.self.specQueued, false)
  assert.equal(duel.self.specLast, true)
  assert.equal(duel.self.attackTimer, DAGGER_SPEED)
  // The next one is the whip again.
  for (let tick = 1; tick < DAGGER_SPEED; tick++) combatTick(duel, landing())
  assert.equal(combatTick(duel, landing()).rival?.stabs, undefined)
  assert.equal(duel.self.specLast, false)
})

it('no special without the bar for it, under "No specials", or boxing', () => {
  for (const rules of [NO_RULES, { ...NO_RULES, noSpec: true }, { ...NO_RULES, noWeapons: true }]) {
    const duel = newDuel('rival', true)
    startDuel(duel, rules, 1_000, () => 0.5)
    duel.phase = 'fighting'
    if (rules === NO_RULES) duel.self.spec = SPEC_COST - 1
    const spec = duel.self.spec
    duel.self.specQueued = true
    const hits = combatTick(duel, landing())
    assert.equal(hits.rival?.stabs, undefined, JSON.stringify(rules))
    assert.equal(duel.self.spec, spec)
    assert.equal(duel.self.specQueued, false)
  }
})

it('the special bar fills back a tenth every fifty ticks, and never past full', () => {
  const duel = fighting()
  duel.self.spec = 50
  duel.rival.spec = SPEC_FULL - 5
  for (let tick = 0; tick < SPEC_REGEN_TICKS; tick++) combatTick(duel, () => 0.999)
  assert.equal(duel.self.spec, 50 + SPEC_REGEN)
  assert.equal(duel.rival.spec, SPEC_FULL)
})
