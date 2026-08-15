import { describe, expect, test } from 'bun:test'

import { TEMPLATES, getTemplate, parseNewArgs, tarballUrl } from '../src/commands/new.js'

describe('vibekit new', () => {
  test('ships the three starter tiers', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['contracts', 'fullstack', 'kitchensink'])
  })

  test('tarball url points at codeload for the template repo', () => {
    expect(tarballUrl(getTemplate('contracts')!)).toBe(
      'https://codeload.github.com/initlabsai/algorand-starter-contracts/tar.gz/refs/heads/main',
    )
  })

  test('parses directory and --template flag', () => {
    expect(parseNewArgs(['my-app', '--template', 'fullstack'])).toEqual({
      dir: 'my-app',
      template: 'fullstack',
    })
    expect(parseNewArgs(['-t', 'contracts', 'my-app'])).toEqual({
      dir: 'my-app',
      template: 'contracts',
    })
    expect(parseNewArgs([])).toEqual({})
  })
})
