'use client'

/** The transcript as DOM: the session nav, the feed of sections, and the composer. */
import { useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '../primitives'
import type { Section, SectionBlock } from './hooks'

export function NavPane({
  sections,
  selectedId,
  onSelect,
  children,
}: {
  sections: Section[]
  selectedId: number | null
  onSelect: (id: number) => void
  children?: ReactNode
}) {
  return (
    <aside className="nav">
      <span className="kicker">session</span>
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
}: {
  sections: Section[]
  selectedId: number | null
  renderBlock: (block: SectionBlock, sectionId: number, itemId: number) => ReactNode
  empty: ReactNode
}) {
  return (
    <section className="feed">
      {sections.length === 0 ? empty : null}
      {sections.map((section) => (
        <article
          key={section.id}
          data-section={section.id}
          className={`section${section.id === selectedId ? ' on' : ''}`}
        >
          <p className="prompt-line">{section.prompt}</p>
          {section.items.map((item) =>
            item.kind === 'note' ? (
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
