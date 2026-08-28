'use client'

/** Which account a screen is about: the connected wallet's, or one you paste. */
import algosdk from 'algosdk'
import { useEffect, useState, type FormEvent } from 'react'

import { useExplorer } from '../explorer'
import { Button, Copyable } from '../primitives'

/** The address a screen should show: the wallet's active account until one is pasted. */
export function useScreenAddress(): [string | undefined, (address: string | undefined) => void] {
  const { activeAddress } = useExplorer()
  const [pasted, setPasted] = useState<string | undefined>(undefined)
  return [pasted ?? activeAddress, setPasted]
}

export function AddressPicker({
  address,
  onChange,
  noun,
}: {
  address: string | undefined
  onChange: (address: string | undefined) => void
  noun: string
}) {
  const { activeAddress, wallet } = useExplorer()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  useEffect(() => setError(undefined), [address])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!algosdk.isValidAddress(value)) {
      setError('That is not a valid Algorand address.')
      return
    }
    onChange(value)
    setDraft('')
  }
  return (
    <div className="picker">
      {address ? (
        <p className="picker-current">
          <span className="kicker">{noun} of</span>{' '}
          <Copyable value={address} />
          {address === activeAddress ? (
            <span className="chip chip-ok">{wallet.activeName ?? 'connected wallet'}</span>
          ) : activeAddress ? (
            <Button label="back to my wallet" onPress={() => onChange(undefined)} />
          ) : null}
        </p>
      ) : (
        <p className="picker-current muted">No wallet connected — paste an address, or connect one on the wallet tab.</p>
      )}
      <form className="picker-form" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="paste another address…"
          aria-label={`Address whose ${noun} to show`}
          autoComplete="off" autoCorrect="off" spellCheck={false} data-1p-ignore data-lpignore="true" data-form-type="other"
        />
        <Button type="submit" label="show" />
      </form>
      {error ? <p className="note note-error">{error}</p> : null}
    </div>
  )
}
