// The game's own tests for this module, run against the server's copy.
import assert from 'node:assert/strict'
import { HOUSE_CUT } from '../src/duel/config.js'
import { WIN_MULTIPLIER, settlement } from '../src/duel/settlement.js'

it('the winner takes the pot less the house cut', () => {
  assert.equal(WIN_MULTIPLIER, 1.94)
  assert.equal(settlement(1_000, 'won'), 1_940)
  assert.equal(settlement(1_000, 'won'), Math.floor(2 * 1_000 * (1 - HOUSE_CUT)))
  // Floored, never rounded up: a pot never pays a fraction of a cent it does not have.
  assert.equal(settlement(333, 'won'), 646)
})

it('a draw is each stake back, and a loss is nothing', () => {
  assert.equal(settlement(1_000, 'drawn'), 1_000)
  assert.equal(settlement(1_000, 'lost'), 0)
})
