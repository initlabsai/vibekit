'use client'

/** The Explorer mounts client-only: the wallet manager touches browser storage and must not render on the server. */
import dynamic from 'next/dynamic'

const Explorer = dynamic(() => import('../src/explorer').then((module) => module.Explorer), {
  ssr: false,
})

export default function Page() {
  return <Explorer />
}
