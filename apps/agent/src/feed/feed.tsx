'use client'

/** The transcript as DOM: the session nav, the feed of sections, and the composer. */
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'

import { CompanionFace, moodFor } from '../features/profile/companion'
import { matchCommands } from '../commands'
import { Button, Copyable } from '../primitives'
import { stripShareText } from '../share'
import { plainAgentText } from '../theme'
import type { Section, SectionBlock } from './hooks'

export function NavPane({
  sections,
  selectedId,
  onSelect,
  open,
  onToggle,
  children,
}: {
  sections: Section[]
  selectedId: number | null
  onSelect: (id: number) => void
  open: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  // Folded: a slim bar with the arrow and one tick per request; click a tick to jump.
  if (!open) {
    return (
      <aside className="nav nav-mini" aria-label="Session, folded">
        <button type="button" className="rail-arrow" onClick={onToggle} title="open the session">
          ▸
        </button>
        <span className="nav-mini-ticks" aria-hidden="true">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`nav-tick${section.id === selectedId ? ' on' : ''}`}
              title={section.prompt}
              onClick={() => onSelect(section.id)}
            />
          ))}
        </span>
      </aside>
    )
  }
  return (
    <aside className="nav">
      <span className="nav-title">
        <span className="kicker">session</span>
        <button type="button" className="rail-arrow" onClick={onToggle} title="fold the session">
          ◂
        </button>
      </span>
      {sections.length === 0 ? <span className="nav-item nav-empty">nothing yet</span> : null}
      {sections.map((section) => (
        <button
          key={section.id}
          className={`nav-item${section.id === selectedId ? ' on' : ''}`}
          onClick={() => onSelect(section.id)}
          title={section.prompt}
        >
          {section.prompt}
        </button>
      ))}
      {children}
    </aside>
  )
}

/** The section and item ids of her most recent line, if any. */
export function latestAgentNote(sections: ReadonlyArray<Section>): { sectionId: number; itemId: number } | undefined {
  for (let s = sections.length - 1; s >= 0; s--) {
    const section = sections[s]!
    for (let i = section.items.length - 1; i >= 0; i--) {
      const item = section.items[i]!
      if (item.kind === 'note' && item.tone === 'agent') return { sectionId: section.id, itemId: item.id }
    }
  }
  return undefined
}

/** A word in the touchable color, like every button; it says so itself when the link is on the clipboard. */
function ShareButton({ disabled, onShare }: { disabled: boolean; onShare: () => Promise<boolean> }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(id)
  }, [copied])
  return (
    <button
      type="button"
      className={`share-button${copied ? ' copied' : ''}`}
      disabled={disabled}
      onClick={() => void onShare().then((ok) => setCopied(ok))}
      title="copy a share link for this exchange"
    >
      {copied ? '✓ copied' : 'share'}
    </button>
  )
}

