'use client'

/** The DOM primitives every card and screen is built from: Frame, Header, Hero, Fact, Chip, Button, Copyable. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { useAssetMeta, useName, useOnScreen, useProfile, type Tier } from './enrich'
import type { OpenTarget } from './result-card'
import { shorten } from './theme'

/** Where a copy is announced (the status line); no-op without a provider. */
export const CopyContext = createContext<(text: string) => void>(() => undefined)

const ADDRESS = /^[A-Z2-7]{58}$/

/** Status color for pills and accents: ok is alive (teal), bad is a wrong fact (bright amber), danger is the only red. */
export type Tone = 'ok' | 'warn' | 'bad' | 'danger' | 'idle'

/** The surface every result card sits on. `danger` frames it in red. */
export function Frame({
  children,
  tone,
  className,
}: {
  children: ReactNode
  tone?: 'danger'
  className?: string
}) {
  return (
    <section className={['card', tone === 'danger' ? 'card-danger' : '', className ?? ''].join(' ')}>
      {children}
    </section>
  )
}

/** A type tag beside a kicker: bare muted text. */
export function Chip({ label, tone }: { label: string; tone?: Tone }) {
  return <span className={`chip${tone ? ` chip-${tone}` : ''}`}>{label}</span>
}

/** Status badge: confirmed, failed, awaiting, and so on. */
export function Pill({ label, tone = 'idle' }: { label: string; tone?: Tone }) {
  return <span className={`pill pill-${tone}`}>{label}</span>
}

/** Card masthead: brass kicker, optional type chip, optional status pill, optional card-local control. */
export function Header({
  kicker,
  chip,
  pill,
  tone,
  action,
}: {
  kicker: string
  chip?: string
  pill?: string
  tone?: Tone
  action?: ReactNode
}) {
  return (
    <header className="card-header">
      <span>
        <span className="kicker">{kicker}</span>
        {chip ? <Chip label={chip} /> : null}
      </span>
      <span className="card-header-end">
        {action}
        {pill ? <Pill label={pill} tone={tone} /> : null}
      </span>
    </header>
  )
}

/** Large primary figure — amount, round, asset name — with a muted unit. */
export function Hero({ value, unit, copy }: { value: string; unit?: string; copy?: string }) {
  return (
    <p className="hero">
      {copy ? <Copyable value={copy} display={value} className="hero-value" open={false} /> : <span className="hero-value">{value}</span>}
      {unit ? <span className="hero-unit">{unit}</span> : null}
    </p>
  )
}

/** A button is a word in the touchable color; `primary` fills it brass, `danger` red. */
export function Button({
  label,
  onPress,
  active = false,
  disabled = false,
  variant,
  type = 'button',
}: {
  label: string
  onPress?: () => void
  active?: boolean
  disabled?: boolean
  variant?: 'primary' | 'danger'
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      className={['button', active ? 'button-active' : '', variant ? `button-${variant}` : ''].join(' ')}
      disabled={disabled}
      onClick={onPress}
    >
      {label}
    </button>
  )
}

/** True inside a clickable table row: the row is the one target, so identifiers in it are inert. */
export const InertContext = createContext(false)

/** Where an identifier opens (the transcript); no-op without a provider. */
export const OpenContext = createContext<((target: OpenTarget) => void) | undefined>(undefined)

const TXID = /^[A-Z2-7]{52}$/

/** The open target an identifier implies by its shape: an address or a transaction id. Numbers are ambiguous. */
function impliedTarget(value: string): OpenTarget | undefined {
  if (ADDRESS.test(value)) return { kind: 'account', address: value }
  if (TXID.test(value)) return { kind: 'transaction', txid: value }
  return undefined
}

/**
 * An identifier: the text opens it — an account or transaction by shape, or
 * the `open` given — and a separate glyph button beside it copies. Without a
 * target (`open={false}`, or a bare number) the text is plain; the glyph stays.
 */
