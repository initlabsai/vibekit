'use client'

/** The transcript as DOM: the session nav, the feed of sections, and the composer. */
import { useState, type FormEvent, type ReactNode } from 'react'

import { CompanionFace, moodFor } from '../features/profile/companion'
import { Button } from '../primitives'
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
              <div key={item.id} className="note-agent">
                <CompanionFace
                  mood={moodFor(section, streamingSection === section.id && index === section.items.length - 1)}
                />
                <p className="note-agent-text">{item.text}</p>
              </div>
            ) : item.kind === 'note' ? (
              <p key={item.id} className={`note${item.tone === 'error' ? ' note-error' : ''}`}>
                {item.text}
              </p>
            ) : (
              <div key={item.id}>{renderBlock(item.block, section.id, item.id)}</div>
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
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (input.trim() === '') return
    onSubmit(input)
    setInput('')
  }
  return (
    <footer className="composer-wrap">
      <form className="composer" onSubmit={submit}>
        <span>›</span>
        <input
          autoFocus
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          aria-label="Explorer composer"
        />
        <Button type="submit" label="send" />
      </form>
      <div className="status-line" role="status" aria-live="polite">
        {status}
      </div>
    </footer>
  )
}
