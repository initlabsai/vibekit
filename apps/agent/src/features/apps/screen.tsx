'use client'

/** `/apps`: look an application up by id; the apps an account has opted into. */
import { useEffect, useState, type FormEvent } from 'react'

import { useExplorer } from '../../explorer'
import { Button } from '../../primitives'
import { useScreenRecord } from '../../screen-record'
import { AddressPicker, useScreenAddress } from '../address-picker'
import { ScreenCard } from '../assets/screen'

export function AppsScreen() {
  const { host, live, openTarget } = useExplorer()
  const [address, setAddress] = useScreenAddress()
  const [draft, setDraft] = useState('')
  const record = useScreenRecord()
  const { run } = record
  useEffect(() => {
    if (!address || live === 'probing') return
    void run('application.locals', () => host().lookupAccountAppStates(address))
  }, [address, host, live, run])
  const lookup = (event: FormEvent) => {
    event.preventDefault()
    const id = Number(draft.trim())
    if (!Number.isSafeInteger(id) || id < 0) return
    openTarget({ kind: 'application', applicationId: id })
    setDraft('')
  }
  return (
    <section className="screen">
      <AddressPicker address={address} onChange={setAddress} noun="applications" />
      <form className="picker-form" onSubmit={lookup}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="app id, e.g. 1002541853" aria-label="Application id"
          autoComplete="off" autoCorrect="off" spellCheck={false} data-1p-ignore data-lpignore="true" data-form-type="other" inputMode="numeric" />
        <Button type="submit" label="open app" />
      </form>
      {record.loading ? <p className="note">loading…</p> : null}
      {record.error ? <p className="note note-error">{record.error}</p> : null}
      <ScreenCard record={record} onOpen={openTarget} />
    </section>
  )
}
