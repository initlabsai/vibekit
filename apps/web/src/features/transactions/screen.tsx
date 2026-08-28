'use client'

/** `/txns`: an account's transactions, by type, paged. */
import { useEffect, useState } from 'react'

import { useExplorer } from '../../explorer'
import { useScreenRecord } from '../../screen-record'
import { Button } from '../../primitives'
import { AddressPicker, useScreenAddress } from '../address-picker'
import { ScreenCard } from '../assets/screen'

const TYPES: ReadonlyArray<{ id: string | undefined; label: string }> = [
  { id: undefined, label: 'all' },
  { id: 'pay', label: 'payments' },
  { id: 'axfer', label: 'asset transfers' },
  { id: 'appl', label: 'app calls' },
]

export function TransactionsScreen() {
  const { host, live, openTarget, network } = useExplorer()
  const [address, setAddress] = useScreenAddress()
  const [txType, setTxType] = useState<string | undefined>(undefined)
  const record = useScreenRecord()
  const { run } = record
  useEffect(() => {
    if (!address || live === 'probing') return
    void run('transaction.list', () => host().searchTransactions({ address, ...(txType ? { txType } : {}) }))
  }, [address, host, live, run, txType])
  return (
    <section className="screen">
      <header className="screen-head">
        <span className="kicker">transactions</span>
        <span className="muted"> · {network}</span>
        <span className="screen-filters">
          {TYPES.map((type) => (
            <Button key={type.label} label={type.label} active={type.id === txType} onPress={() => setTxType(type.id)} />
          ))}
        </span>
      </header>
      <AddressPicker address={address} onChange={setAddress} noun="transactions" />
      {record.loading ? <p className="note">loading…</p> : null}
      {record.error ? <p className="note note-error">{record.error}</p> : null}
      <ScreenCard record={record} onOpen={openTarget} />
    </section>
  )
}
