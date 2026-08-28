'use client'

/** The transcript as DOM: the session nav, the feed of sections, and the composer. */
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'

import { CompanionFace, moodFor } from '../features/profile/companion'
import { matchCommands } from '../commands'
import { Button } from '../primitives'
import type { Section, SectionBlock } from './hooks'

export function plainAgentText(text: string): string {
  return text.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/`([^`\n]+)`/g, '$1')
}

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

export function FeedPane({
  sections,
  selectedId,
  renderBlock,
  empty,
  onToggle,
  streamingSection,
}: {
  sections: Section[]
  selectedId: number | null
  renderBlock: (block: SectionBlock, sectionId: number, itemId: number) => ReactNode
  empty: ReactNode
  /** The bar folds and unfolds its section. */
  onToggle: (id: number) => void
  /** The section the agent is still speaking into, if any. */
  streamingSection?: number | null
}) {
  return (
    <section className="feed">
      {sections.length === 0 ? empty : null}
      {sections.map((section) => (
        <article
          key={section.id}
          data-section={section.id}
          className={`section${section.id === selectedId ? ' on' : ''}${section.collapsed ? ' collapsed' : ''}`}
        >
          <button
            type="button"
            className="prompt-line"
            onClick={() => onToggle(section.id)}
            aria-expanded={!section.collapsed}
            title={section.collapsed ? 'expand' : 'collapse'}
          >
            {section.prompt}
            {section.collapsed ? (
              <span className="prompt-count">
                {section.items.filter((item) => item.kind === 'block').length || section.items.length} hidden
              </span>
            ) : null}
          </button>
          {section.collapsed ? null : section.items.map((item, index) =>
            item.kind === 'note' && item.tone === 'agent' ? (
              <div key={item.id} className={`note-agent${item.pending ? ' pending' : ''}`}>
                <CompanionFace
                  mood={moodFor(section, item, streamingSection === section.id && index === section.items.length - 1)}
                  seed={item.id}
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
                    <p className="note-agent-text">{plainAgentText(item.text)}</p>
                  )}
                </div>
              </div>
            ) : item.kind === 'note' ? (
              <p key={item.id} className={`note${item.tone === 'error' ? ' note-error' : ''}`}>
                {item.text}
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
  placeholder,
}: {
  onSubmit: (raw: string) => void
  status: string
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const [cursor, setCursor] = useState(0)
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
        <Button type="submit" label="send" />
      </form>
      <div className="status-line" role="status" aria-live="polite">
        {status}
      </div>
    </footer>
  )
}
