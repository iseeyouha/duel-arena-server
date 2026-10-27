// The game's own tests for this module, run against the server's copy.
import assert from 'node:assert/strict'
import { ARMOUR_DEFENCE } from '../src/duel/config.js'
import { attackRoll, defenceRoll, hitChance, maxHit, rollAttack, specialMaxHit } from '../src/duel/combat.js'

it('a maxed whip hits up to 24', () => {
  assert.equal(maxHit(), 24)
  assert.equal(maxHit('whip'), 24)
})

it('bare fists hit up to 11, and land less often than a whip', () => {
  assert.equal(maxHit('fists'), 11)
  for (const armour of [0, ARMOUR_DEFENCE]) {
    assert.ok(hitChance(attackRoll('fists'), defenceRoll(armour)) < hitChance(attackRoll('whip'), defenceRoll(armour)))
  }
})

it('the accuracy formula is the game\'s, both sides of the even line', () => {
  assert.equal(hitChance(100, 200), 100 / 402)
  assert.equal(hitChance(300, 100), 1 - 102 / 602)
  assert.ok(Math.abs(hitChance(1000, 1000) - 1000 / 2002) < 1e-12)
})

it('armour is worth defence', () => {
  const lash = attackRoll()
  assert.ok(hitChance(lash, defenceRoll(0)) > hitChance(lash, defenceRoll(ARMOUR_DEFENCE)))
  assert.equal(defenceRoll(), defenceRoll(ARMOUR_DEFENCE))
})

it('a landed attack is anything from 0 to the max hit, evenly', () => {
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const counts = new Array(maxHit() + 1).fill(0)
  let landed = 0
  const runs = 200_000
  for (let i = 0; i < runs; i++) {
    const damage = rollAttack(0, 'whip', random)
    assert.ok(damage >= 0 && damage <= maxHit() && Number.isInteger(damage))
    counts[damage]++
    if (damage > 0) landed++
  }
  const chance = hitChance(attackRoll(), defenceRoll(0))
  const perFace = (chance * runs) / counts.length
  for (let face = 1; face < counts.length; face++) assert.ok(Math.abs(counts[face] - perFace) < perFace * 0.08, `face ${face}`)
  assert.ok(Math.abs(landed / runs - chance * (1 - 1 / counts.length)) < 0.01)
})

it("the dagger's special stabs up to 19, more accurately than the dagger, but no whip", () => {
  assert.equal(maxHit('dagger'), 17)
  assert.equal(specialMaxHit(), 19)
  assert.ok(specialMaxHit() < maxHit('whip'))
  for (const armour of [0, ARMOUR_DEFENCE]) {
    const plain = hitChance(attackRoll('dagger'), defenceRoll(armour))
    const special = hitChance(attackRoll('dagger', 1.15), defenceRoll(armour))
    assert.ok(special > plain)
    assert.ok(special < hitChance(attackRoll('whip'), defenceRoll(armour)))
  }
})
