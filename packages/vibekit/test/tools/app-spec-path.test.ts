import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { ToolError } from '../../src/core/index.js'

import { contractQueries } from '../../src/tools/contracts/index.js'
import { contractActions } from '../../src/tools/contracts/actions.js'
import { fakeContext } from './fake-context.js'

const SPEC_PATH = new URL('./fixtures/hello-world.arc56.json', import.meta.url).pathname
const tool = (name: string) =>
  [...contractQueries, ...contractActions].find((t) => t.name === name)!

const readDisk = (path: string) => readFile(path, 'utf8')

describe('appSpecPath', () => {
  test('list_app_spec_methods reads the spec from disk', async () => {
    const result = (await tool('list_app_spec_methods').handler(
      fakeContext({ readFile: readDisk }),
      {
        appSpecPath: SPEC_PATH,
      },
    )) as {
      name: string
      methods: Array<{ name: string }>
    }
    expect(result.name).toBe('HelloWorld')
    expect(result.methods.map((m) => m.name)).toEqual(['hello', 'storeMessage', 'getMessage'])
  })

  test('a missing file and a missing spec are distinct, clear errors', async () => {
    await expect(
      tool('list_app_spec_methods').handler(fakeContext({ readFile: readDisk }), {
        appSpecPath: '/nowhere/x.arc56.json',
      }),
    ).rejects.toMatchObject({ code: 'APP_SPEC_NOT_FOUND' })
    const missing = tool('app_deploy').handler(fakeContext({ readFile: readDisk }), { sender: 'A' })
    await expect(missing).rejects.toBeInstanceOf(ToolError)
    await expect(
      tool('app_deploy').handler(fakeContext({ readFile: readDisk }), { sender: 'A' }),
    ).rejects.toMatchObject({
      code: 'APP_SPEC_REQUIRED',
    })
  })

  test('every spec-taking tool offers the path form', () => {
    for (const name of [
      'app_deploy',
      'app_update',
      'app_call',
      'list_app_spec_methods',
      'read_global_state',
      'read_local_state',
      'read_box_state',
    ]) {
      const shape = (tool(name).parameters as unknown as { shape: Record<string, unknown> }).shape
      expect(Object.keys(shape)).toContain('appSpecPath')
    }
  })
})

describe('appSpecPath on a deployment with no file grant', () => {
  test('refuses the path form instead of reading the host filesystem', async () => {
    const tool = contractQueries.find((entry) => entry.name === 'list_app_spec_methods')!
    await expect(
      tool.handler(fakeContext({}), { appSpecPath: '/etc/hostname' }),
    ).rejects.toMatchObject({ code: 'APP_SPEC_PATH_UNAVAILABLE' })
  })
})
