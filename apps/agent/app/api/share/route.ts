/**
 * POST a payload, get `{ url }`. The client is not trusted with the hash —
 * the server computes it after stripping, so the URL always describes what
 * the page and the poster will show.
 */
import { hashPayload, MAX_SHARE_BYTES, sharePayloadSchema, stripShareText, type SharePayload } from '../../../src/share'
import { ipOf, store } from '../credits/ledger'
import { writeShare } from './store'

const HOURLY_CAP = Number(process.env.SHARE_IP_HOURLY_CAP ?? 20)

export async function POST(request: Request): Promise<Response> {
  const used = await store.incrBy(`share:rate:${ipOf(request)}`, 1, 60 * 60)
  if (used > HOURLY_CAP)
    return Response.json(
      { error: "hmph. that's a lot of sharing for one hour. give it a minute." },
      { status: 429 },
    )
  const body = await request.text()
  if (Buffer.byteLength(body) > MAX_SHARE_BYTES)
    return Response.json({ error: 'that exchange is too big to share. one section at a time.' }, { status: 413 })
  let payload: SharePayload
  try {
    payload = sharePayloadSchema.parse(JSON.parse(body))
  } catch {
    return Response.json({ error: 'not a shareable exchange.' }, { status: 400 })
  }
  payload = { ...payload, prompt: stripShareText(payload.prompt), reply: stripShareText(payload.reply) }
  if (payload.prompt === '' || payload.reply === '')
    return Response.json({ error: 'not a shareable exchange.' }, { status: 400 })
  const hash = await hashPayload(payload)
  const outcome = await writeShare(hash, payload)
  if (outcome === 'conflict')
    return Response.json(
      { error: 'that link already names a different exchange. tweak a word and share again.' },
      { status: 409 },
    )
  return Response.json({ url: `/s/${hash}` })
}
