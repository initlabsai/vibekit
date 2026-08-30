'use client'

/** The web as citations: numbered results with their matching passages, and one page folded under its title. */
import { useState } from 'react'
import type { WebPage, WebResults } from '@initlabs/vibekit/views'

import { Button, FooterNote, Frame, Header } from '../../primitives'
import { safeHref } from '../../theme'

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function dateOf(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? undefined
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function WebResultsCard({
  data,
  onRead,
}: {
  data: WebResults
  onRead?: (url: string) => void
}) {
  return (
    <Frame>
      <Header kicker="WEB" chip="EXA" pill={String(data.results.length)} tone="idle" />
      <p className="web-query">“{data.query}”</p>
      {data.results.length === 0 ? (
        <FooterNote text="Nothing found." />
      ) : (
        <ol className="web-results">
          {data.results.map((r, i) => {
            const href = safeHref(r.url)
            return (
            <li key={r.url} className="web-result">
              <p className="web-result-line">
                <span className="web-index">{i + 1}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="web-title">
                    {r.title}
                  </a>
                ) : (
                  <span className="web-title">{r.title}</span>
                )}
                <span className="web-meta">
                  {domainOf(r.url)}
                  {dateOf(r.published) ? ` · ${dateOf(r.published)}` : ''}
                </span>
                {onRead ? <Button label="read" onPress={() => onRead(r.url)} /> : null}
              </p>
              {r.highlights.slice(0, 2).map((h, j) => (
                <p key={j} className="web-highlight">
                  {h}
                </p>
              ))}
            </li>
            )
          })}
        </ol>
      )}
    </Frame>
  )
}

export function WebPageCard({ data }: { data: WebPage }) {
  const [open, setOpen] = useState(false)
  const excerpt = data.content.slice(0, 600)
  const href = safeHref(data.url)
  return (
    <Frame>
      <Header
        kicker="PAGE"
        chip="EXA"
        pill={domainOf(data.url).toUpperCase()}
        tone="idle"
        action={
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className="button">
              open ↗
            </a>
          ) : undefined
        }
      />
      <p className="hero">
        <span className="hero-value">{data.title ?? domainOf(data.url)}</span>
      </p>
      <pre className="web-page">{open ? data.content : excerpt}</pre>
      {data.content.length > excerpt.length ? (
        <p className="web-more">
          <Button
            label={open ? 'less' : `more (${Math.round(data.content.length / 1000)}k chars)`}
            onPress={() => setOpen((v) => !v)}
          />
          {data.truncated ? <span className="muted"> · page was cut at 12k</span> : null}
        </p>
      ) : null}
    </Frame>
  )
}