export function Copyable({
  value,
  display,
  width,
  className,
  open,
}: {
  value: string
  display?: string
  width?: number
  className?: string
  open?: OpenTarget | false
}) {
  const [copied, setCopied] = useState(false)
  const announce = useContext(CopyContext)
  const openTarget = useContext(OpenContext)
  const inert = useContext(InertContext)
  // An address wears its NFD name once the enrichment answers; the address still copies.
  const name = useName(ADDRESS.test(value) ? value : undefined)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(id)
  }, [copied])
  const shown = display ?? value
  const text = width ? shorten(shown, width) : shown
  const target = open === false ? undefined : (open ?? impliedTarget(value))
  const label = name ? (
    <>
      <span className="ident-name">{name}</span>
      <span className="ident-sub">{display && display !== value ? text : shorten(value, 12)}</span>
    </>
  ) : (
    text
  )
  if (inert) {
    return (
      <span className={`ident ident-inert${className ? ` ${className}` : ''}`} title={value}>
        <span className="plain">{label}</span>
      </span>
    )
  }
  return (
    <span className={`ident${className ? ` ${className}` : ''}`} title={value}>
      {target && openTarget ? (
        <button
          type="button"
          className="open"
          onClick={(event) => {
            event.stopPropagation()
            openTarget(target)
          }}
        >
          {label}
        </button>
      ) : (
        <span className="plain">{label}</span>
      )}
      <button
        type="button"
        className={`copy${copied ? ' copied' : ''}`}
        aria-label={`Copy ${value}`}
        onClick={(event) => {
          event.stopPropagation()
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true)
            announce(value)
          })
        }}
      >
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  )
}

/** Labeled fact row: muted key, value. Pass `copy` for a clickable identifier. */
export function Fact({
  label,
  value,
  copy,
  open,
  tone,
  children,
}: {
  label: string
  value?: string
  copy?: string
  /** Where the identifier opens when its shape does not say. */
  open?: OpenTarget | false
  tone?: 'danger' | 'ok'
  children?: ReactNode
}) {
  return (
    <div className={`fact${tone ? ` fact-${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>{children ?? (copy ? <Copyable value={copy} display={value} open={open} /> : value)}</dd>
    </div>
  )
}

/** The facts list a card's rows sit in. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="facts">{children}</dl>
}

export function FooterNote({ text }: { text: string }) {
  return <p className="footnote">{text}</p>
}

export function Unavailable({ title, message }: { title: string; message?: string }) {
  return (
    <Frame>
      <Header kicker={title} pill="UNAVAILABLE" tone="bad" />
      <p className="muted">{message ?? 'The record could not be derived.'}</p>
    </Frame>
  )
}

const TIER_LABEL: Record<Tier, string> = {
  trusted: 'trusted',
  verified: 'verified',
  unverified: 'unverified',
  suspicious: 'suspicious',
}

/** Pera's verification tier as a small mark; suspicious is the one red. */
export function TierBadge({ tier }: { tier: Tier | undefined }) {
  if (!tier || tier === 'unverified') return null
  return (
    <span className={`tier tier-${tier}`} title={`Pera: ${TIER_LABEL[tier]}`}>
      {tier === 'suspicious' ? '!' : '✓'}
    </span>
  )
}

/** An asset's name with its logo and tier when Pera knows it. */
export function AssetMark({
  assetId,
  name,
  unitName,
}: {
  assetId: number | string
  name?: string
  unitName?: string
}) {
  const [ref, seen] = useOnScreen<HTMLSpanElement>()
  const meta = useAssetMeta(assetId, seen)
  const label = name ?? meta?.name ?? unitName ?? meta?.unitName ?? `asset ${assetId}`
  return (
    <span className="asset-mark" ref={ref}>
      {meta?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="asset-logo" src={meta.logoUrl} alt="" width={18} height={18} loading="lazy" />
      ) : (
        <span className="asset-logo asset-logo-empty" aria-hidden="true">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="asset-name">{label}</span>
      <TierBadge tier={meta?.tier} />
    </span>
  )
}

/** The round mark for an account: its NFD avatar, or two letters of its name or address. */
export function Avatar({ address, size = 44 }: { address: string; size?: number }) {
  const profile = useProfile(address)
  const style = { width: size, height: size }
  return profile?.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="identity-avatar" src={profile.avatar} alt="" width={size} height={size} style={style} />
  ) : (
    <span className="identity-avatar identity-avatar-empty" aria-hidden="true" style={style}>
      {(profile?.name ?? address).slice(0, 2)}
    </span>
  )
}

/** An account's face: NFD avatar and name over the address, when it has one. */
export function Identity({ address, open }: { address: string; open?: false }) {
  const profile = useProfile(address)
  return (
    <span className="identity">
      <Avatar address={address} />
      <span className="identity-text">
        {profile?.name ? <span className="identity-name">{profile.name}</span> : null}
        <Copyable value={address} display={shorten(address, 22)} open={open} />
      </span>
    </span>
  )
}
