/**
 * A shared exchange as a static page: the question, her line marked as
 * shared, the evidence, and one button into the Explorer with the question
 * waiting in the composer. Nothing here enters a visitor's session — the
 * visitor who wants the answer asks her live.
 */
import type { Metadata } from 'next'

import { ShareEvidence } from '../../../src/share-evidence'
import type { SharePayload } from '../../../src/share'
import { readShare } from '../../api/share/store'

const HASH = /^[0-9a-f]{12}$/

async function payloadOf(params: Promise<{ hash: string }>): Promise<SharePayload | undefined> {
  const { hash } = await params
  return HASH.test(hash) ? readShare(hash) : undefined
}

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }): Promise<Metadata> {
  const payload = await payloadOf(params)
  if (!payload) return { title: 'VibeKit Agent — shared exchange' }
  const title = payload.prompt.length > 70 ? `${payload.prompt.slice(0, 69)}…` : payload.prompt
  const description = payload.reply.length > 200 ? `${payload.reply.slice(0, 199)}…` : payload.reply
  return {
    title: `qt314 — ${title}`,
    description,
    openGraph: { title, description, siteName: 'VibeKit Agent', type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function SharePage({ params }: { params: Promise<{ hash: string }> }) {
  const payload = await payloadOf(params)
  if (!payload)
    return (
      <main className="share-page">
        <p className="share-brand">◆ VIBEKIT <b>AGENT</b></p>
        <h1 className="share-prompt">this link has expired.</h1>
        <p className="muted">shares live for 90 days. the exchange it named is gone; she is not.</p>
        <p><a className="button button-primary" href="/">open the explorer →</a></p>
      </main>
    )
  const ask = `/?ask=${encodeURIComponent(payload.prompt.slice(0, 400))}`
  return (
    <main className="share-page">
      <p className="share-brand">◆ VIBEKIT <b>AGENT</b></p>
      <h1 className="share-prompt">
        › {payload.prompt}
        <span className={`prompt-net net-${payload.network}`}>{payload.network}</span>
      </h1>
      <div className="note-agent share-note">
        <span className="share-face" aria-hidden>(^‿^)</span>
        <div className="note-agent-body">
          <p className="note-agent-text">{payload.reply}</p>
          <p className="share-marker">a shared exchange — she has not said this to you.</p>
        </div>
      </div>
      <ShareEvidence blocks={payload.blocks} />
      <p className="share-ask">
        <a className="button button-primary" href={ask}>ask her yourself →</a>
        <span className="muted"> the question will be waiting in the composer; she answers live.</span>
      </p>
    </main>
  )
}
