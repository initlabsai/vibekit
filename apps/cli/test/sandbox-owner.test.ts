import { describe, expect, test } from 'bun:test'

import { LOCALNET_PROJECT } from '../src/commands/localnet/compose.js'
import { Sandbox, parsePortOwner } from '../src/commands/localnet/sandbox.js'

describe('port ownership', () => {
  test('parses the docker ps line into a compose project owner', () => {
    const line = 'algokit_sandbox_algod\talgokit_sandbox\t/home/me/.config/algokit/sandbox\n'
    expect(parsePortOwner(line)).toEqual({
      container: 'algokit_sandbox_algod',
      project: 'algokit_sandbox',
      workingDir: '/home/me/.config/algokit/sandbox',
    })
    expect(parsePortOwner('')).toBeUndefined()
    expect(parsePortOwner('plain_container\t\t\n')).toBeUndefined()
  })

  test('a sandbox adopts a foreign project but never our own', () => {
    expect(new Sandbox('/tmp/x', { project: 'algokit_sandbox' }).adopted).toBe(true)
    expect(new Sandbox('/tmp/x', { project: LOCALNET_PROJECT }).adopted).toBe(false)
    expect(new Sandbox('/tmp/x').adopted).toBe(false)
    // Adopted projects are driven by name; no compose files of ours are required.
    expect(new Sandbox('/tmp/x', { project: 'algokit_sandbox' }).composeFilesExist()).toBe(true)
  })
})
