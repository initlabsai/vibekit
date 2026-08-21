import { describe, expect, test } from 'bun:test'
import { homedir } from 'os'
import { sep } from 'path'

import { expandPath } from '../src/utils/paths.js'

describe('expandPath', () => {
  test('expands ~, ~/ and ~\\ to the home directory', () => {
    expect(expandPath('~')).toBe(homedir())
    expect(expandPath('~/vibekit-test')).toBe(`${homedir()}${sep}vibekit-test`)
    expect(expandPath('~\\vibekit-test')).toBe(`${homedir()}${sep}vibekit-test`)
  })

  test('never produces a literal ~ directory under cwd', () => {
    expect(expandPath('~/x')).not.toContain(`${sep}~`)
  })
})
