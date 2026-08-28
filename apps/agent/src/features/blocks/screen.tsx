'use client'

/** `/blocks`: the chain as it happens. */
import { useExplorer } from '../../explorer'
import { BlockListCard } from './cards'
import { useBlockTail } from './hooks'

export function BlocksScreen() {
  const { host, live, latestRound, openTarget, network } = useExplorer()
  const { rows, error } = useBlockTail({ host, live, latestRound })
  return (
    <section className="screen">
      <header className="screen-title">
        <span className="kicker">blocks</span>
        <span className="muted"> · {network}</span>
      </header>
      {live !== true ? (
        <p className="note">The tail needs a reachable network — {network} is {live === 'probing' ? 'still probing' : 'unreachable'}.</p>
      ) : error ? (
        <p className="note note-error">{error}</p>
      ) : (
        <BlockListCard blocks={rows} tailing onOpen={(round) => openTarget({ kind: 'block', round })} />
      )}
    </section>
  )
}
