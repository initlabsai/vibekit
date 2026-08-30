/**
 * Vendored JetBrains Mono for Satori. The previous version fetched Google
 * Fonts CSS and regexed a URL out of it on every render — ~300ms inside X's
 * crawl and a live failure mode on someone else's uptime.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const medium = readFile(join(process.cwd(), 'assets/JetBrainsMono-Medium.ttf'))
const bold = readFile(join(process.cwd(), 'assets/JetBrainsMono-Bold.ttf'))

export async function ogFonts(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: 500 | 700 }>
> {
  const [mediumData, boldData] = await Promise.all([medium, bold])
  return [
    { name: 'JetBrains Mono', data: mediumData.buffer as ArrayBuffer, weight: 500 },
    { name: 'JetBrains Mono', data: boldData.buffer as ArrayBuffer, weight: 700 },
  ]
}
