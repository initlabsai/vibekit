/** Web results as numbered citations; a page as its title and a few lines. */
import type { WebPage, WebResults } from '@initlabs/vibekit/plugins/web'

import { ListCard } from '../../generic-cards.js'
import { Fact, Frame, Header, Hero, innerWidth } from '../../primitives.js'
import { COLORS, wrapLines } from '../../theme.js'

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function WebResultsCard({ data, width }: { data: WebResults; width: number }) {
  return (
    <ListCard
      kicker="WEB"
      chip="EXA"
      pill={String(data.results.length)}
      rows={data.results}
      keyOf={(r) => r.url}
      lead={(r) => ({ label: 'url', value: r.url, copy: r.url })}
      facts={(r, body) => (
        <>
          <Fact label="title" value={`${r.title} · ${domainOf(r.url)}`} width={body} />
          {r.highlights[0] ? <Fact label="says" value={r.highlights[0]} width={body} /> : null}
        </>
      )}
      width={width}
    />
  )
}

export function WebPageCard({ data, width }: { data: WebPage; width: number }) {
  const body = innerWidth(width)
  const lines = wrapLines(data.content.replace(/\s+/g, ' ').slice(0, 800), body).slice(0, 8)
  return (
    <Frame width={width}>
      <Header kicker="PAGE" chip="EXA" pill={domainOf(data.url).toUpperCase()} />
      <Hero value={data.title ?? domainOf(data.url)} copy={data.url} />
      <box marginTop={1} flexDirection="column">
        {lines.map((line, i) => (
          <text key={i} fg={COLORS.muted}>
            {line}
          </text>
        ))}
      </box>
    </Frame>
  )
}
