import { describe, expect, test } from 'bun:test'
import { ToolError } from '../../src/core/index.js'

import { contractTools } from '../../src/tools/contracts/index.js'
import { contractWriteTools } from '../../src/tools/contracts/tools-write.js'
import { fakeContext } from './fake-context.js'

const SPEC_PATH = new URL('./fixtures/hello-world.arc56.json', import.meta.url).pathname
const tool = (name: string) =>
  [...contractTools, ...contractWriteTools].find((t) => t.name === name)!

describe('appSpecPath', () => {
  test('app_list_methods reads the spec from disk', async () => {
    const result = (await tool('app_list_methods').handler(fakeContext({}), {
      appSpecPath: SPEC_PATH,
    })) as {
      name: string
      methods: Array<{ name: string }>
    }
    expect(result.name).toBe('HelloWorld')
    expect(result.methods.map((m) => m.name)).toEqual(['hello', 'storeMessage', 'getMessage'])
  })

  test('a missing file and a missing spec are distinct, clear errors', async () => {
    await expect(
      tool('app_list_methods').handler(fakeContext({}), { appSpecPath: '/nowhere/x.arc56.json' }),
    ).rejects.toMatchObject({ code: 'APP_SPEC_NOT_FOUND' })
    const missing = tool('app_deploy').handler(fakeContext({}), { sender: 'A' })
    await expect(missing).rejects.toBeInstanceOf(ToolError)
    await expect(
      tool('app_deploy').handler(fakeContext({}), { sender: 'A' }),
    ).rejects.toMatchObject({
      code: 'APP_SPEC_REQUIRED',
    })
  })

  test('every spec-taking tool offers the path form', () => {
    for (const name of [
      'app_deploy',
      'app_update',
      'app_call',
      'app_list_methods',
      'read_global_state',
      'read_local_state',
      'read_box_state',
    ]) {
      const shape = (tool(name).parameters as { shape: Record<string, unknown> }).shape
      expect(Object.keys(shape)).toContain('appSpecPath')
    }
  })
})
