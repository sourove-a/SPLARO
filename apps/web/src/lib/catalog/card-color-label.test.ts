import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cardColorLabel } from './card-color-label.ts'

describe('cardColorLabel', () => {
  it('shows the name for one named color', () => {
    assert.equal(cardColorLabel([{ name: 'Pink', hex: '#f8c8d8' }]), 'Pink')
  })

  it('pluralizes two or more colors', () => {
    assert.equal(
      cardColorLabel([
        { name: 'Pink', hex: '#f8c8d8' },
        { name: 'Black', hex: '#111111' },
      ]),
      '2 colors',
    )
  })

  it('hides the line when there are no names or hexes', () => {
    assert.equal(cardColorLabel(), null)
    assert.equal(cardColorLabel([], []), null)
  })
})
