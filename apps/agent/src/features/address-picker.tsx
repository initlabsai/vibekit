'use client'

/** Which account a screen is about: the connected wallet's, or one you paste. */
import algosdk from 'algosdk'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { useExplorer } from '../explorer'
import { Button, Copyable } from '../primitives'

/** The address a screen should show: the wallet's active account until one is pasted. */
export function useScreenAddress(): [string | undefined, (address: string | undefined) => void] {
  const { activeAddress } = useExplorer()
  const [pasted, setPasted] = useState<string | undefined>(undefined)
  return [pasted ?? activeAddress, setPasted]
}

/**
 * The header of an account-scoped screen: the kicker, the subject address,
 * a way back to the connected wallet when looking elsewhere, an optional
 * filter row, and the form that changes the subject.
 */
export function AddressPicker({
  address,
  onChange,
  noun,
  children,
}: {
  address: string | undefined
  onChange: (address: string | undefined) => void
  noun: string
  /** Filters for the list, as their own row under the title. */
  children?: ReactNode
}) {
  const { activeAddress } = useExplorer()
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
      <header className="screen-title">
        <span className="kicker">{noun}</span>
        {address ? (
          <>
            <Copyable value={address} width={18} />
            {activeAddress && address !== activeAddress ? <Button label="my wallet" onPress={() => onChange(undefined)} /> : null}
          </>
        ) : (
          <span className="muted">no wallet connected — connect one, or paste an address</span>
        )}
      </header>
      {children ? <div className="screen-filters">{children}</div> : null}
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
