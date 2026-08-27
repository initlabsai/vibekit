import { describe, expect, test } from 'bun:test'

import { copyableIdent, selectedTextToCopy } from '../src/copy-selection.js'

describe('copy on select', () => {
  test('copies any non-empty selection as-is', () => {
    expect(selectedTextToCopy({ getSelectedText: () => 'SMOKE1' })).toBe('SMOKE1')
    expect(selectedTextToCopy({ getSelectedText: () => '  pay  ' })).toBe('  pay  ')
  })

  test('ignores empty drags', () => {
    expect(selectedTextToCopy({ getSelectedText: () => '' })).toBeUndefined()
  })
})

describe('copyable identifiers', () => {
  test('keeps the full value, including numbers', () => {
    expect(copyableIdent('5WJBEYDHLBZ2GPCJDL44THTEP7YYXDKUDJOPG4IDGNYCUSFL7CQQ')).toBe(
      '5WJBEYDHLBZ2GPCJDL44THTEP7YYXDKUDJOPG4IDGNYCUSFL7CQQ',
    )
    expect(copyableIdent(64241214)).toBe('64241214')
  })

  test('skips empty placeholders', () => {
    expect(copyableIdent(undefined)).toBeUndefined()
    expect(copyableIdent('')).toBeUndefined()
    expect(copyableIdent('—')).toBeUndefined()
  })
})
