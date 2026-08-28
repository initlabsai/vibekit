'use client'

/** The DOM primitives every card and screen is built from: Frame, Header, Hero, Fact, Chip, Button, Copyable. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { useAssetMeta, useName, type Tier } from './enrich'
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
      {copy ? <Copyable value={copy} display={value} className="hero-value" /> : <span className="hero-value">{value}</span>}
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

/** Copies `value` on click and shows a brief signal check; `title` carries the full value. */
export function Copyable({
  value,
  display,
  width,
  className,
}: {
  value: string
  display?: string
  width?: number
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const announce = useContext(CopyContext)
  // An address wears its NFD name once the enrichment answers; the address still copies.
  const name = useName(ADDRESS.test(value) ? value : undefined)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(id)
  }, [copied])
  const shown = display ?? value
  const text = width ? shorten(shown, width) : shown
  return (
    <button
      type="button"
      className={`ident${copied ? ' ident-copied' : ''}${className ? ` ${className}` : ''}`}
      title={value}
      onClick={(event) => {
        event.stopPropagation()
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          announce(value)
        })
      }}
    >
      {name ? (
        <>
          <span className="ident-name">{name}</span>
          <span className="ident-sub">{display && display !== value ? text : shorten(value, 12)}</span>
        </>
      ) : (
        text
      )}
    </button>
  )
}

/** Labeled fact row: muted key, value. Pass `copy` for a clickable identifier. */
export function Fact({
  label,
  value,
  copy,
  tone,
  children,
}: {
  label: string
  value?: string
  copy?: string
  tone?: 'danger' | 'ok'
  children?: ReactNode
}) {
  return (
    <div className={`fact${tone ? ` fact-${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>{children ?? (copy ? <Copyable value={copy} display={value} /> : value)}</dd>
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
  const meta = useAssetMeta(assetId)
  const label = name ?? meta?.name ?? unitName ?? meta?.unitName ?? `asset ${assetId}`
  return (
    <span className="asset-mark">
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
