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
    expect(parseNewArgs(['my-app', '--template', 'fullstack'])).toMatchObject({
      dir: 'my-app',
      template: 'fullstack',
      noInit: false,
    })
    expect(parseNewArgs(['-t', 'contracts', 'my-app'])).toMatchObject({
      dir: 'my-app',
      template: 'contracts',
    })
    expect(parseNewArgs([])).toMatchObject({ noInit: false, init: { yes: false } })
  })

  test('parses headless flags and passes init flags through', () => {
    const parsed = parseNewArgs([
      'my-app',
      '-t',
      'contracts',
      '--yes',
      '--agents',
      'claude,codex',
      '--skills',
      'none',
      '--mcps',
      'vibekit',
      '--overwrite',
    ])
    expect(parsed).toMatchObject({
      dir: 'my-app',
      template: 'contracts',
      noInit: false,
      init: {
        dir: 'my-app',
        yes: true,
        overwrite: true,
        agents: ['claude', 'codex'],
        skills: [],
        mcps: ['vibekit'],
      },
    })
    expect(parseNewArgs(['my-app', '-t', 'contracts', '--no-init']).noInit).toBe(true)
  })
})
