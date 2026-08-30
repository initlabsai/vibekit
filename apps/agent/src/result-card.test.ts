import { describe, expect, test } from 'bun:test'

import { TRUSTED_VIEW_IDS } from '@initlabs/vibekit/views'

const source = await Bun.file(new URL('./result-card.tsx', import.meta.url)).text()

describe('result card switch', () => {
  test('every trusted view id has its own case', () => {
    for (const id of TRUSTED_VIEW_IDS) {
      expect(source).toContain(`case '${id}':`)
    }
  })

  test('there is no default branch that could swallow a new view id', () => {
    const switchBody = source.slice(source.indexOf('switch (view.view) {', source.indexOf('export function ResultCard')))
    expect(switchBody).not.toContain('default:')
  })
})
