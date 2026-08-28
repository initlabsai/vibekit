'use client'

/** `/assets`: what an account holds, paged. */
import { useEffect } from 'react'

import { useExplorer } from '../../explorer'
import { ResultCard } from '../../result-card'
import { useScreenRecord } from '../../screen-record'
import { AddressPicker, useScreenAddress } from '../address-picker'

export function AssetsScreen() {
  const { host, live, openTarget, network } = useExplorer()
  const [address, setAddress] = useScreenAddress()
  const record = useScreenRecord()
  const { run } = record
  useEffect(() => {
    if (!address || live === 'probing') return
    void run('asset.holdings', () => host().lookupAccountAssets(address))
  }, [address, host, live, run])
  return (
    <section className="screen">
      <header className="screen-head">
        <span className="kicker">assets</span>
        <span className="muted"> · {network}</span>
      </header>
      <AddressPicker address={address} onChange={setAddress} noun="assets" />
      {record.loading ? <p className="note">loading…</p> : null}
      {record.error ? <p className="note note-error">{record.error}</p> : null}
      {record.view ? (
        <ScreenCard record={record} onOpen={openTarget} />
      ) : null}
    </section>
  )
}

/** A screen's record as the same card the feed would show, paging in place. */
export function ScreenCard({
  record,
  onOpen,
}: {
  record: ReturnType<typeof useScreenRecord>
  onOpen: Parameters<typeof ResultCard>[0]['onOpen']
}) {
  const { store } = useExplorer()
  if (!record.view) return null
  return (
    <ResultCard
      store={store}
      view={record.view}
      onOpen={onOpen}
      onMore={() => void record.more()}
      loadingMore={record.loadingMore}
    />
  )
}
