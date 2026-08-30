import pc from 'picocolors'

import { amber, teal } from '../brand.js'
import { addComponents, listComponents, parseAddArgs } from '../components/index.js'

export async function commandAdd(args: string[]): Promise<void> {
  const { names, dir, force, list } = parseAddArgs(args)
  if (list || names.length === 0) {
    console.log(pc.bold('Components (vibekit add <name…> [--dir components] [--force]):'))
    for (const component of listComponents()) {
      console.log(`  ${amber(component.name.padEnd(14))} ${component.description}  ${pc.dim(component.files.join(', '))}`)
    }
    return
  }
  const result = await addComponents(names, dir, force)
  for (const path of result.written) console.log(`${teal('+')} ${dir}/${path}`)
  for (const path of result.unchanged) console.log(`${pc.dim('=')} ${dir}/${path} ${pc.dim('(unchanged)')}`)
  for (const path of result.kept) console.log(`${pc.yellow('!')} ${dir}/${path} ${pc.dim('exists and differs; --force to overwrite')}`)
  const needsReact = result.written.some((path) => path.endsWith('.tsx') || path === 'action.ts')
  if (needsReact) console.log(pc.dim('\nThe files import react and @initlabs/vibekit; the .css files are yours to restyle.'))
}
