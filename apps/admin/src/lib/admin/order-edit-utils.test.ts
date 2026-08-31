import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { orderEditSubtotal, orderEditTotal } from './order-edit-utils'

describe('order edit preview math', () => {
  it('sums line prices and quantities', () => {
    assert.equal(orderEditSubtotal([{ price: 1200, quantity: 2 }, { price: 800, quantity: 1 }]), 3200)
  })

  it('caps discount at subtotal and never returns a negative total', () => {
    assert.equal(orderEditTotal(3200, 120, 5000), 120)
    assert.equal(orderEditTotal(100, 0, 1000), 0)
  })
})
