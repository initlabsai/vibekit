import type { ReactNode } from 'react'

import { ShellMount } from '../../src/shell-mount'

/** Every explorer route lives inside the client-only shell; `/s/[hash]` stays outside so a crawler needs no JavaScript. */
export default function ExplorerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ShellMount>{children}</ShellMount>
}
