import { describe, expect, test } from 'bun:test'

import { appsKeybar, handleAppsKey, type AppsKeys } from '../src/features/apps/keys.js'
import { keybarFor } from '../src/keys.js'

function apps(overrides: Partial<AppsKeys> = {}): AppsKeys & { calls: string[] } {
  const calls: string[] = []
  const log = (name: string) => () => calls.push(name)
  return {
    calls,
    detailOpen: false,
    methodOpen: false,
    close: log('close'),
    activate: (index) => calls.push(`activate ${index}`),
    selectMethod: (index) => calls.push(`method ${index}`),
    submit: log('submit'),
    open: log('open'),
    deploy: log('deploy'),
    cycleAccount: (delta) => calls.push(`cycle ${delta}`),
    ...overrides,
  }
}
const key = (name: string) => ({ name, preventDefault: () => {} })

describe('apps screen keys', () => {
  test('esc peels an open card before it leaves the screen', () => {
    const open = apps({ detailOpen: true })
    expect(handleAppsKey(key('escape'), open)).toBe(true)
    expect(open.calls).toEqual(['close'])
    expect(handleAppsKey(key('escape'), apps())).toBe(false)
  })

  test('digits pick a card, then a method; o and d act on the open card', () => {
    const list = apps()
    handleAppsKey(key('2'), list)
    expect(list.calls).toEqual(['activate 2'])
    const open = apps({ detailOpen: true })
    handleAppsKey(key('3'), open)
    handleAppsKey(key('o'), open)
    handleAppsKey(key('d'), open)
    expect(open.calls).toEqual(['method 3', 'open', 'deploy'])
  })

  test('enter submits only while a method line has the input', () => {
    const typing = apps({ detailOpen: true, methodOpen: true })
    handleAppsKey(key('return'), typing)
    handleAppsKey(key('o'), typing)
    expect(typing.calls).toEqual(['submit'])
  })

  test('the keybar names what enter and the digits do', () => {
    expect(appsKeybar({ deployOpen: false, selectedMethod: null, selected: null })).toContain(
      '1-9 open',
    )
    expect(
      appsKeybar({ deployOpen: false, selectedMethod: { readonly: true }, selected: { appId: 1 } }),
    ).toContain('enter simulate')
    expect(
      appsKeybar({ deployOpen: true, selectedMethod: null, selected: { appId: 1 } }),
    ).toContain('enter deploy')
  })
})

describe('keybar', () => {
  const base = {
    modalOpen: false,
    screen: 'chat' as const,
    focus: 'composer' as const,
    apps: { deployOpen: false, selectedMethod: null, selected: null },
    tailRunning: false,
    cardActions: {},
    sectionCount: 0,
  }

  test('a modal owns the keyboard', () => {
    expect(keybarFor({ ...base, modalOpen: true, screen: 'apps' })).toBe('enter approve · esc deny')
  })

  test('the feed only offers keys a card in reach can take', () => {
    const feed = { ...base, focus: 'content' as const }
    expect(keybarFor(feed)).not.toContain('t txns')
    expect(keybarFor({ ...feed, cardActions: { t: () => {}, rows: true } })).toContain(
      '1-9 open row · t txns',
    )
  })
})
