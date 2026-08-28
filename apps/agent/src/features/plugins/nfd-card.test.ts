import { describe, expect, test } from 'bun:test'

import { nfdFactsFor } from './nfd-card'

describe('NFD card facts', () => {
  test('orders common fields into useful two-column pairs', () => {
    const facts = nfdFactsFor({
      name: 'gabe.algo',
      address: 'DEPOSIT',
      appId: 763843768,
      properties: {
        twitter: '@gabrielkuettel',
        github: 'gabrielkuettel',
        discord: '249649086968496128',
        email: 'gabriel.kuettel@algorand.foundation',
        bio: 'not a fact row',
      },
    })

    expect(facts).toEqual([
      { label: 'app', value: '763843768' },
      { label: 'twitter', value: '@gabrielkuettel' },
      { label: 'discord', value: '249649086968496128' },
      { label: 'github', value: 'gabrielkuettel' },
      { label: 'email', value: 'gabriel.kuettel@algorand.foundation' },
    ])
  })

  test('omits an owner that repeats the deposit address', () => {
    expect(nfdFactsFor({ name: 'same.algo', address: 'SAME', owner: 'SAME' })).toEqual([])
  })
})
