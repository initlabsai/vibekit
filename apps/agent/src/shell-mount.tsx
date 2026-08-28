'use client'

/** Mounts the Explorer shell client-only: the wallet manager touches browser storage and must not render on the server. */
import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

const ExplorerShell = dynamic(() => import('./explorer').then((module) => module.ExplorerShell), {
  ssr: false,
})

export function ShellMount({ children }: { children: ReactNode }) {
  return <ExplorerShell>{children}</ExplorerShell>
}