export function FeedPane({
  sections,
  selectedId,
  renderBlock,
  empty,
  onToggle,
  streamingSection,
  onShare,
}: {
  sections: Section[]
  selectedId: number | null
  renderBlock: (block: SectionBlock, sectionId: number, itemId: number) => ReactNode
  empty: ReactNode
  /** The bar folds and unfolds its section. */
  onToggle: (id: number) => void
  /** The section the agent is still speaking into, if any. */
  streamingSection?: number | null
  /** Turns the exchange into a URL; resolves true when the link reached the clipboard. */
  onShare?: (section: Section) => Promise<boolean>
}) {
  // Only her newest line wears a live face; every earlier one is a still.
  const latest = latestAgentNote(sections)
  return (
    <section className="feed">
      {sections.length === 0 ? empty : null}
      {sections.map((section) => (
        <article
          key={section.id}
          data-section={section.id}
          className={`section${section.id === selectedId ? ' on' : ''}${section.collapsed ? ' collapsed' : ''}`}
        >
          <div className="prompt-row">
            <button
              type="button"
              className="prompt-line"
              onClick={() => onToggle(section.id)}
              aria-expanded={!section.collapsed}
              title={section.collapsed ? 'expand' : 'collapse'}
            >
              <span className="prompt-text">{section.prompt}</span>
              <span className={`prompt-net net-${section.network}`}>{section.network}</span>
              {section.collapsed ? (
                <span className="prompt-count">
                  {section.items.filter((item) => item.kind === 'block').length || section.items.length} hidden
                </span>
              ) : null}
            </button>
            {onShare && section.items.some((item) => item.kind === 'note' && item.tone === 'agent') ? (
              <ShareButton
                disabled={streamingSection === section.id}
                onShare={() => onShare(section)}
              />
            ) : null}
          </div>
          {section.collapsed ? null : section.items.map((item, index) =>
            item.kind === 'note' && item.tone === 'agent' ? (
              <div key={item.id} className={`note-agent${item.pending ? ' pending' : ''}`}>
                <CompanionFace
                  mood={moodFor(section, item, streamingSection === section.id && index === section.items.length - 1)}
                  step={item.id}
                  still={!(latest?.sectionId === section.id && latest.itemId === item.id)}
                />
                <div className="note-agent-body">
                  {item.pending ? (
                    <p className="note-agent-pending">
                      {item.text.replace(/…$/, '')}
                      <span className="dots" aria-hidden="true">
                        <i>·</i>
                        <i>·</i>
                        <i>·</i>
                      </span>
                    </p>
                  ) : (
                    <p className="note-agent-text">
                      {plainAgentText(item.text)}
                      {item.copy ? <> <Copyable value={item.copy} width={20} open={false} /></> : null}
                    </p>
                  )}
                </div>
              </div>
            ) : item.kind === 'note' ? (
              <p key={item.id} className={`note${item.tone === 'error' ? ' note-error' : ''}`}>
                {item.text}
                {item.copy ? <> <Copyable value={item.copy} width={20} open={false} /></> : null}
              </p>
            ) : (
              <div key={item.id} className="block">
                {renderBlock(item.block, section.id, item.id)}
              </div>
            ),
          )}
        </article>
      ))}
    </section>
  )
}

export function Composer({
  onSubmit,
  status,
  idle,
  placeholder,
}: {
  onSubmit: (raw: string) => void
  /** Something happening now: a copy, an error, sample data. Shown wherever there is room. */
  status: string
  /** The standing line — turns and the offer. Phones keep it in the sheet instead. */
  idle: string
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const [cursor, setCursor] = useState(0)
  // A share page's "ask her yourself" arrives as ?ask=…; the question waits, it is never submitted.
  useEffect(() => {
    const ask = new URLSearchParams(window.location.search).get('ask')
    if (ask) setInput(stripShareText(ask).slice(0, 400))
  }, [])
  const matches = matchCommands(input)
  const active = matches[Math.min(cursor, matches.length - 1)]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (input.trim() === '') return
    onSubmit(input)
    setInput('')
  }
  /** Enter on a listed command runs it, or fills its template and keeps typing. */
  const pick = (command: (typeof matches)[number]) => {
    if (command.template) {
      setInput(command.template)
      return
    }
    onSubmit(`/${command.name}`)
    setInput('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((current) => (current + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length)
    } else if ((event.key === 'Enter' || event.key === 'Tab') && active) {
      event.preventDefault()
      pick(active)
    } else if (event.key === 'Escape') {
      setInput('')
    }
  }
  return (
    <footer className="composer-wrap">
      {matches.length > 0 ? (
        <ul className="palette" role="listbox" aria-label="Commands">
          {matches.map((command) => (
            <li
              key={command.name}
              role="option"
              aria-selected={command === active}
              className={command === active ? 'on' : undefined}
              ref={command === active ? (node) => node?.scrollIntoView({ block: 'nearest' }) : undefined}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(command)
              }}
            >
              <span className="palette-name">/{command.name}</span>
              <span className="palette-hint">{command.hint}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={`status-line${status ? '' : ' status-idle'}`} role="status" aria-live="polite">
        {status || idle}
      </div>
      <form className="composer" onSubmit={submit}>
        <span>›</span>
        <input
          autoFocus
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setCursor(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Explorer composer"
          aria-expanded={matches.length > 0}
          autoComplete="off" autoCorrect="off" spellCheck={false} data-1p-ignore data-lpignore="true" data-form-type="other"
        />
        <button type="submit" className="button send-button" aria-label="send">↑</button>
      </form>
    </footer>
  )
}
