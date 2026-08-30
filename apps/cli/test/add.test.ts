import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { addComponents, listComponents, parseAddArgs } from '../src/components/index.js'

describe('vibekit add', () => {
  test('every bundled component names its files and a description', () => {
    const names = listComponents().map((c) => c.name)
    expect(names).toEqual(['account', 'action', 'approval', 'asset', 'companion', 'tool-result', 'transaction'])
    for (const component of listComponents()) {
      expect(component.description.length).toBeGreaterThan(10)
      expect(component.files.length).toBeGreaterThan(0)
    }
  })

  test('writes the files once, keeps a differing file unless forced, dedups shared files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vibekit-add-'))
    const first = await addComponents(['transaction', 'asset'], dir)
    expect(first.written.sort()).toEqual(['asset.tsx', 'components.css', 'format.ts', 'transaction.tsx'])
    await writeFile(join(dir, 'format.ts'), '// mine\n')
    const second = await addComponents(['account'], dir)
    expect(second).toEqual({ written: ['account.tsx'], kept: ['format.ts'], unchanged: ['components.css'] })
    const forced = await addComponents(['account'], dir, true)
    expect(forced.written).toEqual(['format.ts'])
    expect(await readFile(join(dir, 'format.ts'), 'utf-8')).toContain('formatMicroAlgos')
    await expect(addComponents(['nope'], dir)).rejects.toThrow('Unknown component: nope')
  })

  test('parses names, --dir, --force, --list', () => {
    expect(parseAddArgs(['companion', 'asset', '--dir', 'src/ui', '-f'])).toEqual({ names: ['companion', 'asset'], dir: 'src/ui', force: true, list: false })
    expect(parseAddArgs(['--list'])).toMatchObject({ names: [], dir: 'components', list: true })
  })
})
